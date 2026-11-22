#include "Format.h"
#include "I18n.h"

#include <QLocale>

Format::Format(QObject *parent)
    : QObject(parent)
{
}

static QLocale uiLocale()
{
    return QLocale(I18n::instance()->language());
}

QDateTime Format::parse(const QString &iso)
{
    if (iso.isEmpty())
        return {};
    QDateTime dt = QDateTime::fromString(iso, Qt::ISODateWithMs);
    if (!dt.isValid())
        dt = QDateTime::fromString(iso, Qt::ISODate);
    return dt.isValid() ? dt.toLocalTime() : QDateTime();
}

QString Format::toIso(const QDateTime &dt)
{
    return dt.isValid() ? dt.toUTC().toString(Qt::ISODateWithMs) : QString();
}

int Format::dayDiff(const QDateTime &dt, const QDateTime &now)
{
    return int(now.date().daysTo(dt.toLocalTime().date()));
}

QString Format::dueLabel(const QString &iso)
{
    const QDateTime dt = parse(iso);
    if (!dt.isValid())
        return {};
    const QLocale loc = uiLocale();
    const int diff = dayDiff(dt);

    QString day;
    if (diff == 0)
        day = tr_("date.today");
    else if (diff == 1)
        day = tr_("date.tomorrow");
    else if (diff == -1)
        day = tr_("date.yesterday");
    else if (diff > 1 && diff < 7)
        day = loc.dayName(dt.date().dayOfWeek(), QLocale::ShortFormat);
    else
        day = loc.monthName(dt.date().month(), QLocale::ShortFormat) + QLatin1Char(' ')
            + QString::number(dt.date().day());

    const QTime t = dt.time();
    if (t.hour() == 0 && t.minute() == 0)
        return day;
    return day + QStringLiteral(", ") + loc.toString(t, QLocale::ShortFormat);
}

bool Format::isOverdue(const QString &iso)
{
    const QDateTime dt = parse(iso);
    return dt.isValid() && dt < QDateTime::currentDateTime();
}

bool Format::isToday(const QString &iso)
{
    const QDateTime dt = parse(iso);
    return dt.isValid() && dt.date() == QDate::currentDate();
}

QString Format::timeLabel(const QString &iso)
{
    const QDateTime dt = parse(iso);
    return dt.isValid() ? uiLocale().toString(dt.time(), QLocale::ShortFormat) : QString();
}

QString Format::relative(const QString &iso)
{
    const QDateTime dt = parse(iso);
    if (!dt.isValid())
        return {};
    const qint64 secs = dt.secsTo(QDateTime::currentDateTime());
    if (secs < 60)
        return I18n::instance()->t(QStringLiteral("desktop.time.justNow"));
    if (secs < 3600)
        return I18n::instance()->tc(QStringLiteral("desktop.time.minutesAgo"), int(secs / 60));
    if (secs < 86400)
        return I18n::instance()->tc(QStringLiteral("desktop.time.hoursAgo"), int(secs / 3600));
    if (secs < 7 * 86400)
        return I18n::instance()->tc(QStringLiteral("desktop.time.daysAgo"), int(secs / 86400));
    return uiLocale().toString(dt.date(), QLocale::ShortFormat);
}

QString Format::toLocalInput(const QString &iso)
{
    const QDateTime dt = parse(iso);
    return dt.isValid() ? dt.toString(QStringLiteral("yyyy-MM-ddTHH:mm")) : QString();
}

QString Format::fromLocalInput(const QString &local)
{
    QDateTime dt = QDateTime::fromString(local, QStringLiteral("yyyy-MM-ddTHH:mm"));
    if (!dt.isValid())
        dt = QDateTime(QDate::fromString(local, QStringLiteral("yyyy-MM-dd")), QTime(0, 0));
    return toIso(dt);
}
