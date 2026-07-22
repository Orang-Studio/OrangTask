package lt.oranges.orangtask.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lt.oranges.orangtask.core.db.TagEntity
import lt.oranges.orangtask.core.db.TaskEntity
import lt.oranges.orangtask.core.network.MemberDto
import lt.oranges.orangtask.ui.components.Avatar
import lt.oranges.orangtask.ui.components.FieldLabel
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.PRIORITIES
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.priorityColor
import lt.oranges.orangtask.ui.components.priorityLabel
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.format.formatDueDate
import lt.oranges.orangtask.ui.theme.Ink600
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Ink850
import lt.oranges.orangtask.ui.theme.Orange500
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** TaskDetail.tsx as a modal bottom sheet: complete toggle, title, due date/time, priority, assignee */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailSheet(
    task: TaskEntity,
    subtasks: List<TaskEntity>,
    tags: List<TagEntity>,
    members: List<MemberDto>,
    viewModel: TaskListViewModel,
) {
    val haptics = rememberHaptics()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val dark = isDarkTheme()
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    // draft fields, reset when a different task is opened
    var title by rememberSaveable(task.id) { mutableStateOf(task.title) }
    var notes by rememberSaveable(task.id) { mutableStateOf(task.notes ?: "") }
    var recurrence by rememberSaveable(task.id) { mutableStateOf(task.recurrenceRule ?: "") }
    var newSubtask by rememberSaveable(task.id) { mutableStateOf("") }
    var newTagName by rememberSaveable(task.id) { mutableStateOf("") }
    var showTagPicker by rememberSaveable(task.id) { mutableStateOf(false) }
    var showAssignPicker by remember { mutableStateOf(false) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var pendingDayMillis by remember { mutableStateOf<Long?>(null) }

    fun commitDrafts() {
        if (title.trim() != task.title && title.isNotBlank()) viewModel.setTitle(task.id, title)
        if (notes != (task.notes ?: "")) viewModel.setNotes(task.id, notes)
        if (recurrence.trim() != (task.recurrenceRule ?: "")) viewModel.setRecurrence(task.id, recurrence)
    }

    fun dismiss() {
        commitDrafts()
        viewModel.closeTask()
    }

    ModalBottomSheet(
        onDismissRequest = { dismiss() },
        sheetState = sheetState,
        containerColor = if (dark) Ink850 else Color.White,
    ) {
        Column(
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .navigationBarsPadding()
                .imePadding(),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // header: complete toggle + close
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .background(if (task.done) Orange500 else Color.Transparent)
                        .border(1.dp, if (task.done) Orange500 else (if (dark) Ink600 else Color(0xFFD1D5DB)))
                        .clickable {
                            haptics.tap()
                            viewModel.toggleComplete(task)
                        }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                ) {
                    Icon(
                        Icons.Filled.Check,
                        contentDescription = null,
                        tint = if (task.done) Color.White else MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.size(15.dp),
                    )
                    Text(
                        text = if (task.done) "COMPLETED" else "COMPLETE",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = if (task.done) Color.White else MaterialTheme.colorScheme.onSurface,
                    )
                }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = { dismiss() }) {
                    Icon(Icons.Outlined.Close, contentDescription = "Close", tint = muted)
                }
            }

            // title
            BasicTextField(
                value = title,
                onValueChange = { title = it },
                textStyle = MaterialTheme.typography.titleLarge.copy(
                    color = MaterialTheme.colorScheme.onSurface,
                    textDecoration = if (task.done) TextDecoration.LineThrough else null,
                ),
                cursorBrush = SolidColor(Orange500),
                modifier = Modifier
                    .fillMaxWidth()
                    .onFocusChanged { state ->
                        if (!state.isFocused && title.trim() != task.title && title.isNotBlank()) {
                            viewModel.setTitle(task.id, title)
                        }
                    },
            )

            // due date
            DetailRow(icon = Icons.Outlined.CalendarMonth) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = task.dueAtMillis?.let { formatDueDate(it) } ?: "Add due date",
                        fontSize = 14.sp,
                        color = if (task.dueAtMillis != null) MaterialTheme.colorScheme.onSurface else muted,
                        modifier = Modifier
                            .border(1.dp, if (dark) Ink600 else Color(0xFFD1D5DB))
                            .clickable { showDatePicker = true }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                    )
                    if (task.dueAtMillis != null) {
                        Icon(
                            Icons.Outlined.Close,
                            contentDescription = "Clear due date",
                            tint = muted,
                            modifier = Modifier
                                .size(18.dp)
                                .clickable { viewModel.setDueDate(task.id, null) },
                        )
                    }
                }
            }

            // priority
            DetailRow(icon = Icons.Outlined.Flag) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PRIORITIES.forEach { p ->
                        val selected = task.priority == p
                        Text(
                            text = priorityLabel(p),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = when {
                                selected && p != "none" -> priorityColor(p)
                                else -> MaterialTheme.colorScheme.onSurface
                            },
                            modifier = Modifier
                                .background(
                                    if (selected) (if (dark) Ink700 else Color(0xFFFFF7ED))
                                    else Color.Transparent
                                )
                                .border(1.dp, if (selected) Orange500 else (if (dark) Ink600 else Color(0xFFD1D5DB)))
                                .clickable {
                                    haptics.tap()
                                    viewModel.setPriority(task.id, p)
                                }
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                        )
                    }
                }
            }

            // assignee only when the list is actually shared
            if (members.size > 1) {
                val assignee = members.find { it.id == task.assignedTo }
                DetailRow(icon = Icons.Outlined.Person) {
                    Box {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier
                                .border(1.dp, if (dark) Ink600 else Color(0xFFD1D5DB))
                                .clickable { showAssignPicker = true }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                        ) {
                            if (assignee != null) {
                                Avatar(name = assignee.name, url = assignee.avatarUrl, size = 20.dp)
                                Text(assignee.name, fontSize = 14.sp)
                            } else {
                                Text("Assign to...", fontSize = 14.sp, color = muted)
                            }
                        }
                        DropdownMenu(
                            expanded = showAssignPicker,
                            onDismissRequest = { showAssignPicker = false },
                        ) {
                            DropdownMenuItem(
                                text = { Text("Unassigned") },
                                onClick = {
                                    viewModel.setAssignee(task.id, null)
                                    showAssignPicker = false
                                },
                            )
                            members.forEach { member ->
                                DropdownMenuItem(
                                    leadingIcon = { Avatar(name = member.name, url = member.avatarUrl, size = 20.dp) },
                                    text = { Text(member.name) },
                                    trailingIcon = {
                                        if (task.assignedTo == member.id) {
                                            Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(14.dp))
                                        }
                                    },
                                    onClick = {
                                        haptics.tap()
                                        viewModel.setAssignee(task.id, member)
                                        showAssignPicker = false
                                    },
                                )
                            }
                        }
                    }
                }
            }

            DetailRow(icon = Icons.Outlined.LocalOffer, alignTop = true) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        tags.filter { it.id in task.tagIds }.forEach { tag ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                modifier = Modifier
                                    .background(if (dark) Color(0xFF431407) else Color(0xFFFFEDD5))
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                            ) {
                                Text(
                                    tag.name,
                                    fontSize = 13.sp,
                                    color = if (dark) Color(0xFFFB923C) else Color(0xFFC2410C),
                                )
                                Icon(
                                    Icons.Outlined.Close,
                                    contentDescription = "Remove tag",
                                    tint = muted,
                                    modifier = Modifier
                                        .size(12.dp)
                                        .clickable { viewModel.removeTag(task.id, tag) },
                                )
                            }
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier
                                .border(1.dp, if (dark) Ink600 else Color(0xFFD1D5DB))
                                .clickable { showTagPicker = !showTagPicker }
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        ) {
                            Icon(Icons.Outlined.Add, contentDescription = null, tint = muted, modifier = Modifier.size(12.dp))
                            Text("Tag", fontSize = 13.sp, color = muted)
                        }
                    }
                    if (showTagPicker) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            tags.filter { it.id !in task.tagIds }.take(6).forEach { tag ->
                                Text(
                                    tag.name,
                                    fontSize = 13.sp,
                                    modifier = Modifier
                                        .background(if (dark) Ink700 else Color(0xFFF3F4F6))
                                        .clickable {
                                            viewModel.addTag(task.id, tag)
                                            showTagPicker = false
                                        }
                                        .padding(horizontal = 8.dp, vertical = 4.dp),
                                )
                            }
                        }
                        OrangTextField(
                            value = newTagName,
                            onValueChange = { newTagName = it },
                            placeholder = "New tag...",
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                            keyboardActions = KeyboardActions(onDone = {
                                if (newTagName.isNotBlank()) {
                                    viewModel.createAndAddTag(task.id, newTagName)
                                    newTagName = ""
                                    showTagPicker = false
                                }
                            }),
                        )
                    }
                }
            }

            // notes
            Column {
                FieldLabel("Notes")
                Spacer(Modifier.height(6.dp))
                OrangTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    placeholder = "Add notes...",
                    singleLine = false,
                    minHeight = 96.dp,
                    modifier = Modifier.onFocusChanged { state ->
                        if (!state.isFocused && notes != (task.notes ?: "")) {
                            viewModel.setNotes(task.id, notes)
                        }
                    },
                )
            }

            // recurrence rule
            DetailRow(icon = Icons.Outlined.Repeat) {
                OrangTextField(
                    value = recurrence,
                    onValueChange = { recurrence = it },
                    placeholder = "Recurrence rule (e.g. FREQ=DAILY)",
                    modifier = Modifier.onFocusChanged { state ->
                        if (!state.isFocused && recurrence.trim() != (task.recurrenceRule ?: "")) {
                            viewModel.setRecurrence(task.id, recurrence)
                        }
                    },
                )
            }

            // subtasks
            Column {
                FieldLabel("Subtasks")
                Spacer(Modifier.height(8.dp))
                subtasks.forEach { subtask ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    ) {
                        TaskCheckbox(
                            done = subtask.done,
                            onClick = {
                                haptics.tap()
                                viewModel.toggleComplete(subtask)
                            },
                            size = 20.dp,
                        )
                        Text(
                            text = subtask.title,
                            fontSize = 14.sp,
                            textDecoration = if (subtask.done) TextDecoration.LineThrough else null,
                            color = if (subtask.done) muted else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.weight(1f),
                        )
                        Icon(
                            Icons.Outlined.Delete,
                            contentDescription = "Delete subtask",
                            tint = muted,
                            modifier = Modifier
                                .size(16.dp)
                                .clickable { viewModel.deleteTask(subtask) },
                        )
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 4.dp),
                ) {
                    Icon(Icons.Outlined.Add, contentDescription = null, tint = muted, modifier = Modifier.size(16.dp))
                    BasicTextField(
                        value = newSubtask,
                        onValueChange = { newSubtask = it },
                        singleLine = true,
                        textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
                        cursorBrush = SolidColor(Orange500),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = {
                            if (newSubtask.isNotBlank()) {
                                viewModel.addSubtask(task, newSubtask)
                                newSubtask = ""
                            }
                        }),
                        decorationBox = { inner ->
                            Box {
                                if (newSubtask.isEmpty()) {
                                    Text("Add subtask...", fontSize = 14.sp, color = muted.copy(alpha = 0.6f))
                                }
                                inner()
                            }
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            // footer: delete
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .clickable {
                        haptics.error()
                        viewModel.deleteTask(task)
                    }
                    .padding(vertical = 8.dp),
            ) {
                Icon(Icons.Outlined.Delete, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                Text("Delete task", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color(0xFFEF4444))
            }

            Spacer(Modifier.height(8.dp))
        }
    }

    // date picker time picker save
    if (showDatePicker) {
        val dateState = rememberDatePickerState(
            initialSelectedDateMillis = task.dueAtMillis ?: System.currentTimeMillis(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    pendingDayMillis = dateState.selectedDateMillis
                    showDatePicker = false
                    if (pendingDayMillis != null) showTimePicker = true
                }) { Text("Next") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = dateState)
        }
    }

    if (showTimePicker) {
        val existing = task.dueAtMillis?.let { Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault()) }
        val timeState = rememberTimePickerState(
            initialHour = existing?.hour ?: 9,
            initialMinute = existing?.minute ?: 0,
        )
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val dayMillis = pendingDayMillis
                    if (dayMillis != null) {
                        // DatePicker returns UTC midnight of the picked day
                        val date = LocalDate.ofEpochDay(dayMillis / 86_400_000L)
                        val due = date.atTime(timeState.hour, timeState.minute)
                            .atZone(ZoneId.systemDefault())
                            .toInstant()
                        viewModel.setDueDate(task.id, due)
                    }
                    showTimePicker = false
                }) { Text("Set") }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
            },
            text = { TimePicker(state = timeState) },
        )
    }
}

@Composable
private fun DetailRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    alignTop: Boolean = false,
    content: @Composable () -> Unit,
) {
    Row(
        verticalAlignment = if (alignTop) Alignment.Top else Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .then(if (alignTop) Modifier.padding(top = 8.dp) else Modifier)
                .size(18.dp),
        )
        Box(modifier = Modifier.weight(1f)) { content() }
    }
}
