#include "ApiClient.h"
#include "TokenStore.h"

#include <QCryptographicHash>
#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJSEngine>
#include <QNetworkReply>
#include <QStandardPaths>
#include <QUrlQuery>

QString ApiResult::errorMessage() const
{
    const QString err = json.object().value(QStringLiteral("error")).toString();
    if (!err.isEmpty())
        return err;
    if (status == 0)
        return rawError.isEmpty() ? QStringLiteral("Network error") : rawError;
    return QStringLiteral("Request failed (%1)").arg(status);
}

ApiClient::ApiClient(const QString &baseUrl, TokenStore *tokens, QObject *parent)
    : QObject(parent)
    , m_baseUrl(baseUrl)
    , m_tokens(tokens)
{
    m_nam.setTransferTimeout(20000);
}

QUrl ApiClient::url(const QString &path) const
{
    return QUrl(m_baseUrl + path);
}

void ApiClient::request(const QByteArray &method, const QString &path, const QJsonValue &body,
                        ApiCallback cb, Options opts)
{
    send(Pending{method, path, body, std::move(cb), opts}, false);
}

void ApiClient::send(const Pending &p, bool isRetry)
{
    QNetworkRequest req(url(p.path));
    req.setRawHeader("X-Platform", "desktop");
    req.setRawHeader("Accept", "application/json");
    req.setHeader(QNetworkRequest::UserAgentHeader,
                  QStringLiteral("OrangTask-Desktop/%1").arg(QStringLiteral(ORANGTASK_VERSION)));
    if (!p.opts.bearer.isEmpty())
        req.setRawHeader("Authorization", "Bearer " + p.opts.bearer);
    else if (p.opts.auth && !m_tokens->accessToken().isEmpty())
        req.setRawHeader("Authorization", "Bearer " + m_tokens->accessToken().toUtf8());

    QByteArray payload;
    const bool hasBody = !p.body.isUndefined() && !p.body.isNull();
    if (hasBody) {
        req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
        payload = p.body.isArray() ? QJsonDocument(p.body.toArray()).toJson(QJsonDocument::Compact)
                                   : QJsonDocument(p.body.toObject()).toJson(QJsonDocument::Compact);
    }

    QNetworkReply *reply = hasBody || p.method == "POST" || p.method == "PUT" || p.method == "PATCH"
        ? m_nam.sendCustomRequest(req, p.method, payload)
        : m_nam.sendCustomRequest(req, p.method);

    connect(reply, &QNetworkReply::finished, this, [this, reply, p, isRetry]() {
        reply->deleteLater();
        ApiResult r;
        r.status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QByteArray data = reply->readAll();
        if (!data.isEmpty())
            r.json = QJsonDocument::fromJson(data);
        if (r.status == 0) {
            r.rawError = reply->errorString();
            setOnline(false);
        } else {
            setOnline(true);
        }

        const bool canRefresh = r.status == 401 && p.opts.auth && p.opts.bearer.isEmpty() && !isRetry
            && !m_tokens->refreshToken().isEmpty();
        if (canRefresh) {
            refreshAndReplay(p);
            return;
        }
        if (p.cb)
            p.cb(r);
    });
}

// concurrent 401s share a single refresh everything waiting replays afterwards
void ApiClient::refreshAndReplay(const Pending &p)
{
    m_waitingForRefresh.append(p);
    if (m_refreshing)
        return;
    m_refreshing = true;

    Options opts;
    opts.auth = false;
    opts.bearer = m_tokens->refreshToken().toUtf8();
    request("POST", QStringLiteral("/api/auth/refresh"), QJsonObject(), [this](const ApiResult &r) {
        m_refreshing = false;
        const QList<Pending> waiting = std::exchange(m_waitingForRefresh, {});
        const QString access = r.object().value(QStringLiteral("access_token")).toString();
        if (r.ok() && !access.isEmpty()) {
            m_tokens->setAccessToken(access);
            for (const Pending &w : waiting)
                send(w, true);
            return;
        }
        if (r.status == 401 || r.status == 403)
            emit sessionExpired();
        ApiResult failed = r;
        if (r.ok())
            failed.status = 401;
        for (const Pending &w : waiting) {
            if (w.cb)
                w.cb(failed);
        }
    }, opts);
}

void ApiClient::getAll(const QString &path, const QString &key,
                       std::function<void(bool, const QJsonArray &, const ApiResult &)> cb)
{
    auto acc = std::make_shared<QJsonArray>();
    auto step = std::make_shared<std::function<void(int)>>();
    *step = [this, path, key, cb, acc, step](int offset) {
        QString p = path;
        p += path.contains(QLatin1Char('?')) ? QLatin1Char('&') : QLatin1Char('?');
        p += QStringLiteral("limit=200&offset=%1").arg(offset);
        get(p, [cb, acc, step, key](const ApiResult &r) {
            if (!r.ok()) {
                cb(false, *acc, r);
                *step = nullptr;
                return;
            }
            const QJsonObject o = r.object();
            for (const QJsonValue &v : o.value(key).toArray())
                acc->append(v);
            const QJsonValue next = o.value(QStringLiteral("nextOffset"));
            if (next.isDouble() && next.toInt() > 0) {
                (*step)(next.toInt());
            } else {
                cb(true, *acc, r);
                *step = nullptr;
            }
        });
    };
    (*step)(0);
}

void ApiClient::call(const QString &method, const QString &path, const QJsonValue &body, const QJSValue &callback)
{
    QJSValue cb = callback;
    request(method.toUpper().toLatin1(), path, body, [this, cb](const ApiResult &r) mutable {
        if (!cb.isCallable())
            return;
        QJSEngine *engine = qjsEngine(this);
        QJSValue json = engine ? engine->toScriptValue(r.json.isArray() ? QVariant(r.json.array().toVariantList())
                                                                        : QVariant(r.json.object().toVariantMap()))
                               : QJSValue();
        if (!r.ok() && engine)
            json.setProperty(QStringLiteral("error"), r.errorMessage());
        cb.call({QJSValue(r.ok()), QJSValue(r.status), json});
    });
}

void ApiClient::fetchImage(const QUrl &src, std::function<void(const QString &)> cb)
{
    if (!src.isValid() || src.scheme().isEmpty()) {
        cb(QString());
        return;
    }
    const QString dir = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation) + QStringLiteral("/avatars");
    QDir().mkpath(dir);
    const QString file = dir + QLatin1Char('/')
        + QString::fromLatin1(QCryptographicHash::hash(src.toEncoded(), QCryptographicHash::Sha1).toHex());
    if (QFile::exists(file)) {
        cb(QUrl::fromLocalFile(file).toString());
        return;
    }
    QNetworkReply *reply = m_nam.get(QNetworkRequest(src));
    connect(reply, &QNetworkReply::finished, this, [reply, file, cb]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            cb(QString());
            return;
        }
        QFile f(file);
        if (f.open(QIODevice::WriteOnly)) {
            f.write(reply->readAll());
            f.close();
            cb(QUrl::fromLocalFile(file).toString());
        } else {
            cb(QString());
        }
    });
}

void ApiClient::setOnline(bool online)
{
    if (online == m_online)
        return;
    m_online = online;
    emit reachabilityChanged(online);
}
