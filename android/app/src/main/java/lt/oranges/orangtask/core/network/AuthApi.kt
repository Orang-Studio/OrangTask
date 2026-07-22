package lt.oranges.orangtask.core.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponse

    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterRequest): AuthResponse

    @POST("api/auth/magic-link")
    suspend fun sendMagicLink(@Body body: EmailRequest): OkResponse

    // with the X-Platform header the backend answers this with JSON tokens instead of a browser redirect
    @GET("api/auth/magic-link/verify")
    suspend fun verifyMagicLink(@Query("token") token: String): AuthResponse

    @POST("api/auth/forgot-password")
    suspend fun forgotPassword(@Body body: EmailRequest): OkResponse

    @POST("api/auth/reset-password")
    suspend fun resetPassword(@Body body: ResetPasswordRequest): OkResponse

    @GET("api/auth/me")
    suspend fun me(): MeResponse

    @GET("api/auth/providers")
    suspend fun providers(): ProvidersResponse

    @POST("api/auth/logout")
    suspend fun logout(@Body body: LogoutRequest): OkResponse

    @POST("api/auth/pin/verify")
    suspend fun pinVerify(@Body body: PinRequest): OkResponse

    @POST("api/auth/pin/forgot")
    suspend fun pinForgot(): OkResponse

    @POST("api/auth/pin/reset")
    suspend fun pinReset(@Body body: CodeRequest): OkResponse
}
