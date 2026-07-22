package lt.oranges.orangtask.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.network.ProvidersResponse
import lt.oranges.orangtask.core.network.userMessage
import javax.inject.Inject

enum class LoginMode { MAGIC, PASSWORD, REGISTER, RESET }
enum class ResetStep { REQUEST, CONFIRM }

data class LoginUiState(
    val mode: LoginMode = LoginMode.MAGIC,
    val email: String = "",
    val password: String = "",
    val name: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val magicSent: Boolean = false,
    val pastedLink: String = "",
    val resetStep: ResetStep = ResetStep.REQUEST,
    val resetCode: String = "",
    val providers: ProvidersResponse = ProvidersResponse(),
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val repo: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state

    /** set once any auth flow lands tokens; the nav shell re-evaluates the session */
    var onAuthenticated: (() -> Unit)? = null

    init {
        // show only the OAuth buttons the backend actually has configured
        viewModelScope.launch {
            runCatching { repo.providers() }
                .onSuccess { p -> _state.update { it.copy(providers = p) } }
        }
    }

    fun setMode(mode: LoginMode) = _state.update {
        it.copy(mode = mode, error = null, resetStep = ResetStep.REQUEST, resetCode = "")
    }

    fun setEmail(v: String) = _state.update { it.copy(email = v, error = null) }
    fun setPassword(v: String) = _state.update { it.copy(password = v, error = null) }
    fun setName(v: String) = _state.update { it.copy(name = v, error = null) }
    fun setPastedLink(v: String) = _state.update { it.copy(pastedLink = v, error = null) }
    fun setResetCode(v: String) = _state.update {
        it.copy(resetCode = v.filter(Char::isDigit).take(6), error = null)
    }

    fun useDifferentEmail() = _state.update { it.copy(magicSent = false, pastedLink = "") }

    fun sendMagic() {
        val s = _state.value
        if (!s.email.contains("@")) {
            _state.update { it.copy(error = "Enter a valid email") }
            return
        }
        launchBusy {
            repo.sendMagicLink(s.email)
            _state.update { it.copy(magicSent = true) }
        }
    }

    fun completeMagicLink() {
        val pasted = _state.value.pastedLink.trim()
        if (pasted.isEmpty()) {
            _state.update { it.copy(error = "Paste the link from your email") }
            return
        }
        launchBusy {
            repo.verifyMagicLink(pasted)
            onAuthenticated?.invoke()
        }
    }

    fun submitPassword() {
        val s = _state.value
        launchBusy {
            if (s.mode == LoginMode.REGISTER) {
                repo.register(s.email, s.password, s.name)
            } else {
                repo.login(s.email, s.password)
            }
            onAuthenticated?.invoke()
        }
    }

    fun requestReset() {
        val s = _state.value
        if (!s.email.contains("@")) {
            _state.update { it.copy(error = "Enter a valid email") }
            return
        }
        launchBusy {
            repo.forgotPassword(s.email)
            _state.update { it.copy(resetStep = ResetStep.CONFIRM) }
        }
    }

    fun submitReset() {
        val s = _state.value
        if (!Regex("^\\d{6}$").matches(s.resetCode)) {
            _state.update { it.copy(error = "Enter the 6-digit code from your email") }
            return
        }
        if (s.password.length < 8) {
            _state.update { it.copy(error = "Password must be at least 8 characters") }
            return
        }
        launchBusy {
            repo.resetPassword(s.email, s.resetCode, s.password)
            // reset succeeded sign straight in with the new password
            repo.login(s.email, s.password)
            onAuthenticated?.invoke()
        }
    }

    private fun launchBusy(block: suspend () -> Unit) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                block()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.userMessage()) }
            } finally {
                _state.update { it.copy(loading = false) }
            }
        }
    }
}
