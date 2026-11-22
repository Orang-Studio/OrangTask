#include "AuthManager.h"

#include "ApiClient.h"
#include "I18n.h"
#include "Settings.h"
#include "TokenStore.h"

#include <QDesktopServices>
#include <QJsonArray>
#include <QUrlQuery>

AuthManager::AuthManager(ApiClient *api, TokenStore *tokens, Settings *settings, QObject *parent)
    : QObject(parent)
    , m_api(api)
    , m_tokens(tokens)
    , m_settings(settings)
{
    connect(m_api, &ApiClient::sessionExpired, this, [this]() {
        if (m_state == LoggedOut)
            return;
        clearLocalSession();
        setError(tr_("desktop.auth.sessionExpired"));
    });
}

void AuthManager::start()
{
    m_tokens->load();
    if (!m_tokens->hasSession()) {
        setState(LoggedOut);
        return;
    }
    const QVariantMap cached = m_settings->value(QStringLiteral("auth/user")).toMap();
    const bool cachedPin = m_settings->value(QStringLiteral("auth/pinEnabled"), false).toBool();
    if (!cached.isEmpty()) {
        setUser(cached);
        setState(cachedPin ? NeedsPin : LoggedIn);
    }
    refreshMe();
}

void AuthManager::refreshMe()
{
    if (!m_tokens->hasSession())
        return;
    m_api->get(QStringLiteral("/api/auth/me"), [this](const ApiResult &r) {
        if (r.ok()) {
            const QJsonObject o = r.object();
            QVariantMap u = o.value(QStringLiteral("user")).toObject().toVariantMap();
            const bool pin = u.value(QStringLiteral("pin_enabled")).toBool();
            setUser(u);
            m_settings->setValue(QStringLiteral("auth/pinEnabled"), pin);
            // the PIN is a local gate once unlocked in this run stay unlocked
            if (m_state != LoggedIn)
                setState(o.value(QStringLiteral("requires_pin")).toBool() || (pin && m_state == NeedsPin) ? NeedsPin : LoggedIn);
            return;
        }
        if (r.status == 401 || r.status == 403) {
            clearLocalSession();
            return;
        }
        // offline or server hiccup keep the cached session if we had one
        if (m_state == Unknown)
            setState(m_user.isEmpty() ? LoggedOut : LoggedIn);
    });
}

void AuthManager::login(const QString &email, const QString &password)
{
    if (email.trimmed().isEmpty() || password.isEmpty()) {
        setError(tr_("desktop.auth.missingFields"));
        return;
    }
    m_pendingEmail = email.trimmed();
    m_pendingPassword = password;
    QJsonObject body{{QStringLiteral("email"), m_pendingEmail}, {QStringLiteral("password"), password}};
    if (!m_captchaToken.isEmpty())
        body.insert(QStringLiteral("recaptcha_token"), m_captchaToken);
    setBusy(true);
    setError({});
    m_api->request("POST", QStringLiteral("/api/auth/login"), body, [this](const ApiResult &r) {
        setBusy(false);
        m_captchaToken.clear();
        const QJsonObject o = r.object();
        if (r.ok() && o.value(QStringLiteral("requires_email_2fa")).toBool()) {
            m_captchaRequired = false;
            setStep(QStringLiteral("twofa"));
            return;
        }
        if (r.ok()) {
            acceptSession(r);
            return;
        }
        m_captchaRequired = o.value(QStringLiteral("recaptcha_required")).toBool();
        emit stepChanged();
        failed(r);
    }, {false, {}});
}

void AuthManager::verifyTwoFactor(const QString &code)
{
    setBusy(true);
    setError({});
    QJsonObject body{{QStringLiteral("email"), m_pendingEmail}, {QStringLiteral("code"), code.trimmed()}};
    m_api->request("POST", QStringLiteral("/api/auth/login/2fa/verify"), body, [this](const ApiResult &r) {
        setBusy(false);
        if (r.ok())
            acceptSession(r);
        else
            failed(r);
    }, {false, {}});
}

void AuthManager::resendTwoFactor()
{
    QJsonObject body{{QStringLiteral("email"), m_pendingEmail}};
    m_api->request("POST", QStringLiteral("/api/auth/login/2fa/resend"), body, [this](const ApiResult &r) {
        if (r.ok())
            emit message(tr_("desktop.auth.codeResent"));
        else
            failed(r);
    }, {false, {}});
}

