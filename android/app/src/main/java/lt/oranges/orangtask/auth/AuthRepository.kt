package lt.oranges.orangtask.auth

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import lt.oranges.orangtask.core.db.OrangDb
import lt.oranges.orangtask.core.network.AuthApi
import lt.oranges.orangtask.core.network.AuthResponse
import lt.oranges.orangtask.core.network.CodeRequest
import lt.oranges.orangtask.core.network.EmailRequest
import lt.oranges.orangtask.core.network.LoginRequest
import lt.oranges.orangtask.core.network.LogoutRequest
import lt.oranges.orangtask.core.network.MeResponse
import lt.oranges.orangtask.core.network.PinRequest
import lt.oranges.orangtask.core.network.RegisterRequest
import lt.oranges.orangtask.core.network.ResetPasswordRequest
import lt.oranges.orangtask.core.network.TokenStore
import lt.oranges.orangtask.core.network.UserDto
import javax.inject.Inject
import javax.inject.Singleton

sealed interface LoginOutcome {
    data class Success(val user: UserDto?) : LoginOutcome
    data object RequiresPin : LoginOutcome
}

@Singleton
class AuthRepository @Inject constructor(
    private val api: AuthApi,
    private val tokenStore: TokenStore,
    private val json: Json,
    private val db: OrangDb,
) {

    suspend fun login(email: String, password: String): LoginOutcome {
        val res = api.login(LoginRequest(email.trim(), password))
        storeTokensOrFail(res)
        return if (res.requiresPin) LoginOutcome.RequiresPin else {
            cacheUser(res.user)
            LoginOutcome.Success(res.user)
        }
    }

    suspend fun register(email: String, password: String, name: String): LoginOutcome {
        val res = api.register(RegisterRequest(email.trim(), password, name.trim()))
        storeTokensOrFail(res)
        cacheUser(res.user)
        return LoginOutcome.Success(res.user)
    }

    suspend fun sendMagicLink(email: String) {
        api.sendMagicLink(EmailRequest(email.trim()))
    }

    /** which OAuth providers the backend has configured drives the login buttons */
    suspend fun providers() = api.providers()

    /** completes magic-link sign-in from a pasted email link (or a bare token) */
    suspend fun verifyMagicLink(pasted: String): LoginOutcome {
        val token = Regex("token=([0-9a-fA-F]+)").find(pasted)?.groupValues?.get(1)
            ?: pasted.trim()
        val res = api.verifyMagicLink(token)
        storeTokensOrFail(res)
        return if (res.requiresPin) LoginOutcome.RequiresPin else {
            cacheUser(res.user)
            LoginOutcome.Success(res.user)
        }
    }

    suspend fun forgotPassword(email: String) {
        api.forgotPassword(EmailRequest(email.trim()))
    }

    suspend fun resetPassword(email: String, code: String, password: String) {
        api.resetPassword(ResetPasswordRequest(email.trim(), code, password))
    }

    suspend fun me(): MeResponse {
        val me = api.me()
        cacheUser(me.user)
        return me
    }

    /** the PIN gate is a local decision: the servers pin_ok cookie cant reach us */
    fun requiresPinLocally(user: UserDto): Boolean =
        user.pinEnabled && !tokenStore.pinUnlockValid

    suspend fun verifyPin(pin: String) {
        api.pinVerify(PinRequest(pin))
        tokenStore.markPinVerified()
    }

    suspend fun requestPinReset() {
        api.pinForgot()
    }

    /** removes the PIN entirely (backend behavior), so the session is unlocked */
    suspend fun resetPin(code: String) {
        api.pinReset(CodeRequest(code))
        tokenStore.markPinVerified()
    }

    suspend fun logout() {
        runCatching { api.logout(LogoutRequest(tokenStore.refreshToken)) }
        tokenStore.clear()
        // the next account must not see this ones cached tasks
        withContext(Dispatchers.IO) { db.clearAllTables() }
    }

    /** a 200 auth response with no tokens in the body means the server doesnt have the native-client */
    private fun storeTokensOrFail(res: AuthResponse) {
        if (res.accessToken == null || res.refreshToken == null) {
            throw IllegalStateException(
                "The server didn't return session tokens, it's running an " +
                    "older OrangTask backend without native app support. " +
                    "Update and restart the backend, then try again."
            )
        }
        tokenStore.storeTokens(res.accessToken, res.refreshToken)
    }

    fun cachedUser(): UserDto? = tokenStore.cachedUserJson?.let {
        runCatching { json.decodeFromString(UserDto.serializer(), it) }.getOrNull()
    }

    private fun cacheUser(user: UserDto?) {
        if (user != null) tokenStore.cachedUserJson = json.encodeToString(UserDto.serializer(), user)
    }
}
