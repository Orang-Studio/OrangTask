#include "Settings.h"

#include <QDir>
#include <QRect>
#include <QStandardPaths>

static QString settingsFilePath()
{
    const QString dir = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation);
    QDir().mkpath(dir);
    return dir + QStringLiteral("/settings.ini");
}

Settings::Settings(QObject *parent)
    : QObject(parent)
    , m_s(settingsFilePath(), QSettings::IniFormat)
{
}

QString Settings::serverUrl() const
{
    const QString env = qEnvironmentVariable("ORANGTASK_URL");
    QString url = env.isEmpty() ? get<QString>("server/url", QStringLiteral("https://task.oranges.lt")) : env;
    while (url.endsWith(QLatin1Char('/')))
        url.chop(1);
    return url;
}

#define OT_SETTING(Type, getter, setter, key, fallback)            \
    Type Settings::getter() const { return get<Type>(key, fallback); } \
    void Settings::setter(const Type &v)                            \
    {                                                                  \
        if (put<Type>(key, v)) emit getter##Changed();                 \
    }

#define OT_SETTING_V(Type, getter, setter, key, fallback)             \
    Type Settings::getter() const { return get<Type>(key, fallback); } \
    void Settings::setter(Type v)                                      \
    {                                                                  \
        if (put<Type>(key, v)) emit getter##Changed();                 \
    }

OT_SETTING(QString, theme, setTheme, "ui/theme", QStringLiteral("system"))
OT_SETTING(QString, language, setLanguage, "ui/language", QStringLiteral("system"))
OT_SETTING(QString, popupCorner, setPopupCorner, "tray/popupCorner", QStringLiteral("auto"))
OT_SETTING(QString, popupView, setPopupView, "tray/popupView", QStringLiteral("today"))
OT_SETTING_V(bool, startInTray, setStartInTray, "general/startInTray", true)
OT_SETTING_V(bool, closeToTray, setCloseToTray, "general/closeToTray", true)
OT_SETTING_V(bool, remindersEnabled, setRemindersEnabled, "reminders/enabled", true)
OT_SETTING_V(bool, morningSummary, setMorningSummary, "reminders/morningSummary", true)
OT_SETTING_V(int, morningSummaryHour, setMorningSummaryHour, "reminders/morningSummaryHour", 8)
OT_SETTING_V(bool, badgeEnabled, setBadgeEnabled, "tray/badge", true)
OT_SETTING_V(bool, stickyVisible, setStickyVisible, "sticky/visible", false)
OT_SETTING(QString, stickyScratchpadId, setStickyScratchpadId, "sticky/scratchpadId", QString())
OT_SETTING_V(int, sidebarWidth, setSidebarWidth, "ui/sidebarWidth", 240)
OT_SETTING_V(bool, sidebarCollapsed, setSidebarCollapsed, "ui/sidebarCollapsed", false)
OT_SETTING_V(int, detailWidth, setDetailWidth, "ui/detailWidth", 400)

QVariant Settings::value(const QString &key, const QVariant &fallback) const
{
    return m_s.value(key, fallback);
}

void Settings::setValue(const QString &key, const QVariant &value)
{
    m_s.setValue(key, value);
}

QRect Settings::stickyGeometry() const { return m_s.value(QStringLiteral("sticky/geometry")).toRect(); }
void Settings::setStickyGeometry(const QRect &r) { m_s.setValue(QStringLiteral("sticky/geometry"), r); }
QRect Settings::mainGeometry() const { return m_s.value(QStringLiteral("ui/mainGeometry")).toRect(); }
void Settings::setMainGeometry(const QRect &r) { m_s.setValue(QStringLiteral("ui/mainGeometry"), r); }
