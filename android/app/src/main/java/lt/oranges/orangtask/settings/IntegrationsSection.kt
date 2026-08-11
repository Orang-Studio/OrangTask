package lt.oranges.orangtask.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import lt.oranges.orangtask.BuildConfig
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.db.isoToMillis
import lt.oranges.orangtask.core.network.ApiKeyDto
import lt.oranges.orangtask.ui.components.BrandButton
import lt.oranges.orangtask.ui.components.FieldLabel
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.SurfaceCard
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.format.formatDueDate
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Ink900
import lt.oranges.orangtask.ui.theme.Orange500

@Composable
fun IntegrationsSection(
    onError: (String) -> Unit,
    apiKeysViewModel: ApiKeysViewModel = hiltViewModel(),
) {
    LaunchedEffect(Unit) {
        apiKeysViewModel.errors.collect { onError(it) }
    }

    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(stringResource(R.string.api_keys_heading), fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(
                stringResource(R.string.api_keys_description),
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            ApiKeysManager(apiKeysViewModel)
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                stringResource(R.string.webhooks_integrations_heading),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
            )
            Text(
                stringResource(R.string.webhooks_integrations_description),
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            CodeBlock(
                label = stringResource(R.string.incoming_webhook_payload_label),
                code = "POST /api/hooks/<incoming-webhook-token>\n" +
                    "{\n" +
                    "  \"title\": \"Review PR\",\n" +
                    "  \"due\": \"tomorrow at 3pm\",\n" +
                    "  \"list\": \"Work\",\n" +
                    "  \"priority\": \"high\",\n" +
                    "  \"tags\": [\"code-review\"]\n" +
                    "}",
            )
            CodeBlock(
                label = stringResource(R.string.direct_api_access_example_label),
                code = "GET ${BuildConfig.API_BASE_URL.trimEnd('/')}/api/tasks\n" +
                    "Authorization: Bearer <api-key>",
            )
        }
    }
}

@Composable
private fun CodeBlock(label: String, code: String) {
    val dark = isDarkTheme()
    SurfaceCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            FieldLabel(label)
            Spacer(Modifier.height(6.dp))
            Text(
                code,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(if (dark) Ink900 else Color(0xFFF3F4F6))
                    .padding(10.dp),
            )
        }
    }
}

@Composable
private fun ApiKeysManager(viewModel: ApiKeysViewModel) {
    val haptics = rememberHaptics()
    var showForm by rememberSaveable { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf("") }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        viewModel.revealed?.let { created ->
            RevealedKeyCard(name = created.name, rawKey = created.rawKey, onDismiss = viewModel::dismissRevealed)
        }

        if (viewModel.loading) {
            Text(stringResource(R.string.loading), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        viewModel.keys.forEach { key ->
            ApiKeyRow(key) {
                haptics.error()
                viewModel.delete(key.id)
            }
        }

        if (showForm) {
            SurfaceCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(12.dp),
                ) {
                    OrangTextField(
                        value = name,
                        onValueChange = { name = it },
                        placeholder = stringResource(R.string.api_key_name_placeholder),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        BrandButton(
                            text = if (viewModel.creating) stringResource(R.string.creating) else stringResource(R.string.create_key),
                            enabled = !viewModel.creating && name.isNotBlank(),
                            onClick = {
                                haptics.tap()
                                viewModel.create(name) {
                                    name = ""
                                    showForm = false
                                }
                            },
                            modifier = Modifier.weight(1f),
                        )
                        BrandButton(text = stringResource(R.string.cancel), secondary = true, onClick = { showForm = false })
                    }
                }
            }
        } else {
            BrandButton(
                text = stringResource(R.string.new_api_key),
                icon = Icons.Outlined.Add,
                secondary = true,
                onClick = {
                    haptics.tap()
                    showForm = true
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun RevealedKeyCard(name: String, rawKey: String, onDismiss: () -> Unit) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }

    SurfaceCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(stringResource(R.string.api_key_created, name), fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(
                stringResource(R.string.api_key_copy_warning),
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp, bottom = 8.dp),
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    rawKey,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .weight(1f)
                        .background(if (dark) Ink900 else Color(0xFFF3F4F6))
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                )
                IconButton(onClick = {
                    clipboard.setText(AnnotatedString(rawKey))
                    copied = true
                    haptics.success()
                }) {
                    Icon(
                        Icons.Outlined.ContentCopy,
                        contentDescription = stringResource(R.string.copy_key),
                        tint = if (copied) Orange500 else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
            Text(
                stringResource(R.string.done),
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.clickable(onClick = onDismiss).padding(top = 10.dp),
            )
        }
    }
}

@Composable
private fun ApiKeyRow(key: ApiKeyDto, onDelete: () -> Unit) {
    var confirmDelete by remember { mutableStateOf(false) }

    SurfaceCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(12.dp),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(key.name, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                val lastUsedMillis = isoToMillis(key.lastUsedAt)
                Text(
                    if (lastUsedMillis == null) {
                        stringResource(R.string.api_key_never_used, key.keyPrefix)
                    } else {
                        stringResource(R.string.api_key_last_used, key.keyPrefix, formatDueDate(lastUsedMillis))
                    },
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = { confirmDelete = true }) {
                Icon(
                    Icons.Outlined.Delete,
                    contentDescription = stringResource(R.string.revoke_api_key_content_description, key.name),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text(stringResource(R.string.revoke_api_key)) },
            text = { Text(stringResource(R.string.revoke_api_key_confirmation, key.name)) },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    onDelete()
                }) { Text(stringResource(R.string.revoke), color = Color(0xFFEF4444)) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}
