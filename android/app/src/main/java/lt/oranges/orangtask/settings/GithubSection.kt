package lt.oranges.orangtask.settings

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.i18n.tr
import lt.oranges.orangtask.ui.components.BrandButton
import lt.oranges.orangtask.ui.components.SurfaceCard
import lt.oranges.orangtask.core.db.isoToMillis
import lt.oranges.orangtask.ui.format.formatDueDate
import lt.oranges.orangtask.ui.theme.Orange500

private data class ToggleInfo(val toggle: GithubToggle, val labelRes: Int, val descRes: Int)

private val GITHUB_TOGGLES = listOf(
    ToggleInfo(GithubToggle.ISSUES, R.string.github_issues, R.string.github_issues_description),
    ToggleInfo(GithubToggle.PULL_REQUESTS, R.string.github_pull_requests, R.string.github_pull_requests_description),
    ToggleInfo(GithubToggle.SECURITY, R.string.github_security, R.string.github_security_description),
)

@Composable
fun GithubSection(
    onError: (String) -> Unit,
    viewModel: GithubViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    var confirmDisconnect by rememberSaveable { mutableStateOf(false) }
    var hasResumed by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.errors.collect { onError(it) } }
    LifecycleResumeEffect(Unit) {
        if (hasResumed) viewModel.refresh() else hasResumed = true
        onPauseOrDispose { }
    }

    val connection = viewModel.connection

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            tr(R.string.github_description),
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        SurfaceCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    if (connection?.githubLogin != null) {
                        tr(R.string.github_signed_in_as, connection.githubLogin)
                    } else {
                        tr(R.string.github_not_connected)
                    },
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    when {
                        !viewModel.configured -> tr(R.string.github_not_configured)
                        connection == null -> tr(R.string.github_connect_on_web)
                        connection.lastSyncedAt != null ->
                            tr(R.string.github_last_synced, formatDueDate(isoToMillis(connection.lastSyncedAt)))
                        else -> tr(R.string.github_never_synced)
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                connection?.lastError?.let {
                    Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.error)
                }
            }
        }

        if (connection != null) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                GITHUB_TOGGLES.forEach { info ->
                    val checked = when (info.toggle) {
                        GithubToggle.ISSUES -> connection.syncIssues
                        GithubToggle.PULL_REQUESTS -> connection.syncPullRequests
                        GithubToggle.SECURITY -> connection.syncSecurity
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(tr(info.labelRes), fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            Text(
                                tr(info.descRes),
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Switch(
                            checked = checked,
                            onCheckedChange = { viewModel.setToggle(info.toggle, it) },
                            colors = SwitchDefaults.colors(checkedTrackColor = Orange500),
                        )
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BrandButton(
                    text = if (viewModel.syncing) tr(R.string.github_syncing) else tr(R.string.github_sync_now),
                    onClick = { viewModel.sync() },
                    enabled = !viewModel.syncing,
                )
                TextButton(onClick = { confirmDisconnect = true }) {
                    Text(tr(R.string.github_disconnect), color = MaterialTheme.colorScheme.error)
                }
            }
        } else {
            BrandButton(
                text = if (viewModel.connecting) tr(R.string.github_connecting) else tr(R.string.github_sign_in),
                onClick = {
                    viewModel.connect { url ->
                        CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
                    }
                },
                enabled = viewModel.configured && !viewModel.connecting,
            )
        }

        Text(
            tr(R.string.github_access_note),
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }

    if (confirmDisconnect) {
        AlertDialog(
            onDismissRequest = { confirmDisconnect = false },
            title = { Text(tr(R.string.github_disconnect)) },
            text = { Text(tr(R.string.github_disconnect_confirm)) },
            confirmButton = {
                TextButton(onClick = {
                    confirmDisconnect = false
                    viewModel.disconnect()
                }) { Text(tr(R.string.github_disconnect), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDisconnect = false }) { Text(tr(R.string.cancel)) }
            },
        )
    }
}
