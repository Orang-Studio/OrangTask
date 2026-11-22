package lt.oranges.orangtask.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.HowToReg
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.WbSunny
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import lt.oranges.orangtask.ui.components.OrangSnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.zIndex
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.pluralStringResource
import lt.oranges.orangtask.core.i18n.tr
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.channels.ReceiveChannel
import lt.oranges.orangtask.R
import java.util.Locale
import java.time.format.DateTimeFormatter
import lt.oranges.orangtask.core.db.TaskEntity
import lt.oranges.orangtask.notifications.NotificationBell
import lt.oranges.orangtask.ui.components.EmptyState
import lt.oranges.orangtask.ui.components.LIST_COLORS
import lt.oranges.orangtask.ui.components.LIST_ICONS
import lt.oranges.orangtask.ui.components.ListIcon
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.listIconFor
import lt.oranges.orangtask.ui.components.parseHexColor
import lt.oranges.orangtask.ui.components.priorityLabel
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.format.formatDueDate
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Orange500

private data class SmartConfig(
    val titleRes: Int,
    val icon: ImageVector,
    val emptyTitleRes: Int,
    val emptyDescriptionRes: Int,
    val allowAdd: Boolean,
)

private val SMART_CONFIGS = mapOf(
    "today" to SmartConfig(
        R.string.today, Icons.Outlined.WbSunny,
        R.string.nothing_due_today, R.string.today_empty_description, true,
    ),
    "upcoming" to SmartConfig(
        R.string.upcoming, Icons.Outlined.CalendarMonth,
        R.string.no_upcoming_tasks, R.string.upcoming_empty_description, true,
    ),
    "overdue" to SmartConfig(
        R.string.overdue, Icons.Outlined.ErrorOutline,
        R.string.no_overdue_tasks, R.string.overdue_empty_description, false,
    ),
    "assigned" to SmartConfig(
        R.string.assigned_to_me, Icons.Outlined.HowToReg,
        R.string.nothing_assigned_to_you, R.string.assigned_empty_description, false,
    ),
    "all" to SmartConfig(
        R.string.all_tasks, Icons.Outlined.Layers,
        R.string.no_tasks_yet, R.string.all_tasks_empty_description, true,
    ),
)

