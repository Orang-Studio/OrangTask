package lt.oranges.orangtask.settings

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.IntegrationInstructions
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.Upload
import androidx.compose.material.icons.outlined.Webhook
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.compose.foundation.text.KeyboardOptions
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.delay
import lt.oranges.orangtask.core.network.UserDto
import lt.oranges.orangtask.ui.components.Avatar
import lt.oranges.orangtask.ui.components.BrandButton
import lt.oranges.orangtask.ui.components.FieldLabel
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.SurfaceCard
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.theme.Ink600
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Orange500
import lt.oranges.orangtask.ui.theme.ThemeMode

// section keys ("" = index)
private const val SECTION_PROFILE = "profile"
private const val SECTION_APPEARANCE = "appearance"
private const val SECTION_NOTIFICATIONS = "notifications"
private const val SECTION_WEBHOOKS = "webhooks"
private const val SECTION_INTEGRATIONS = "integrations"
private const val SECTION_DATA = "data"

private data class SectionInfo(val key: String, val label: String, val icon: ImageVector)

private val SECTIONS = listOf(
    SectionInfo(SECTION_PROFILE, "Profile", Icons.Outlined.Person),
    SectionInfo(SECTION_APPEARANCE, "Appearance", Icons.Outlined.Palette),
    SectionInfo(SECTION_NOTIFICATIONS, "Notifications", Icons.Outlined.Notifications),
    SectionInfo(SECTION_WEBHOOKS, "Webhooks", Icons.Outlined.Webhook),
    SectionInfo(SECTION_INTEGRATIONS, "Integrations", Icons.Outlined.IntegrationInstructions),
    SectionInfo(SECTION_DATA, "Data", Icons.Outlined.Storage),
)

/** SettingsPage.tsx, phone-shaped: an index of sections that push in, instead of the web sidebar */
@Composable
fun SettingsScreen(
    user: UserDto?,
    onLogout: () -> Unit,
    onUserChanged: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    var section by rememberSaveable { mutableStateOf("") }
    val snackbar = remember { SnackbarHostState() }

    BackHandler(enabled = section.isNotEmpty()) { section = "" }

    LaunchedEffect(Unit) {
        viewModel.errors.collect { snackbar.showSnackbar(it) }
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = if (section.isEmpty()) 16.dp else 4.dp),
            ) {
                if (section.isEmpty()) {
                    Icon(Icons.Outlined.Settings, contentDescription = null, tint = Orange500, modifier = Modifier.size(20.dp))
                    Text("SETTINGS", fontSize = 17.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                } else {
                    IconButton(onClick = { section = "" }) {
                        Icon(
                            Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = "Back",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        (SECTIONS.firstOrNull { it.key == section }?.label ?: "").uppercase(),
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                    )
                }
            }
            HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
            ) {
                when (section) {
                    "" -> SettingsIndex(
                        user = user,
                        onOpen = { haptics.tap(); section = it },
                        onLogout = {
                            haptics.tap()
                            onLogout()
                        },
                    )
                    SECTION_PROFILE -> ProfileSection(user, viewModel, onUserChanged)
                    SECTION_APPEARANCE -> AppearanceSection(viewModel)
                    SECTION_NOTIFICATIONS -> NotificationPrefsSection(viewModel)
                    // webhook/integration errors funnel into the same snackbar via the settings VM
                    SECTION_WEBHOOKS -> WebhooksSection(onError = { viewModel.errors.tryEmit(it) })
                    SECTION_INTEGRATIONS -> IntegrationsSection(onError = { viewModel.errors.tryEmit(it) })
                    SECTION_DATA -> DataSection(user, viewModel, onLogout)
                }
            }
        }

        SnackbarHost(hostState = snackbar, modifier = Modifier.align(Alignment.BottomCenter))
    }
}

// ---- Index ----