void AuthManager::registerAccount(const QString &name, const QString &email, const QString &password)
{
    if (name.trimmed().isEmpty() || email.trimmed().isEmpty() || password.isEmpty()) {
        setError(tr_("desktop.auth.missingFields"));
        return;
    }
    m_pendingEmail = email.trimmed();
    QJsonObject body{{QStringLiteral("name"), name.trimmed()},
                     {QStringLiteral("email"), m_pendingEmail},
                     {QStringLiteral("password"), password}};
    if (!m_captchaToken.isEmpty())
        body.insert(QStringLiteral("recaptcha_token"), m_captchaToken);
    setBusy(true);
    setError({});
    m_api->request("POST", QStringLiteral("/api/auth/register"), body, [this](const ApiResult &r) {
        setBusy(false);
        m_captchaToken.clear();
        if (r.ok()) {
            acceptSession(r);
            return;
        }
        m_captchaRequired = r.object().value(QStringLiteral("recaptcha_required")).toBool();
        emit stepChanged();
        failed(r);
    }, {false, {}});
}

void AuthManager::continueAsGuest()
{
    setBusy(true);
    setError({});
    m_api->request("POST", QStringLiteral("/api/auth/guest"), QJsonObject{}, [this](const ApiResult &r) {
        setBusy(false);
        if (r.ok())
            acceptSession(r);
        else
            failed(r);
    }, {false, {}});
}

void AuthManager::requestMagicLink(const QString &email)
{
    if (!email.contains(QLatin1Char('@'))) {
        setError(tr_("login.validEmail"));
        return;
    }
    m_pendingEmail = email.trimmed();
    setBusy(true);
    setError({});
    m_api->request("POST", QStringLiteral("/api/auth/magic-link"), QJsonObject{{QStringLiteral("email"), m_pendingEmail}},
                   [this](const ApiResult &r) {
                       setBusy(false);
                       if (r.ok())
                           setStep(QStringLiteral("magic-sent"));
                       else
                           failed(r);
                   }, {false, {}});
}

void AuthManager::verifyMagicLink(const QString &tokenOrLink)
{
    QString token = tokenOrLink.trimmed();
    if (token.contains(QLatin1String("token="))) {
        const QUrl u(token);
        token = QUrlQuery(u).queryItemValue(QStringLiteral("token"));
        if (token.isEmpty())
            token = tokenOrLink.section(QLatin1String("token="), 1).section(QLatin1Char('&'), 0, 0);
    }
    if (token.isEmpty()) {
        setError(tr_("desktop.auth.invalidLink"));
        return;
    }
    setBusy(true);
    setError({});
    m_api->request("GET", QStringLiteral("/api/auth/magic-link/verify?token=") + QString::fromLatin1(QUrl::toPercentEncoding(token)),
                   {}, [this](const ApiResult &r) {
                       setBusy(false);
                       if (r.ok())
                           acceptSession(r);
                       else
                           failed(r);
                   }, {false, {}});
}

void AuthManager::oauth(const QString &provider)
{
    setError({});
    QDesktopServices::openUrl(m_api->url(QStringLiteral("/api/auth/%1?platform=desktop").arg(provider)));
    emit message(tr_("desktop.auth.continueInBrowser"));
}

void AuthManager::openCaptcha()
{
    QDesktopServices::openUrl(m_api->url(QStringLiteral("/api/auth/recaptcha/mobile")));
}

void AuthManager::forgotPassword()
{
    QDesktopServices::openUrl(m_api->url(QStringLiteral("/forgot-password")));
}

void AuthManager::verifyPin(const QString &pin)
{
    setBusy(true);
    setError({});
    m_api->request("POST", QStringLiteral("/api/auth/pin/verify"), QJsonObject{{QStringLiteral("pin"), pin}},
                   [this](const ApiResult &r) {
                       setBusy(false);
                       if (r.ok()) {
                           setState(LoggedIn);
                           emit loggedIn();
                       } else if (r.status == 401 && r.object().value(QStringLiteral("error")).toString() == QLatin1String("Wrong PIN")) {
                           setError(tr_("pin.wrongPin"));
                       } else {
                           failed(r);
                       }
                   });
}

void AuthManager::forgotPin()
{
    m_api->request("POST", QStringLiteral("/api/auth/pin/forgot"), QJsonObject(), [this](const ApiResult &r) {
        if (r.ok())
            emit message(tr_("desktop.auth.pinCodeSent"));
        else
            failed(r);
    });
}

void AuthManager::resetPin(const QString &code)
{
    setBusy(true);
    m_api->request("POST", QStringLiteral("/api/auth/pin/reset"), QJsonObject{{QStringLiteral("code"), code.trimmed()}},
                   [this](const ApiResult &r) {
                       setBusy(false);
                       if (!r.ok()) {
                           failed(r);
                           return;
                       }
                       m_settings->setValue(QStringLiteral("auth/pinEnabled"), false);
                       setState(LoggedIn);
                       emit loggedIn();
                   });
}

