package lt.oranges.orangtask.ui.format

import androidx.compose.runtime.Composable
import lt.oranges.orangtask.core.i18n.tr
import lt.oranges.orangtask.R
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

@Composable
fun formatDueDate(millis: Long?): String {
    if (millis == null) return ""
    val zone = ZoneId.systemDefault()
    val date = Instant.ofEpochMilli(millis).atZone(zone)
    val diffDays = ChronoUnit.DAYS.between(LocalDate.now(zone), date.toLocalDate())

    val hasTime = date.hour != 0 || date.minute != 0
    val timeFmt = DateTimeFormatter.ofPattern(
        tr(R.string.date_time_format),
        Locale.getDefault(),
    )
    val weekdayFmt = DateTimeFormatter.ofPattern(
        tr(R.string.date_weekday_format),
        Locale.getDefault(),
    )
    val monthDayFmt = DateTimeFormatter.ofPattern(
        tr(R.string.date_month_day_format),
        Locale.getDefault(),
    )
    val timeStr = if (hasTime) timeFmt.format(date) else ""

    val dayStr = when {
        diffDays == 0L -> tr(R.string.date_today)
        diffDays == 1L -> tr(R.string.date_tomorrow)
        diffDays == -1L -> tr(R.string.date_yesterday)
        diffDays in 2..6 -> weekdayFmt.format(date)
        else -> monthDayFmt.format(date)
    }
    return if (timeStr.isNotEmpty()) tr(R.string.date_with_time, dayStr, timeStr) else dayStr
}

fun isOverdue(millis: Long?): Boolean = millis != null && millis < System.currentTimeMillis()

fun dayStartMillis(): Long =
    LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

const val DAY_MILLIS: Long = 86_400_000L
