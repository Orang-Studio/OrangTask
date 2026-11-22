package lt.oranges.orangtask.tasks

import android.content.Context
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.i18n.AppStrings
import lt.oranges.orangtask.core.i18n.RemoteI18n
import lt.oranges.orangtask.core.i18n.tr
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.theme.Ink600
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

private const val SUMMARY_SEPARATOR = " · "

private fun localeOf(context: Context): Locale =
    context.resources.configuration.locales[0] ?: Locale.getDefault()

private fun unitPlural(freq: RecurrenceFreq): Int = when (freq) {
    RecurrenceFreq.DAILY -> R.plurals.repeat_unit_days
    RecurrenceFreq.WEEKLY -> R.plurals.repeat_unit_weeks
    RecurrenceFreq.MONTHLY -> R.plurals.repeat_unit_months
    RecurrenceFreq.YEARLY -> R.plurals.repeat_unit_years
}

private fun simpleFreqLabel(freq: RecurrenceFreq): Int = when (freq) {
    RecurrenceFreq.DAILY -> R.string.repeat_daily
    RecurrenceFreq.WEEKLY -> R.string.repeat_weekly
    RecurrenceFreq.MONTHLY -> R.string.repeat_monthly
    RecurrenceFreq.YEARLY -> R.string.repeat_yearly
}

private fun shortFreqLabel(freq: RecurrenceFreq): Int = when (freq) {
    RecurrenceFreq.DAILY -> R.string.repeat_freq_day
    RecurrenceFreq.WEEKLY -> R.string.repeat_freq_week
    RecurrenceFreq.MONTHLY -> R.string.repeat_freq_month
    RecurrenceFreq.YEARLY -> R.string.repeat_freq_year
}

private fun ordinalLabel(ordinal: Int): Int = when (ordinal) {
    1 -> R.string.repeat_ordinal_first
    2 -> R.string.repeat_ordinal_second
    3 -> R.string.repeat_ordinal_third
    4 -> R.string.repeat_ordinal_fourth
    else -> R.string.repeat_ordinal_last
}

private val WEEKDAYS_MON_TO_FRI = setOf(
    DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY,
)

fun describeRecurrence(context: Context, rule: String?): String {
    val raw = rule?.trim().orEmpty()
    if (raw.isEmpty()) return AppStrings.get(context, R.string.repeat_never)
    val recurrence = parseRecurrence(raw) ?: return AppStrings.get(context, R.string.repeat_custom_rule)

    val locale = localeOf(context)
    val parts = mutableListOf<String>()

    parts += if (recurrence.interval == 1) {
        AppStrings.get(context, simpleFreqLabel(recurrence.freq))
    } else {
        val unit = context.resources.getQuantityString(unitPlural(recurrence.freq), recurrence.interval)
        AppStrings.get(context, R.string.repeat_summary_every, recurrence.interval, unit)
    }

    when (recurrence.freq) {
        RecurrenceFreq.WEEKLY -> if (recurrence.byDay.isNotEmpty() && recurrence.byDay.size < 7) {
            parts += if (recurrence.byDay == WEEKDAYS_MON_TO_FRI) {
                AppStrings.get(context, R.string.repeat_weekdays)
            } else {
                val order = weekdayOrder(WeekFields.of(locale).firstDayOfWeek)
                recurrence.byDay
                    .sortedBy { order.indexOf(it) }
                    .joinToString(", ") { it.getDisplayName(TextStyle.SHORT, locale) }
            }
        }
        RecurrenceFreq.MONTHLY -> parts += when (recurrence.monthlyMode) {
            MonthlyMode.DAY_OF_MONTH ->
                AppStrings.get(context, R.string.repeat_monthly_day_option, recurrence.monthDay)
            MonthlyMode.DAY_OF_WEEK -> AppStrings.get(
                context,
                R.string.repeat_monthly_nth,
                AppStrings.get(context, ordinalLabel(recurrence.weekOrdinal)),
                recurrence.monthWeekday.getDisplayName(TextStyle.FULL, locale),
            )
        }
        else -> Unit
    }

    recurrence.count?.let {
        parts += "$it " + context.resources.getQuantityString(R.plurals.repeat_occurrences, it)
    }
    recurrence.until?.let {
        val formatted = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale).format(it)
        parts += AppStrings.get(context, R.string.repeat_summary_until, formatted)
    }

    return parts.joinToString(SUMMARY_SEPARATOR)
}

