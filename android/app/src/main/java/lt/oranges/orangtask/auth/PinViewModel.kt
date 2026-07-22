package lt.oranges.orangtask.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.network.userMessage
import javax.inject.Inject

data class PinUiState(
    val pin: String = "",
    val error: Boolean = false,
    val submitting: Boolean = false,
    // forgot-PIN recovery: null = normal entry, otherwise the emailed-code step
    val recoverMessage: String? = null,
    val recoverCode: String = "",
    val recoverError: String? = null,
    val recoverBusy: Boolean = false,
    val unlocked: Boolean = false,
)

@HiltViewModel
class PinViewModel @Inject constructor(
    private val repo: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(PinUiState())
    val state: StateFlow<PinUiState> = _state

    fun onPinChange(value: String) {
        val digits = value.filter(Char::isDigit).take(6)
        _state.update { it.copy(pin = digits, error = false) }
        // a 6-digit PIN is unambiguous, so submit automatically; 4-5 use Unlock
        if (digits.length == 6) verify()
    }

    fun verify() {
        val s = _state.value
        if (s.pin.length < 4 || s.submitting) return
        viewModelScope.launch {
            _state.update { it.copy(submitting = true) }
            try {
                repo.verifyPin(s.pin)
                _state.update { it.copy(unlocked = true) }
            } catch (e: Exception) {
                _state.update { it.copy(error = true, pin = "") }
            } finally {
                _state.update { it.copy(submitting = false) }
            }
        }
    }

    fun requestPinReset() {
        viewModelScope.launch {
            _state.update { it.copy(recoverBusy = true, recoverError = null) }
            try {
                repo.requestPinReset()
                _state.update {
                    it.copy(recoverMessage = "We emailed a reset code to your account address.")
                }
            } catch (e: Exception) {
                _state.update { it.copy(recoverError = e.userMessage()) }
            } finally {
                _state.update { it.copy(recoverBusy = false) }
            }
        }
    }

    fun onRecoverCodeChange(value: String) = _state.update {
        it.copy(recoverCode = value.filter(Char::isDigit).take(6), recoverError = null)
    }

    fun submitPinReset() {
        val s = _state.value
        if (!Regex("^\\d{6}$").matches(s.recoverCode)) {
            _state.update { it.copy(recoverError = "Enter the 6-digit code from your email") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(recoverBusy = true, recoverError = null) }
            try {
                repo.resetPin(s.recoverCode)
                _state.update { it.copy(unlocked = true) }
            } catch (e: Exception) {
                _state.update { it.copy(recoverError = e.userMessage()) }
            } finally {
                _state.update { it.copy(recoverBusy = false) }
            }
        }
    }

    fun backToPinEntry() = _state.update {
        it.copy(recoverMessage = null, recoverCode = "", recoverError = null)
    }
}