@Composable
private fun SettingsIndex(user: UserDto?, onOpen: (String) -> Unit, onLogout: () -> Unit) {
    val dark = isDarkTheme()
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SurfaceCard(modifier = Modifier.fillMaxWidth()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(16.dp),
            ) {
                Avatar(name = user?.name, url = user?.avatarUrl, size = 48.dp)
                Column {
                    Text(user?.name ?: "", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Text(
                        user?.email ?: "",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        Column {
            SECTIONS.forEach { info ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpen(info.key) }
                        .height(52.dp),
                ) {
                    Icon(
                        info.icon,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(info.label, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                    Icon(
                        Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                    )
                }
                HorizontalDivider(color = if (dark) Ink700 else Color(0xFFF3F4F6))
            }
        }

        BrandButton(
            text = "Sign out",
            secondary = true,
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

// ---- Profile + PIN ----

@Composable
private fun ProfileSection(user: UserDto?, viewModel: SettingsViewModel, onUserChanged: () -> Unit) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    var name by rememberSaveable { mutableStateOf(user?.name ?: "") }
    var avatarUrl by rememberSaveable { mutableStateOf(user?.avatarUrl ?: "") }
    var pinInput by rememberSaveable { mutableStateOf("") }
    var showPinForm by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.loadPinStatus() }
    LaunchedEffect(viewModel.profileSaved) {
        if (viewModel.profileSaved) {
            delay(2000)
            viewModel.clearProfileSaved()
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Avatar(name = name.ifBlank { user?.name }, url = avatarUrl.ifBlank { null }, size = 56.dp)
            Text(
                user?.email ?: "",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Column {
            FieldLabel("Name")
            Spacer(Modifier.height(6.dp))
            OrangTextField(value = name, onValueChange = { name = it })
        }
        Column {
            FieldLabel("Avatar URL")
            Spacer(Modifier.height(6.dp))
            OrangTextField(value = avatarUrl, onValueChange = { avatarUrl = it }, placeholder = "https://...")
        }
        BrandButton(
            text = when {
                viewModel.profileSaving -> "Saving…"
                viewModel.profileSaved -> "Saved ✓"
                else -> "Save profile"
            },
            enabled = !viewModel.profileSaving && name.isNotBlank(),
            onClick = {
                haptics.tap()
                viewModel.saveProfile(name, avatarUrl) { onUserChanged() }
            },
        )

        HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("App PIN", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                if (viewModel.hasPin == true) {
                    Text(
                        "Enabled",
                        fontSize = 10.sp,
                        color = Color(0xFF22C55E),
                        modifier = Modifier
                            .background(if (dark) Color(0xFF052E16) else Color(0xFFDCFCE7))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
            Text(
                "Optional. Require a 4-6 digit PIN to open the app on this account.",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            when (viewModel.hasPin) {
                null -> Text("Checking…", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                true -> BrandButton(text = "Remove PIN", secondary = true, onClick = {
                    haptics.tap()
                    viewModel.removePin()
                })
                false -> if (showPinForm) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OrangTextField(
                            value = pinInput,
                            onValueChange = { pinInput = it.filter(Char::isDigit).take(6) },
                            placeholder = "4-6 digits",
                            isPassword = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            modifier = Modifier.weight(1f),
                        )
                        BrandButton(
                            text = "Set PIN",
                            enabled = pinInput.length in 4..6,
                            onClick = {
                                haptics.tap()
                                viewModel.setPin(pinInput)
                                pinInput = ""
                                showPinForm = false
                            },
                        )
                    }
                } else {
                    BrandButton(text = "Set up PIN", secondary = true, onClick = {
                        haptics.tap()
                        showPinForm = true
                    })
                }
            }
        }
    }
}

// ---- Appearance ----

@Composable
private fun AppearanceSection(viewModel: SettingsViewModel) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    Column {
        FieldLabel("Theme")
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ThemeMode.entries.forEach { mode ->
                val selected = viewModel.themePrefs.mode == mode
                Text(
                    text = mode.name.lowercase().replaceFirstChar { it.uppercase() },
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (selected) Orange500 else MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier
                        .border(1.dp, if (selected) Orange500 else (if (dark) Ink600 else Color(0xFFD1D5DB)))
                        .clickable {
                            haptics.tap()
                            viewModel.themePrefs.setMode(mode)
                        }
                        .padding(horizontal = 14.dp, vertical = 9.dp),
                )
            }
        }
    }
}

private data class NotifType(val key: String, val label: String, val desc: String)

private val NOTIF_TYPES = listOf(
    NotifType("task_due_soon", "Task due soon", "1 hour before a task is due"),
    NotifType("task_assigned", "Task assigned", "When someone assigns you a task"),
    NotifType("list_shared", "List shared", "When someone shares a list with you"),
    NotifType("task_completed_by", "Task completed", "When a collaborator completes a shared task"),
)

@Composable
private fun NotificationPrefsSection(viewModel: SettingsViewModel) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()

    LaunchedEffect(Unit) { viewModel.loadPrefs() }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Push delivers to devices where you've enabled it (browser push today, " +
                "native Android push arrives in a later update). Email goes to your account address.",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        val prefs = viewModel.prefs
        if (prefs == null) {
            Text("Loading…", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            return@Column
        }

        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 2.dp)) {
            FieldLabel("Notify me about", modifier = Modifier.weight(1f))
            FieldLabel("Push", modifier = Modifier.padding(end = 26.dp))
            FieldLabel("Email")
        }
        HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))

        NOTIF_TYPES.forEach { type ->
            val pref = prefs[type.key]
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(type.label, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    Text(type.desc, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Switch(
                    checked = pref?.push == true,
                    onCheckedChange = {
                        haptics.tap()
                        viewModel.setChannel(type.key, "push", it)
                    },
                    colors = SwitchDefaults.colors(checkedTrackColor = Orange500),
                )
                Switch(
                    checked = pref?.email == true,
                    onCheckedChange = {
                        haptics.tap()
                        viewModel.setChannel(type.key, "email", it)
                    },
                    colors = SwitchDefaults.colors(checkedTrackColor = Orange500),
                )
            }
        }
    }
}

// ---- Data: export, Keep import, delete account ----

@Composable
private fun DataSection(user: UserDto?, viewModel: SettingsViewModel, onLogout: () -> Unit) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    val context = LocalContext.current

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Export your data", fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(
                "Download all your lists, tasks, tags, and webhooks as JSON.",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            BrandButton(
                text = if (viewModel.exporting) "Exporting…" else "Export JSON",
                secondary = true,
                enabled = !viewModel.exporting,
                onClick = {
                    haptics.tap()
                    viewModel.export { file ->
                        val uri = FileProvider.getUriForFile(
                            context, "${context.packageName}.fileprovider", file,
                        )
                        val send = Intent(Intent.ACTION_SEND).apply {
                            type = "application/json"
                            putExtra(Intent.EXTRA_STREAM, uri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        context.startActivity(Intent.createChooser(send, "Export OrangTask data"))
                    }
                },
            )
        }

        HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))

        KeepImportBlock(viewModel)

        HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))

        DeleteAccountBlock(user, viewModel, onLogout)
    }
}

