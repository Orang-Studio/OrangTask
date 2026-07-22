package lt.oranges.orangtask.core.network

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/** tags every request as a native client */
@Singleton
class AuthInterceptor @Inject constructor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val builder = chain.request().newBuilder()
            .header("X-Platform", "android")

        if (chain.request().header("Authorization") == null) {
            tokenStore.accessToken?.let { builder.header("Authorization", "Bearer $it") }
        }
        return chain.proceed(builder.build())
    }
}
