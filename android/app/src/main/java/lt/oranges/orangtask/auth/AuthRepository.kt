package lt.oranges.orangtask.auth

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.i18n.AppStrings
import lt.oranges.orangtask.core.db.OrangDb
import lt.oranges.orangtask.core.network.AuthApi
import lt.oranges.orangtask.core.network.AuthResponse
import lt.oranges.orangtask.core.network.CodeRequest
import lt.oranges.orangtask.core.network.EmailCodeRequest
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
    data object RequiresEmail2fa : LoginOutcome
    data object RequiresEmailVerification : LoginOutcome
}

@Singleton
class AuthRepository @Inject constructor(
    private val api: AuthApi,
    private val tokenStore: TokenStore,
    private val json: Json,
    private val db: OrangDb,
    @ApplicationContext private val context: Context,
) {

    suspend fun login(email: String, password: String, recaptchaToken: String? = null): LoginOutcome {
        val res = api.login(LoginRequest(email.trim(), password, recaptchaToken))
        return when {
            res.requiresEmail2fa -> LoginOutcome.RequiresEmail2fa
            res.requiresEmailVerification -> LoginOutcome.RequiresEmailVerification
            else -> completeLogin(res)
        }
    }

    suspend fun register(email: String, password: String, name: String, recaptchaToken: String): LoginOutcome {
        val res = api.register(RegisterRequest(email.trim(), password, name.trim(), recaptchaToken))
        return completeLogin(res)
    }

    suspend fun verifyLoginCode(email: String, code: String): LoginOutcome =
        completeLogin(api.verifyLoginCode(EmailCodeRequest(email.trim(), code)))

    suspend fun resendLoginCode(email: String) {
        api.resendLoginCode(EmailRequest(email.trim()))
    }

    suspend fun resendVerification(email: String) {
        api.resendVerification(EmailRequest(email.trim()))
    }

    suspend fun sendMagicLink(email: String) {
        api.sendMagicLink(EmailRequest(email.trim()))
    }

    suspend fun providers() = api.providers()

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

    fun requiresPinLocally(user: UserDto): Boolean =
        user.pinEnabled && !tokenStore.pinUnlockValid

    suspend fun verifyPin(pin: String) {
        api.pinVerify(PinRequest(pin))
        tokenStore.markPinVerified()
    }

    suspend fun requestPinReset() {
        api.pinForgot()
    }

    suspend fun resetPin(code: String) {
        api.pinReset(CodeRequest(code))
        tokenStore.markPinVerified()
    }

    suspend fun logout() {
        runCatching { api.logout(LogoutRequest(tokenStore.refreshToken)) }
        tokenStore.clear()

        withContext(Dispatchers.IO) { db.clearAllTables() }
    }

    private fun completeLogin(res: AuthResponse): LoginOutcome {
        storeTokensOrFail(res)
        return if (res.requiresPin) LoginOutcome.RequiresPin else {
            cacheUser(res.user)
            LoginOutcome.Success(res.user)
        }
    }

    private fun storeTokensOrFail(res: AuthResponse) {
        if (res.accessToken == null || res.refreshToken == null) {
            throw IllegalStateException(AppStrings.get(context, R.string.session_tokens_missing))
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
