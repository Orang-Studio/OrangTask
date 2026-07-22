package lt.oranges.orangtask.notifications

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.DoneAll
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.serialization.json.JsonPrimitive
import lt.oranges.orangtask.core.db.isoToMillis
import lt.oranges.orangtask.core.network.NotificationDto
import lt.oranges.orangtask.ui.components.EmptyState
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.format.formatDueDate
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Orange500

/** NotificationsPage.tsx: list + mark read; tapping deep-links into the list */
@Composable
fun NotificationsScreen(
    onBack: () -> Unit,
    onOpenList: (String) -> Unit,
    viewModel: NotificationsViewModel = sharedNotificationsViewModel(),
) {
    val items by viewModel.items.collectAsStateWithLifecycle()
    val loading by viewModel.loading.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    val unread = items.count { !it.read }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp),
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = "Back",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text("NOTIFICATIONS", fontSize = 17.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            if (unread > 0) {
                Text("$unread new", fontSize = 13.sp, color = Orange500)
            }
            Spacer(Modifier.weight(1f))
            if (unread > 0) {
                IconButton(onClick = {
                    haptics.tap()
                    viewModel.markAllRead()
                }) {
                    Icon(
                        Icons.Outlined.DoneAll,
                        contentDescription = "Mark all read",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))

        Box(modifier = Modifier.weight(1f)) {
            when {
                loading && items.isEmpty() -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    Text("Loading…", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                items.isEmpty() -> EmptyState(
                    icon = Icons.Outlined.Notifications,
                    title = "No notifications",
                    description = "You're all caught up. New activity will show here.",
                )
                else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(items, key = { it.id }) { notification ->
                        NotificationRow(notification) {
                            haptics.tap()
                            if (!notification.read) viewModel.markRead(notification.id)
                            notification.listId?.let(onOpenList)
                        }
                    }
                }
            }
        }
    }
}

/** list_shared / task_assigned events carry the list to open in metadata */
private val NotificationDto.listId: String?
    get() = (metadata?.get("list_id") as? JsonPrimitive)?.takeIf { it.isString }?.content

@Composable
private fun NotificationRow(notification: NotificationDto, onClick: () -> Unit) {
    val dark = isDarkTheme()
    Column {
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .background(
                    if (notification.read) Color.Transparent
                    else if (dark) Color(0xFF1C130C) else Color(0xFFFFF7ED).copy(alpha = 0.5f)
                )
                .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Box(
                Modifier
                    .padding(top = 6.dp)
                    .size(8.dp)
                    .background(if (notification.read) Color.Transparent else Orange500, CircleShape),
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(notification.title, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                notification.body?.takeIf { it.isNotBlank() }?.let {
                    Text(
                        it,
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                isoToMillis(notification.createdAt)?.let {
                    Text(
                        formatDueDate(it),
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
        HorizontalDivider(color = if (dark) Ink700 else Color(0xFFF3F4F6))
    }
}
