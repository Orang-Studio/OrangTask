#include "Autostart.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QSettings>
#include <QStandardPaths>

Autostart::Autostart(QObject *parent)
    : QObject(parent)
{
    const QString dataDir = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation);
    QDir().mkpath(dataDir);
    QSettings s(dataDir + QStringLiteral("/settings.ini"), QSettings::IniFormat);
    if (!s.value(QStringLiteral("general/autostartInitialized")).toBool()) {
        s.setValue(QStringLiteral("general/autostartInitialized"), true);
        setEnabled(true);
    }
}

QString Autostart::path()
{
    return QStandardPaths::writableLocation(QStandardPaths::GenericConfigLocation)
        + QStringLiteral("/autostart/lt.oranges.orangtask.desktop");
}

bool Autostart::enabled() const
{
    return QFileInfo::exists(path());
}

void Autostart::setEnabled(bool on)
{
    if (on == enabled())
        return;
    if (on) {
        QDir().mkpath(QFileInfo(path()).absolutePath());
        QFile f(path());
        if (!f.open(QIODevice::WriteOnly | QIODevice::Truncate))
            return;
        f.write("[Desktop Entry]\n"
                "Type=Application\n"
                "Name=OrangTask\n"
                "Exec=orangtask --tray\n"
                "Icon=lt.oranges.orangtask\n"
                "X-GNOME-Autostart-enabled=true\n"
                "X-KDE-autostart-phase=2\n"
                "NoDisplay=true\n");
    } else {
        QFile::remove(path());
    }
    emit enabledChanged();
}
