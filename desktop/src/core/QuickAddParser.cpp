#include "QuickAddParser.h"
#include "Format.h"

#include <QHash>
#include <QRegularExpression>
#include <QTimeZone>
#include <functional>
#include <optional>

namespace {

const QString B0 = QStringLiteral(R"((?:^|(?<=\s)))");
const QString B1 = QStringLiteral(R"((?=$|[\s.,;:!?]))");
constexpr auto IC = QRegularExpression::CaseInsensitiveOption;

QRegularExpression rx(const QString &pattern)
{
    return QRegularExpression(pattern, IC);
}

struct Pattern
{
    QRegularExpression regex;
    QString value;
};

const QList<Pattern> &priorityPatterns()
{
    static const QList<Pattern> list = [] {
        const QList<QPair<QString, QString>> words = {
            {QStringLiteral("high priority"), QStringLiteral("high")},
            {QStringLiteral("low priority"), QStringLiteral("low")},
            {QStringLiteral("medium priority"), QStringLiteral("medium")},
            {QStringLiteral("urgent"), QStringLiteral("high")},
            {QStringLiteral("!high"), QStringLiteral("high")},
            {QStringLiteral("!medium"), QStringLiteral("medium")},
            {QStringLiteral("!low"), QStringLiteral("low")},
            {QStringLiteral("p1"), QStringLiteral("high")},
            {QStringLiteral("p2"), QStringLiteral("medium")},
            {QStringLiteral("p3"), QStringLiteral("low")},
        };
        QList<Pattern> out;
        for (const auto &w : words)
            out.append({rx(B0 + QRegularExpression::escape(w.first) + B1), w.second});
        return out;
    }();
    return list;
}

const QList<Pattern> &recurrencePatterns()
{
    static const QList<Pattern> list = {
        {rx(R"(\bevery day\b|\bdaily\b)"), QStringLiteral("FREQ=DAILY")},
        {rx(R"(\bevery week\b|\bweekly\b)"), QStringLiteral("FREQ=WEEKLY")},
        {rx(R"(\bevery month\b|\bmonthly\b)"), QStringLiteral("FREQ=MONTHLY")},
        {rx(R"(\bevery year\b|\byearly\b|\bannually\b)"), QStringLiteral("FREQ=YEARLY")},
        {rx(R"(\bevery monday\b)"), QStringLiteral("FREQ=WEEKLY;BYDAY=MO")},
        {rx(R"(\bevery tuesday\b)"), QStringLiteral("FREQ=WEEKLY;BYDAY=TU")},
        {rx(R"(\bevery wednesday\b)"), QStringLiteral("FREQ=WEEKLY;BYDAY=WE")},
        {rx(R"(\bevery thursday\b)"), QStringLiteral("FREQ=WEEKLY;BYDAY=TH")},
        {rx(R"(\bevery friday\b)"), QStringLiteral("FREQ=WEEKLY;BYDAY=FR")},
        {rx(R"(\bevery saturday\b)"), QStringLiteral("FREQ=WEEKLY;BYDAY=SA")},
        {rx(R"(\bevery sunday\b)"), QStringLiteral("FREQ=WEEKLY;BYDAY=SU")},
        {rx(R"(\bweekdays\b|\bevery weekday\b)"), QStringLiteral("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")},
    };
    return list;
}

const QHash<QString, int> &weekdays()
{
    static const QHash<QString, int> map = {
        {QStringLiteral("monday"), 1}, {QStringLiteral("mon"), 1},
        {QStringLiteral("tuesday"), 2}, {QStringLiteral("tues"), 2}, {QStringLiteral("tue"), 2},
        {QStringLiteral("wednesday"), 3}, {QStringLiteral("wed"), 3},
        {QStringLiteral("thursday"), 4}, {QStringLiteral("thurs"), 4}, {QStringLiteral("thur"), 4},
        {QStringLiteral("thu"), 4},
        {QStringLiteral("friday"), 5}, {QStringLiteral("fri"), 5},
        {QStringLiteral("saturday"), 6}, {QStringLiteral("sat"), 6},
        {QStringLiteral("sunday"), 7}, {QStringLiteral("sun"), 7},
    };
    return map;
}

const QHash<QString, int> &months()
{
    static const QHash<QString, int> map = {
        {QStringLiteral("january"), 1}, {QStringLiteral("jan"), 1},
        {QStringLiteral("february"), 2}, {QStringLiteral("feb"), 2},
        {QStringLiteral("march"), 3}, {QStringLiteral("mar"), 3},
        {QStringLiteral("april"), 4}, {QStringLiteral("apr"), 4},
        {QStringLiteral("may"), 5},
        {QStringLiteral("june"), 6}, {QStringLiteral("jun"), 6},
        {QStringLiteral("july"), 7}, {QStringLiteral("jul"), 7},
        {QStringLiteral("august"), 8}, {QStringLiteral("aug"), 8},
        {QStringLiteral("september"), 9}, {QStringLiteral("sept"), 9}, {QStringLiteral("sep"), 9},
        {QStringLiteral("october"), 10}, {QStringLiteral("oct"), 10},
        {QStringLiteral("november"), 11}, {QStringLiteral("nov"), 11},
        {QStringLiteral("december"), 12}, {QStringLiteral("dec"), 12},
    };
    return map;
}

const QString WEEKDAY_ALT = QStringLiteral(
    "monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun");
const QString MONTH_ALT = QStringLiteral(
    "january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|"
    "september|sept|sep|october|oct|november|nov|december|dec");
const QString PREP = QStringLiteral(R"((?:(?:on|by|due)\s+)?)");
const QString TIME_CORE = QStringLiteral(R"((?:(\d{1,2}):(\d{2})\s*(am|pm)?|(\d{1,2})\s*(am|pm)|noon|midnight))");

struct DateHit
{
    int start = 0;
    int end = 0;
    QDate date;
    std::optional<QTime> time;
    QDateTime exact;
};

using Resolver = std::function<std::optional<DateHit>(const QRegularExpressionMatch &, const QDateTime &)>;

struct DateRule
{
    QRegularExpression regex;
    Resolver resolve;
};

DateHit hitOf(const QRegularExpressionMatch &m, const QDate &date, std::optional<QTime> time = {},
              const QDateTime &exact = {})
{
    return DateHit{int(m.capturedStart(0)), int(m.capturedEnd(0)), date, time, exact};
}

std::optional<DateHit> monthDayHit(const QRegularExpressionMatch &m, const QDateTime &now,
                                   int monthGroup, int dayGroup, int yearGroup)
{
    const int month = months().value(m.captured(monthGroup).toLower(), 0);
    if (!month)
        return std::nullopt;
    bool ok = false;
    const int day = m.captured(dayGroup).toInt(&ok);
    if (!ok)
        return std::nullopt;
    bool hasYear = false;
    const int year = m.captured(yearGroup).toInt(&hasYear);
    QDate date(hasYear ? year : now.date().year(), month, day);
    if (!date.isValid())
        return std::nullopt;
    if (!hasYear && date < now.date())
        date = date.addYears(1);
    return hitOf(m, date);
}

const QList<DateRule> &dateRules()
{
    static const QList<DateRule> rules = {
        {rx(B0 + PREP + QStringLiteral("today") + B1),
         [](const auto &m, const auto &now) { return std::optional(hitOf(m, now.date())); }},
        {rx(B0 + PREP + QStringLiteral("tonight") + B1),
         [](const auto &m, const auto &now) { return std::optional(hitOf(m, now.date(), QTime(20, 0))); }},
        {rx(B0 + PREP + QStringLiteral("(?:tomorrow|tmrw|tmr)") + B1),
         [](const auto &m, const auto &now) { return std::optional(hitOf(m, now.date().addDays(1))); }},
        {rx(B0 + PREP + QStringLiteral("next week") + B1),
         [](const auto &m, const auto &now) { return std::optional(hitOf(m, now.date().addDays(7))); }},
        {rx(B0 + PREP + QStringLiteral("next month") + B1),
         [](const auto &m, const auto &now) { return std::optional(hitOf(m, now.date().addMonths(1))); }},
        {rx(B0 + QStringLiteral(R"(in\s+(\d+)\s*(minutes|minute|mins|min|hours|hour|hrs|hr))") + B1),
         [](const auto &m, const auto &now) -> std::optional<DateHit> {
             bool ok = false;
             const qint64 n = m.captured(1).toLongLong(&ok);
             if (!ok)
                 return std::nullopt;
             const QDateTime exact = m.captured(2).startsWith(QLatin1Char('h'), Qt::CaseInsensitive)
                 ? now.addSecs(n * 3600) : now.addSecs(n * 60);
             return hitOf(m, exact.date(), exact.time(), exact);
         }},
        {rx(B0 + QStringLiteral(R"(in\s+(\d+)\s*(days|day|weeks|week|months|month))") + B1),
         [](const auto &m, const auto &now) -> std::optional<DateHit> {
             bool ok = false;
             const int n = m.captured(1).toInt(&ok);
             if (!ok)
                 return std::nullopt;
             const QString unit = m.captured(2).toLower();
             QDate date;
             if (unit.startsWith(QLatin1String("day")))
                 date = now.date().addDays(n);
             else if (unit.startsWith(QLatin1String("week")))
                 date = now.date().addDays(7 * n);
             else
                 date = now.date().addMonths(n);
             return hitOf(m, date);
         }},
        {rx(B0 + PREP + QStringLiteral(R"((next\s+)?()") + WEEKDAY_ALT + QStringLiteral(")") + B1),
         [](const auto &m, const auto &now) -> std::optional<DateHit> {
             const int target = weekdays().value(m.captured(2).toLower(), 0);
             if (!target)
                 return std::nullopt;
             int diff = (target - now.date().dayOfWeek() + 7) % 7;
             if (diff == 0 && !m.captured(1).isEmpty())
                 diff = 7;
             return hitOf(m, now.date().addDays(diff));
         }},
        {rx(B0 + PREP + QStringLiteral("(") + MONTH_ALT
            + QStringLiteral(R"()\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?)") + B1),
         [](const auto &m, const auto &now) { return monthDayHit(m, now, 1, 2, 3); }},
        {rx(B0 + PREP + QStringLiteral(R"((\d{1,2})(?:st|nd|rd|th)?\s+()") + MONTH_ALT
            + QStringLiteral(R"()(?:,?\s+(\d{4}))?)") + B1),
         [](const auto &m, const auto &now) { return monthDayHit(m, now, 2, 1, 3); }},
    };
    return rules;
}

std::optional<QTime> resolveTime(const QRegularExpressionMatch &m)
{
    const QString text = m.captured(0).toLower();
    if (text.contains(QLatin1String("noon")))
        return QTime(12, 0);
    if (text.contains(QLatin1String("midnight")))
        return QTime(0, 0);
    QString hourStr, minuteStr, ampm;
    if (!m.captured(1).isEmpty()) {
        hourStr = m.captured(1);
        minuteStr = m.captured(2);
        ampm = m.captured(3);
    } else {
        hourStr = m.captured(4);
        ampm = m.captured(5);
    }
    bool ok = false;
    int hour = hourStr.toInt(&ok);
    if (!ok)
        return std::nullopt;
    const int minute = minuteStr.isEmpty() ? 0 : minuteStr.toInt();
    ampm = ampm.toLower();
    if (ampm == QLatin1String("pm") && hour >= 1 && hour <= 11)
        hour += 12;
    else if (ampm == QLatin1String("am") && hour == 12)
        hour = 0;
    const QTime t(hour, minute);
    return t.isValid() ? std::optional(t) : std::nullopt;
}

} // namespace

