package lt.oranges.orangtask.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.network.ProvidersResponse
import lt.oranges.orangtask.core.network.userMessage
import javax.inject.Inject

enum class LoginMode { MAGIC, PASSWORD, REGISTER, RESET, EMAIL_2FA, VERIFY_EMAIL }
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
    val emailCode: String = "",
    val captchaToken: String? = null,
    val captchaRequired: Boolean = false,
    val providers: ProvidersResponse = ProvidersResponse(),
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val repo: AuthRepository,
    private val captchaTokenStore: CaptchaTokenStore,
) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state

    var onAuthenticated: (() -> Unit)? = null

    init {
        viewModelScope.launch {
            runCatching { repo.providers() }
                .onSuccess { p -> _state.update { it.copy(providers = p) } }
        }
        viewModelScope.launch {
            captchaTokenStore.token.collect { token ->
                if (token != null) _state.update { it.copy(captchaToken = token, error = null) }
            }
        }
    }

    fun setMode(mode: LoginMode) = _state.update {
        it.copy(mode = mode, error = null, resetStep = ResetStep.REQUEST, resetCode = "", emailCode = "")
    }

    fun setEmail(v: String) = _state.update { it.copy(email = v, error = null) }
    fun setPassword(v: String) = _state.update { it.copy(password = v, error = null) }
    fun setName(v: String) = _state.update { it.copy(name = v, error = null) }
    fun setPastedLink(v: String) = _state.update { it.copy(pastedLink = v, error = null) }
    fun setResetCode(v: String) = _state.update {
        it.copy(resetCode = v.filter(Char::isDigit).take(6), error = null)
    }
    fun setEmailCode(v: String) = _state.update {
        it.copy(emailCode = v.filter(Char::isDigit).take(6), error = null)
    }

    fun useDifferentEmail() = _state.update { it.copy(magicSent = false, pastedLink = "") }

    fun sendMagic() {
        val s = _state.value
        if (!s.email.contains("@")) return showEmailError()
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
        launchBusy { handleOutcome(repo.verifyMagicLink(pasted)) }
    }

    fun submitPassword() {
        val s = _state.value
        if (!s.email.contains("@")) return showEmailError()
        if (s.password.length < 8) {
            _state.update { it.copy(error = "Password must be at least 8 characters") }
            return
        }
        if (s.mode == LoginMode.REGISTER && s.captchaToken == null) {
            _state.update { it.copy(captchaRequired = true, error = "Complete the security check to create your account") }
            return
        }
        launchBusy {
            val outcome = if (s.mode == LoginMode.REGISTER) {
                repo.register(s.email, s.password, s.name, requireNotNull(s.captchaToken))
            } else {
                repo.login(s.email, s.password, s.captchaToken)
            }
            captchaTokenStore.clear()
            _state.update { it.copy(captchaToken = null, captchaRequired = false) }
            handleOutcome(outcome)
        }
    }

    fun verifyEmailCode() {
        val s = _state.value
        if (!Regex("^\\d{6}$").matches(s.emailCode)) {
            _state.update { it.copy(error = "Enter the 6-digit code from your email") }
            return
        }
        launchBusy { handleOutcome(repo.verifyLoginCode(s.email, s.emailCode)) }
    }

    fun resendLoginCode() = launchBusy { repo.resendLoginCode(_state.value.email) }
    fun resendVerification() = launchBusy { repo.resendVerification(_state.value.email) }

    fun requestReset() {
        val s = _state.value
        if (!s.email.contains("@")) return showEmailError()
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
            handleOutcome(repo.login(s.email, s.password, s.captchaToken))
        }
    }

    private fun handleOutcome(outcome: LoginOutcome) {
        when (outcome) {
            is LoginOutcome.Success, LoginOutcome.RequiresPin -> onAuthenticated?.invoke()
            LoginOutcome.RequiresEmail2fa -> _state.update { it.copy(mode = LoginMode.EMAIL_2FA, emailCode = "") }
            LoginOutcome.RequiresEmailVerification -> _state.update { it.copy(mode = LoginMode.VERIFY_EMAIL) }
        }
    }

    private fun showEmailError() {
        _state.update { it.copy(error = "Enter a valid email") }
    }

    private fun launchBusy(block: suspend () -> Unit) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                block()
            } catch (e: Exception) {
                val message = e.userMessage()
                _state.update {
                    when {
                        message.contains("CAPTCHA", ignoreCase = true) -> it.copy(captchaRequired = true, error = message)
                        message.contains("verify your email", ignoreCase = true) -> it.copy(mode = LoginMode.VERIFY_EMAIL, error = null)
                        else -> it.copy(error = message)
                    }
                }
            } finally {
                _state.update { it.copy(loading = false) }
            }
        }
    }
}
