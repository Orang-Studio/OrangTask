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
import androidx.compose.material.icons.outlined.Language
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
import androidx.compose.ui.res.pluralStringResource
import lt.oranges.orangtask.core.i18n.tr
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.compose.foundation.text.KeyboardOptions
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.delay
import lt.oranges.orangtask.R
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

private const val SECTION_PROFILE = "profile"
private const val SECTION_APPEARANCE = "appearance"
private const val SECTION_LANGUAGE = "language"
private const val SECTION_NOTIFICATIONS = "notifications"
private const val SECTION_WEBHOOKS = "webhooks"
private const val SECTION_INTEGRATIONS = "integrations"
private const val SECTION_DATA = "data"

private data class SectionInfo(val key: String, val labelRes: Int, val icon: ImageVector)

private val SECTIONS = listOf(
    SectionInfo(SECTION_PROFILE, R.string.settings_profile, Icons.Outlined.Person),
    SectionInfo(SECTION_APPEARANCE, R.string.settings_appearance, Icons.Outlined.Palette),
    SectionInfo(SECTION_LANGUAGE, R.string.language_title, Icons.Outlined.Language),
    SectionInfo(SECTION_NOTIFICATIONS, R.string.settings_notifications, Icons.Outlined.Notifications),
    SectionInfo(SECTION_WEBHOOKS, R.string.settings_webhooks, Icons.Outlined.Webhook),
    SectionInfo(SECTION_INTEGRATIONS, R.string.settings_integrations, Icons.Outlined.IntegrationInstructions),
    SectionInfo(SECTION_DATA, R.string.settings_data, Icons.Outlined.Storage),
)

private fun themeLabelRes(mode: ThemeMode): Int = when (mode) {
    ThemeMode.SYSTEM -> R.string.theme_system
    ThemeMode.LIGHT -> R.string.theme_light
    ThemeMode.DARK -> R.string.theme_dark
}

private data class NotifType(val key: String, val labelRes: Int, val descRes: Int)

