package lt.oranges.orangtask.ui.format

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

private val timeFmt = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
private val weekdayFmt = DateTimeFormatter.ofPattern("EEE", Locale.US)
private val monthDayFmt = DateTimeFormatter.ofPattern("MMM d", Locale.US)

/** port of frontend/src/lib/date.ts formatDueDate() */
fun formatDueDate(millis: Long?): String {
    if (millis == null) return ""
    val zone = ZoneId.systemDefault()
    val date = Instant.ofEpochMilli(millis).atZone(zone)
    val diffDays = ChronoUnit.DAYS.between(LocalDate.now(zone), date.toLocalDate())

    val hasTime = date.hour != 0 || date.minute != 0
    val timeStr = if (hasTime) timeFmt.format(date) else ""

    val dayStr = when {
        diffDays == 0L -> "Today"
        diffDays == 1L -> "Tomorrow"
        diffDays == -1L -> "Yesterday"
        diffDays in 2..6 -> weekdayFmt.format(date)
        else -> monthDayFmt.format(date)
    }
    return if (timeStr.isNotEmpty()) "$dayStr, $timeStr" else dayStr
}

fun isOverdue(millis: Long?): Boolean = millis != null && millis < System.currentTimeMillis()

fun dayStartMillis(): Long =
    LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

const val DAY_MILLIS: Long = 86_400_000L
