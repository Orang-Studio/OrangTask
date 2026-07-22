package lt.oranges.orangtask.core.network

import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/** on any 401, silently exchanges the refresh token for a new access token and retries the native */
@Singleton
class TokenAuthenticator @Inject constructor(
    private val tokenStore: TokenStore,
) : Authenticator {

    // bare client: the refresh call must not recurse through this authenticator
    private val refreshClient = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }
    private val lock = Any()

    override fun authenticate(route: Route?, response: Response): Request? {
        val path = response.request.url.encodedPath
        // a 401 from these endpoints means bad credentials/PIN, not an expired session
        if (path.endsWith("/api/auth/refresh") || path.endsWith("/api/auth/login") ||
            path.endsWith("/api/auth/register") || path.endsWith("/api/auth/pin/verify")
        ) return null

        if (responseCount(response) >= 2) return null

        val refresh = tokenStore.refreshToken ?: return null
        val failedAccess = response.request.header("Authorization")?.removePrefix("Bearer ")

        synchronized(lock) {
            // another thread may have refreshed while we waited on the lock
            val current = tokenStore.accessToken
            if (current != null && current != failedAccess) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $current")
                    .build()
            }

            val refreshRequest = Request.Builder()
                .url(response.request.url.newBuilder().encodedPath("/api/auth/refresh").query(null).build())
                .header("X-Platform", "android")
                .header("Authorization", "Bearer $refresh")
                .post(ByteArray(0).toRequestBody(null))
                .build()

            return try {
                refreshClient.newCall(refreshRequest).execute().use { res ->
                    if (!res.isSuccessful) {
                        if (res.code == 401) tokenStore.notifySessionExpired()
                        return null
                    }
                    val newAccess = json
                        .decodeFromString(OkResponse.serializer(), res.body?.string().orEmpty())
                        .accessToken
                        ?: return null
                    tokenStore.accessToken = newAccess
                    response.request.newBuilder()
                        .header("Authorization", "Bearer $newAccess")
                        .build()
                }
            } catch (_: IOException) {
                null // network hiccup surface the original 401, dont kill the session
            }
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
