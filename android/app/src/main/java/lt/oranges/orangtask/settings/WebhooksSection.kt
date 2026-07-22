package lt.oranges.orangtask.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import lt.oranges.orangtask.BuildConfig
import lt.oranges.orangtask.core.db.isoToMillis
import lt.oranges.orangtask.core.network.WebhookDto
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

private val OUTGOING_EVENTS = listOf(
    "task.created", "task.updated", "task.completed", "task.deleted", "task.due_soon", "list.shared",
)

/** WebhookManager.tsx: cards with enable toggle, expandable detail, add form */
@Composable
fun WebhooksSection(
    onError: (String) -> Unit,
    viewModel: WebhooksViewModel = hiltViewModel(),
) {
    LaunchedEffect(Unit) {
        viewModel.errors.collect { onError(it) }
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            "Send task events to external services, or create tasks from incoming requests.",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (viewModel.loading) {
            Text("Loading…", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        viewModel.webhooks.forEach { webhook ->
            WebhookCard(webhook, viewModel)
        }

        CreateWebhookForm(viewModel)
    }
}

@Composable
private fun WebhookCard(webhook: WebhookDto, viewModel: WebhooksViewModel) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    val clipboard = LocalClipboardManager.current
    var expanded by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }

    val incoming = webhook.direction == "incoming"
    val incomingUrl = webhook.incomingToken
        ?.let { "${BuildConfig.API_BASE_URL.trimEnd('/')}/api/hooks/$it" }

    SurfaceCard(modifier = Modifier.fillMaxWidth()) {
        Column {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp, top = 10.dp, bottom = 10.dp),
            ) {
                Icon(
                    if (incoming) Icons.Outlined.ArrowDownward else Icons.Outlined.ArrowUpward,
                    contentDescription = if (incoming) "Incoming" else "Outgoing",
                    tint = if (incoming) Color(0xFF3B82F6) else Orange500,
                    modifier = Modifier.size(18.dp),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            webhook.name,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            if (webhook.enabled) "Enabled" else "Disabled",
                            fontSize = 10.sp,
                            color = if (webhook.enabled) Color(0xFF22C55E) else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        webhook.url ?: incomingUrl ?: "",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Switch(
                    checked = webhook.enabled,
                    onCheckedChange = {
                        haptics.tap()
                        viewModel.setEnabled(webhook.id, it)
                    },
                    colors = SwitchDefaults.colors(checkedTrackColor = Orange500),
                )
                IconButton(onClick = {
                    expanded = !expanded
                    if (expanded && !incoming) viewModel.loadDeliveries(webhook.id)
                }) {
                    Icon(
                        if (expanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                        contentDescription = if (expanded) "Collapse" else "Expand",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (expanded) {
                HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(12.dp),
                ) {
                    if (incomingUrl != null) {
                        Column {
                            FieldLabel("Incoming URL")
                            Spacer(Modifier.height(4.dp))
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    incomingUrl,
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
                                    clipboard.setText(AnnotatedString(incomingUrl))
                                    haptics.success()
                                }) {
                                    Icon(
                                        Icons.Outlined.ContentCopy,
                                        contentDescription = "Copy URL",
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.size(16.dp),
                                    )
                                }
                            }
                        }
                    }

                    if (!incoming) {
                        webhook.events?.takeIf { it.isNotEmpty() }?.let { events ->
                            Column {
                                FieldLabel("Events")
                                Spacer(Modifier.height(4.dp))
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                                ) {
                                    events.forEach { EventChip(it, selected = true, onClick = null) }
                                }
                            }
                        }

                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            BrandButton(
                                text = "Send test",
                                icon = Icons.Outlined.Send,
                                secondary = true,
                                onClick = {
                                    haptics.tap()
                                    viewModel.test(webhook.id)
                                },
                            )
                            viewModel.testResults[webhook.id]?.let {
                                Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }

                        Column {
                            FieldLabel("Delivery log")
                            Spacer(Modifier.height(4.dp))
                            val log = viewModel.deliveries[webhook.id]
                            when {
                                log == null -> Text("Loading…", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                log.isEmpty() -> Text("No deliveries yet.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                else -> log.take(10).forEach { delivery ->
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                                    ) {
                                        val code = delivery.statusCodeInt
                                        val ok = code != null && code < 400
                                        Text(
                                            code?.toString() ?: "ERR",
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace,
                                            color = if (ok) Color(0xFF22C55E) else Color(0xFFEF4444),
                                            modifier = Modifier
                                                .background(if (dark) Ink900 else Color(0xFFF3F4F6))
                                                .padding(horizontal = 5.dp, vertical = 1.dp),
                                        )
                                        Text(delivery.event, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                        Spacer(Modifier.weight(1f))
                                        isoToMillis(delivery.createdAt)?.let {
                                            Text(
                                                formatDueDate(it),
                                                fontSize = 11.sp,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Text(
                        "Delete webhook",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFFEF4444),
                        modifier = Modifier
                            .clickable { confirmDelete = true }
                            .padding(vertical = 4.dp),
                    )
                }
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete webhook") },
            text = { Text("Delete \"${webhook.name}\"?") },
            confirmButton = {
                TextButton(onClick = {
                    haptics.error()
                    confirmDelete = false
                    viewModel.delete(webhook.id)
                }) { Text("Delete", color = Color(0xFFEF4444)) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun CreateWebhookForm(viewModel: WebhooksViewModel) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    var showForm by rememberSaveable { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf("") }
    var url by rememberSaveable { mutableStateOf("") }
    var direction by rememberSaveable { mutableStateOf("outgoing") }
    var selectedEvents by rememberSaveable { mutableStateOf(listOf("task.completed")) }

    if (!showForm) {
        BrandButton(
            text = "Add webhook",
            icon = Icons.Outlined.Add,
            secondary = true,
            onClick = {
                haptics.tap()
                showForm = true
            },
            modifier = Modifier.fillMaxWidth(),
        )
        return
    }

    SurfaceCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(12.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("outgoing" to "Outgoing", "incoming" to "Incoming").forEach { (value, label) ->
                    val selected = direction == value
                    Text(
                        label,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        color = if (selected) Orange500 else MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier
                            .weight(1f)
                            .background(
                                if (selected) {
                                    if (dark) Ink700 else Color(0xFFFFF7ED)
                                } else Color.Transparent
                            )
                            .clickable {
                                haptics.tap()
                                direction = value
                            }
                            .padding(vertical = 10.dp),
                    )
                }
            }

            OrangTextField(value = name, onValueChange = { name = it }, placeholder = "Webhook name")

            if (direction == "outgoing") {
                OrangTextField(value = url, onValueChange = { url = it }, placeholder = "https://example.com/webhook")
                Column {
                    FieldLabel("Events")
                    Spacer(Modifier.height(6.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                    ) {
                        OUTGOING_EVENTS.forEach { event ->
                            EventChip(event, selected = event in selectedEvents) {
                                haptics.tap()
                                selectedEvents = if (event in selectedEvents) {
                                    selectedEvents - event
                                } else selectedEvents + event
                            }
                        }
                    }
                }
            } else {
                Text(
                    "An incoming URL will be generated. POST a JSON task to it to create tasks from external tools.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BrandButton(
                    text = if (viewModel.creating) "Creating…" else "Create",
                    enabled = !viewModel.creating && name.isNotBlank() &&
                        (direction == "incoming" || url.isNotBlank()),
                    onClick = {
                        haptics.tap()
                        viewModel.create(
                            name = name,
                            url = url.takeIf { direction == "outgoing" },
                            direction = direction,
                            events = selectedEvents.takeIf { direction == "outgoing" },
                        ) {
                            showForm = false
                            name = ""
                            url = ""
                            selectedEvents = listOf("task.completed")
                        }
                    },
                    modifier = Modifier.weight(1f),
                )
                BrandButton(text = "Cancel", secondary = true, onClick = { showForm = false })
            }
        }
    }
}

@Composable
private fun EventChip(event: String, selected: Boolean, onClick: (() -> Unit)?) {
    val dark = isDarkTheme()
    Text(
        event,
        fontSize = 11.sp,
        fontFamily = FontFamily.Monospace,
        color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .background(if (selected) Orange500 else (if (dark) Ink700 else Color(0xFFF3F4F6)))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 8.dp, vertical = 5.dp),
    )
}
