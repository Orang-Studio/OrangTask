#include "AppController.h"

#include "core/ApiClient.h"
#include "core/AuthManager.h"
#include "core/Database.h"
#include "core/I18n.h"
#include "core/RealtimeClient.h"
#include "core/Settings.h"
#include "core/Store.h"
#include "core/SyncEngine.h"
#include "core/TokenStore.h"
#include "system/KWin.h"
#include "system/WindowPlacer.h"

#include <QApplication>
#include <QDesktopServices>
#include <QFileInfo>
#include <QNetworkReply>
#include <QQmlApplicationEngine>
#include <QQmlComponent>
#include <QJsonObject>
#include <QQmlContext>
#include <QQmlEngine>
#include <QQuickWindow>
#include <QRegularExpression>
#include <QTextDocumentFragment>
#include <QThread>

static AppController *s_instance = nullptr;

static const QHash<QString, QString> &windowFiles()
{
    static const QHash<QString, QString> files{
        {QStringLiteral("main"), QStringLiteral("Main.qml")},
        {QStringLiteral("popup"), QStringLiteral("popup/TrayPopup.qml")},
        {QStringLiteral("quickadd"), QStringLiteral("popup/QuickAddWindow.qml")},
        {QStringLiteral("sticky"), QStringLiteral("popup/StickyNote.qml")},
    };
    return files;
}

AppController::AppController(QObject *parent)
    : QObject(parent)
{
    s_instance = this;
    m_settings = new Settings(this);
    m_i18n = new I18n(this);
    m_i18n->setPreference(m_settings->language());
    connect(m_settings, &Settings::languageChanged, this, [this]() { m_i18n->setPreference(m_settings->language()); });

    m_tokens = new TokenStore(this);
    m_api = new ApiClient(m_settings->serverUrl(), m_tokens, this);
    m_db = new Database();
    m_store = new Store(m_db, this);
    m_rt = new RealtimeClient(m_settings->serverUrl(), m_tokens, this);
    m_sync = new SyncEngine(m_api, m_db, m_store, m_rt, this);
    m_auth = new AuthManager(m_api, m_tokens, m_settings, this);

    connect(m_auth, &AuthManager::stateChanged, this, &AppController::onAuthState);
    connect(m_auth, &AuthManager::message, this, &AppController::toast);
    connect(m_sync, &SyncEngine::toast, this, &AppController::toast);

    // date views today overdue and due labels go stale at midnight and after suspend a cheap once a minute check covers both
    m_day = QDate::currentDate();
    m_dayTimer.setInterval(60 * 1000);
    connect(&m_dayTimer, &QTimer::timeout, this, &AppController::checkDay);
    m_dayTimer.start();

    m_cursorWait.setSingleShot(true);
    m_cursorWait.setInterval(300);
    connect(&m_cursorWait, &QTimer::timeout, this, [this]() { presentPopup({}); });

    // windows belong to the QML engine which main destroys before us
    connect(qApp, &QCoreApplication::aboutToQuit, this, [this]() {
        saveStickyOffset();
        for (QQuickWindow *w : std::as_const(m_windows))
            delete w;
        m_windows.clear();
    });
}

AppController::~AppController()
{
    delete m_sync;
    m_sync = nullptr;
    delete m_store;
    m_store = nullptr;
    delete m_db;
    if (s_instance == this)
        s_instance = nullptr;
}

AppController *AppController::instance()
{
    return s_instance;
}

void AppController::start(const QStringList &args)
{
    m_tokens->load();
    m_auth->start();
    handleArgs(args, true);
}

bool AppController::layerShell() const
{
    return WindowPlacer::usesLayerShell(WindowPlacer::Sticky);
}

QString AppController::version() const
{
    return QStringLiteral(ORANGTASK_VERSION);
}

QString AppController::today() const
{
    return m_day.toString(Qt::ISODate);
}

void AppController::checkDay()
{
    const QDate d = QDate::currentDate();
    if (d == m_day)
        return;
    m_day = d;
    m_store->touch();
    emit dayChanged();
}

