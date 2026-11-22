#include "KWin.h"

#include <QDBusConnection>
#include <QDBusConnectionInterface>
#include <QDBusInterface>
#include <QDBusReply>
#include <QDir>
#include <QFile>
#include <QGuiApplication>
#include <QStandardPaths>

namespace KWin {

static const QString Service = QStringLiteral("org.kde.KWin");

static QDBusInterface scripting()
{
    return QDBusInterface(Service, QStringLiteral("/Scripting"), QStringLiteral("org.kde.kwin.Scripting"));
}

bool available()
{
    static const bool yes = QGuiApplication::platformName().startsWith(QLatin1String("wayland"))
        && QDBusConnection::sessionBus().interface()->isServiceRegistered(Service);
    return yes;
}

void unload(const QString &name)
{
    if (available())
        scripting().call(QStringLiteral("unloadScript"), name);
}

bool run(const QString &name, const QString &source, bool keep)
{
    if (!available())
        return false;
    const QString dir = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation) + QStringLiteral("/kwin");
    QDir().mkpath(dir);
    const QString path = dir + QLatin1Char('/') + name + QLatin1String(".js");
    QFile f(path);
    if (!f.open(QIODevice::WriteOnly | QIODevice::Truncate))
        return false;
    f.write(source.toUtf8());
    f.close();

    unload(name);
    const QDBusReply<int> id = scripting().call(QStringLiteral("loadScript"), path, name);
    if (!id.isValid() || id.value() < 0)
        return false;
    QDBusInterface script(Service, QStringLiteral("/Scripting/Script%1").arg(id.value()),
                          QStringLiteral("org.kde.kwin.Script"));
    const bool ok = script.call(QStringLiteral("run")).type() != QDBusMessage::ErrorMessage;
    if (!keep)
        unload(name);
    return ok;
}

QString reply(const QString &tag, const QString &valueExpr)
{
    return QStringLiteral("callDBus(\"lt.oranges.orangtask\", \"/app\", \"lt.oranges.orangtask.App\", "
                          "\"KWinReply\", \"%1\", String(%2));").arg(tag, valueExpr);
}

} // namespace KWin