private val NOTIF_TYPES = listOf(
    NotifType("task_due_soon", R.string.task_due_soon_label, R.string.task_due_soon_description),
    NotifType("task_assigned", R.string.task_assigned_label, R.string.task_assigned_description),
    NotifType("list_shared", R.string.list_shared_label, R.string.list_shared_description),
    NotifType("task_completed_by", R.string.task_completed_label, R.string.task_completed_description),
)

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
                    Text(tr(R.string.settings_heading), fontSize = 17.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                } else {
                    IconButton(onClick = { section = "" }) {
                        Icon(
                            Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = tr(R.string.content_description_back),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    val sectionLabelRes = SECTIONS.firstOrNull { it.key == section }?.labelRes
                    Text(
                        (if (sectionLabelRes == null) "" else tr(sectionLabelRes)).uppercase(),
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
                    SECTION_LANGUAGE -> LanguageSection()
                    SECTION_NOTIFICATIONS -> NotificationPrefsSection(viewModel)

                    SECTION_WEBHOOKS -> WebhooksSection(onError = { viewModel.errors.tryEmit(it) })
                    SECTION_INTEGRATIONS -> IntegrationsSection(onError = { viewModel.errors.tryEmit(it) })
                    SECTION_DATA -> DataSection(user, viewModel, onLogout)
                }
            }
        }

        SnackbarHost(hostState = snackbar, modifier = Modifier.align(Alignment.BottomCenter))
    }
}

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
                    Text(tr(info.labelRes), fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
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
            text = tr(R.string.sign_out),
            secondary = true,
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

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
            FieldLabel(tr(R.string.name))
            Spacer(Modifier.height(6.dp))
            OrangTextField(value = name, onValueChange = { name = it })
        }
        Column {
            FieldLabel(tr(R.string.avatar_url))
            Spacer(Modifier.height(6.dp))
            OrangTextField(
                value = avatarUrl,
                onValueChange = { avatarUrl = it },
                placeholder = tr(R.string.avatar_url_placeholder),
            )
        }
        BrandButton(
            text = when {
                viewModel.profileSaving -> tr(R.string.saving)
                viewModel.profileSaved -> tr(R.string.saved)
                else -> tr(R.string.save_profile)
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
                Text(tr(R.string.app_pin), fontSize = 14.sp, fontWeight = FontWeight.Medium)
                if (viewModel.hasPin == true) {
                    Text(
                        tr(R.string.enabled),
                        fontSize = 10.sp,
                        color = Color(0xFF22C55E),
                        modifier = Modifier
                            .background(if (dark) Color(0xFF052E16) else Color(0xFFDCFCE7))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
            Text(
                tr(R.string.pin_description),
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            when (viewModel.hasPin) {
                null -> Text(tr(R.string.checking), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                true -> BrandButton(text = tr(R.string.remove_pin), secondary = true, onClick = {
                    haptics.tap()
                    viewModel.removePin()
                })
                false -> if (showPinForm) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OrangTextField(
                            value = pinInput,
                            onValueChange = { pinInput = it.filter(Char::isDigit).take(6) },
                            placeholder = tr(R.string.pin_digits_placeholder),
                            isPassword = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            modifier = Modifier.weight(1f),
                        )
                        BrandButton(
                            text = tr(R.string.set_pin),
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
                    BrandButton(text = tr(R.string.set_up_pin), secondary = true, onClick = {
                        haptics.tap()
                        showPinForm = true
                    })
                }
            }
        }
    }
}

@Composable
private fun AppearanceSection(viewModel: SettingsViewModel) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    Column {
        FieldLabel(tr(R.string.theme))
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ThemeMode.entries.forEach { mode ->
                val selected = viewModel.themePrefs.mode == mode
                Text(
                    text = tr(themeLabelRes(mode)),
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

@Composable
private fun NotificationPrefsSection(viewModel: SettingsViewModel) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()

    LaunchedEffect(Unit) { viewModel.loadPrefs() }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            tr(R.string.notification_delivery_description),
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        val prefs = viewModel.prefs
        if (prefs == null) {
            Text(tr(R.string.loading), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            return@Column
        }

        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 2.dp)) {
            FieldLabel(tr(R.string.notify_me_about), modifier = Modifier.weight(1f))
            FieldLabel(tr(R.string.push), modifier = Modifier.padding(end = 26.dp))
            FieldLabel(tr(R.string.email))
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
                    Text(tr(type.labelRes), fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    Text(tr(type.descRes), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
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

@Composable
private fun DataSection(user: UserDto?, viewModel: SettingsViewModel, onLogout: () -> Unit) {
    val haptics = rememberHaptics()
    val dark = isDarkTheme()
    val context = LocalContext.current
    val exportChooserTitle = tr(R.string.export_orangtask_data)

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(tr(R.string.export_your_data), fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(
                tr(R.string.export_data_description),
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            BrandButton(
                text = if (viewModel.exporting) tr(R.string.exporting) else tr(R.string.export_json),
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
                        context.startActivity(Intent.createChooser(send, exportChooserTitle))
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
    val googleKeep = tr(R.string.google_keep)
    var listName by rememberSaveable { mutableStateOf(googleKeep) }
    var includeArchived by rememberSaveable { mutableStateOf(true) }
    var includeTrashed by rememberSaveable { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) viewModel.parseKeepZip(uri)
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(tr(R.string.import_from_google_keep), fontSize = 14.sp, fontWeight = FontWeight.Medium)
        Text(
            tr(R.string.import_google_keep_description),
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        BrandButton(
            text = if (viewModel.keepParsing) tr(R.string.reading_zip) else tr(R.string.choose_takeout_zip),
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
                        pluralStringResource(
                            R.plurals.keep_notes_ready,
                            viewModel.keepNotes.size,
                            viewModel.keepNotes.size,
                        ),
                        fontSize = 13.sp,
                    )
                    Column {
                        FieldLabel(tr(R.string.import_into_list))
                        Spacer(Modifier.height(4.dp))
                        OrangTextField(
                            value = listName,
                            onValueChange = { listName = it },
                            placeholder = googleKeep,
                        )
                    }
                    CheckboxRow(tr(R.string.include_archived_notes), includeArchived) { includeArchived = it }
                    CheckboxRow(tr(R.string.include_trashed_notes), includeTrashed) { includeTrashed = it }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        BrandButton(
                            text = if (viewModel.keepImporting) {
                                tr(R.string.importing)
                            } else {
                                pluralStringResource(R.plurals.import_notes, viewModel.keepNotes.size, viewModel.keepNotes.size)
                            },
                            enabled = !viewModel.keepImporting,
                            onClick = {
                                haptics.tap()
                                viewModel.runKeepImport(listName, includeArchived, includeTrashed)
                            },
                            modifier = Modifier.weight(1f),
                        )
                        BrandButton(text = tr(R.string.cancel), secondary = true, onClick = { viewModel.clearKeepSelection() })
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
        Text(tr(R.string.delete_account), fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color(0xFFEF4444))
        Text(
            tr(R.string.delete_account_description),
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        BrandButton(text = tr(R.string.delete_account), secondary = true, onClick = {
            haptics.error()
            confirmEmail = ""
            showConfirm = true
        })
    }

    if (showConfirm) {
        AlertDialog(
            onDismissRequest = { if (!viewModel.deletingAccount) showConfirm = false },
            title = { Text(tr(R.string.delete_account)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        tr(
                            R.string.type_email_to_confirm,
                            user?.email ?: tr(R.string.your_email),
                        )
                    )
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
                        if (viewModel.deletingAccount) tr(R.string.deleting) else tr(R.string.delete_forever),
                        color = if (matches) Color(0xFFEF4444) else Color(0xFFEF4444).copy(alpha = 0.4f),
                    )
                }
            },
            dismissButton = {
                TextButton(
                    enabled = !viewModel.deletingAccount,
                    onClick = { showConfirm = false },
                ) { Text(tr(R.string.cancel)) }
            },
        )
    }
}
