// orangtask screenshots dir seeds a believable account into a throwaway profile and renders each window offscreen to PNG for the README and AppStream
#include "AppController.h"

#include "core/AuthManager.h"
#include "core/Settings.h"
#include "core/Store.h"

#include <QDateTime>
#include <QDir>
#include <QEventLoop>
#include <QJsonArray>
#include <QJsonObject>
#include <QQuickWindow>
#include <QTcpServer>
#include <QTcpSocket>
#include <QTimer>

namespace {

void settle(int ms = 400)
{
    QEventLoop loop;
    QTimer::singleShot(ms, &loop, &QEventLoop::quit);
    loop.exec();
}

QJsonObject list(const char *id, const char *name, const char *color, const char *icon, double pos)
{
    return {{QStringLiteral("id"), QLatin1String(id)}, {QStringLiteral("name"), QLatin1String(name)},
            {QStringLiteral("color"), QLatin1String(color)}, {QStringLiteral("icon"), QLatin1String(icon)},
            {QStringLiteral("position"), pos}, {QStringLiteral("my_role"), QStringLiteral("owner")}};
}

} // namespace

QString AppController::startScreenshotServer(QObject *parent)
{
    auto *server = new QTcpServer(parent);
    if (!server->listen(QHostAddress::LocalHost))
        return {};
    QObject::connect(server, &QTcpServer::newConnection, server, [server]() {
        while (QTcpSocket *s = server->nextPendingConnection()) {
            QObject::connect(s, &QTcpSocket::readyRead, s, [s]() {
                s->readAll();
                s->write("HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n"
                         "Content-Length: 2\r\n\r\n{}");
            });
            QObject::connect(s, &QTcpSocket::disconnected, s, &QObject::deleteLater);
        }
    });
    return QStringLiteral("http://127.0.0.1:%1").arg(server->serverPort());
}