@Composable
fun TaskListScreen(
    quickAddRequests: ReceiveChannel<Unit>,
    onListDeleted: () -> Unit,
    onOpenNotifications: (() -> Unit)? = null,
    viewModel: TaskListViewModel = hiltViewModel(),
) {
    val tasks by viewModel.tasks.collectAsStateWithLifecycle()
    val list by viewModel.list.collectAsStateWithLifecycle()
    val tags by viewModel.tags.collectAsStateWithLifecycle()
    val selectedTask by viewModel.selectedTask.collectAsStateWithLifecycle()
    val subtasks by viewModel.subtasks.collectAsStateWithLifecycle()

    val isListRoute = viewModel.listId != null
    val smart = if (isListRoute) null else SMART_CONFIGS[viewModel.kind] ?: SMART_CONFIGS.getValue("today")
    val canEdit = !isListRoute || (list?.myRole ?: "owner") != "viewer"
    val showQuickAdd = canEdit && (isListRoute || smart?.allowAdd == true)

    val snackbar = remember { SnackbarHostState() }
    val focusRequester = remember { FocusRequester() }
    var shareOpen by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.errors.collect { snackbar.showSnackbar(it) }
    }
    if (showQuickAdd) {
        LaunchedEffect(Unit) {
            for (request in quickAddRequests) {
                runCatching { focusRequester.requestFocus() }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)

            .imePadding(),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp),
            ) {
                if (isListRoute) {
                    ListIcon(icon = list?.icon, colorHex = list?.color, size = 20.dp)
                } else {
                    Icon(smart!!.icon, contentDescription = null, tint = Orange500, modifier = Modifier.size(20.dp))
                }
                Text(
                    text = (if (isListRoute) list?.name ?: "" else tr(smart!!.titleRes)).uppercase(),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,

                    modifier = Modifier.weight(1f),
                )
                if (tasks.isNotEmpty()) {
                    Text(
                        pluralStringResource(R.plurals.task_count, tasks.size, tasks.size),
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (onOpenNotifications != null && !isListRoute) {
                    NotificationBell(onClick = onOpenNotifications)
                }
                if (isListRoute && list != null) {
                    ListMenu(
                        isOwner = list?.myRole == "owner",
                        canEdit = canEdit,
                        listName = list?.name ?: "",
                        onShare = {
                            viewModel.loadMembers()
                            shareOpen = true
                        },
                        onRename = viewModel::renameList,
                        onSetIcon = viewModel::setListIcon,
                        onSetColor = viewModel::setListColor,
                        onDelete = { viewModel.deleteList(onListDeleted) },
                    )
                }
            }
            HorizontalDivider(color = if (isDarkTheme()) Ink700 else Color(0xFFE5E7EB))

            if (viewModel.kind == "upcoming" && !isListRoute) {
                val month by viewModel.calendarMonth.collectAsStateWithLifecycle()
                val day by viewModel.selectedDay.collectAsStateWithLifecycle()
                val lists by viewModel.lists.collectAsStateWithLifecycle()
                UpcomingCalendar(
                    month = month,
                    selected = day,
                    tasks = tasks,
                    listColors = lists.associate { it.id to it.color },
                    onMonth = { viewModel.calendarMonth.value = it },
                    onSelect = { viewModel.selectedDay.value = it },
                )
                Text(
                    day.format(DateTimeFormatter.ofPattern("EEEE, MMMM d", Locale.getDefault())).uppercase(),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp),
                )
            }
            Box(modifier = Modifier.weight(1f)) {
                val dayTasks = if (viewModel.kind == "upcoming" && !isListRoute) {
                    val day by viewModel.selectedDay.collectAsStateWithLifecycle()
                    tasks.filter { it.dueDay() == day }
                } else tasks
                when {
                    viewModel.kind == "upcoming" && !isListRoute && dayTasks.isEmpty() -> Text(
                        tr(R.string.no_tasks_this_day),
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                    viewModel.initialLoading && tasks.isEmpty() -> TaskListSkeleton()
                    tasks.isEmpty() -> EmptyState(
                        icon = if (isListRoute) listIconFor(list?.icon) else smart!!.icon,
                        title = if (isListRoute) tr(R.string.no_tasks_in_list)
                        else tr(smart!!.emptyTitleRes),
                        description = if (isListRoute) tr(R.string.list_empty_description)
                        else tr(smart!!.emptyDescriptionRes),
                    )
                    else -> TaskLazyList(
                        tasks = dayTasks,
                        showListName = !isListRoute,
                        // positions are per list like desktop only list views reorder
                        reorderable = isListRoute && canEdit,
                        viewModel = viewModel,
                    )
                }
            }

            if (showQuickAdd) {
                QuickAddBar(focusRequester = focusRequester, onAdd = viewModel::quickAdd)
            }
        }

        OrangSnackbarHost(hostState = snackbar, modifier = Modifier.align(Alignment.BottomCenter).imePadding())
    }

    selectedTask?.let { task ->
        TaskDetailSheet(
            task = task,
            subtasks = subtasks,
            tags = tags,
            members = viewModel.members,
            viewModel = viewModel,
        )
    }

    if (shareOpen && list != null) {
        ShareSheet(
            listName = list?.name ?: "",
            members = viewModel.members,
            isOwner = list?.myRole == "owner",
            currentUserId = viewModel.myUserId,
            onInvite = viewModel::inviteMember,
            onSetRole = viewModel::setMemberRole,
            onRemove = viewModel::removeMember,
            onLeave = {
                shareOpen = false
                viewModel.leaveList(onListDeleted)
            },
            onDismiss = { shareOpen = false },
        )
    }
}