void AppController::onAuthState()
{
    switch (m_auth->state()) {
    case AuthManager::LoggedIn:
        m_store->setUserId(m_auth->userId());
        m_sync->start();
        break;
    case AuthManager::LoggedOut:
        m_sync->stop(true);
        hidePopup();
        setStickyShown(false);
        break;
    case AuthManager::NeedsPin:
        m_sync->stop(false);
        break;
    case AuthManager::Unknown:
        break;
    }
}

void AppController::handleArgs(const QStringList &args, bool firstRun)
{
    bool handled = false;
    bool trayOnly = false;
    for (const QString &arg : args) {
        if (arg == QLatin1String("--tray")) {
            trayOnly = true;
        } else if (arg == QLatin1String("--quick-add")) {
            showQuickAdd();
            handled = true;
        } else if (arg == QLatin1String("--popup")) {
            showPopup();
            handled = true;
        } else if (arg == QLatin1String("--sticky")) {
            toggleSticky();
            handled = true;
        } else if (arg.startsWith(QLatin1String("orangtask:"))) {
            const QUrl url(arg);
            handled = true;
            if (m_auth->handleUrl(url)) {
                if (m_auth->state() != AuthManager::LoggedIn)
                    showMain();
                continue;
            }
            if (url.host() == QLatin1String("task"))
                openTask(url.path().mid(1));
            else if (url.host() == QLatin1String("quick-add"))
                showQuickAdd();
            else
                showMain();
        }
    }
    if (firstRun && m_settings->stickyVisible() && m_auth->state() == AuthManager::LoggedIn)
        setStickyShown(true);
    if (!handled && !trayOnly)
        showMain();
}

bool AppController::selfTest()
{
    int warnings = 0;
    connect(m_engine, &QQmlEngine::warnings, this, [&warnings](const QList<QQmlError> &list) {
        for (const QQmlError &e : list)
            qWarning().noquote() << e.toString();
        warnings += list.size();
    });
    bool ok = true;
    QStringList names = windowFiles().keys();
    names.sort();
    for (const QString &name : names) {
        QQuickWindow *w = window(name);
        if (!w) {
            ok = false;
            continue;
        }
        w->show();
        QCoreApplication::processEvents();
        QThread::msleep(50);
        QCoreApplication::processEvents();
        w->hide();
        qInfo().noquote() << "self-test: loaded" << name;
    }
    if (ok)
        ok = selfTestSignedIn();
    return ok && warnings == 0;
}