QuickAddParser::QuickAddParser(QObject *parent)
    : QObject(parent)
{
}

ParsedQuickAdd QuickAddParser::parse(const QString &input, const QDateTime &now)
{
    ParsedQuickAdd out;
    QString title = input;

    for (const auto &p : priorityPatterns()) {
        const auto m = p.regex.match(title);
        if (!m.hasMatch())
            continue;
        out.priority = p.value;
        title = title.remove(m.capturedStart(0), m.capturedLength(0)).trimmed();
        break;
    }

    for (const auto &p : recurrencePatterns()) {
        const auto m = p.regex.match(title);
        if (!m.hasMatch())
            continue;
        out.recurrenceRule = p.value;
        title = title.remove(m.capturedStart(0), m.capturedLength(0)).trimmed();
        break;
    }

    std::optional<DateHit> best;
    for (const auto &rule : dateRules()) {
        const auto m = rule.regex.match(title);
        if (!m.hasMatch())
            continue;
        const auto hit = rule.resolve(m, now);
        if (!hit)
            continue;
        if (!best || hit->start < best->start || (hit->start == best->start && hit->end > best->end))
            best = hit;
    }

    static const QRegularExpression afterDateTime(
        QStringLiteral(R"(^,?\s+(?:at\s+)?)") + TIME_CORE + B1, IC);
    static const QRegularExpression standaloneTime(
        B0 + QStringLiteral(R"((?:at\s+)?)") + TIME_CORE + B1, IC);

    if (best && !best->exact.isValid()) {
        const auto m = afterDateTime.match(title.mid(best->end));
        if (m.hasMatch()) {
            if (const auto time = resolveTime(m)) {
                best->time = time;
                best->end += int(m.capturedEnd(0));
            }
        }
    } else if (!best) {
        const auto m = standaloneTime.match(title);
        if (m.hasMatch()) {
            if (const auto time = resolveTime(m)) {
                QDate date = now.date();
                if (!(*time > now.time()))
                    date = date.addDays(1);
                best = DateHit{int(m.capturedStart(0)), int(m.capturedEnd(0)), date, time, {}};
            }
        }
    }

    if (best) {
        title = title.remove(best->start, best->end - best->start).trimmed();
        if (best->exact.isValid())
            out.dueAt = best->exact;
        else
            out.dueAt = QDateTime(best->date, best->time.value_or(QTime(23, 59)), now.timeZone());
    }

    static const QRegularExpression trailingPrep(QStringLiteral(R"(\s+(on|at|by|in|every)\s*$)"), IC);
    static const QRegularExpression spaces(QStringLiteral(R"(\s{2,})"));
    title = title.remove(trailingPrep).trimmed();
    title = title.replace(spaces, QStringLiteral(" ")).trimmed();
    out.title = title;
    return out;
}

QVariantMap QuickAddParser::preview(const QString &input) const
{
    const ParsedQuickAdd p = parse(input);
    const QString due = Format::toIso(p.dueAt);
    return {
        {QStringLiteral("title"), p.title},
        {QStringLiteral("due"), due},
        {QStringLiteral("dueLabel"), Format::dueLabel(due)},
        {QStringLiteral("priority"), p.priority},
        {QStringLiteral("recurrence"), p.recurrenceRule},
    };
}