@Composable
private fun TaskLazyList(
    tasks: List<TaskEntity>,
    showListName: Boolean,
    reorderable: Boolean,
    viewModel: TaskListViewModel,
) {
    val haptics = rememberHaptics()
    val listState = rememberLazyListState()
    // order shown while a drag runs and until Room emits the saved order
    var localOrder by remember { mutableStateOf<List<TaskEntity>?>(null) }
    val shown = localOrder ?: tasks

    val reorder = rememberReorderState(
        listState = listState,
        onMove = { from, to ->
            val current = (localOrder ?: tasks).toMutableList()
            val fromIndex = current.indexOfFirst { it.id == from }
            val toIndex = current.indexOfFirst { it.id == to }
            if (fromIndex >= 0 && toIndex >= 0) {
                current.add(toIndex, current.removeAt(fromIndex))
                localOrder = current
                haptics.tap()
            }
        },
        onDrop = {
            val order = localOrder
            if (order == null || order.map { it.id } == tasks.map { it.id }) {
                localOrder = null
            } else {
                viewModel.reorder(order.map { it.id })
            }
        },
    )

    LaunchedEffect(tasks) {
        if (reorder.draggingKey == null) localOrder = null
    }

    LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
        items(shown, key = { it.id }) { task ->
            val dragging = reorder.draggingKey == task.id
            Box(
                modifier = (if (dragging) {
                    Modifier
                        .zIndex(1f)
                        .graphicsLayer { translationY = reorder.draggingOffset }
                        .shadow(8.dp)
                } else {
                    Modifier.animateItem()
                }).then(
                    if (reorderable) Modifier.reorderOnHold(reorder, task.id, onStart = { haptics.longPress() })
                    else Modifier,
                ),
            ) {
                TaskRow(
                    task = task,
                    showListName = showListName,
                    onToggleComplete = { viewModel.toggleComplete(task) },
                    onDelete = { viewModel.deleteTask(task) },
                    onOpen = { viewModel.openTask(task) },
                )
            }
        }
    }
}

@Composable
private fun QuickAddBar(focusRequester: FocusRequester, onAdd: (String) -> Unit) {
    var text by rememberSaveable { mutableStateOf("") }
    val haptics = rememberHaptics()

    fun submit() {
        if (text.isNotBlank()) {
            haptics.tap()
            onAdd(text)
            text = ""
        }
    }

    val parsed = remember(text) { if (text.isBlank()) null else parseQuickAdd(text) }
    val hasMeta = parsed != null &&
        (parsed.dueAt != null || parsed.priority != "none" || parsed.recurrenceRule != null)

    Column {
        HorizontalDivider(color = if (isDarkTheme()) Ink700 else Color(0xFFE5E7EB))
        if (hasMeta && parsed != null) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 8.dp),
            ) {
                parsed.dueAtMillis?.let {
                    ParseChip(Icons.Outlined.CalendarMonth, formatDueDate(it), highlight = true)
                }
                if (parsed.priority != "none") {
                    ParseChip(Icons.Outlined.Flag, priorityLabel(parsed.priority))
                }
                if (parsed.recurrenceRule != null) {
                    ParseChip(Icons.Outlined.Repeat, tr(R.string.recurring))
                }
            }
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().padding(12.dp),
        ) {
            OrangTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = tr(R.string.quick_add_placeholder),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { submit() }),
                modifier = Modifier.weight(1f).focusRequester(focusRequester),
            )
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(44.dp)
                    .background(if (text.isBlank()) Orange500.copy(alpha = 0.5f) else Orange500)
                    .clickable(enabled = text.isNotBlank()) { submit() },
            ) {
                Icon(Icons.Outlined.Add, contentDescription = tr(R.string.add_task), tint = Color.White)
            }
        }
    }
}

@Composable
private fun ParseChip(icon: ImageVector, label: String, highlight: Boolean = false) {
    val dark = isDarkTheme()
    val background = when {
        highlight && dark -> Color(0xFF431407)
        highlight -> Color(0xFFFFEDD5)
        dark -> Ink700
        else -> Color(0xFFF3F4F6)
    }
    val content = when {
        highlight && dark -> Color(0xFFFB923C)
        highlight -> Color(0xFFC2410C)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.background(background).padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(11.dp))
        Text(label, fontSize = 11.sp, color = content)
    }
}

