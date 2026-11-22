#pragma once

#include <QObject>
#include <QSettings>
#include <QPoint>
#include <QRect>
#include <QSize>

class Settings : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString serverUrl READ serverUrl CONSTANT)
    Q_PROPERTY(QString theme READ theme WRITE setTheme NOTIFY themeChanged)
    Q_PROPERTY(QString language READ language WRITE setLanguage NOTIFY languageChanged)
    Q_PROPERTY(QString popupCorner READ popupCorner WRITE setPopupCorner NOTIFY popupCornerChanged)
    Q_PROPERTY(QString popupView READ popupView WRITE setPopupView NOTIFY popupViewChanged)
    Q_PROPERTY(bool startInTray READ startInTray WRITE setStartInTray NOTIFY startInTrayChanged)
    Q_PROPERTY(bool closeToTray READ closeToTray WRITE setCloseToTray NOTIFY closeToTrayChanged)
    Q_PROPERTY(bool remindersEnabled READ remindersEnabled WRITE setRemindersEnabled NOTIFY remindersEnabledChanged)
    Q_PROPERTY(bool morningSummary READ morningSummary WRITE setMorningSummary NOTIFY morningSummaryChanged)
    Q_PROPERTY(int morningSummaryHour READ morningSummaryHour WRITE setMorningSummaryHour NOTIFY morningSummaryHourChanged)
    Q_PROPERTY(bool badgeEnabled READ badgeEnabled WRITE setBadgeEnabled NOTIFY badgeEnabledChanged)
    Q_PROPERTY(bool stickyVisible READ stickyVisible WRITE setStickyVisible NOTIFY stickyVisibleChanged)
    Q_PROPERTY(QString stickyScratchpadId READ stickyScratchpadId WRITE setStickyScratchpadId NOTIFY stickyScratchpadIdChanged)
    Q_PROPERTY(int sidebarWidth READ sidebarWidth WRITE setSidebarWidth NOTIFY sidebarWidthChanged)
    Q_PROPERTY(bool sidebarCollapsed READ sidebarCollapsed WRITE setSidebarCollapsed NOTIFY sidebarCollapsedChanged)
    Q_PROPERTY(int detailWidth READ detailWidth WRITE setDetailWidth NOTIFY detailWidthChanged)

public:
    explicit Settings(QObject *parent = nullptr);

    QString serverUrl() const;

    QString theme() const;
    void setTheme(const QString &v);
    QString language() const;
    void setLanguage(const QString &v);
    QString popupCorner() const;
    void setPopupCorner(const QString &v);
    QString popupView() const;
    void setPopupView(const QString &v);
    bool startInTray() const;
    void setStartInTray(bool v);
    bool closeToTray() const;
    void setCloseToTray(bool v);
    bool remindersEnabled() const;
    void setRemindersEnabled(bool v);
    bool morningSummary() const;
    void setMorningSummary(bool v);
    int morningSummaryHour() const;
    void setMorningSummaryHour(int v);
    bool badgeEnabled() const;
    void setBadgeEnabled(bool v);
    bool stickyVisible() const;
    void setStickyVisible(bool v);
    QString stickyScratchpadId() const;
    void setStickyScratchpadId(const QString &v);
    int sidebarWidth() const;
    void setSidebarWidth(int v);
    bool sidebarCollapsed() const;
    void setSidebarCollapsed(bool v);
    int detailWidth() const;
    void setDetailWidth(int v);

    Q_INVOKABLE QVariant value(const QString &key, const QVariant &fallback = {}) const;
    Q_INVOKABLE void setValue(const QString &key, const QVariant &value);

    QRect stickyGeometry() const;
    void setStickyGeometry(const QRect &r);
    QRect mainGeometry() const;
    void setMainGeometry(const QRect &r);

signals:
    void themeChanged();
    void languageChanged();
    void popupCornerChanged();
    void popupViewChanged();
    void startInTrayChanged();
    void closeToTrayChanged();
    void remindersEnabledChanged();
    void morningSummaryChanged();
    void morningSummaryHourChanged();
    void badgeEnabledChanged();
    void stickyVisibleChanged();
    void stickyScratchpadIdChanged();
    void sidebarWidthChanged();
    void sidebarCollapsedChanged();
    void detailWidthChanged();

private:
    template<typename T> T get(const char *key, const T &fallback) const
    {
        return m_s.value(QLatin1String(key), QVariant::fromValue(fallback)).template value<T>();
    }
    template<typename T> bool put(const char *key, const T &v)
    {
        if (m_s.contains(QLatin1String(key)) && m_s.value(QLatin1String(key)).template value<T>() == v)
            return false;
        m_s.setValue(QLatin1String(key), QVariant::fromValue(v));
        return true;
    }

    mutable QSettings m_s;
};
