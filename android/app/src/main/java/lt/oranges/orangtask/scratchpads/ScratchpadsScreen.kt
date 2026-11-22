package lt.oranges.orangtask.scratchpads

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CheckBox
import androidx.compose.material.icons.outlined.Code
import androidx.compose.material.icons.outlined.DataObject
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.FormatBold
import androidx.compose.material.icons.outlined.FormatItalic
import androidx.compose.material.icons.outlined.FormatListBulleted
import androidx.compose.material.icons.outlined.FormatListNumbered
import androidx.compose.material.icons.outlined.FormatQuote
import androidx.compose.material.icons.outlined.FormatStrikethrough
import androidx.compose.material.icons.outlined.HorizontalRule
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Title
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.db.ScratchpadEntity
import lt.oranges.orangtask.core.i18n.tr
import lt.oranges.orangtask.ui.components.EmptyState
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.theme.Gray200
import lt.oranges.orangtask.ui.theme.Gray400
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Orange500

private data class Format(
    val icon: ImageVector,
    val label: Int,
    val before: String,
    val after: String = "",
    val line: Boolean = false,
)

private val FORMATS = listOf(
    Format(Icons.Outlined.FormatBold, R.string.format_bold, "**", "**"),
    Format(Icons.Outlined.FormatItalic, R.string.format_italic, "*", "*"),
    Format(Icons.Outlined.FormatStrikethrough, R.string.format_strikethrough, "~~", "~~"),
    Format(Icons.Outlined.Code, R.string.format_code, "`", "`"),
    Format(Icons.Outlined.Title, R.string.format_heading, "## ", line = true),
    Format(Icons.Outlined.FormatListBulleted, R.string.format_bullet_list, "- ", line = true),
    Format(Icons.Outlined.FormatListNumbered, R.string.format_numbered_list, "1. ", line = true),
    Format(Icons.Outlined.CheckBox, R.string.format_task_item, "- [ ] ", line = true),
    Format(Icons.Outlined.FormatQuote, R.string.format_quote, "> ", line = true),
    Format(Icons.Outlined.Link, R.string.format_link, "[", "](https://)"),
    Format(Icons.Outlined.DataObject, R.string.format_code_block, "```\n", "\n```"),
    Format(Icons.Outlined.HorizontalRule, R.string.format_divider, "---\n", line = true),
)

private fun applyFormat(value: TextFieldValue, format: Format): TextFieldValue {
    val text = value.text
    val start = value.selection.min
    val end = value.selection.max
    val shift = format.before.length

    if (format.line) {
        val lineStart = text.lastIndexOf('\n', start - 1) + 1
        val next = text.substring(0, lineStart) + format.before + text.substring(lineStart)
        return TextFieldValue(next, TextRange(start + shift, end + shift))
    }

    val next = text.substring(0, start) + format.before + text.substring(start, end) +
        format.after + text.substring(end)
    return TextFieldValue(next, TextRange(start + shift, end + shift))
}

@Composable
fun ScratchpadsScreen(
    onBack: () -> Unit,
    viewModel: ScratchpadsViewModel = hiltViewModel(),
) {
    val pads by viewModel.scratchpads.collectAsStateWithLifecycle()
    val loading by viewModel.loading.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val dark = isDarkTheme()

    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var preview by rememberSaveable { mutableStateOf(false) }
    var confirmDelete by rememberSaveable { mutableStateOf<String?>(null) }

    val selected = pads.find { it.id == selectedId }

    fun closeEditor() {
        viewModel.flushDraft()
        selectedId = null
        preview = false
    }

    BackHandler(enabled = selected != null) { closeEditor() }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp),
        ) {
            IconButton(onClick = {
                haptics.tap()
                if (selected != null) closeEditor() else onBack()
            }) {
                Icon(
                    Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = tr(R.string.content_description_back),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = if (selected != null) {
                    selected.title.ifBlank { tr(R.string.scratchpads_untitled) }
                } else {
                    tr(R.string.scratchpads_heading)
                },
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = if (selected != null) 0.sp else 1.sp,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            if (selected != null) {
                IconButton(onClick = {
                    haptics.tap()
                    preview = !preview
                }) {
                    Icon(
                        if (preview) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                        contentDescription = if (preview) tr(R.string.edit) else tr(R.string.preview),
                        tint = if (preview) Orange500 else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = {
                    haptics.tap()
                    confirmDelete = selected.id
                }) {
                    Icon(
                        Icons.Outlined.Delete,
                        contentDescription = tr(R.string.delete_note),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                IconButton(onClick = {
                    haptics.tap()
                    viewModel.createScratchpad { id ->
                        selectedId = id
                        preview = false
                    }
                }) {
                    Icon(
                        Icons.Outlined.Add,
                        contentDescription = tr(R.string.new_note),
                        tint = Orange500,
                    )
                }
            }
        }
        HorizontalDivider(color = if (dark) Ink700 else Gray200)

        Box(modifier = Modifier.weight(1f)) {
            when {
                selected != null -> ScratchpadEditor(selected, preview, viewModel)
                loading && pads.isEmpty() -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    Text(
                        tr(R.string.loading),
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                pads.isEmpty() -> EmptyState(
                    icon = Icons.Outlined.EditNote,
                    title = tr(R.string.no_scratchpads_yet),
                    description = tr(R.string.scratchpads_empty_description),
                )
                else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(pads, key = { it.id }) { pad ->
                        ScratchpadRow(
                            pad = pad,
                            onClick = {
                                haptics.tap()
                                selectedId = pad.id
                                preview = false
                            },
                            onDelete = {
                                haptics.tap()
                                confirmDelete = pad.id
                            },
                        )
                    }
                }
            }
        }
    }

    val pendingDelete = confirmDelete?.let { id -> pads.find { it.id == id } }
    if (pendingDelete != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text(tr(R.string.delete_note)) },
            text = {
                Text(
                    tr(
                        R.string.delete_note_confirmation,
                        pendingDelete.title.ifBlank { tr(R.string.scratchpads_untitled) },
                    ),
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    haptics.error()
                    confirmDelete = null
                    if (selectedId == pendingDelete.id) {
                        selectedId = null
                        preview = false
                    }
                    viewModel.deleteScratchpad(pendingDelete.id)
                }) { Text(tr(R.string.delete), color = Color(0xFFEF4444)) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = null }) { Text(tr(R.string.cancel)) }
            },
        )
    }
}

