package lt.oranges.orangtask.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.theme.Orange500

/** NotificationBell.tsx: bell icon with an unread dot */
@Composable
fun NotificationBell(
    onClick: () -> Unit,
    viewModel: NotificationsViewModel = sharedNotificationsViewModel(),
) {
    val unread by viewModel.unreadCount.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()

    IconButton(onClick = {
        haptics.tap()
        onClick()
    }) {
        Box {
            Icon(
                Icons.Outlined.Notifications,
                contentDescription = "Notifications",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (unread > 0) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 2.dp, y = (-2).dp)
                        .size(8.dp)
                        .background(Orange500, CircleShape),
                )
            }
        }
    }
}