@Composable
fun rememberRecurrenceSummary(rule: String?): String {
    val context = LocalContext.current
    val update by RemoteI18n.updates.collectAsState()
    return remember(context, rule, update) { describeRecurrence(context, rule) }
}

@Composable
fun RecurrenceField(
    rule: String?,
    anchor: LocalDate,
    onChange: (String?) -> Unit,
) {
    val dark = isDarkTheme()
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val hasRule = !rule.isNullOrBlank()
    var showPicker by remember { mutableStateOf(false) }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = rememberRecurrenceSummary(rule),
            fontSize = 14.sp,
            color = if (hasRule) MaterialTheme.colorScheme.onSurface else muted,
            modifier = Modifier
                .border(1.dp, if (dark) Ink600 else Color(0xFFD1D5DB))
                .clickable { showPicker = true }
                .padding(horizontal = 12.dp, vertical = 8.dp),
        )
        if (hasRule) {
            Icon(
                Icons.Outlined.Close,
                contentDescription = tr(R.string.repeat_remove),
                tint = muted,
                modifier = Modifier
                    .size(18.dp)
                    .clickable { onChange(null) },
            )
        }
    }

    if (showPicker) {
        RecurrenceDialog(
            initial = rule,
            anchor = anchor,
            onDismiss = { showPicker = false },
            onConfirm = {
                onChange(it)
                showPicker = false
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RecurrenceDialog(
    initial: String?,
    anchor: LocalDate,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    val context = LocalContext.current
    val locale = localeOf(context)
    val parsed = remember(initial) { parseRecurrence(initial) }
    val wasCustom = !initial.isNullOrBlank() && parsed == null

    var draft by remember(initial) {
        mutableStateOf(parsed ?: defaultRecurrence(RecurrenceFreq.WEEKLY, anchor, null))
    }
    var countText by remember(initial) { mutableStateOf((parsed?.count ?: 5).toString()) }
    var showUntilPicker by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(tr(R.string.repeat_title)) },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier
                    .heightIn(max = 420.dp)
                    .verticalScroll(rememberScrollState()),
            ) {
                if (wasCustom) {
                    Text(
                        text = tr(R.string.repeat_custom_rule_notice),
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    RecurrenceFreq.entries.forEachIndexed { index, freq ->
                        SegmentedButton(
                            selected = draft.freq == freq,
                            onClick = { draft = defaultRecurrence(freq, anchor, draft) },
                            shape = SegmentedButtonDefaults.itemShape(index, RecurrenceFreq.entries.size),
                            icon = {},
                            label = { Text(tr(shortFreqLabel(freq)), fontSize = 13.sp) },
                        )
                    }
                }

                IntervalStepper(
                    value = draft.interval,
                    freq = draft.freq,
                    onChange = { draft = draft.copy(interval = it) },
                )

                when (draft.freq) {
                    RecurrenceFreq.WEEKLY -> WeekdaySelector(
                        selected = draft.byDay,
                        locale = locale,
                        onToggle = { day ->
                            val next = if (day in draft.byDay) draft.byDay - day else draft.byDay + day
                            // at least one day has to stay on otherwise the rule loses meaning
                            if (next.isNotEmpty()) draft = draft.copy(byDay = next)
                        },
                    )

                    RecurrenceFreq.MONTHLY -> MonthlySelector(
                        draft = draft,
                        locale = locale,
                        onChange = { draft = it },
                    )

                    else -> Unit
                }

                EndsSelector(
                    draft = draft,
                    countText = countText,
                    locale = locale,
                    onCountTextChange = { text ->
                        countText = text
                        text.toIntOrNull()?.takeIf { it in 1..MAX_COUNT }?.let {
                            draft = draft.copy(count = it, until = null)
                        }
                    },
                    onChange = { draft = it },
                    onPickDate = { showUntilPicker = true },
                )

                Text(
                    text = describeRecurrence(context, draft.toRrule()),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(draft.toRrule()) }) { Text(tr(R.string.set)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(tr(R.string.cancel)) }
        },
    )

    if (showUntilPicker) {
        val startMillis = (draft.until ?: anchor.plusMonths(1))
            .atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val state = rememberDatePickerState(initialSelectedDateMillis = startMillis)
        DatePickerDialog(
            onDismissRequest = { showUntilPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { millis ->
                        val date = Instant.ofEpochMilli(millis).atZone(ZoneId.of("UTC")).toLocalDate()
                        draft = draft.copy(until = date, count = null)
                    }
                    showUntilPicker = false
                }) { Text(tr(R.string.set)) }
            },
            dismissButton = {
                TextButton(onClick = { showUntilPicker = false }) { Text(tr(R.string.cancel)) }
            },
        ) {
            DatePicker(state = state)
        }
    }
}

