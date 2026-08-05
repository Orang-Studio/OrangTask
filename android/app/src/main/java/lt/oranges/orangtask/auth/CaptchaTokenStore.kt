package lt.oranges.orangtask.auth

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CaptchaTokenStore @Inject constructor() {
    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token.asStateFlow()

    fun set(token: String) {
        _token.value = token
    }

    fun clear() {
        _token.value = null
    }
}