// walks the signed in UI against a little seeded data so warnings from pages the signed out start never builds still fail the test
bool AppController::selfTestSignedIn()
{
    const auto settle = []() {
        for (int i = 0; i < 4; ++i) {
            QCoreApplication::processEvents();
            QThread::msleep(20);
        }
    };
    const QString today = QDate::currentDate().toString(Qt::ISODate);
    const QString yesterday = QDate::currentDate().addDays(-1).toString(Qt::ISODate);
    const QVariantMap user{{QStringLiteral("id"), QStringLiteral("u-test")},
                           {QStringLiteral("email"), QStringLiteral("test@example.invalid")},
                           {QStringLiteral("name"), QStringLiteral("Test")}};

    m_auth->forceStateForTest(AuthManager::NeedsPin, user);
    QQuickWindow *main = window(QStringLiteral("main"));
    if (!main)
        return false;
    main->show();
    settle();
    qInfo().noquote() << "self-test: loaded pin";

    m_auth->forceStateForTest(AuthManager::LoggedIn, user);
    m_store->upsert(Store::Lists, QJsonObject{{QStringLiteral("id"), QStringLiteral("l-test")},
                                              {QStringLiteral("name"), QStringLiteral("Test list")},
                                              {QStringLiteral("color"), QStringLiteral("#f97316")},
                                              {QStringLiteral("icon"), QStringLiteral("list")},
                                              {QStringLiteral("my_role"), QStringLiteral("owner")}});
    m_store->upsert(Store::Tags, QJsonObject{{QStringLiteral("id"), QStringLiteral("g-test")},
                                             {QStringLiteral("name"), QStringLiteral("work")},
                                             {QStringLiteral("color"), QStringLiteral("#3b82f6")}});
    m_store->upsertMany(Store::Tasks, {
        QJsonObject{{QStringLiteral("id"), QStringLiteral("t-1")}, {QStringLiteral("list_id"), QStringLiteral("l-test")},
                    {QStringLiteral("title"), QStringLiteral("Due today")}, {QStringLiteral("status"), QStringLiteral("todo")},
                    {QStringLiteral("priority"), QStringLiteral("high")}, {QStringLiteral("due_date"), today},
                    {QStringLiteral("notes"), QStringLiteral("Some **notes**")},
                    {QStringLiteral("created_at"), QDateTime::currentDateTimeUtc().toString(Qt::ISODate)}},
        QJsonObject{{QStringLiteral("id"), QStringLiteral("t-2")}, {QStringLiteral("list_id"), QStringLiteral("l-test")},
                    {QStringLiteral("title"), QStringLiteral("Overdue")}, {QStringLiteral("status"), QStringLiteral("todo")},
                    {QStringLiteral("priority"), QStringLiteral("none")}, {QStringLiteral("due_date"), yesterday}},
        QJsonObject{{QStringLiteral("id"), QStringLiteral("t-3")}, {QStringLiteral("list_id"), QStringLiteral("l-test")},
                    {QStringLiteral("parent_id"), QStringLiteral("t-1")},
                    {QStringLiteral("title"), QStringLiteral("Subtask")}, {QStringLiteral("status"), QStringLiteral("done")}},
    });
    m_store->upsert(Store::Scratchpads, QJsonObject{{QStringLiteral("id"), QStringLiteral("s-test")},
                                                    {QStringLiteral("title"), QStringLiteral("Note")},
                                                    {QStringLiteral("content"), QStringLiteral("Hello")}});
    settle();

    for (const QString &page : {QStringLiteral("today"), QStringLiteral("week"), QStringLiteral("overdue"),
                                QStringLiteral("assigned"), QStringLiteral("all"), QStringLiteral("list:l-test"),
                                QStringLiteral("scratchpads"), QStringLiteral("notifications"),
                                QStringLiteral("settings")}) {
        emit pageRequested(page);
        settle();
        qInfo().noquote() << "self-test: page" << page;
    }
    if (QObject *settingsPage = main->findChild<QObject *>(QStringLiteral("settingsPage"))) {
        for (const char *section : {"profile", "appearance", "desktop", "notifications", "more"}) {
            settingsPage->setProperty("section", QString::fromLatin1(section));
            settle();
            qInfo().noquote() << "self-test: settings" << section;
        }
    } else {
        qWarning() << "self-test: settings page not found";
        return false;
    }
    emit taskOpenRequested(QStringLiteral("t-1"));
    settle();
    qInfo().noquote() << "self-test: task detail";

    if (QQuickWindow *popup = window(QStringLiteral("popup"))) {
        popup->show();
        for (const QString &view : {QStringLiteral("today"), QStringLiteral("week"), QStringLiteral("overdue"),
                                    QStringLiteral("assigned"), QStringLiteral("all"), QStringLiteral("list")}) {
            popup->setProperty("listId", view == QLatin1String("list") ? QStringLiteral("l-test") : QString());
            popup->setProperty("view", view);
            settle();
        }
        popup->hide();
        qInfo().noquote() << "self-test: popup views";
    }
    m_settings->setStickyScratchpadId(QStringLiteral("s-test"));
    setStickyShown(true);
    settle();
    setStickyShown(false);
    main->hide();
    return true;
}

