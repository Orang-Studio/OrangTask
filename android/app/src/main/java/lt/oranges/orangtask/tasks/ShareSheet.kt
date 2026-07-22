package lt.oranges.orangtask.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lt.oranges.orangtask.core.network.MemberDto
import lt.oranges.orangtask.ui.components.Avatar
import lt.oranges.orangtask.ui.components.BrandButton
import lt.oranges.orangtask.ui.components.FieldLabel
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Ink850
import lt.oranges.orangtask.ui.theme.Orange500

/** ShareModal.tsx as a bottom sheet: member list with roles, invite-by-email (owner), role */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareSheet(
    listName: String,
    members: List<MemberDto>,
    isOwner: Boolean,
    onInvite: (email: String, role: String) -> Unit,
    onSetRole: (userId: String, role: String) -> Unit,
    onRemove: (userId: String) -> Unit,
    onLeave: () -> Unit,
    onDismiss: () -> Unit,
) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    var email by rememberSaveable { mutableStateOf("") }
    var role by rememberSaveable { mutableStateOf("editor") }
    var confirmLeave by remember { mutableStateOf(false) }

    fun invite() {
        val value = email.trim()
        if (value.isEmpty()) return
        haptics.tap()
        onInvite(value, role)
        email = ""
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = if (dark) Ink850 else Color.White,
        dragHandle = null,
    ) {
        Column(modifier = Modifier.navigationBarsPadding().padding(bottom = 16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().height(56.dp).padding(start = 16.dp, end = 4.dp),
            ) {
                Text(
                    "SHARE \"${listName.uppercase()}\"",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Outlined.Close, contentDescription = "Close", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))

            Column(
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.padding(16.dp),
            ) {
                if (isOwner) {
                    Column {
                        FieldLabel("Invite by email")
                        Spacer(Modifier.height(6.dp))
                        OrangTextField(
                            value = email,
                            onValueChange = { email = it },
                            placeholder = "teammate@example.com",
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Email,
                                imeAction = ImeAction.Done,
                            ),
                            keyboardActions = KeyboardActions(onDone = { invite() }),
                        )
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            RolePicker(role = role, onRole = { role = it })
                            BrandButton(
                                text = "Invite",
                                icon = Icons.Outlined.PersonAdd,
                                enabled = email.isNotBlank(),
                                onClick = { invite() },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }

                Column {
                    FieldLabel("Members")
                    Spacer(Modifier.height(4.dp))
                    if (members.none { it.role != "owner" }) {
                        Text(
                            "Just you for now. Invite someone to collaborate.",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(vertical = 8.dp),
                        )
                    }
                    members.forEach { member ->
                        MemberRow(
                            member = member,
                            canManage = isOwner && member.role != "owner",
                            onSetRole = { onSetRole(member.id, it) },
                            onRemove = {
                                haptics.error()
                                onRemove(member.id)
                            },
                        )
                    }
                }

                if (!isOwner) {
                    HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))
                    Text(
                        "Leave list",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFFEF4444),
                        modifier = Modifier
                            .clickable { confirmLeave = true }
                            .padding(vertical = 6.dp),
                    )
                }
            }
        }
    }

    if (confirmLeave) {
        AlertDialog(
            onDismissRequest = { confirmLeave = false },
            title = { Text("Leave list") },
            text = { Text("Leave \"$listName\"? You'll lose access until you're invited again.") },
            confirmButton = {
                TextButton(onClick = {
                    haptics.error()
                    confirmLeave = false
                    onLeave()
                }) { Text("Leave", color = Color(0xFFEF4444)) }
            },
            dismissButton = { TextButton(onClick = { confirmLeave = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun MemberRow(
    member: MemberDto,
    canManage: Boolean,
    onSetRole: (String) -> Unit,
    onRemove: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
    ) {
        Avatar(name = member.name, url = member.avatarUrl, size = 32.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(member.name, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                member.email,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (member.role == "owner") {
            RoleBadge("Owner", highlight = true)
        } else if (canManage) {
            RolePicker(role = member.role, onRole = onSetRole, compact = true)
            IconButton(onClick = onRemove) {
                Icon(
                    Icons.Outlined.Delete,
                    contentDescription = "Remove ${member.name}",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
            }
        } else {
            RoleBadge(member.role.replaceFirstChar { it.uppercase() })
        }
    }
}

@Composable
private fun RoleBadge(text: String, highlight: Boolean = false) {
    val dark = isDarkTheme()
    val background = when {
        highlight && dark -> Color(0xFF431407)
        highlight -> Color(0xFFFFEDD5)
        dark -> Ink700
        else -> Color(0xFFF3F4F6)
    }
    val content = when {
        highlight && dark -> Color(0xFFFB923C)
        highlight -> Color(0xFFC2410C)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Text(
        text,
        fontSize = 11.sp,
        color = content,
        modifier = Modifier.background(background).padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

/** editor/Viewer dropdown, standing in for the web <select> */
@Composable
private fun RolePicker(role: String, onRole: (String) -> Unit, compact: Boolean = false) {
    var open by remember { mutableStateOf(false) }
    val dark = isDarkTheme()
    Box {
        Text(
            role.replaceFirstChar { it.uppercase() } + " ▾",
            fontSize = if (compact) 12.sp else 13.sp,
            fontWeight = FontWeight.Medium,
            color = if (dark) Color.White else Color(0xFF111827),
            modifier = Modifier
                .background(if (dark) Ink700 else Color(0xFFF3F4F6))
                .clickable { open = true }
                .padding(horizontal = 10.dp, vertical = if (compact) 6.dp else 12.dp),
        )
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            listOf("editor", "viewer").forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            option.replaceFirstChar { it.uppercase() },
                            color = if (option == role) Orange500 else MaterialTheme.colorScheme.onSurface,
                        )
                    },
                    onClick = {
                        open = false
                        if (option != role) onRole(option)
                    },
                )
            }
        }
    }
}
