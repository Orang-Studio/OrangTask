package lt.oranges.orangtask.tasks

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime

/** natural-language quick add frontend/src/lib/chrono.ts in Kotlin */
data class ParsedQuickAdd(
    val title: String,
    val dueAt: Instant?,
    val priority: String,
    val recurrenceRule: String?,
) {
    val dueAtMillis: Long? get() = dueAt?.toEpochMilli()
}

// word-ish boundaries; \b alone cant start a match at "!high"
private const val B0 = """(?:^|(?<=\s))"""
private const val B1 = """(?=$|[\s.,;:!?])"""

private val IC = RegexOption.IGNORE_CASE

private val PRIORITY_PATTERNS: List<Pair<Regex, String>> = listOf(
    "high priority" to "high",
    "low priority" to "low",
    "medium priority" to "medium",
    "urgent" to "high",
    "!high" to "high",
    "!medium" to "medium",
    "!low" to "low",
    "p1" to "high",
    "p2" to "medium",
    "p3" to "low",
).map { (word, level) -> Regex(B0 + Regex.escape(word) + B1, IC) to level }

private val RECURRENCE_PATTERNS: List<Pair<Regex, String>> = listOf(
    Regex("""\bevery day\b|\bdaily\b""", IC) to "FREQ=DAILY",
    Regex("""\bevery week\b|\bweekly\b""", IC) to "FREQ=WEEKLY",
    Regex("""\bevery month\b|\bmonthly\b""", IC) to "FREQ=MONTHLY",
    Regex("""\bevery year\b|\byearly\b|\bannually\b""", IC) to "FREQ=YEARLY",
    Regex("""\bevery monday\b""", IC) to "FREQ=WEEKLY;BYDAY=MO",
    Regex("""\bevery tuesday\b""", IC) to "FREQ=WEEKLY;BYDAY=TU",
    Regex("""\bevery wednesday\b""", IC) to "FREQ=WEEKLY;BYDAY=WE",
    Regex("""\bevery thursday\b""", IC) to "FREQ=WEEKLY;BYDAY=TH",
    Regex("""\bevery friday\b""", IC) to "FREQ=WEEKLY;BYDAY=FR",
    Regex("""\bevery saturday\b""", IC) to "FREQ=WEEKLY;BYDAY=SA",
    Regex("""\bevery sunday\b""", IC) to "FREQ=WEEKLY;BYDAY=SU",
    Regex("""\bweekdays\b|\bevery weekday\b""", IC) to "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
)

private val WEEKDAYS = mapOf(
    "monday" to DayOfWeek.MONDAY, "mon" to DayOfWeek.MONDAY,
    "tuesday" to DayOfWeek.TUESDAY, "tues" to DayOfWeek.TUESDAY, "tue" to DayOfWeek.TUESDAY,
    "wednesday" to DayOfWeek.WEDNESDAY, "wed" to DayOfWeek.WEDNESDAY,
    "thursday" to DayOfWeek.THURSDAY, "thurs" to DayOfWeek.THURSDAY, "thur" to DayOfWeek.THURSDAY,
    "thu" to DayOfWeek.THURSDAY,
    "friday" to DayOfWeek.FRIDAY, "fri" to DayOfWeek.FRIDAY,
    "saturday" to DayOfWeek.SATURDAY, "sat" to DayOfWeek.SATURDAY,
    "sunday" to DayOfWeek.SUNDAY, "sun" to DayOfWeek.SUNDAY,
)

private val MONTHS = mapOf(
    "january" to 1, "jan" to 1, "february" to 2, "feb" to 2, "march" to 3, "mar" to 3,
    "april" to 4, "apr" to 4, "may" to 5, "june" to 6, "jun" to 6, "july" to 7, "jul" to 7,
    "august" to 8, "aug" to 8, "september" to 9, "sept" to 9, "sep" to 9,
    "october" to 10, "oct" to 10, "november" to 11, "nov" to 11, "december" to 12, "dec" to 12,
)

private const val WEEKDAY_ALT =
    "monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun"
