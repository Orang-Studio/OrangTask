package lt.oranges.orangtask.tasks

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

const val MAX_INTERVAL = 999
const val MAX_COUNT = 999

const val LAST_WEEK_ORDINAL = -1

private val UNTIL_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd")

enum class RecurrenceFreq(val code: String) {
    DAILY("DAILY"),
    WEEKLY("WEEKLY"),
    MONTHLY("MONTHLY"),
    YEARLY("YEARLY"),
}

enum class MonthlyMode { DAY_OF_MONTH, DAY_OF_WEEK }

enum class RecurrenceEnd { NEVER, ON_DATE, AFTER_COUNT }

data class Recurrence(
    val freq: RecurrenceFreq = RecurrenceFreq.WEEKLY,
    val interval: Int = 1,
    val byDay: Set<DayOfWeek> = emptySet(),
    val monthlyMode: MonthlyMode = MonthlyMode.DAY_OF_MONTH,
    val monthDay: Int = 1,
    val weekOrdinal: Int = 1,
    val monthWeekday: DayOfWeek = DayOfWeek.MONDAY,
    val count: Int? = null,
    val until: LocalDate? = null,
) {
    val end: RecurrenceEnd
        get() = when {
            count != null -> RecurrenceEnd.AFTER_COUNT
            until != null -> RecurrenceEnd.ON_DATE
            else -> RecurrenceEnd.NEVER
        }

    fun toRrule(): String = buildString {
        append("FREQ=").append(freq.code)
        if (interval > 1) append(";INTERVAL=").append(interval)
        when (freq) {
            RecurrenceFreq.WEEKLY ->
                if (byDay.isNotEmpty()) {
                    append(";BYDAY=").append(byDay.sortedBy { it.value }.joinToString(",") { it.rruleCode })
                }
            RecurrenceFreq.MONTHLY -> when (monthlyMode) {
                MonthlyMode.DAY_OF_MONTH -> append(";BYMONTHDAY=").append(monthDay)
                MonthlyMode.DAY_OF_WEEK ->
                    append(";BYDAY=").append(weekOrdinal).append(monthWeekday.rruleCode)
            }
            else -> Unit
        }
        count?.let { append(";COUNT=").append(it) }
        until?.let { append(";UNTIL=").append(UNTIL_FORMAT.format(it)).append("T000000Z") }
    }
}

val DayOfWeek.rruleCode: String
    get() = when (this) {
        DayOfWeek.MONDAY -> "MO"
        DayOfWeek.TUESDAY -> "TU"
        DayOfWeek.WEDNESDAY -> "WE"
        DayOfWeek.THURSDAY -> "TH"
        DayOfWeek.FRIDAY -> "FR"
        DayOfWeek.SATURDAY -> "SA"
        DayOfWeek.SUNDAY -> "SU"
    }

private fun dayFromCode(code: String): DayOfWeek? = when (code) {
    "MO" -> DayOfWeek.MONDAY
    "TU" -> DayOfWeek.TUESDAY
    "WE" -> DayOfWeek.WEDNESDAY
    "TH" -> DayOfWeek.THURSDAY
    "FR" -> DayOfWeek.FRIDAY
    "SA" -> DayOfWeek.SATURDAY
    "SU" -> DayOfWeek.SUNDAY
    else -> null
}

private val KNOWN_PARTS = setOf(
    "FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYSETPOS", "COUNT", "UNTIL", "WKST",
)

private val BYDAY_ENTRY = Regex("""^([+-]?\d+)?([A-Z]{2})$""")