QQuickWindow *AppController::window(const QString &name)
{
    if (QQuickWindow *w = m_windows.value(name))
        return w;
    if (!m_engine)
        return nullptr;

    const QUrl url(QStringLiteral("qrc:/qt/qml/OrangTask/qml/") + windowFiles().value(name));
    QQmlComponent component(m_engine, url);
    QObject *obj = component.create(m_engine->rootContext());
    auto *w = qobject_cast<QQuickWindow *>(obj);
    if (!w) {
        qWarning().noquote() << "failed to create" << name << component.errorString();
        delete obj;
        return nullptr;
    }

    if (name == QLatin1String("popup")) {
        WindowPlacer::prepare(w, WindowPlacer::Popup);
        connect(w, &QWindow::activeChanged, this, [this, w]() {
            if (w->isActive()) {
                m_popupWasActive = true;
            } else if (m_popupWasActive && w->isVisible()) {
                // clicking the tray icon also takes focus away remember when we hid so that click doesnt immediately reopen the popup
                m_popupHiddenAt.restart();
                hidePopup();
            }
        });
        connect(w, &QWindow::visibleChanged, this, &AppController::popupVisibleChanged);
    } else if (name == QLatin1String("quickadd")) {
        WindowPlacer::prepare(w, WindowPlacer::QuickAdd);
        connect(w, &QWindow::activeChanged, this, [w]() {
            if (!w->isActive() && w->isVisible())
                w->hide();
        });
    } else if (name == QLatin1String("sticky")) {
        WindowPlacer::prepare(w, WindowPlacer::Sticky);
        const QRect g = WindowPlacer::usesLayerShell(WindowPlacer::Sticky) || !KWin::available()
            ? m_settings->stickyGeometry()
            : m_settings->value(QStringLiteral("sticky/kwinGeometry")).toRect();
        if (g.width() > 0)
            w->resize(g.size());
        WindowPlacer::place(w, WindowPlacer::Sticky, {});
        WindowPlacer::setStickyOffset(w, g.width() > 0 ? g.topLeft() : QPoint(24, 24));
        connect(w, &QWindow::visibleChanged, this, &AppController::stickyVisibleChanged);
    }
    m_windows.insert(name, w);
    return w;
}

void AppController::showMain()
{
    QQuickWindow *w = window(QStringLiteral("main"));
    if (!w)
        return;
    hidePopup();
    if (w->windowStates() & Qt::WindowMinimized)
        w->setWindowStates(w->windowStates() & ~Qt::WindowMinimized);
    w->show();
    w->raise();
    w->requestActivate();
}

bool AppController::popupVisible() const
{
    QQuickWindow *w = m_windows.value(QStringLiteral("popup"));
    return w && w->isVisible();
}

void AppController::togglePopup()
{
    if (popupVisible()) {
        hidePopup();
        return;
    }
    if (m_popupHiddenAt.isValid() && m_popupHiddenAt.elapsed() < 250)
        return;
    showPopup();
}

void AppController::showPopup()
{
    if (m_cursorWait.isActive())
        return;
    // wayland hides the pointer from clients KWin can tell us where it is for the position and the screen
    if (KWin::available()) {
        m_cursorWait.start();
        const bool asked = KWin::run(QStringLiteral("orangtask-cursor"),
            KWin::reply(QStringLiteral("cursor"),
                        QStringLiteral("workspace.cursorPos.x + ',' + workspace.cursorPos.y")));
        if (asked)
            return;
        m_cursorWait.stop();
    }
    presentPopup({});
}

void AppController::presentPopup(std::optional<QPoint> cursor)
{
    QQuickWindow *w = window(QStringLiteral("popup"));
    if (!w)
        return;
    m_popupWasActive = false;
    WindowPlacer::place(w, WindowPlacer::Popup, m_settings->popupCorner(), cursor);
    w->show();
    w->raise();
    w->requestActivate();
}

void AppController::hidePopup()
{
    if (QQuickWindow *w = m_windows.value(QStringLiteral("popup")))
        w->hide();
}

void AppController::showQuickAdd()
{
    QQuickWindow *w = window(QStringLiteral("quickadd"));
    if (!w)
        return;
    hidePopup();
    WindowPlacer::place(w, WindowPlacer::QuickAdd, {});
    w->show();
    w->raise();
    w->requestActivate();
    emit quickAddFocusRequested();
}

void AppController::hideQuickAdd()
{
    if (QQuickWindow *w = m_windows.value(QStringLiteral("quickadd")))
        w->hide();
}

bool AppController::stickyVisible() const
{
    QQuickWindow *w = m_windows.value(QStringLiteral("sticky"));
    return w && w->isVisible();
}