private const val MONTH_ALT =
    "january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|" +
        "september|sept|sep|october|oct|november|nov|december|dec"

// leading preposition is part of the match so "report by friday" "report"
private const val PREP = """(?:(?:on|by|due)\s+)?"""

private const val TIME_CORE =
    """(?:(\d{1,2}):(\d{2})\s*(am|pm)?|(\d{1,2})\s*(am|pm)|noon|midnight)"""

private val AFTER_DATE_TIME = Regex("""^,?\s+(?:at\s+)?$TIME_CORE$B1""", IC)
private val STANDALONE_TIME = Regex("""$B0(?:at\s+)?$TIME_CORE$B1""", IC)

/** a date/time phrase found in the input, with the character range it covers */
private class DateHit(
    val start: Int,
    var end: Int,
    val date: LocalDate?,
    var time: LocalTime?,
    val exact: ZonedDateTime? = null,
)

private class DateRule(pattern: String, val resolve: (MatchResult, ZonedDateTime) -> DateHit?) {
    val regex = Regex(B0 + pattern + B1, IC)
}

private fun MatchResult.hit(date: LocalDate?, time: LocalTime? = null, exact: ZonedDateTime? = null) =
    DateHit(range.first, range.last + 1, date, time, exact)

private val DATE_RULES = listOf(
    DateRule("${PREP}today") { m, now -> m.hit(now.toLocalDate()) },
    DateRule("${PREP}tonight") { m, now -> m.hit(now.toLocalDate(), LocalTime.of(20, 0)) },
    DateRule("$PREP(?:tomorrow|tmrw|tmr)") { m, now -> m.hit(now.toLocalDate().plusDays(1)) },
    DateRule("${PREP}next week") { m, now -> m.hit(now.toLocalDate().plusDays(7)) },
    DateRule("${PREP}next month") { m, now -> m.hit(now.toLocalDate().plusMonths(1)) },
    DateRule("""in\s+(\d+)\s*(minutes|minute|mins|min|hours|hour|hrs|hr)""") { m, now ->
        val n = m.groupValues[1].toLongOrNull() ?: return@DateRule null
        val exact = if (m.groupValues[2].startsWith("h", ignoreCase = true)) now.plusHours(n) else now.plusMinutes(n)
        m.hit(exact.toLocalDate(), exact.toLocalTime(), exact)
    },
    DateRule("""in\s+(\d+)\s*(days|day|weeks|week|months|month)""") { m, now ->
        val n = m.groupValues[1].toLongOrNull() ?: return@DateRule null
        val date = when (m.groupValues[2].lowercase().trimEnd('s')) {
            "day" -> now.toLocalDate().plusDays(n)
            "week" -> now.toLocalDate().plusWeeks(n)
            else -> now.toLocalDate().plusMonths(n)
        }
        m.hit(date)
    },
    DateRule("""$PREP(next\s+)?($WEEKDAY_ALT)""") { m, now ->
        val target = WEEKDAYS[m.groupValues[2].lowercase()] ?: return@DateRule null
        var diff = (target.value - now.dayOfWeek.value + 7) % 7
        if (diff == 0 && m.groupValues[1].isNotEmpty()) diff = 7 // "next friday" on a Friday
        m.hit(now.toLocalDate().plusDays(diff.toLong()))
    },
    DateRule("""$PREP($MONTH_ALT)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?""") { m, now ->
        monthDayHit(m, now, monthGroup = 1, dayGroup = 2, yearGroup = 3)
    },
    DateRule("""$PREP(\d{1,2})(?:st|nd|rd|th)?\s+($MONTH_ALT)(?:,?\s+(\d{4}))?""") { m, now ->
        monthDayHit(m, now, monthGroup = 2, dayGroup = 1, yearGroup = 3)
    },
)

