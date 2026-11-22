#include "app/AppController.h"
#include "app/DBusInterface.h"
#include "core/ApiClient.h"
#include "core/AuthManager.h"
#include "core/Format.h"
#include "core/I18n.h"
#include "core/IconProvider.h"
#include "core/QuickAddParser.h"
#include "core/Settings.h"
#include "core/Store.h"
#include "core/SyncEngine.h"
#include "models/ListModel.h"
#include "models/ScratchpadModel.h"
#include "models/TaskModel.h"
#include "system/Autostart.h"
#include "system/KRunner.h"
#include "system/Notifier.h"
#include "system/ReminderScheduler.h"
#include "system/TrayController.h"

#include <QApplication>
#include <QDBusConnection>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QStandardPaths>
#include <QDBusConnectionInterface>
#include <QDBusMessage>
#include <QFontDatabase>
#include <QIcon>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QQuickWindow>

static const QString ServiceName = QStringLiteral("lt.oranges.orangtask");

// a second orangtask launcher orangtask link KRunner restart hands its arguments to the running instance and exits
static bool forwardToRunningInstance(const QStringList &args)
{
    QDBusConnection bus = QDBusConnection::sessionBus();
    if (!bus.isConnected())
        return false;
    if (bus.registerService(ServiceName))
        return false;
    QDBusMessage msg = QDBusMessage::createMethodCall(ServiceName, QStringLiteral("/app"),
                                                      QStringLiteral("lt.oranges.orangtask.App"),
                                                      QStringLiteral("Activate"));
    msg << args;
    const QDBusMessage reply = bus.call(msg, QDBus::Block, 5000);
    return reply.type() == QDBusMessage::ReplyMessage;
}

static void loadFonts()
{
    for (const char *w : {"Regular", "Medium", "SemiBold", "Bold"})
        QFontDatabase::addApplicationFont(QStringLiteral(":/qt/qml/OrangTask/assets/fonts/DMSans-%1.ttf").arg(QLatin1String(w)));
    QFont f(QStringLiteral("DM Sans"));
    f.setPointSizeF(10.5);
    f.setHintingPreference(QFont::PreferNoHinting);
    QGuiApplication::setFont(f);
}

static void migrateLegacyStorage()
{
    const QString targetDir = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation);
    if (targetDir.isEmpty())
        return;
    QDir().mkpath(targetDir);

    const QString home = QDir::homePath();
    const QString legacyDataDir = home + QStringLiteral("/.local/share/OrangTask/orangtask");
    const auto copyIfMissing = [](const QString &src, const QString &dst, bool privateFile) {
        if (!QFileInfo::exists(src) || QFileInfo::exists(dst))
            return;
        if (QFile::copy(src, dst) && privateFile)
            QFile::setPermissions(dst, QFileDevice::ReadOwner | QFileDevice::WriteOwner);
    };
    copyIfMissing(legacyDataDir + QStringLiteral("/cache.db"), targetDir + QStringLiteral("/cache.db"), false);
    copyIfMissing(legacyDataDir + QStringLiteral("/cache.db-wal"), targetDir + QStringLiteral("/cache.db-wal"), false);
    copyIfMissing(legacyDataDir + QStringLiteral("/cache.db-shm"), targetDir + QStringLiteral("/cache.db-shm"), false);
    copyIfMissing(legacyDataDir + QStringLiteral("/session.json"), targetDir + QStringLiteral("/session.json"), true);
    copyIfMissing(home + QStringLiteral("/.config/OrangTask/orangtask.ini"), targetDir + QStringLiteral("/settings.ini"), false);
}

int main(int argc, char *argv[])
{
    QApplication::setOrganizationName(QStringLiteral("OrangStudio"));
    QApplication::setApplicationName(QStringLiteral("OrangTasks"));
    QApplication::setApplicationDisplayName(QStringLiteral("OrangTask"));
    QApplication::setApplicationVersion(QStringLiteral(ORANGTASK_VERSION));
    QGuiApplication::setDesktopFileName(ServiceName);
    QQuickWindow::setTextRenderType(QQuickWindow::NativeTextRendering);

    QApplication qapp(argc, argv);
    migrateLegacyStorage();
    qapp.setQuitOnLastWindowClosed(false);
    qapp.setWindowIcon(QIcon::fromTheme(ServiceName, QIcon(QStringLiteral(":/qt/qml/OrangTask/assets/logo.svg"))));

    const QStringList args = qapp.arguments().mid(1);
    const bool offscreenRun = args.contains(QStringLiteral("--self-test")) || args.contains(QStringLiteral("--screenshots"));
    if (!offscreenRun && forwardToRunningInstance(args))
        return 0;

    if (args.contains(QStringLiteral("--screenshots")))
        qputenv("ORANGTASK_URL", AppController::startScreenshotServer(&qapp).toUtf8());

    loadFonts();
    QQuickStyle::setStyle(QStringLiteral("Basic"));
    KRunner::registerTypes();

    AppController app;

    const char *core = "OrangTask.Core";
    qmlRegisterSingletonInstance(core, 1, 0, "App", &app);
    qmlRegisterSingletonInstance(core, 1, 0, "AppSettings", app.settings());
    qmlRegisterSingletonInstance(core, 1, 0, "I18n", app.i18n());
    qmlRegisterSingletonInstance(core, 1, 0, "Api", app.api());
    qmlRegisterSingletonInstance(core, 1, 0, "Auth", app.auth());
    qmlRegisterSingletonInstance(core, 1, 0, "Sync", app.sync());
    qmlRegisterSingletonInstance(core, 1, 0, "Store", app.store());
    Format format;
    qmlRegisterSingletonInstance(core, 1, 0, "Format", &format);
    QuickAddParser quickAdd;
    qmlRegisterSingletonInstance(core, 1, 0, "QuickAdd", &quickAdd);
    Autostart autostart;
    qmlRegisterSingletonInstance(core, 1, 0, "Autostart", &autostart);
    qmlRegisterType<TaskModel>(core, 1, 0, "TaskModel");
    qmlRegisterType<ListModel>(core, 1, 0, "ListsModel");
    qmlRegisterType<ScratchpadModel>(core, 1, 0, "ScratchpadModel");
    qmlRegisterUncreatableType<AuthManager>(core, 1, 0, "AuthState", QStringLiteral("enum only"));

    QQmlApplicationEngine engine;
    engine.addImageProvider(QStringLiteral("icon"), new IconProvider);
    engine.addImportPath(QStringLiteral("qrc:/qt/qml"));
    app.setEngine(&engine);

    Notifier notifier;
    DBusInterface dbus(&app);
    KRunner runner(&app, &notifier);
    QDBusConnection bus = QDBusConnection::sessionBus();
    bus.registerObject(QStringLiteral("/app"), &dbus, QDBusConnection::ExportAllSlots);
    bus.registerObject(QStringLiteral("/runner"), &runner, QDBusConnection::ExportAllSlots);

    TrayController tray(&app);
    ReminderScheduler reminders(&app, &notifier);

    if (args.contains(QStringLiteral("--self-test"))) {
        engine.setOutputWarningsToStandardError(false);
        return app.selfTest() ? 0 : 1;
    }
    if (const qsizetype i = args.indexOf(QStringLiteral("--screenshots")); i >= 0) {
        return app.captureScreenshots(args.value(i + 1, QStringLiteral("screenshots"))) ? 0 : 1;
    }

    app.start(args);
    return qapp.exec();
}
