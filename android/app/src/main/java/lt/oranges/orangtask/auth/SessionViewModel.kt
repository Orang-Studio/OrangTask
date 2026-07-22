package lt.oranges.orangtask.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.network.TokenStore
import lt.oranges.orangtask.core.network.UserDto
import lt.oranges.orangtask.core.network.userMessage
import lt.oranges.orangtask.notifications.PushRegistrar
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject

sealed interface SessionState {
    data object Loading : SessionState
    data object LoggedOut : SessionState
    data object RequiresPin : SessionState
    data class Active(val user: UserDto?) : SessionState
}

@HiltViewModel
class SessionViewModel @Inject constructor(
    private val repo: AuthRepository,
    private val tokenStore: TokenStore,
    private val pushRegistrar: PushRegistrar,
) : ViewModel() {

    private val _state = MutableStateFlow<SessionState>(SessionState.Loading)
    val state: StateFlow<SessionState> = _state

    init {
        viewModelScope.launch {
            tokenStore.sessionExpired.collect { _state.value = SessionState.LoggedOut }
        }
        refresh()
    }

    /** re-evaluates the session (called on startup and after login / PIN unlock) */
    fun refresh() {
        viewModelScope.launch { load() }
    }

    fun logout() {
        viewModelScope.launch {
            pushRegistrar.unregister()
            repo.logout()
            _state.value = SessionState.LoggedOut
        }
    }

    /** tokens delivered by the OAuth deep link (orangtask://auth-callback) */
    fun onOAuthTokens(access: String, refresh: String) {
        tokenStore.storeTokens(access, refresh)
        _state.value = SessionState.Loading
        viewModelScope.launch { load() }
    }

    /** a task.oranges.lt/auth/magic?token=… link opened directly (App Link from the magic-link email), so */
    fun onMagicLink(url: String, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                repo.verifyMagicLink(url)
                _state.value = SessionState.Loading
                load()
            } catch (e: Exception) {
                onError(e.userMessage())
            }
        }
    }

    private suspend fun load() {
        if (!tokenStore.hasSession) {
            _state.value = SessionState.LoggedOut
            return
        }
        _state.value = try {
            val me = repo.me()
            if (repo.requiresPinLocally(me.user)) SessionState.RequiresPin
            else {
                pushRegistrar.register()
                SessionState.Active(me.user)
            }
        } catch (e: HttpException) {
            if (e.code() == 401) SessionState.LoggedOut else fromCache()
        } catch (e: IOException) {
            fromCache() // offline start open with the cached identity
        }
    }

    private fun fromCache(): SessionState {
        val cached = repo.cachedUser()
        return when {
            cached == null -> SessionState.LoggedOut
            repo.requiresPinLocally(cached) -> SessionState.RequiresPin
            else -> SessionState.Active(cached)
        }
    }
}
