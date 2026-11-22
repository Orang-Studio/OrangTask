#pragma once

#include <QDate>
#include <QElapsedTimer>
#include <QHash>
#include <QObject>
#include <QPoint>
#include <QPointer>
#include <QRect>
#include <QTimer>
#include <QUrl>

#include <optional>

class ApiClient;
class AuthManager;
class Database;
class I18n;
class QQmlApplicationEngine;
class QQuickWindow;
class RealtimeClient;
class Settings;
class Store;
class SyncEngine;
class TokenStore;

class AppController : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool popupVisible READ popupVisible NOTIFY popupVisibleChanged)
    Q_PROPERTY(bool stickyVisible READ stickyVisible NOTIFY stickyVisibleChanged)
    Q_PROPERTY(bool layerShell READ layerShell CONSTANT)
    Q_PROPERTY(QString version READ version CONSTANT)

public:
    explicit AppController(QObject *parent = nullptr);
    ~AppController() override;

    static AppController *instance();

    Settings *settings() const { return m_settings; }
    I18n *i18n() const { return m_i18n; }
    ApiClient *api() const { return m_api; }
    AuthManager *auth() const { return m_auth; }
    Store *store() const { return m_store; }
    SyncEngine *sync() const { return m_sync; }

    void setEngine(QQmlApplicationEngine *engine) { m_engine = engine; }
    bool selfTest();
    bool captureScreenshots(const QString &dir);
    // a local server that answers every request with 404 so screenshot runs stay online without touching the real server
    static QString startScreenshotServer(QObject *parent);
    void start(const QStringList &args);

    bool popupVisible() const;
    bool stickyVisible() const;
    bool layerShell() const;
    QString version() const;

    Q_INVOKABLE void handleArgs(const QStringList &args, bool firstRun = false);

    Q_INVOKABLE void showMain();
    Q_INVOKABLE void togglePopup();
    Q_INVOKABLE void showPopup();
    Q_INVOKABLE void hidePopup();
    Q_INVOKABLE void showQuickAdd();
    Q_INVOKABLE void hideQuickAdd();
    Q_INVOKABLE void toggleSticky();
    Q_INVOKABLE void setStickyShown(bool shown);
    Q_INVOKABLE void openTask(const QString &id);
    Q_INVOKABLE void showPage(const QString &page);     // "scratchpads", "settings", ...
    Q_INVOKABLE void openInBrowser(const QString &path = {});
    Q_INVOKABLE void moveSticky(int dx, int dy);        // layer-shell drag (margins)
    Q_INVOKABLE void startSystemMove(QObject *window);   // xdg / X11 drag
    Q_INVOKABLE void quit();
    void kwinReply(const QString &tag, const QString &value);

    Q_INVOKABLE QString captureDrop(const QString &text, const QVariantList &urls, const QString &listId = {});

    // local calendar day bumped at midnight so date based bindings re evaluate
    Q_INVOKABLE QString today() const;

signals:
    void popupVisibleChanged();
    void stickyVisibleChanged();
    void taskOpenRequested(const QString &id);
    void pageRequested(const QString &page);
    void quickAddFocusRequested();
    void dayChanged();
    void toast(const QString &message);

private:
    bool selfTestSignedIn();
    QQuickWindow *window(const QString &name);
    void onAuthState();
    void checkDay();
    void saveStickyOffset();
    void presentPopup(std::optional<QPoint> cursor);
    void adoptStickyInKWin(QQuickWindow *w);
    void fetchPageTitle(const QString &taskId, const QUrl &url, const QString &placeholder);

    Settings *m_settings = nullptr;
    I18n *m_i18n = nullptr;
    TokenStore *m_tokens = nullptr;
    ApiClient *m_api = nullptr;
    Database *m_db = nullptr;
    Store *m_store = nullptr;
    RealtimeClient *m_rt = nullptr;
    SyncEngine *m_sync = nullptr;
    AuthManager *m_auth = nullptr;

    QQmlApplicationEngine *m_engine = nullptr;
    QDate m_day;
    QHash<QString, QPointer<QQuickWindow>> m_windows;
    bool m_popupWasActive = false;
    QElapsedTimer m_popupHiddenAt;
    // waiting for KWin to report the pointer before showing the popup
    QTimer m_cursorWait;
    QTimer m_dayTimer;
};