@Composable
private fun IntervalStepper(value: Int, freq: RecurrenceFreq, onChange: (Int) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(tr(R.string.repeat_every), fontSize = 14.sp, modifier = Modifier.weight(1f))
        OutlinedIconButton(
            onClick = { onChange((value - 1).coerceAtLeast(1)) },
            enabled = value > 1,
            shape = RectangleShape,
            modifier = Modifier.size(36.dp),
        ) {
            Icon(
                Icons.Outlined.Remove,
                contentDescription = tr(R.string.repeat_decrease_interval),
                modifier = Modifier.size(16.dp),
            )
        }
        Text(
            text = value.toString(),
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            modifier = Modifier.width(28.dp),
        )
        OutlinedIconButton(
            onClick = { onChange((value + 1).coerceAtMost(MAX_INTERVAL)) },
            enabled = value < MAX_INTERVAL,
            shape = RectangleShape,
            modifier = Modifier.size(36.dp),
        ) {
            Icon(
                Icons.Outlined.Add,
                contentDescription = tr(R.string.repeat_increase_interval),
                modifier = Modifier.size(16.dp),
            )
        }
        Text(
            text = pluralStringResource(unitPlural(freq), value),
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(64.dp),
        )
    }
}

@Composable
private fun WeekdaySelector(
    selected: Set<DayOfWeek>,
    locale: Locale,
    onToggle: (DayOfWeek) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            tr(R.string.repeat_on_days),
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
            weekdayOrder(WeekFields.of(locale).firstDayOfWeek).forEach { day ->
                val full = day.getDisplayName(TextStyle.FULL, locale)
                FilterChip(
                    selected = day in selected,
                    onClick = { onToggle(day) },
                    label = {
                        Text(
                            text = day.getDisplayName(TextStyle.NARROW, locale),
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    },
                    modifier = Modifier
                        .weight(1f)
                        .semantics { contentDescription = full },
                )
            }
        }
    }
}

