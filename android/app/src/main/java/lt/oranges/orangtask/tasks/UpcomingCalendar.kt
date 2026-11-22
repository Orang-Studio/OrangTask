package lt.oranges.orangtask.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.db.TaskEntity
import lt.oranges.orangtask.core.i18n.tr
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.parseHexColor
import lt.oranges.orangtask.ui.theme.Ink600
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Ink900
import lt.oranges.orangtask.ui.theme.Orange50
import lt.oranges.orangtask.ui.theme.Orange500
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

private const val MAX_DOTS = 3

fun calendarGridStart(month: YearMonth): LocalDate {
    val first = month.atDay(1)
    val weekStart = WeekFields.of(Locale.getDefault()).firstDayOfWeek
    return first.minusDays(((first.dayOfWeek.value - weekStart.value + 7) % 7).toLong())
}

fun calendarWeeks(month: YearMonth): Int {
    val lead = month.atDay(1).toEpochDay() - calendarGridStart(month).toEpochDay()
    return ((lead + month.lengthOfMonth() + 6) / 7).toInt()
}

fun TaskEntity.dueDay(zone: ZoneId = ZoneId.systemDefault()): LocalDate? =
    dueAtMillis?.let { Instant.ofEpochMilli(it).atZone(zone).toLocalDate() }

@Composable
fun UpcomingCalendar(
    month: YearMonth,
    selected: LocalDate,
    tasks: List<TaskEntity>,
    listColors: Map<String, String?>,
    onMonth: (YearMonth) -> Unit,
    onSelect: (LocalDate) -> Unit,
) {
    val dark = isDarkTheme()
    val line = if (dark) Ink700 else Color(0xFFE5E7EB)
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val today = LocalDate.now()
    val start = calendarGridStart(month)
    val weeks = calendarWeeks(month)
    val byDay = tasks.groupBy { it.dueDay() }
    val locale = Locale.getDefault()

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp).height(44.dp),
        ) {
            Text(
                month.month.getDisplayName(TextStyle.FULL_STANDALONE, locale)
                    .replaceFirstChar { it.titlecase(locale) } + " " + month.year,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            Text(
                tr(R.string.today).uppercase(),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                modifier = Modifier
                    .border(1.dp, if (dark) Ink600 else Color(0xFFD1D5DB))
                    .clickable {
                        onMonth(YearMonth.from(today))
                        onSelect(today)
                    }
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            )
            IconButton(onClick = { onMonth(month.minusMonths(1)) }) {
                Icon(Icons.AutoMirrored.Outlined.KeyboardArrowLeft, contentDescription = tr(R.string.previous_month))
            }
            IconButton(onClick = { onMonth(month.plusMonths(1)) }) {
                Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = tr(R.string.next_month))
            }
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            for (i in 0 until 7) {
                Text(
                    start.plusDays(i.toLong()).dayOfWeek.getDisplayName(TextStyle.NARROW_STANDALONE, locale),
                    fontSize = 11.sp,
                    color = muted,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.weight(1f).padding(vertical = 6.dp),
                )
            }
        }
        HorizontalDivider(color = line)
        for (w in 0 until weeks) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (d in 0 until 7) {
                    val day = start.plusDays((w * 7 + d).toLong())
                    val inMonth = day.month == month.month
                    val dayTasks = byDay[day].orEmpty()
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .background(
                                when {
                                    day == selected -> if (dark) Ink700 else Orange50
                                    !inMonth -> if (dark) Ink900 else Color(0xFFF9FAFB)
                                    else -> Color.Transparent
                                },
                            )
                            .clickable {
                                onSelect(day)
                                if (!inMonth) onMonth(YearMonth.from(day))
                            }
                            .padding(top = 4.dp),
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .size(24.dp)
                                .then(if (day == today) Modifier.background(Orange500, CircleShape) else Modifier),
                        ) {
                            Text(
                                day.dayOfMonth.toString(),
                                fontSize = 12.sp,
                                fontWeight = if (day == today) FontWeight.Bold else FontWeight.Normal,
                                color = when {
                                    day == today -> Color.White
                                    inMonth -> MaterialTheme.colorScheme.onSurface
                                    else -> muted
                                },
                            )
                        }
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                            modifier = Modifier.padding(top = 4.dp),
                        ) {
                            dayTasks.take(MAX_DOTS).forEach { task ->
                                Box(
                                    Modifier
                                        .size(6.dp)
                                        .alpha(if (task.done) 0.4f else 1f)
                                        .background(parseHexColor(listColors[task.listId], Orange500), CircleShape),
                                )
                            }
                        }
                    }
                }
            }
            HorizontalDivider(color = line)
        }
    }
}
