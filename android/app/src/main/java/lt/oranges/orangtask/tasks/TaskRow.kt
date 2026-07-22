package lt.oranges.orangtask.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountTree
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lt.oranges.orangtask.core.db.TaskEntity
import lt.oranges.orangtask.ui.components.Avatar
import lt.oranges.orangtask.ui.components.PriorityDot
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.format.formatDueDate
import lt.oranges.orangtask.ui.format.isOverdue
import lt.oranges.orangtask.ui.theme.Ink400
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Ink800
import lt.oranges.orangtask.ui.theme.Orange500

/** TaskItem.tsx: swipe right to complete (orange), swipe left to delete (red), tap to open, circle */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskRow(
    task: TaskEntity,
    showListName: Boolean,
    onToggleComplete: () -> Unit,
    onDelete: () -> Unit,
    onOpen: () -> Unit,
) {
    val haptics = rememberHaptics()

    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            when (value) {
                SwipeToDismissBoxValue.StartToEnd -> {
                    haptics.success()
                    onToggleComplete()
                    false // snap back; the row just re-renders as done
                }
                SwipeToDismissBoxValue.EndToStart -> {
                    haptics.error()
                    onDelete()
                    true
                }
                else -> false
            }
        },
        positionalThreshold = { totalDistance -> totalDistance * 0.35f },
    )

    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = !task.done,
        enableDismissFromEndToStart = true,
        backgroundContent = {
            val (color, icon, alignment) = when (dismissState.dismissDirection) {
                SwipeToDismissBoxValue.StartToEnd ->
                    Triple(Orange500, Icons.Outlined.CheckCircle, Alignment.CenterStart)
                SwipeToDismissBoxValue.EndToStart ->
                    Triple(Color(0xFFDC2626), Icons.Outlined.Delete, Alignment.CenterEnd)
                else -> Triple(Color.Transparent, null, Alignment.Center)
            }
            Box(
                contentAlignment = alignment,
                modifier = Modifier.fillMaxSize().background(color).padding(horizontal = 20.dp),
            ) {
                if (icon != null) Icon(icon, contentDescription = null, tint = Color.White)
            }
        },
    ) {
        TaskRowContent(
            task = task,
            showListName = showListName,
            onToggleComplete = {
                if (task.done) haptics.tap() else haptics.success()
                onToggleComplete()
            },
            onOpen = onOpen,
        )
    }
}

@Composable
private fun TaskRowContent(
    task: TaskEntity,
    showListName: Boolean,
    onToggleComplete: () -> Unit,
    onOpen: () -> Unit,
) {
    val dark = isDarkTheme()
    val mutedColor = MaterialTheme.colorScheme.onSurfaceVariant

    Column(modifier = Modifier.background(if (dark) Ink800 else Color.White)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onOpen)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            TaskCheckbox(done = task.done, onClick = onToggleComplete)

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    PriorityDot(task.priority)
                    Text(
                        text = task.title,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textDecoration = if (task.done) TextDecoration.LineThrough else null,
                        color = if (task.done) mutedColor else MaterialTheme.colorScheme.onSurface,
                    )
                }

                val hasMeta = task.dueAtMillis != null || task.tagNames.isNotEmpty() ||
                    task.subtaskCount > 0 || task.assignedTo != null ||
                    (showListName && task.listName != null)
                if (hasMeta) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(top = 4.dp),
                    ) {
                        task.dueAtMillis?.let { due ->
                            val overdue = !task.done && isOverdue(due)
                            Text(
                                text = formatDueDate(due),
                                fontSize = 12.sp,
                                maxLines = 1,
                                color = when {
                                    overdue && dark -> Color(0xFFF87171)
                                    overdue -> Color(0xFFB91C1C)
                                    else -> mutedColor
                                },
                                modifier = Modifier
                                    .background(
                                        when {
                                            overdue && dark -> Color(0xFF450A0A)
                                            overdue -> Color(0xFFFEE2E2)
                                            dark -> Ink700
                                            else -> Color(0xFFF3F4F6)
                                        },
                                        RoundedCornerShape(4.dp),
                                    )
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                        if (task.subtaskCount > 0) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp),
                            ) {
                                Icon(
                                    Icons.Outlined.AccountTree,
                                    contentDescription = null,
                                    tint = mutedColor,
                                    modifier = Modifier.size(11.dp),
                                )
                                Text("${task.subtaskCount}", fontSize = 12.sp, color = mutedColor)
                            }
                        }
                        task.tagNames.take(3).forEach { tag ->
                            Text(
                                text = tag,
                                fontSize = 12.sp,
                                maxLines = 1,
                                color = if (dark) Color(0xFFFB923C) else Color(0xFFC2410C),
                                modifier = Modifier
                                    .background(
                                        if (dark) Color(0xFF431407) else Color(0xFFFFEDD5),
                                        RoundedCornerShape(4.dp),
                                    )
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                        if (task.assignedTo != null) {
                            Avatar(name = task.assigneeName, url = task.assigneeAvatar, size = 16.dp)
                            task.assigneeName?.let {
                                Text(it, fontSize = 12.sp, maxLines = 1, color = mutedColor)
                            }
                        }
                        if (showListName && task.listName != null) {
                            Text(
                                text = task.listName,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                color = mutedColor.copy(alpha = 0.7f),
                            )
                        }
                    }
                }
            }
        }
        HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))
    }
}

/** the 24dp circle checkbox: orange fill + white check when done */
@Composable
fun TaskCheckbox(
    done: Boolean,
    onClick: () -> Unit,
    size: androidx.compose.ui.unit.Dp = 24.dp,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(size)
            .then(
                if (done) Modifier.background(Orange500, CircleShape)
                else Modifier.border(2.dp, if (isDarkTheme()) Ink400 else Color(0xFF9CA3AF), CircleShape)
            )
            .clickable(onClick = onClick),
    ) {
        if (done) {
            Icon(
                Icons.Filled.Check,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(size * 0.6f),
            )
        }
    }
}
