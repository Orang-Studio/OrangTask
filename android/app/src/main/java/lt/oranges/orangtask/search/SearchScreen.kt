package lt.oranges.orangtask.search

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lt.oranges.orangtask.core.db.isoToMillis
import lt.oranges.orangtask.core.network.SearchResultDto
import lt.oranges.orangtask.ui.components.EmptyState
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.PriorityDot
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.format.formatDueDate
import lt.oranges.orangtask.ui.theme.Ink700

/** CommandPalette.tsx as the Search tab: type ≥2 characters, results stream in as you pause, tapping */
@Composable
fun SearchScreen(
    onOpenTask: (listId: String, taskId: String) -> Unit,
    viewModel: SearchViewModel = hiltViewModel(),
) {
    val query by viewModel.query.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val focusRequester = remember { FocusRequester() }
    val haptics = rememberHaptics()

    LaunchedEffect(Unit) {
        runCatching { focusRequester.requestFocus() }
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        ) {
            Icon(
                Icons.Outlined.Search,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
            OrangTextField(
                value = query,
                onValueChange = viewModel::onQueryChange,
                placeholder = "Search tasks...",
                modifier = Modifier.weight(1f).focusRequester(focusRequester),
            )
        }
        HorizontalDivider(color = if (isDarkTheme()) Ink700 else Color(0xFFE5E7EB))

        Box(modifier = Modifier.fillMaxSize()) {
            when (val s = state) {
                SearchUiState.Idle -> CenteredHint("Type at least 2 characters")
                SearchUiState.Searching -> CenteredHint("Searching…")
                is SearchUiState.Error -> EmptyState(
                    icon = Icons.Outlined.CloudOff,
                    title = "Search unavailable",
                    description = s.message,
                )
                is SearchUiState.Results ->
                    if (s.results.isEmpty()) {
                        CenteredHint("No results for \"${s.query}\"")
                    } else {
                        LazyColumn(modifier = Modifier.fillMaxSize()) {
                            items(s.results, key = { it.id }) { result ->
                                SearchResultRow(result) {
                                    haptics.tap()
                                    onOpenTask(result.listId, result.id)
                                }
                            }
                        }
                    }
            }
        }
    }
}

@Composable
private fun CenteredHint(text: String) {
    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Text(text, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SearchResultRow(result: SearchResultDto, onClick: () -> Unit) {
    val done = result.status == "done"
    val subtitle = buildString {
        append(result.listName ?: "")
        isoToMillis(result.dueDate)?.let {
            if (isNotEmpty()) append(" · ")
            append(formatDueDate(it))
        }
    }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        PriorityDot(result.priority)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                result.title,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textDecoration = if (done) TextDecoration.LineThrough else null,
                color = if (done) MaterialTheme.colorScheme.onSurfaceVariant
                else MaterialTheme.colorScheme.onSurface,
            )
            if (subtitle.isNotEmpty()) {
                Text(
                    subtitle,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Icon(
            Icons.AutoMirrored.Outlined.KeyboardArrowRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(16.dp),
        )
    }
}