void AuthManager::logout()
{
    const QString refresh = m_tokens->refreshToken();
    ApiClient::Options opts;
    opts.auth = false;
    opts.bearer = m_tokens->accessToken().toUtf8();
    m_api->request("POST", QStringLiteral("/api/auth/logout"), QJsonObject{{QStringLiteral("refresh_token"), refresh}},
                   {}, opts);
    clearLocalSession();
}

void AuthManager::backToCredentials()
{
    setError({});
    setStep(QStringLiteral("credentials"));
}

void AuthManager::clearError()
{
    setError({});
}

bool AuthManager::handleUrl(const QUrl &url)
{
    const QUrlQuery q(url);
    if (url.scheme() == QLatin1String("orangtask") && url.host() == QLatin1String("auth-callback")) {
        const QString err = q.queryItemValue(QStringLiteral("error"));
        if (!err.isEmpty()) {
            setError(tr_("desktop.auth.oauthFailed", {{QStringLiteral("error"), err}}));
            return true;
        }
        const QString access = q.queryItemValue(QStringLiteral("access"));
        const QString refresh = q.queryItemValue(QStringLiteral("refresh"));
        if (access.isEmpty() || refresh.isEmpty()) {
            setError(tr_("desktop.auth.oauthFailed", {{QStringLiteral("error"), QStringLiteral("missing_tokens")}}));
            return true;
        }
        m_tokens->setTokens(access, refresh);
        setState(Unknown);
        refreshMe();
        emit loggedIn();
        return true;
    }
    if (url.scheme() == QLatin1String("orangtask") && url.host() == QLatin1String("recaptcha")) {
        m_captchaToken = q.queryItemValue(QStringLiteral("token"));
        emit stepChanged();
        // retry the login the captcha was requested for
        if (!m_captchaToken.isEmpty() && !m_pendingEmail.isEmpty() && !m_pendingPassword.isEmpty() && m_state == LoggedOut)
            login(m_pendingEmail, m_pendingPassword);
        return true;
    }
    const bool magic = (url.scheme() == QLatin1String("orangtask") && url.host() == QLatin1String("magic-link"))
        || (url.scheme() == QLatin1String("https") && url.path() == QLatin1String("/auth/magic"));
    if (magic) {
        verifyMagicLink(url.toString());
        return true;
    }
    return false;
}

void AuthManager::acceptSession(const ApiResult &r)
{
    const QJsonObject o = r.object();
    const QString access = o.value(QStringLiteral("access_token")).toString();
    const QString refresh = o.value(QStringLiteral("refresh_token")).toString();
    if (access.isEmpty() || refresh.isEmpty()) {
        setError(tr_("desktop.auth.noTokens"));
        return;
    }
    m_tokens->setTokens(access, refresh);
    m_pendingPassword.clear();
    m_captchaRequired = false;
    setStep(QStringLiteral("credentials"));
    const bool requiresPin = o.value(QStringLiteral("requires_pin")).toBool();
    if (o.contains(QStringLiteral("user")))
        setUser(o.value(QStringLiteral("user")).toObject().toVariantMap());
    if (requiresPin) {
        m_settings->setValue(QStringLiteral("auth/pinEnabled"), true);
        setState(NeedsPin);
        refreshMe();
        return;
    }
    setState(LoggedIn);
    refreshMe();
    emit loggedIn();
}

void AuthManager::failed(const ApiResult &r)
{
    if (r.networkError())
        setError(tr_("desktop.offline.cantReach"));
    else
        setError(r.errorMessage());
}

void AuthManager::clearLocalSession()
{
    m_tokens->clear();
    m_settings->setValue(QStringLiteral("auth/user"), QVariant());
    m_settings->setValue(QStringLiteral("auth/pinEnabled"), false);
    setUser({});
    setStep(QStringLiteral("credentials"));
    setState(LoggedOut);
    emit loggedOut();
}

void AuthManager::setState(State s)
{
    if (m_state == s)
        return;
    m_state = s;
    emit stateChanged();
}

void AuthManager::setBusy(bool b)
{
    if (m_busy == b)
        return;
    m_busy = b;
    emit busyChanged();
}

void AuthManager::setError(const QString &e)
{
    if (m_error == e)
        return;
    m_error = e;
    emit errorChanged();
}

void AuthManager::setStep(const QString &s)
{
    m_step = s;
    emit stepChanged();
}

void AuthManager::setUser(const QVariantMap &u)
{
    m_user = u;
    if (!u.isEmpty())
        m_settings->setValue(QStringLiteral("auth/user"), u);
    emit userChanged();
}
