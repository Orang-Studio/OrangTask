package lt.oranges.orangtask.core.network

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/** holds the access/refresh token pair (Android Keystore-encrypted at rest) plus the local PIN-unlock */
@Singleton
class TokenStore @Inject constructor(@ApplicationContext context: Context) {

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "auth_tokens",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val _sessionExpired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    /** emitted when a refresh attempt fails and tokens are cleared navigate to login */
    val sessionExpired: SharedFlow<Unit> = _sessionExpired

    @Volatile
    var accessToken: String? = prefs.getString(KEY_ACCESS, null)
        set(value) {
            field = value
            prefs.edit().putString(KEY_ACCESS, value).apply()
        }

    @Volatile
    var refreshToken: String? = prefs.getString(KEY_REFRESH, null)
        set(value) {
            field = value
            prefs.edit().putString(KEY_REFRESH, value).apply()
        }

    /** same 7-day cap the server applies to its pin_ok cookie */
    var pinVerifiedUntil: Long
        get() = prefs.getLong(KEY_PIN_UNTIL, 0L)
        set(value) = prefs.edit().putLong(KEY_PIN_UNTIL, value).apply()

    /** cached /me user JSON so a cold offline start can still open the app */
    var cachedUserJson: String?
        get() = prefs.getString(KEY_USER, null)
        set(value) = prefs.edit().putString(KEY_USER, value).apply()

    val hasSession: Boolean get() = refreshToken != null

    val pinUnlockValid: Boolean get() = System.currentTimeMillis() < pinVerifiedUntil

    fun markPinVerified() {
        pinVerifiedUntil = System.currentTimeMillis() + PIN_TTL_MS
    }

    fun storeTokens(access: String?, refresh: String?) {
        if (access != null) accessToken = access
        if (refresh != null) refreshToken = refresh
    }

    fun clear() {
        accessToken = null
        refreshToken = null
        pinVerifiedUntil = 0L
        cachedUserJson = null
    }

    fun notifySessionExpired() {
        clear()
        _sessionExpired.tryEmit(Unit)
    }

    companion object {
        private const val KEY_ACCESS = "access_token"
        private const val KEY_REFRESH = "refresh_token"
        private const val KEY_PIN_UNTIL = "pin_verified_until"
        private const val KEY_USER = "cached_user"
        private const val PIN_TTL_MS = 7L * 24 * 60 * 60 * 1000
    }
}