bool AppController::captureScreenshots(const QString &dir)
{
    if (!QDir().mkpath(dir))
        return false;

    const QDate today = QDate::currentDate();
    const auto day = [&today](int offset) { return today.addDays(offset).toString(Qt::ISODate); };
    const QString now = QDateTime::currentDateTimeUtc().toString(Qt::ISODate);

    bool ok = true;
    const auto shoot = [&](QQuickWindow *w, const QString &name) {
        settle();
        const QImage img = w->grabWindow();
        if (img.isNull() || !img.save(QDir(dir).filePath(name + QStringLiteral(".png")))) {
            qWarning().noquote() << "screenshots: failed" << name;
            ok = false;
            return;
        }
        qInfo().noquote() << "screenshots:" << name;
    };

    m_settings->setLanguage(QStringLiteral("en"));
    m_settings->setTheme(QStringLiteral("light"));

    QQuickWindow *main = window(QStringLiteral("main"));
    if (!main)
        return false;
    main->resize(1200, 760);
    main->show();
    // auth never starts here no keyring reads so it would stay on the splash
    m_auth->forceStateForTest(AuthManager::LoggedOut, {});
    shoot(main, QStringLiteral("login"));

    const QVariantMap user{{QStringLiteral("id"), QStringLiteral("u-demo")},
                           {QStringLiteral("email"), QStringLiteral("demo@example.invalid")},
                           {QStringLiteral("name"), QStringLiteral("Alex Demo")}};
    // never start sync here it would reach the network and replace the demo data
    disconnect(m_auth, &AuthManager::stateChanged, this, nullptr);
    m_auth->forceStateForTest(AuthManager::LoggedIn, user);
    m_store->setUserId(QStringLiteral("u-demo"));

    const QJsonObject work = list("l-work", "Work", "#f97316", "briefcase", 0);
    const QJsonObject home = list("l-home", "Home", "#22c55e", "home", 1);
    const QJsonObject shop = list("l-shop", "Groceries", "#3b82f6", "cart", 2);
    const QJsonObject trip = list("l-trip", "Vilnius trip", "#a855f7", "plane", 3);
    m_store->upsertMany(Store::Lists, {work, home, shop, trip});
    m_store->upsertMany(Store::Tags, {
        QJsonObject{{QStringLiteral("id"), QStringLiteral("g-urgent")}, {QStringLiteral("name"), QStringLiteral("urgent")},
                    {QStringLiteral("color"), QStringLiteral("#ef4444")}},
        QJsonObject{{QStringLiteral("id"), QStringLiteral("g-call")}, {QStringLiteral("name"), QStringLiteral("call")},
                    {QStringLiteral("color"), QStringLiteral("#3b82f6")}},
    });

    int n = 0;
    const auto task = [&](const QJsonObject &l, const char *title, const char *priority, const QString &due,
                          const QStringList &tags = {}, bool done = false) {
        QJsonObject t{{QStringLiteral("id"), QStringLiteral("t-%1").arg(++n)},
                      {QStringLiteral("list_id"), l.value(QStringLiteral("id"))},
                      {QStringLiteral("list_name"), l.value(QStringLiteral("name"))},
                      {QStringLiteral("list_color"), l.value(QStringLiteral("color"))},
                      {QStringLiteral("list_icon"), l.value(QStringLiteral("icon"))},
                      {QStringLiteral("title"), QString::fromUtf8(title)},
                      {QStringLiteral("status"), done ? QStringLiteral("done") : QStringLiteral("todo")},
                      {QStringLiteral("priority"), QLatin1String(priority)},
                      {QStringLiteral("position"), n},
                      {QStringLiteral("created_at"), now}};
        if (!due.isEmpty())
            t.insert(QStringLiteral("due_date"), due);
        if (!tags.isEmpty()) {
            QJsonArray names, ids;
            for (const QString &tag : tags) {
                names.append(tag);
                ids.append(QStringLiteral("g-") + tag);
            }
            t.insert(QStringLiteral("tag_names"), names);
            t.insert(QStringLiteral("tag_ids"), ids);
        }
        return t;
    };
    QList<QJsonObject> tasks{
        task(work, "Send Q3 report to the board", "high", day(0), {QStringLiteral("urgent")}),
        task(work, "Review the onboarding redesign", "medium", day(0)),
        task(work, "Call the accountant about VAT", "medium", day(-1), {QStringLiteral("call")}),
        task(work, "Plan sprint 42", "low", day(2)),
        task(work, "Update the API docs", "none", day(4)),
        task(home, "Book the dentist", "medium", day(0), {QStringLiteral("call")}),
        task(home, "Water the plants", "none", day(0)),
        task(home, "Fix the bathroom tap", "low", day(3)),
        task(shop, "Oat milk", "none", {}),
        task(shop, "Coffee beans", "none", {}),
        task(shop, "Tomatoes", "none", {}),
        task(shop, "Bread", "none", {}, {}, true),
        task(trip, "Buy train tickets", "high", day(1)),
        task(trip, "Pack the charger", "none", day(5)),
    };
    // a few subtasks under the report so the detail pane has something to show
    tasks[0].insert(QStringLiteral("notes"), QStringLiteral("Numbers are in the **finance** sheet. Keep it to two pages."));
    tasks[0].insert(QStringLiteral("subtask_count"), 3);
    for (const char *sub : {"Pull the revenue numbers", "Draft the summary", "Get sign-off from Ieva"}) {
        QJsonObject s = task(work, sub, "none", {}, {}, n % 2 == 0);
        s.insert(QStringLiteral("parent_id"), QStringLiteral("t-1"));
        tasks.append(s);
    }
    m_store->upsertMany(Store::Tasks, tasks);
    m_store->upsert(Store::Scratchpads, QJsonObject{
        {QStringLiteral("id"), QStringLiteral("s-demo")}, {QStringLiteral("title"), QStringLiteral("Ideas")},
        {QStringLiteral("content"), QStringLiteral("- Weekly review on Fridays\n- Try the new coffee place\n- Gift for Mia's birthday")},
        {QStringLiteral("updated_at"), now}});
    settle();

    const auto mainShots = [&](const QString &suffix) {
        emit pageRequested(QStringLiteral("today"));
        shoot(main, QStringLiteral("main-today") + suffix);
        emit pageRequested(QStringLiteral("list:l-work"));
        emit taskOpenRequested(QStringLiteral("t-1"));
        shoot(main, QStringLiteral("main-task-detail") + suffix);
    };
    mainShots({});
    emit pageRequested(QStringLiteral("list:l-shop"));
    shoot(main, QStringLiteral("main-list"));
    if (QObject *dialog = main->findChild<QObject *>(QStringLiteral("newListDialog"))) {
        QMetaObject::invokeMethod(dialog, "openNew");
        if (QObject *name = dialog->findChild<QObject *>(QStringLiteral("newListName")))
            name->setProperty("text", QStringLiteral("Groceries"));
        // the offline stub answers the preview with nothing stand in for Jevs pick
        settle(600);
        dialog->setProperty("suggested", QStringLiteral("cart"));
        dialog->setProperty("suggestedFor", QStringLiteral("Groceries"));
        dialog->setProperty("iconsOpen", true);
        shoot(main, QStringLiteral("main-new-list"));
        QMetaObject::invokeMethod(dialog, "close");
    }
    emit pageRequested(QStringLiteral("scratchpads"));
    shoot(main, QStringLiteral("main-scratchpads"));
    emit pageRequested(QStringLiteral("settings"));
    if (QObject *settingsPage = main->findChild<QObject *>(QStringLiteral("settingsPage")))
        settingsPage->setProperty("section", QStringLiteral("desktop"));
    shoot(main, QStringLiteral("main-settings-desktop"));

    const auto popupShots = [&](const QString &suffix) {
        if (QQuickWindow *popup = window(QStringLiteral("popup"))) {
            popup->show();
            popup->setProperty("listId", QString());
            popup->setProperty("view", QStringLiteral("today"));
            shoot(popup, QStringLiteral("popup-today") + suffix);
            popup->setProperty("listId", QStringLiteral("l-shop"));
            popup->setProperty("view", QStringLiteral("list"));
            shoot(popup, QStringLiteral("popup-list") + suffix);
            popup->hide();
        }
    };
    popupShots({});

    if (QQuickWindow *quick = window(QStringLiteral("quickadd"))) {
        quick->show();
        if (QObject *input = quick->findChild<QObject *>(QStringLiteral("quickAddInput")))
            input->setProperty("text", QStringLiteral("Call Ieva tomorrow 3pm !high #call"));
        shoot(quick, QStringLiteral("quick-add"));
        quick->hide();
    }

    m_settings->setStickyScratchpadId(QStringLiteral("s-demo"));
    setStickyShown(true);
    if (QQuickWindow *sticky = window(QStringLiteral("sticky")))
        shoot(sticky, QStringLiteral("sticky-note"));
    setStickyShown(false);

    m_settings->setTheme(QStringLiteral("dark"));
    mainShots(QStringLiteral("-dark"));
    popupShots(QStringLiteral("-dark"));
    main->hide();
    return ok;
}