void AppController::toggleSticky()
{
    setStickyShown(!stickyVisible());
}

void AppController::setStickyShown(bool shown)
{
    if (!shown) {
        if (QQuickWindow *w = m_windows.value(QStringLiteral("sticky"))) {
            saveStickyOffset();
            KWin::unload(QStringLiteral("orangtask-sticky"));
            w->hide();
        }
        m_settings->setStickyVisible(false);
        return;
    }
    QQuickWindow *w = window(QStringLiteral("sticky"));
    if (!w)
        return;
    w->show();
    if (!WindowPlacer::usesLayerShell(WindowPlacer::Sticky) && KWin::available())
        adoptStickyInKWin(w);
    m_settings->setStickyVisible(true);
}

// wayland wont let a normal window place itself or stay on top so a KWin script does it and reports where the note ends up after each move resize
void AppController::adoptStickyInKWin(QQuickWindow *w)
{
    const QRect g = m_settings->value(QStringLiteral("sticky/kwinGeometry")).toRect();
    const QString saved = g.isValid()
        ? QStringLiteral("{x: %1, y: %2, width: %3, height: %4}").arg(g.x()).arg(g.y()).arg(g.width()).arg(g.height())
        : QStringLiteral("null");
    const QString title = QString(w->title()).replace(QLatin1Char('\\'), QLatin1String("\\\\"))
                                             .replace(QLatin1Char('"'), QLatin1String("\\\""));
    const QString source = QStringLiteral(R"(
const pid = %1, caption = "%2", saved = %3;
function adopt(w) {
    if (!w || w.pid !== pid || w.caption !== caption) return false;
    w.keepAbove = true;
    w.skipTaskbar = true;
    w.skipPager = true;
    w.skipSwitcher = true;
    if (saved) w.frameGeometry = saved;
    w.interactiveMoveResizeFinished.connect(() => {
        const g = w.frameGeometry;
        %4
    });
    return true;
}
if (!workspace.windowList().some(adopt)) workspace.windowAdded.connect(adopt);
)").arg(QCoreApplication::applicationPid()).arg(title, saved,
         KWin::reply(QStringLiteral("sticky"), QStringLiteral("[g.x, g.y, g.width, g.height].map(Math.round).join(',')")));
    KWin::run(QStringLiteral("orangtask-sticky"), source, true);
}

void AppController::kwinReply(const QString &tag, const QString &value)
{
    const QStringList n = value.split(QLatin1Char(','));
    if (tag == QLatin1String("cursor") && n.size() == 2) {
        if (m_cursorWait.isActive()) {
            m_cursorWait.stop();
            presentPopup(QPoint(n[0].toInt(), n[1].toInt()));
        }
    } else if (tag == QLatin1String("sticky") && n.size() == 4) {
        m_settings->setValue(QStringLiteral("sticky/kwinGeometry"),
                             QRect(n[0].toInt(), n[1].toInt(), n[2].toInt(), n[3].toInt()));
    }
}

void AppController::moveSticky(int dx, int dy)
{
    QQuickWindow *w = m_windows.value(QStringLiteral("sticky"));
    if (!w)
        return;
    const QPoint o = WindowPlacer::stickyOffset(w);
    // the offset is measured from the top right corner so moving right shrinks it
    WindowPlacer::setStickyOffset(w, QPoint(o.x() - dx, o.y() + dy));
}

void AppController::saveStickyOffset()
{
    QQuickWindow *w = m_windows.value(QStringLiteral("sticky"));
    // under KWin the script reports the geometry instead
    if (w && w->isVisible() && (WindowPlacer::usesLayerShell(WindowPlacer::Sticky) || !KWin::available()))
        m_settings->setStickyGeometry(QRect(WindowPlacer::stickyOffset(w), w->size()));
}

void AppController::startSystemMove(QObject *window)
{
    if (auto *w = qobject_cast<QWindow *>(window))
        w->startSystemMove();
}

void AppController::openTask(const QString &id)
{
    if (id.isEmpty())
        return;
    showMain();
    emit taskOpenRequested(id);
}

void AppController::showPage(const QString &page)
{
    showMain();
    emit pageRequested(page);
}

