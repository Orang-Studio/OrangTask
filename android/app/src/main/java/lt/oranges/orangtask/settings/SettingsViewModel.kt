package lt.oranges.orangtask.settings

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import lt.oranges.orangtask.core.network.ChannelPref
import lt.oranges.orangtask.core.network.UserDto
import lt.oranges.orangtask.core.network.userMessage
import lt.oranges.orangtask.lists.ListRepository
import lt.oranges.orangtask.tasks.TaskRepository
import lt.oranges.orangtask.ui.theme.ThemePrefs
import java.io.File
import javax.inject.Inject

/** state for the full settings surface: profile, PIN, prefs, data import/export */
@HiltViewModel
class SettingsViewModel @Inject constructor(
    val themePrefs: ThemePrefs,
    private val repo: SettingsRepository,
    private val listRepository: ListRepository,
    private val taskRepository: TaskRepository,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    val errors = MutableSharedFlow<String>(extraBufferCapacity = 4)

    var profileSaving by mutableStateOf(false)
        private set
    var profileSaved by mutableStateOf(false)
        private set

    fun saveProfile(name: String, avatarUrl: String, onSaved: (UserDto) -> Unit) {
        viewModelScope.launch {
            profileSaving = true
            try {
                val user = repo.updateProfile(name.trim(), avatarUrl.trim())
                profileSaved = true
                onSaved(user)
            } catch (e: Exception) {
                errors.tryEmit(e.userMessage())
            } finally {
                profileSaving = false
            }
        }
    }

    fun clearProfileSaved() {
        profileSaved = false
    }

    /** null while the status request is in flight */
    var hasPin by mutableStateOf<Boolean?>(null)
        private set

    fun loadPinStatus() {
        viewModelScope.launch {
            runCatching { hasPin = repo.pinStatus() }
        }
    }

    fun setPin(pin: String) {
        viewModelScope.launch {
            try {
                repo.setPin(pin)
                hasPin = true
            } catch (e: Exception) {
                errors.tryEmit(e.userMessage())
            }
        }
    }

    fun removePin() {
        viewModelScope.launch {
            try {
                repo.removePin()
                hasPin = false
            } catch (e: Exception) {
                errors.tryEmit(e.userMessage())
            }
        }
    }

    var prefs by mutableStateOf<Map<String, ChannelPref>?>(null)
        private set

    fun loadPrefs() {
        viewModelScope.launch {
            runCatching { prefs = repo.notificationPrefs() }
        }
    }

    /** optimistic like the web: flip locally, PUT in the background */
    fun setChannel(type: String, channel: String, value: Boolean) {
        val current = prefs ?: return
        val pref = current[type] ?: ChannelPref()
        val next = current + (type to if (channel == "push") pref.copy(push = value) else pref.copy(email = value))
        prefs = next
        viewModelScope.launch { runCatching { repo.saveNotificationPrefs(next) } }
    }

    // ---- Google Keep import ----

    var keepParsing by mutableStateOf(false)
        private set
    var keepNotes by mutableStateOf<List<JsonObject>>(emptyList())
        private set
    var keepImporting by mutableStateOf(false)
        private set
    var keepResult by mutableStateOf<String?>(null)
        private set
    var keepError by mutableStateOf<String?>(null)
        private set

    fun parseKeepZip(uri: Uri) {
        viewModelScope.launch {
            keepParsing = true
            keepError = null
            keepResult = null
            keepNotes = emptyList()
            try {
                val notes = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.use { KeepZip.parse(it) }
                        ?: emptyList()
                }
                if (notes.isEmpty()) {
                    keepError = "No Google Keep notes found in that zip. " +
                        "Pick the Takeout archive that contains a \"Keep\" folder."
                } else {
                    keepNotes = notes
                }
            } catch (e: Exception) {
                keepError = "Could not read that file. Select the .zip from Google Takeout (don't unzip it)."
            } finally {
                keepParsing = false
            }
        }
    }

    fun clearKeepSelection() {
        keepNotes = emptyList()
        keepError = null
    }

    fun runKeepImport(listName: String, includeArchived: Boolean, includeTrashed: Boolean) {
        val notes = keepNotes.ifEmpty { return }
        viewModelScope.launch {
            keepImporting = true
            keepError = null
            try {
                val res = repo.importGoogleKeep(notes, listName, includeArchived, includeTrashed)
                keepNotes = emptyList()
                keepResult = buildString {
                    append("Imported ${res.imported} note${if (res.imported == 1) "" else "s"}")
                    if (res.subtasks > 0) append(" and ${res.subtasks} checklist item${if (res.subtasks == 1) "" else "s"}")
                    append(" into \"${res.list.name}\".")
                    if (res.skipped > 0) append(" Skipped ${res.skipped} archived/trashed.")
                }
                // pull the new list/tasks/tags into the local cache right away
                runCatching { listRepository.refreshLists() }
                runCatching { listRepository.refreshTags() }
                runCatching { taskRepository.refreshAllTasks() }
            } catch (e: Exception) {
                keepError = e.userMessage()
            } finally {
                keepImporting = false
            }
        }
    }

    // ---- Export / delete account ----

    var exporting by mutableStateOf(false)
        private set

    /** downloads the JSON export to the cache and hands the file to [onReady] (share sheet) */
    fun export(onReady: (File) -> Unit) {
        if (exporting) return
        viewModelScope.launch {
            exporting = true
            try {
                val file = File(context.cacheDir, "orangtask-export.json")
                repo.exportTo(file)
                onReady(file)
            } catch (e: Exception) {
                errors.tryEmit(e.userMessage())
            } finally {
                exporting = false
            }
        }
    }

    var deletingAccount by mutableStateOf(false)
        private set

    fun deleteAccount(email: String, onDeleted: () -> Unit) {
        viewModelScope.launch {
            deletingAccount = true
            try {
                repo.deleteAccount(email.trim())
                onDeleted()
            } catch (e: Exception) {
                errors.tryEmit(e.userMessage())
            } finally {
                deletingAccount = false
            }
        }
    }
}
