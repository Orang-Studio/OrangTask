package lt.oranges.orangtask.core.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val name: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("pin_enabled") val pinEnabled: Boolean = false,
)

@Serializable
data class AuthResponse(
    val user: UserDto? = null,
    @SerialName("requires_pin") val requiresPin: Boolean = false,
    @SerialName("access_token") val accessToken: String? = null,
    @SerialName("refresh_token") val refreshToken: String? = null,
)

@Serializable
data class MeResponse(
    val user: UserDto,
    @SerialName("requires_pin") val requiresPin: Boolean = false,
)

@Serializable
data class OkResponse(
    val ok: Boolean = false,
    @SerialName("access_token") val accessToken: String? = null,
)

@Serializable
data class ProvidersResponse(val github: Boolean = false, val google: Boolean = false)

@Serializable
data class DeviceTokenRequest(val token: String, val platform: String = "android")

@Serializable data class LoginRequest(val email: String, val password: String)
@Serializable data class RegisterRequest(val email: String, val password: String, val name: String)
@Serializable data class EmailRequest(val email: String)
@Serializable data class ResetPasswordRequest(val email: String, val code: String, val password: String)
@Serializable data class PinRequest(val pin: String)
@Serializable data class CodeRequest(val code: String)
@Serializable data class LogoutRequest(@SerialName("refresh_token") val refreshToken: String? = null)

@Serializable data class ApiErrorBody(val error: String? = null)