void AppController::openInBrowser(const QString &path)
{
    QDesktopServices::openUrl(QUrl(m_api->baseUrl() + (path.startsWith(QLatin1Char('/')) || path.isEmpty() ? path : QLatin1Char('/') + path)));
}

void AppController::quit()
{
    m_sync->flushDeferred();
    QApplication::quit();
}

QString AppController::captureDrop(const QString &text, const QVariantList &urls, const QString &listId)
{
    const QString list = listId.isEmpty() || listId.startsWith(QLatin1String("view:")) ? m_sync->defaultListId() : listId;
    if (list.isEmpty()) {
        emit toast(tr_("desktop.tasks.noList"));
        return {};
    }

    QString title;
    QString notes;
    QUrl web;
    if (!urls.isEmpty()) {
        const QUrl url = urls.first().toUrl();
        if (url.isLocalFile()) {
            title = QFileInfo(url.toLocalFile()).fileName();
            QStringList all;
            for (const QVariant &u : urls)
                all << u.toUrl().toString();
            notes = all.join(QLatin1Char('\n'));
        } else {
            title = url.toString();
            notes = url.toString();
            if (url.scheme().startsWith(QLatin1String("http")))
                web = url;
        }
    } else {
        const QString trimmed = text.trimmed();
        title = trimmed.section(QLatin1Char('\n'), 0, 0).trimmed();
        if (trimmed.contains(QLatin1Char('\n')))
            notes = trimmed;
        const QUrl maybe(title, QUrl::StrictMode);
        if (!maybe.scheme().isEmpty() && maybe.scheme().startsWith(QLatin1String("http")) && !title.contains(QLatin1Char(' '))) {
            web = maybe;
            notes = title;
        }
    }
    if (title.isEmpty())
        return {};
    if (title.size() > 200)
        title = title.left(199) + QChar(0x2026);

    const QString id = m_sync->createTask({
        {QStringLiteral("list_id"), list},
        {QStringLiteral("title"), title},
        {QStringLiteral("notes"), notes},
    });
    if (!id.isEmpty() && web.isValid())
        fetchPageTitle(id, web, title);
    return id;
}

void AppController::fetchPageTitle(const QString &taskId, const QUrl &url, const QString &placeholder)
{
    // the task id may be remapped from tmp to the server id while we wait
    auto current = std::make_shared<QString>(taskId);
    auto remap = connect(m_sync, &SyncEngine::idRemapped, this, [current](const QString &from, const QString &to) {
        if (from == *current)
            *current = to;
    });

    QNetworkRequest req(url);
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    req.setTransferTimeout(10000);
    req.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("OrangTask/%1").arg(version()));
    QNetworkReply *reply = m_api->nam()->get(req);

    // read just enough of the page to find title
    auto buffer = std::make_shared<QByteArray>();
    connect(reply, &QNetworkReply::readyRead, reply, [reply, buffer]() {
        buffer->append(reply->readAll());
        if (buffer->size() > 512 * 1024 || buffer->contains("</title>") || buffer->contains("</TITLE>"))
            reply->abort();
    });
    connect(reply, &QNetworkReply::finished, this, [this, reply, buffer, current, remap, placeholder]() {
        reply->deleteLater();
        disconnect(remap);
        buffer->append(reply->readAll());
        static const QRegularExpression re(QStringLiteral("<title[^>]*>([\\s\\S]*?)</title>"),
                                           QRegularExpression::CaseInsensitiveOption);
        const auto m = re.match(QString::fromUtf8(*buffer));
        if (!m.hasMatch())
            return;
        QString title = QTextDocumentFragment::fromHtml(m.captured(1)).toPlainText().simplified();
        if (title.isEmpty())
            return;
        if (title.size() > 200)
            title = title.left(199) + QChar(0x2026);
        // leave it alone if the user renamed the task meanwhile
        const QJsonObject t = m_store->task(*current);
        if (t.isEmpty() || Store::str(t, "title") != placeholder)
            return;
        m_sync->updateTask(*current, {{QStringLiteral("title"), title}});
    });
}
