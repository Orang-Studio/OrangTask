#pragma once

#include <QJSValue>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QObject>
#include <QPointer>
#include <functional>
#include <memory>
#include <utility>

class TokenStore;

struct ApiResult
{
    int status = 0;                // HTTP status, 0 when the request never reached the server
    QJsonDocument json;
    QString rawError;              // Qt network error text

    bool ok() const { return status >= 200 && status < 300; }
    bool networkError() const { return status == 0; }
    // worth retrying later offline queue semantics
    bool transient() const { return status == 0 || status == 429 || status >= 500; }
    QJsonObject object() const { return json.object(); }
    QString errorMessage() const;
};

using ApiCallback = std::function<void(const ApiResult &)>;

struct ApiRequestOptions
{
    bool auth = true;
    QByteArray bearer;              // explicit token (refresh/logout), skips the 401 dance
};

class ApiClient : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString baseUrl READ baseUrl CONSTANT)

public:
    using Options = ApiRequestOptions;

    ApiClient(const QString &baseUrl, TokenStore *tokens, QObject *parent = nullptr);

    QString baseUrl() const { return m_baseUrl; }
    QUrl url(const QString &path) const;

    void request(const QByteArray &method, const QString &path, const QJsonValue &body = {},
                 ApiCallback cb = {}, Options opts = Options());
    void get(const QString &path, ApiCallback cb) { request("GET", path, {}, std::move(cb)); }

    void getAll(const QString &path, const QString &key, std::function<void(bool ok, const QJsonArray &, const ApiResult &)> cb);

    Q_INVOKABLE void call(const QString &method, const QString &path, const QJsonValue &body, const QJSValue &callback);

    void fetchImage(const QUrl &url, std::function<void(const QString &localUrl)> cb);

    QNetworkAccessManager *nam() { return &m_nam; }

signals:
    void sessionExpired();
    void reachabilityChanged(bool online);

private:
    struct Pending
    {
        QByteArray method;
        QString path;
        QJsonValue body;
        ApiCallback cb;
        Options opts;
    };

    void send(const Pending &p, bool isRetry);
    void refreshAndReplay(const Pending &p);
    void setOnline(bool online);

    QString m_baseUrl;
    TokenStore *m_tokens;
    QNetworkAccessManager m_nam;
    bool m_refreshing = false;
    QList<Pending> m_waitingForRefresh;
    bool m_online = true;
};