@Composable
private fun ListMenu(
    isOwner: Boolean,
    canEdit: Boolean,
    listName: String,
    onShare: () -> Unit,
    onRename: (String) -> Unit,
    onSetIcon: (String) -> Unit,
    onSetColor: (String) -> Unit,
    onDelete: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    var renameOpen by remember { mutableStateOf(false) }
    var iconOpen by remember { mutableStateOf(false) }
    var colorOpen by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var renameValue by remember { mutableStateOf("") }
    val haptics = rememberHaptics()

    Box {
        IconButton(onClick = { haptics.tap(); menuOpen = true }) {
            Icon(
                Icons.Outlined.MoreVert,
                contentDescription = tr(R.string.list_options),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
            DropdownMenuItem(text = { Text(tr(R.string.share)) }, onClick = {
                onShare()
                menuOpen = false
            })
            if (canEdit) {
                DropdownMenuItem(text = { Text(tr(R.string.rename)) }, onClick = {
                    renameValue = listName
                    renameOpen = true
                    menuOpen = false
                })
                DropdownMenuItem(text = { Text(tr(R.string.change_icon)) }, onClick = {
                    iconOpen = true
                    menuOpen = false
                })
                DropdownMenuItem(text = { Text(tr(R.string.change_color)) }, onClick = {
                    colorOpen = true
                    menuOpen = false
                })
            }
            if (isOwner) {
                DropdownMenuItem(
                    text = { Text(tr(R.string.delete_list), color = Color(0xFFEF4444)) },
                    onClick = {
                        confirmDelete = true
                        menuOpen = false
                    },
                )
            }
        }
    }

    if (renameOpen) {
        AlertDialog(
            onDismissRequest = { renameOpen = false },
            title = { Text(tr(R.string.rename_list)) },
            text = {
                OrangTextField(
                    value = renameValue,
                    onValueChange = { renameValue = it },
                    placeholder = tr(R.string.list_name_placeholder),
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    if (renameValue.isNotBlank()) onRename(renameValue)
                    renameOpen = false
                }) { Text(tr(R.string.rename)) }
            },
            dismissButton = { TextButton(onClick = { renameOpen = false }) { Text(tr(R.string.cancel)) } },
        )
    }

    if (iconOpen) {
        AlertDialog(
            onDismissRequest = { iconOpen = false },
            title = { Text(tr(R.string.change_icon)) },
            text = {
                LazyVerticalGrid(columns = GridCells.Fixed(6), modifier = Modifier.height(240.dp)) {
                    items(LIST_ICONS.keys.toList()) { key ->
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .size(40.dp)
                                .clickable {
                                    haptics.tap()
                                    onSetIcon(key)
                                    iconOpen = false
                                },
                        ) {
                            Icon(
                                LIST_ICONS.getValue(key),
                                contentDescription = tr(R.string.list_icon),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { iconOpen = false }) { Text(tr(R.string.cancel)) } },
        )
    }

    if (colorOpen) {
        AlertDialog(
            onDismissRequest = { colorOpen = false },
            title = { Text(tr(R.string.change_color)) },
            text = {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LIST_COLORS.forEach { hex ->
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .background(parseHexColor(hex, Orange500), CircleShape)
                                .clickable {
                                    onSetColor(hex)
                                    colorOpen = false
                                },
                        )
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { colorOpen = false }) { Text(tr(R.string.cancel)) } },
        )
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text(tr(R.string.delete_list)) },
            text = { Text(tr(R.string.delete_list_confirmation, listName)) },
            confirmButton = {
                TextButton(onClick = {
                    haptics.error()
                    confirmDelete = false
                    onDelete()
                }) { Text(tr(R.string.delete), color = Color(0xFFEF4444)) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text(tr(R.string.cancel)) } },
        )
    }
}

@Composable
private fun TaskListSkeleton() {
    val barColor = if (isDarkTheme()) Ink700 else Color(0xFFE5E7EB)
    Column {
        repeat(6) { index ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            ) {
                Box(Modifier.size(24.dp).background(barColor, CircleShape))
                Box(
                    Modifier
                        .weight(if (index % 2 == 0) 0.7f else 0.5f)
                        .height(14.dp)
                        .alpha(0.8f)
                        .background(barColor),
                )
                Spacer(Modifier.weight(if (index % 2 == 0) 0.3f else 0.5f))
            }
        }
    }
}
