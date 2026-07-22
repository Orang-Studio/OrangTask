package lt.oranges.orangtask.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.network.WebhookDeliveryDto
import lt.oranges.orangtask.core.network.WebhookDto
import lt.oranges.orangtask.core.network.userMessage
import javax.inject.Inject

/** WebhookManager.tsx: CRUD + enable toggle + test + delivery log */
@HiltViewModel
class WebhooksViewModel @Inject constructor(
    private val repo: SettingsRepository,
) : ViewModel() {

    val errors = MutableSharedFlow<String>(extraBufferCapacity = 4)

    var webhooks by mutableStateOf<List<WebhookDto>>(emptyList())
        private set
    var loading by mutableStateOf(true)
        private set
    var creating by mutableStateOf(false)
        private set

    /** delivery log per expanded webhook; test results flash per webhook */
    val deliveries = mutableStateMapOf<String, List<WebhookDeliveryDto>>()
    val testResults = mutableStateMapOf<String, String>()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            runCatching { webhooks = repo.webhooks() }
                .onFailure { errors.tryEmit(it.userMessage()) }
            loading = false
        }
    }

    fun create(name: String, url: String?, direction: String, events: List<String>?, onDone: () -> Unit) {
        viewModelScope.launch {
            creating = true
            try {
                val webhook = repo.createWebhook(name.trim(), url?.trim(), direction, events)
                webhooks = listOf(webhook) + webhooks
                onDone()
            } catch (e: Exception) {
                errors.tryEmit(e.userMessage())
            } finally {
                creating = false
            }
        }
    }

    fun setEnabled(id: String, enabled: Boolean) {
        // optimistic toggle, reconciled with the server row
        webhooks = webhooks.map { if (it.id == id) it.copy(enabled = enabled) else it }
        viewModelScope.launch {
            try {
                val updated = repo.setWebhookEnabled(id, enabled)
                webhooks = webhooks.map { if (it.id == id) updated else it }
            } catch (e: Exception) {
                webhooks = webhooks.map { if (it.id == id) it.copy(enabled = !enabled) else it }
                errors.tryEmit(e.userMessage())
            }
        }
    }

    fun delete(id: String) {
        val before = webhooks
        webhooks = webhooks.filterNot { it.id == id }
        viewModelScope.launch {
            try {
                repo.deleteWebhook(id)
            } catch (e: Exception) {
                webhooks = before
                errors.tryEmit(e.userMessage())
            }
        }
    }

    fun loadDeliveries(id: String) {
        viewModelScope.launch {
            runCatching { deliveries[id] = repo.webhookDeliveries(id) }
        }
    }

    fun test(id: String) {
        viewModelScope.launch {
            testResults[id] = "Sending…"
            try {
                val res = repo.testWebhook(id)
                testResults[id] =
                    if (!res.error.isNullOrEmpty()) "Error: ${res.error}" else "${res.statusCode} OK"
                loadDeliveries(id)
            } catch (e: Exception) {
                testResults[id] = e.userMessage()
            }
        }
    }
}
