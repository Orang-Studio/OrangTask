package lt.oranges.orangtask.lists

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.HowToReg
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material.icons.outlined.Tag
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import lt.oranges.orangtask.R
import lt.oranges.orangtask.ui.components.EmptyState
import lt.oranges.orangtask.ui.components.ListIcon
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Ink800
import lt.oranges.orangtask.ui.theme.Orange500

@Composable
fun ListsScreen(
    onOpenView: (String) -> Unit,
    onOpenList: (String) -> Unit,
    viewModel: ListsViewModel = hiltViewModel(),
) {
    val lists by viewModel.lists.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    var adding by remember { mutableStateOf(false) }
    var newName by rememberSaveable { mutableStateOf("") }

    fun create() {
        val name = newName.trim()
        adding = false
        if (name.isEmpty()) return
        newName = ""
        viewModel.createList(name) { id -> onOpenList(id) }
    }

    val views = listOf(
        Triple("upcoming", tr(R.string.upcoming), Icons.Outlined.CalendarMonth),
        Triple("overdue", tr(R.string.overdue), Icons.Outlined.ErrorOutline),
        Triple("assigned", tr(R.string.assigned_to_me), Icons.Outlined.HowToReg),
        Triple("all", tr(R.string.all_tasks), Icons.Outlined.Layers),
    )

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp),
        ) {
            Icon(Icons.Outlined.Layers, contentDescription = null, tint = Orange500, modifier = Modifier.size(20.dp))
            Text(
                tr(R.string.lists).uppercase(),
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
            )
            Spacer(Modifier.weight(1f))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier
                    .background(Orange500)
                    .clickable {
                        haptics.tap()
                        adding = true
                    }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Icon(Icons.Outlined.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                Text(
                    tr(R.string.new_label).uppercase(),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    color = Color.White,
                )
            }
        }
        HorizontalDivider(color = if (isDarkTheme()) Ink700 else Color(0xFFE5E7EB))

        LazyColumn(modifier = Modifier.fillMaxSize()) {
            if (adding) {
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    ) {
                        Icon(
                            Icons.Outlined.Tag,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                        )
                        OrangTextField(
                            value = newName,
                            onValueChange = { newName = it },
                            placeholder = tr(R.string.list_name_placeholder),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                            keyboardActions = KeyboardActions(onDone = { create() }),
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            tr(R.string.add_label).uppercase(),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Orange500,
                            modifier = Modifier.clickable { create() }.padding(8.dp),
                        )
                    }
                }
            }

            item { SectionLabel(tr(R.string.views)) }
            items(views, key = { it.first }) { (kind, label, icon) ->
                IndexRow(
                    icon = { Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp)) },
                    label = label,
                    onClick = {
                        haptics.tap()
                        onOpenView(kind)
                    },
                )
            }

            item { SectionLabel(tr(R.string.lists)) }
            items(lists, key = { it.id }) { list ->
                IndexRow(
                    icon = { ListIcon(icon = list.icon, colorHex = list.color) },
                    label = list.name,
                    roleBadge = list.myRole?.takeIf { it != "owner" }?.let { roleLabel(it) },
                    count = list.taskCount.takeIf { it > 0 },
                    onClick = {
                        haptics.tap()
                        onOpenList(list.id)
                    },
                )
            }

            if (lists.isEmpty() && !adding) {
                item {
                    Box(Modifier.fillMaxWidth().height(320.dp)) {
                        EmptyState(
                            icon = Icons.Outlined.Layers,
                            title = tr(R.string.no_lists_yet),
                            description = tr(
                                R.string.no_lists_description,
                                tr(R.string.new_label),
                            ),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun roleLabel(role: String): String = when (role) {
    "owner" -> tr(R.string.role_owner)
    "editor" -> tr(R.string.role_editor)
    "viewer" -> tr(R.string.role_viewer)
    else -> role.replaceFirstChar { it.uppercase() }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        letterSpacing = 1.5.sp,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp),
    )
}

@Composable
private fun IndexRow(
    icon: @Composable () -> Unit,
    label: String,
    onClick: () -> Unit,
    roleBadge: String? = null,
    count: Int? = null,
) {
    val dark = isDarkTheme()
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .height(56.dp)
                .padding(horizontal = 16.dp),
        ) {
            icon()
            Text(
                label,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,

                modifier = Modifier.weight(1f),
            )
            roleBadge?.let {
                Text(
                    it.uppercase(),
                    fontSize = 10.sp,
                    letterSpacing = 1.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .background(if (dark) Ink800 else Color(0xFFF3F4F6))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
            count?.let {
                Text(
                    pluralStringResource(R.plurals.task_count, it, it),
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Icon(
                Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            )
        }
        HorizontalDivider(color = if (dark) Ink700 else Color(0xFFF3F4F6))
    }
}
