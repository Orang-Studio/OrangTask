package lt.oranges.orangtask.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.network.ApiKeyDto
import lt.oranges.orangtask.core.network.CreatedApiKeyDto
import lt.oranges.orangtask.core.network.userMessage
import javax.inject.Inject

/** personal API keys for direct REST access (n8n, Zapier, scripts, etc.) */
@HiltViewModel
class ApiKeysViewModel @Inject constructor(
    private val repo: SettingsRepository,
) : ViewModel() {

    val errors = MutableSharedFlow<String>(extraBufferCapacity = 4)

    var keys by mutableStateOf<List<ApiKeyDto>>(emptyList())
        private set
    var loading by mutableStateOf(true)
        private set
    var creating by mutableStateOf(false)
        private set

    /** set right after creation the raw key, shown exactly once */
    var revealed by mutableStateOf<CreatedApiKeyDto?>(null)
        private set

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            runCatching { keys = repo.apiKeys() }
                .onFailure { errors.tryEmit(it.userMessage()) }
            loading = false
        }
    }

    fun create(name: String, onDone: () -> Unit) {
        if (name.isBlank()) return
        viewModelScope.launch {
            creating = true
            try {
                val created = repo.createApiKey(name)
                revealed = created
                refresh()
                onDone()
            } catch (e: Exception) {
                errors.tryEmit(e.userMessage())
            } finally {
                creating = false
            }
        }
    }

    fun dismissRevealed() {
        revealed = null
    }

    fun delete(id: String) {
        val before = keys
        keys = keys.filterNot { it.id == id }
        viewModelScope.launch {
            try {
                repo.deleteApiKey(id)
            } catch (e: Exception) {
                keys = before
                errors.tryEmit(e.userMessage())
            }
        }
    }
}