@Composable
private fun KeepImportBlock(viewModel: SettingsViewModel) {
    val haptics = rememberHaptics()
    var listName by rememberSaveable { mutableStateOf("Google Keep") }
    var includeArchived by rememberSaveable { mutableStateOf(true) }
    var includeTrashed by rememberSaveable { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) viewModel.parseKeepZip(uri)
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Import from Google Keep", fontSize = 14.sp, fontWeight = FontWeight.Medium)
        Text(
            "Export your notes with Google Takeout (takeout.google.com), then choose the " +
                ".zip it gives you, no need to unzip. Checklists become subtasks and labels become tags.",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        BrandButton(
            text = if (viewModel.keepParsing) "Reading zip…" else "Choose Takeout .zip",
            icon = Icons.Outlined.Upload,
            secondary = true,
            enabled = !viewModel.keepParsing && !viewModel.keepImporting,
            onClick = {
                haptics.tap()
                picker.launch(arrayOf("application/zip", "application/x-zip-compressed", "application/octet-stream"))
            },
        )

        if (viewModel.keepNotes.isNotEmpty()) {
            SurfaceCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(12.dp),
                ) {
                    Text(
                        "Found ${viewModel.keepNotes.size} note${if (viewModel.keepNotes.size == 1) "" else "s"} ready to import.",
                        fontSize = 13.sp,
                    )
                    Column {
                        FieldLabel("Import into list")
                        Spacer(Modifier.height(4.dp))
                        OrangTextField(value = listName, onValueChange = { listName = it }, placeholder = "Google Keep")
                    }
                    CheckboxRow("Include archived notes", includeArchived) { includeArchived = it }
                    CheckboxRow("Include trashed notes", includeTrashed) { includeTrashed = it }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        BrandButton(
                            text = if (viewModel.keepImporting) "Importing…" else "Import ${viewModel.keepNotes.size} notes",
                            enabled = !viewModel.keepImporting,
                            onClick = {
                                haptics.tap()
                                viewModel.runKeepImport(listName, includeArchived, includeTrashed)
                            },
                            modifier = Modifier.weight(1f),
                        )
                        BrandButton(text = "Cancel", secondary = true, onClick = { viewModel.clearKeepSelection() })
                    }
                }
            }
        }

        viewModel.keepResult?.let {
            Text(it, fontSize = 13.sp, color = Color(0xFF22C55E))
        }
        viewModel.keepError?.let {
            Text(it, fontSize = 13.sp, color = Color(0xFFEF4444))
        }
    }
}

