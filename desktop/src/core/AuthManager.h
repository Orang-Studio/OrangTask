#pragma once

#include <QObject>
#include <QUrl>
#include <QVariantMap>

class ApiClient;
class Settings;
class TokenStore;
struct ApiResult;

class AuthManager : public QObject
{
    Q_OBJECT
    Q_PROPERTY(State state READ state NOTIFY stateChanged)
    Q_PROPERTY(QVariantMap user READ user NOTIFY userChanged)
    Q_PROPERTY(QString userId READ userId NOTIFY userChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(QString error READ error NOTIFY errorChanged)
    Q_PROPERTY(QString pendingEmail READ pendingEmail NOTIFY stepChanged)
    Q_PROPERTY(QString step READ step NOTIFY stepChanged)
    Q_PROPERTY(bool captchaRequired READ captchaRequired NOTIFY stepChanged)
    Q_PROPERTY(bool hasCaptchaToken READ hasCaptchaToken NOTIFY stepChanged)

public:
    enum State { Unknown, LoggedOut, NeedsPin, LoggedIn };
    Q_ENUM(State)

    AuthManager(ApiClient *api, TokenStore *tokens, Settings *settings, QObject *parent = nullptr);

    State state() const { return m_state; }
    QVariantMap user() const { return m_user; }
    QString userId() const { return m_user.value(QStringLiteral("id")).toString(); }
    bool busy() const { return m_busy; }
    QString error() const { return m_error; }
    QString pendingEmail() const { return m_pendingEmail; }
    QString step() const { return m_step; }
    bool captchaRequired() const { return m_captchaRequired; }
    bool hasCaptchaToken() const { return !m_captchaToken.isEmpty(); }

    void start();

    Q_INVOKABLE void login(const QString &email, const QString &password);
    Q_INVOKABLE void verifyTwoFactor(const QString &code);
    Q_INVOKABLE void resendTwoFactor();
    Q_INVOKABLE void registerAccount(const QString &name, const QString &email, const QString &password);
    Q_INVOKABLE void continueAsGuest();
    Q_INVOKABLE void requestMagicLink(const QString &email);
    // accepts a bare token or any link that carries token
    Q_INVOKABLE void verifyMagicLink(const QString &tokenOrLink);
    Q_INVOKABLE void oauth(const QString &provider);
    Q_INVOKABLE void openCaptcha();
    Q_INVOKABLE void forgotPassword();
    Q_INVOKABLE void verifyPin(const QString &pin);
    Q_INVOKABLE void forgotPin();
    Q_INVOKABLE void resetPin(const QString &code);
    Q_INVOKABLE void logout();
    Q_INVOKABLE void backToCredentials();
    Q_INVOKABLE void clearError();
    Q_INVOKABLE void refreshMe();

    // handles orangtask deep links and magic links
    bool handleUrl(const QUrl &url);

    // self test only fakes a session so the signed in UI can be loaded
    void forceStateForTest(State s, const QVariantMap &user)
    {
        setUser(user);
        setState(s);
    }

signals:
    void stateChanged();
    void userChanged();
    void busyChanged();
    void errorChanged();
    void stepChanged();
    void loggedIn();
    void loggedOut();
    void message(const QString &text);

private:
    void setState(State s);
    void setBusy(bool b);
    void setError(const QString &e);
    void setStep(const QString &s);
    void setUser(const QVariantMap &u);
    // handles any response that may carry access_token refresh_token user requires_pin
    void acceptSession(const ApiResult &r);
    void failed(const ApiResult &r);
    void clearLocalSession();

    ApiClient *m_api;
    TokenStore *m_tokens;
    Settings *m_settings;
    State m_state = Unknown;
    QVariantMap m_user;
    bool m_busy = false;
    QString m_error;
    QString m_step = QStringLiteral("credentials");
    QString m_pendingEmail;
    QString m_pendingPassword;
    QString m_captchaToken;
    bool m_captchaRequired = false;
};
