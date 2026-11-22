package lt.oranges.orangtask.lists

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.i18n.tr
import lt.oranges.orangtask.ui.components.BrandButton
import lt.oranges.orangtask.ui.components.DEFAULT_LIST_ICON
import lt.oranges.orangtask.ui.components.FieldLabel
import lt.oranges.orangtask.ui.components.LIST_COLORS
import lt.oranges.orangtask.ui.components.LIST_ICONS
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.listIconFor
import lt.oranges.orangtask.ui.components.parseHexColor
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Ink850
import lt.oranges.orangtask.ui.theme.Orange500

private const val SUGGEST_DEBOUNCE_MS = 350L

@Composable
fun NewListDialog(
    onDismiss: () -> Unit,
    onSuggest: suspend (String) -> String?,
    onCreate: (name: String, color: String, icon: String?) -> Unit,
) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    var name by rememberSaveable { mutableStateOf("") }
    var color by rememberSaveable { mutableStateOf(LIST_COLORS.first()) }
    // null auto the icon follows the suggestion for the name
    var picked by rememberSaveable { mutableStateOf<String?>(null) }
    // the grid stays folded away until the preview tile is tapped
    var iconsOpen by rememberSaveable { mutableStateOf(false) }
    var suggestedFor by remember { mutableStateOf<String?>(null) }
    var suggested by remember { mutableStateOf<String?>(null) }
    var suggesting by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    val trimmed = name.trim()
    // restarting on every keystroke cancels the previous wait and any call still out
    LaunchedEffect(trimmed, picked) {
        if (picked != null || trimmed.isEmpty() || suggestedFor == trimmed) {
            suggesting = false
            return@LaunchedEffect
        }
        suggesting = true
        delay(SUGGEST_DEBOUNCE_MS)
        val icon = runCatching { onSuggest(trimmed) }.getOrNull()
        suggested = icon?.takeIf { it in LIST_ICONS }
        suggestedFor = trimmed
        suggesting = false
    }
    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    val autoIcon = suggested.takeIf { trimmed.isNotEmpty() && suggestedFor == trimmed }
    val icon = picked ?: autoIcon ?: DEFAULT_LIST_ICON
    val tint = parseHexColor(color, Orange500)

    fun submit() {
        if (trimmed.isEmpty()) return
        haptics.success()
        // no icon while the preview is still out the server picks one after creating
        onCreate(trimmed, color, picked ?: autoIcon)
    }

    // drawn in activity window because compose dialog misses keyboard height
    BackHandler(onBack = onDismiss)
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.5f))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDismiss)
            .systemBarsPadding()
            .imePadding()
            .padding(16.dp),
    ) {
        Surface(
            color = if (dark) Ink850 else Color.White,
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, if (dark) Ink700 else Color(0xFFE5E7EB))
                // taps on the card must not fall through to the dismissing layer
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
        ) {
            Column {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
                ) {
                    Text(
                        tr(R.string.new_list).uppercase(),
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        letterSpacing = 1.sp,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Outlined.Close, contentDescription = tr(R.string.cancel), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))

                Column(
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                    modifier = Modifier.verticalScroll(rememberScrollState()).padding(20.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        // the badge and spinner sit beside the bordered tile not inside it a border draws over its own children and would cut through them
                        Box(Modifier.size(48.dp)) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .border(2.dp, tint)
                                    .clickable {
                                        haptics.tap()
                                        iconsOpen = !iconsOpen
                                    },
                            ) {
                                Icon(listIconFor(icon), contentDescription = tr(R.string.change_icon), tint = tint, modifier = Modifier.size(24.dp))
                            }
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .align(Alignment.BottomEnd)
                                    .offset(x = 7.dp, y = 7.dp)
                                    .size(18.dp)
                                    .background(tint, CircleShape),
                            ) {
                                Icon(
                                    if (iconsOpen) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(16.dp),
                                )
                            }
                            if (suggesting) {
                                CircularProgressIndicator(
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .offset(x = 7.dp, y = (-7).dp)
                                        .size(14.dp)
                                        .background(if (dark) Ink850 else Color.White, CircleShape),
                                )
                            }
                        }
                        OrangTextField(
                            value = name,
                            onValueChange = { if (it.length <= 100) name = it },
                            placeholder = tr(R.string.list_name_placeholder),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                            keyboardActions = KeyboardActions(onDone = { submit() }),
                            modifier = Modifier.weight(1f).focusRequester(focusRequester),
                        )
                    }

                    AnimatedVisibility(
                        visible = iconsOpen,
                        enter = expandVertically() + fadeIn(),
                        exit = shrinkVertically() + fadeOut(),
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            FieldLabel(tr(R.string.icon_label))
                            LazyVerticalGrid(columns = GridCells.Fixed(7), modifier = Modifier.height(176.dp)) {
                                items(LIST_ICONS.keys.toList(), key = { it }) { key ->
                                    val active = icon == key
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier
                                            .padding(2.dp)
                                            .height(40.dp)
                                            .background(
                                                if (active) (if (dark) Ink700 else Color(0xFFFFEDD5)) else Color.Transparent,
                                                RoundedCornerShape(4.dp),
                                            )
                                            .then(if (active) Modifier.border(1.dp, Orange500, RoundedCornerShape(4.dp)) else Modifier)
                                            .clickable {
                                                haptics.tap()
                                                // picking the chosen icon again hands it back to the names suggestion
                                                picked = if (picked == key) null else key
                                                iconsOpen = false
                                            },
                                    ) {
                                        Icon(
                                            LIST_ICONS.getValue(key),
                                            contentDescription = key,
                                            tint = if (active) tint else MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.size(20.dp),
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        FieldLabel(tr(R.string.color_label))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            LIST_COLORS.forEach { hex ->
                                val selected = hex == color
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier
                                        .size(32.dp)
                                        .then(
                                            if (selected) Modifier.border(2.dp, MaterialTheme.colorScheme.onSurfaceVariant, CircleShape)
                                            else Modifier,
                                        )
                                        .clickable {
                                            haptics.tap()
                                            color = hex
                                        },
                                ) {
                                    Box(Modifier.size(24.dp).background(parseHexColor(hex, Orange500), CircleShape))
                                }
                            }
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        BrandButton(
                            text = tr(R.string.cancel),
                            onClick = onDismiss,
                            secondary = true,
                            modifier = Modifier.weight(1f).border(1.dp, if (dark) Ink700 else Color(0xFFE5E7EB)),
                        )
                        BrandButton(
                            text = tr(R.string.create),
                            onClick = { submit() },
                            enabled = trimmed.isNotEmpty(),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}