private fun monthDayHit(m: MatchResult, now: ZonedDateTime, monthGroup: Int, dayGroup: Int, yearGroup: Int): DateHit? {
    val month = MONTHS[m.groupValues[monthGroup].lowercase()] ?: return null
    val day = m.groupValues[dayGroup].toIntOrNull() ?: return null
    val year = m.groupValues[yearGroup].toIntOrNull()
    var date = runCatching { LocalDate.of(year ?: now.year, month, day) }.getOrNull() ?: return null
    // no explicit year the next occurrence (chronos forwardDate)
    if (year == null && date.isBefore(now.toLocalDate())) date = date.plusYears(1)
    return m.hit(date)
}

private fun resolveTime(m: MatchResult): LocalTime? {
    val text = m.value.lowercase()
    if (text.contains("noon")) return LocalTime.NOON
    if (text.contains("midnight")) return LocalTime.MIDNIGHT
    val (hourStr, minuteStr, ampm) =
        if (m.groupValues[1].isNotEmpty()) Triple(m.groupValues[1], m.groupValues[2], m.groupValues[3])
        else Triple(m.groupValues[4], "", m.groupValues[5])
    var hour = hourStr.toIntOrNull() ?: return null
    val minute = minuteStr.toIntOrNull() ?: 0
    when (ampm.lowercase()) {
        "pm" -> if (hour in 1..11) hour += 12
        "am" -> if (hour == 12) hour = 0
        // no am/pm ("17:30") 24h clock, take as-is
    }
    return runCatching { LocalTime.of(hour, minute) }.getOrNull()
}

fun parseQuickAdd(input: String, now: ZonedDateTime = ZonedDateTime.now()): ParsedQuickAdd {
    var title = input
    var priority = "none"

    // priority first keyword in table order, like the web
    for ((regex, level) in PRIORITY_PATTERNS) {
        val match = regex.find(title) ?: continue
        priority = level
        title = title.removeRange(match.range).trim()
        break
    }

    // recurrence must run before date parsing so the weekday rule never sees the day name inside
    var recurrenceRule: String? = null
    for ((regex, rule) in RECURRENCE_PATTERNS) {
        val match = regex.find(title) ?: continue
        recurrenceRule = rule
        title = title.removeRange(match.range).trim()
        break
    }

    // date: earliest match wins; ties go to the longest (like chronos first result)
    var best: DateHit? = null
    for (rule in DATE_RULES) {
        val match = rule.regex.find(title) ?: continue
        val hit = rule.resolve(match, now) ?: continue
        val current = best
        if (current == null || hit.start < current.start ||
            (hit.start == current.start && hit.end > current.end)
        ) {
            best = hit
        }
    }

    val dated = best
    if (dated != null && dated.exact == null) {
        // a time right after the date ("friday at 5pm", "tomorrow 9am")
        val match = AFTER_DATE_TIME.find(title.substring(dated.end))
        if (match != null) {
            val time = resolveTime(match)
            if (time != null) {
                dated.time = time
                dated.end += match.range.last + 1
            }
        }
    } else if (dated == null) {
        // bare time today, or tomorrow once it has passed (forwardDate)
        val match = STANDALONE_TIME.find(title)
        if (match != null) {
            val time = resolveTime(match)
            if (time != null) {
                var date = now.toLocalDate()
                if (!time.isAfter(now.toLocalTime())) date = date.plusDays(1)
                best = DateHit(match.range.first, match.range.last + 1, date, time)
            }
        }
    }

    val hit = best
    val dueAt: Instant? = if (hit == null) null else {
        title = title.removeRange(hit.start, hit.end).trim()
        when {
            hit.exact != null -> hit.exact.toInstant()
            // date without a time defaults to end of day same as the Today views quick add, and never instantly
            else -> hit.date!!.atTime(hit.time ?: LocalTime.of(23, 59)).atZone(now.zone).toInstant()
        }
    }

    // leftover prepositions and double spaces (web cleanup, verbatim)
    title = title.replace(Regex("""\s+(on|at|by|in|every)\s*$""", IC), "").trim()
    title = title.replace(Regex("""\s{2,}"""), " ").trim()

    return ParsedQuickAdd(title, dueAt, priority, recurrenceRule)
}