@Composable
private fun ScratchpadRow(pad: ScratchpadEntity, onClick: () -> Unit, onDelete: () -> Unit) {
    val dark = isDarkTheme()
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .clickable { onClick() }
            .padding(horizontal = 16.dp),
    ) {
        Icon(
            Icons.Outlined.EditNote,
            contentDescription = null,
            tint = muted,
            modifier = Modifier.size(18.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = pad.title.ifBlank { tr(R.string.scratchpads_untitled) },
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
            )
            val snippet = pad.content.lineSequence().firstOrNull { it.isNotBlank() }?.trim()
            if (!snippet.isNullOrEmpty()) {
                Text(text = snippet, fontSize = 13.sp, color = muted, maxLines = 1)
            }
        }
        Icon(
            Icons.Outlined.Delete,
            contentDescription = tr(R.string.delete_note),
            tint = muted,
            modifier = Modifier.size(16.dp).clickable { onDelete() },
        )
    }
    HorizontalDivider(color = if (dark) Ink700 else Gray200)
}

@Composable
private fun ScratchpadEditor(
    pad: ScratchpadEntity,
    preview: Boolean,
    viewModel: ScratchpadsViewModel,
) {
    val haptics = rememberHaptics()
    var title by rememberSaveable(pad.id) { mutableStateOf(pad.title) }
    var content by rememberSaveable(pad.id, stateSaver = TextFieldValue.Saver) {
        mutableStateOf(TextFieldValue(pad.content))
    }

    var base by remember(pad.id) { mutableStateOf(pad.title to pad.content) }
    LaunchedEffect(pad.title, pad.content) {
        val remote = pad.title to pad.content
        if (title == pad.title && content.text == pad.content) {
            base = remote
        } else if (title == base.first && content.text == base.second) {
            title = pad.title
            content = TextFieldValue(pad.content, TextRange(minOf(content.selection.end, pad.content.length)))
            base = remote
        }
    }

    DisposableEffect(pad.id) {
        onDispose { viewModel.flushDraft() }
    }

    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        OrangTextField(
            value = title,
            onValueChange = {
                title = it
                viewModel.onDraftChanged(pad.id, it, content.text)
            },
            placeholder = tr(R.string.scratchpad_title_placeholder),
            modifier = Modifier.fillMaxWidth(),
        )

        if (!preview) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            ) {
                for (format in FORMATS) {
                    IconButton(onClick = {
                        haptics.tap()
                        val next = applyFormat(content, format)
                        content = next
                        viewModel.onDraftChanged(pad.id, title, next.text)
                    }) {
                        Icon(
                            format.icon,
                            contentDescription = tr(format.label),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }
        }

        if (preview) {
            if (content.text.isBlank()) {
                Text(tr(R.string.scratchpad_empty_note), fontSize = 14.sp, color = Gray400)
            } else {
                RichText(content.text, modifier = Modifier.fillMaxWidth())
            }
        } else {
            BasicTextField(
                value = content,
                onValueChange = {
                    content = it
                    viewModel.onDraftChanged(pad.id, title, it.text)
                },
                textStyle = MaterialTheme.typography.bodyMedium.copy(
                    color = MaterialTheme.colorScheme.onSurface,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 14.sp,
                ),
                cursorBrush = SolidColor(Orange500),
                decorationBox = { inner ->
                    Box {
                        if (content.text.isEmpty()) {
                            Text(
                                tr(R.string.scratchpad_content_placeholder),
                                fontSize = 14.sp,
                                color = Gray400,
                            )
                        }
                        inner()
                    }
                },
                modifier = Modifier.fillMaxWidth().heightIn(min = 240.dp),
            )
        }

        Text(tr(R.string.scratchpads_formatting_hint), fontSize = 11.sp, color = Gray400)
        Spacer(Modifier.height(24.dp))
    }
}