@Composable
private fun CheckboxRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.clickable { onChange(!checked) },
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = onChange,
            colors = CheckboxDefaults.colors(checkedColor = Orange500),
        )
        Text(label, fontSize = 13.sp)
    }
}

@Composable
private fun DeleteAccountBlock(user: UserDto?, viewModel: SettingsViewModel, onLogout: () -> Unit) {
    val haptics = rememberHaptics()
    var showConfirm by remember { mutableStateOf(false) }
    var confirmEmail by remember { mutableStateOf("") }
    val matches = confirmEmail.trim().equals(user?.email ?: "", ignoreCase = true)

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Delete account", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color(0xFFEF4444))
        Text(
            "Permanently delete your account and all data. This cannot be undone.",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        BrandButton(text = "Delete account", secondary = true, onClick = {
            haptics.error()
            confirmEmail = ""
            showConfirm = true
        })
    }

    if (showConfirm) {
        AlertDialog(
            onDismissRequest = { if (!viewModel.deletingAccount) showConfirm = false },
            title = { Text("Delete account") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Type ${user?.email ?: "your email"} to confirm:")
                    OrangTextField(
                        value = confirmEmail,
                        onValueChange = { confirmEmail = it },
                        placeholder = user?.email ?: "",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    enabled = matches && !viewModel.deletingAccount,
                    onClick = {
                        haptics.error()
                        viewModel.deleteAccount(confirmEmail) {
                            showConfirm = false
                            onLogout()
                        }
                    },
                ) {
                    Text(
                        if (viewModel.deletingAccount) "Deleting…" else "Delete forever",
                        color = if (matches) Color(0xFFEF4444) else Color(0xFFEF4444).copy(alpha = 0.4f),
                    )
                }
            },
            dismissButton = {
                TextButton(
                    enabled = !viewModel.deletingAccount,
                    onClick = { showConfirm = false },
                ) { Text("Cancel") }
            },
        )
    }
}
