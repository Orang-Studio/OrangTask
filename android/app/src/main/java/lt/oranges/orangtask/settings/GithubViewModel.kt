package lt.oranges.orangtask.settings

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.network.GithubConnectionDto
import lt.oranges.orangtask.core.network.GithubCountsDto
import lt.oranges.orangtask.core.network.GithubSettingsRequest
import lt.oranges.orangtask.core.network.userMessage
import javax.inject.Inject

@HiltViewModel
class GithubViewModel @Inject constructor(
    private val repo: SettingsRepository,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    val errors = MutableSharedFlow<String>(extraBufferCapacity = 4)

    var configured by mutableStateOf(false)
        private set
    var connection by mutableStateOf<GithubConnectionDto?>(null)
        private set
    var counts by mutableStateOf(GithubCountsDto())
        private set
    var loading by mutableStateOf(true)
        private set
    var syncing by mutableStateOf(false)
        private set
    var connecting by mutableStateOf(false)
        private set

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            runCatching { repo.githubStatus() }
                .onSuccess {
                    configured = it.configured
                    connection = it.connection
                    counts = it.counts
                }
                .onFailure { errors.tryEmit(it.userMessage(context)) }
            loading = false
        }
    }

    fun setToggle(field: GithubToggle, value: Boolean) {
        val before = connection ?: return
        connection = when (field) {
            GithubToggle.ISSUES -> before.copy(syncIssues = value)
            GithubToggle.PULL_REQUESTS -> before.copy(syncPullRequests = value)
            GithubToggle.SECURITY -> before.copy(syncSecurity = value)
        }
        val body = when (field) {
            GithubToggle.ISSUES -> GithubSettingsRequest(syncIssues = value)
            GithubToggle.PULL_REQUESTS -> GithubSettingsRequest(syncPullRequests = value)
            GithubToggle.SECURITY -> GithubSettingsRequest(syncSecurity = value)
        }
        viewModelScope.launch {
            runCatching { connection = repo.updateGithubSettings(body) }
                .onFailure {
                    connection = before
                    errors.tryEmit(it.userMessage(context))
                }
        }
    }

    fun connect(onReady: (String) -> Unit) {
        if (connecting) return
        viewModelScope.launch {
            connecting = true
            runCatching { repo.githubConnectUrl() }
                .onSuccess(onReady)
                .onFailure { errors.tryEmit(it.userMessage(context)) }
            connecting = false
        }
    }

    fun sync() {
        viewModelScope.launch {
            syncing = true
            runCatching { repo.syncGithub() }
                .onFailure { errors.tryEmit(it.userMessage(context)) }
            syncing = false
            refresh()
        }
    }

    fun disconnect() {
        viewModelScope.launch {
            runCatching { repo.disconnectGithub(false) }
                .onFailure { errors.tryEmit(it.userMessage(context)) }
            refresh()
        }
    }
}

enum class GithubToggle { ISSUES, PULL_REQUESTS, SECURITY }