@Composable
private fun MonthlySelector(draft: Recurrence, locale: Locale, onChange: (Recurrence) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            FilterChip(
                selected = draft.monthlyMode == MonthlyMode.DAY_OF_MONTH,
                onClick = { onChange(draft.copy(monthlyMode = MonthlyMode.DAY_OF_MONTH)) },
                label = { Text(tr(R.string.repeat_monthly_day_option, draft.monthDay), fontSize = 13.sp) },
            )
            FilterChip(
                selected = draft.monthlyMode == MonthlyMode.DAY_OF_WEEK,
                onClick = { onChange(draft.copy(monthlyMode = MonthlyMode.DAY_OF_WEEK)) },
                label = {
                    Text(
                        tr(
                            R.string.repeat_monthly_nth,
                            tr(ordinalLabel(draft.weekOrdinal)),
                            draft.monthWeekday.getDisplayName(TextStyle.SHORT, locale),
                        ),
                        fontSize = 13.sp,
                    )
                },
            )
        }

        if (draft.monthlyMode == MonthlyMode.DAY_OF_MONTH) {
            PickerDropdown(
                label = tr(R.string.repeat_monthly_day_option, draft.monthDay),
                options = (1..31).map { it to AppStrings.get(LocalContext.current, R.string.repeat_monthly_day_option, it) },
                onSelect = { onChange(draft.copy(monthDay = it)) },
            )
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val ordinals = listOf(1, 2, 3, 4, LAST_WEEK_ORDINAL)
                PickerDropdown(
                    label = tr(ordinalLabel(draft.weekOrdinal)),
                    options = ordinals.map { it to AppStrings.get(LocalContext.current, ordinalLabel(it)) },
                    onSelect = { onChange(draft.copy(weekOrdinal = it)) },
                    modifier = Modifier.weight(1f),
                )
                PickerDropdown(
                    label = draft.monthWeekday.getDisplayName(TextStyle.FULL, locale),
                    options = weekdayOrder(WeekFields.of(locale).firstDayOfWeek)
                        .map { it to it.getDisplayName(TextStyle.FULL, locale) },
                    onSelect = { onChange(draft.copy(monthWeekday = it)) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun <T> PickerDropdown(
    label: String,
    options: List<Pair<T, String>>,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = modifier) {
        OutlinedButton(
            onClick = { expanded = true },
            shape = RectangleShape,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(label, fontSize = 13.sp, maxLines = 1)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (value, text) ->
                DropdownMenuItem(
                    text = { Text(text) },
                    onClick = {
                        onSelect(value)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun EndsSelector(
    draft: Recurrence,
    countText: String,
    locale: Locale,
    onCountTextChange: (String) -> Unit,
    onChange: (Recurrence) -> Unit,
    onPickDate: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            tr(R.string.repeat_ends),
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        EndOption(
            selected = draft.end == RecurrenceEnd.NEVER,
            onSelect = { onChange(draft.copy(count = null, until = null)) },
        ) {
            Text(tr(R.string.repeat_ends_never), fontSize = 14.sp)
        }

        EndOption(
            selected = draft.end == RecurrenceEnd.ON_DATE,
            onSelect = {
                val date = draft.until ?: LocalDate.now().plusMonths(1)
                onChange(draft.copy(until = date, count = null))
            },
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(tr(R.string.repeat_ends_on_date), fontSize = 14.sp)
                if (draft.end == RecurrenceEnd.ON_DATE && draft.until != null) {
                    OutlinedButton(onClick = onPickDate, shape = RectangleShape) {
                        Text(
                            DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
                                .withLocale(locale)
                                .format(draft.until),
                            fontSize = 13.sp,
                        )
                    }
                }
            }
        }

        EndOption(
            selected = draft.end == RecurrenceEnd.AFTER_COUNT,
            onSelect = {
                val count = countText.toIntOrNull()?.takeIf { it in 1..MAX_COUNT } ?: 5
                onChange(draft.copy(count = count, until = null))
            },
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(tr(R.string.repeat_after), fontSize = 14.sp)
                if (draft.end == RecurrenceEnd.AFTER_COUNT) {
                    OutlinedTextField(
                        value = countText,
                        onValueChange = { input -> onCountTextChange(input.filter { it.isDigit() }.take(3)) },
                        singleLine = true,
                        shape = RectangleShape,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                        ),
                        modifier = Modifier.width(84.dp),
                    )
                    Text(
                        pluralStringResource(R.plurals.repeat_occurrences, draft.count ?: 1),
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun EndOption(selected: Boolean, onSelect: () -> Unit, content: @Composable () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onSelect),
    ) {
        RadioButton(selected = selected, onClick = onSelect)
        content()
        Spacer(Modifier.width(0.dp))
    }
}