fun parseRecurrence(rule: String?): Recurrence? {
    val body = rule?.trim()?.removePrefix("RRULE:")?.trim()?.uppercase() ?: return null
    if (body.isEmpty()) return null

    val parts = mutableMapOf<String, String>()
    for (chunk in body.split(';')) {
        if (chunk.isBlank()) continue
        val key = chunk.substringBefore('=', "")
        val value = chunk.substringAfter('=', "")
        if (key.isEmpty() || value.isEmpty()) return null
        if (key !in KNOWN_PARTS) return null
        parts[key] = value
    }

    val freq = RecurrenceFreq.entries.find { it.code == parts["FREQ"] } ?: return null
    val interval = parts["INTERVAL"]?.let { it.toIntOrNull() ?: return null } ?: 1
    if (interval < 1 || interval > MAX_INTERVAL) return null

    val byDayRaw = parts["BYDAY"]?.split(',')?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()
    val byDayEntries = byDayRaw.map { entry ->
        val match = BYDAY_ENTRY.matchEntire(entry) ?: return null
        val ordinal = match.groupValues[1].takeIf { it.isNotEmpty() }?.toIntOrNull()
        val day = dayFromCode(match.groupValues[2]) ?: return null
        ordinal to day
    }

    val count = parts["COUNT"]?.let { it.toIntOrNull()?.takeIf { n -> n in 1..MAX_COUNT } ?: return null }
    val until = parts["UNTIL"]?.let { raw ->
        val datePart = raw.substringBefore('T')
        if (datePart.length != 8) return null
        try {
            LocalDate.parse(datePart, UNTIL_FORMAT)
        } catch (_: DateTimeParseException) {
            return null
        }
    }
    if (count != null && until != null) return null

    var result = Recurrence(freq = freq, interval = interval, count = count, until = until)

    when (freq) {
        RecurrenceFreq.WEEKLY -> {
            if (byDayEntries.any { it.first != null }) return null
            if (parts.containsKey("BYMONTHDAY") || parts.containsKey("BYSETPOS")) return null
            result = result.copy(byDay = byDayEntries.map { it.second }.toSet())
        }
        RecurrenceFreq.MONTHLY -> {
            val monthDay = parts["BYMONTHDAY"]?.let {
                it.toIntOrNull()?.takeIf { d -> d in 1..31 } ?: return null
            }
            val setPos = parts["BYSETPOS"]?.let {
                it.toIntOrNull()?.takeIf { p -> p in 1..4 || p == LAST_WEEK_ORDINAL } ?: return null
            }
            result = when {
                monthDay != null && byDayEntries.isEmpty() && setPos == null ->
                    result.copy(monthlyMode = MonthlyMode.DAY_OF_MONTH, monthDay = monthDay)

                // either BYDAY 2TU or the equivalent BYDAY TU BYSETPOS 2
                monthDay == null && byDayEntries.size == 1 -> {
                    val (ordinal, day) = byDayEntries.single()
                    val effective = ordinal ?: setPos ?: return null
                    if (ordinal != null && setPos != null && ordinal != setPos) return null
                    if (effective !in 1..4 && effective != LAST_WEEK_ORDINAL) return null
                    result.copy(
                        monthlyMode = MonthlyMode.DAY_OF_WEEK,
                        weekOrdinal = effective,
                        monthWeekday = day,
                    )
                }

                monthDay == null && byDayEntries.isEmpty() && setPos == null ->
                    result.copy(monthlyMode = MonthlyMode.DAY_OF_MONTH, monthDay = 1)

                else -> return null
            }
        }
        RecurrenceFreq.DAILY, RecurrenceFreq.YEARLY -> {
            if (byDayEntries.isNotEmpty()) return null
            if (parts.containsKey("BYMONTHDAY") || parts.containsKey("BYSETPOS")) return null
        }
    }

    return result
}

fun defaultRecurrence(freq: RecurrenceFreq, anchor: LocalDate, previous: Recurrence?): Recurrence {
    val base = previous?.copy(freq = freq) ?: Recurrence(freq = freq)
    return when (freq) {
        RecurrenceFreq.WEEKLY ->
            base.copy(byDay = base.byDay.ifEmpty { setOf(anchor.dayOfWeek) })
        RecurrenceFreq.MONTHLY ->
            if (previous?.freq == RecurrenceFreq.MONTHLY) base
            else base.copy(
                monthlyMode = MonthlyMode.DAY_OF_MONTH,
                monthDay = anchor.dayOfMonth,
                weekOrdinal = ((anchor.dayOfMonth - 1) / 7 + 1).coerceAtMost(4),
                monthWeekday = anchor.dayOfWeek,
            )
        else -> base
    }
}

fun weekdayOrder(firstDay: DayOfWeek): List<DayOfWeek> =
    (0..6).map { firstDay.plus(it.toLong()) }
