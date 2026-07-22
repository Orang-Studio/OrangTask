package lt.oranges.orangtask.core.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull

/** phase 3 surface: sharing, profile/PIN, webhooks, notifications, Keep import */

private fun JsonPrimitive?.asIntOrNull(): Int? = this?.let { it.intOrNull ?: it.content.toIntOrNull() }

// ---- List sharing ----

@Serializable data class InviteMemberRequest(val email: String, val role: String = "editor")
@Serializable data class MemberRoleRequest(val role: String)

// ---- Profile / account ----

@Serializable
data class UpdateProfileRequest(
    val name: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
)

@Serializable data class UserResponse(val user: UserDto)
@Serializable data class DeleteAccountRequest(val email: String)
@Serializable data class PinStatusResponse(@SerialName("has_pin") val hasPin: Boolean = false)

@Serializable data class ChannelPref(val push: Boolean = true, val email: Boolean = false)

/** { prefs: { task_due_soon: {push, email}, ... } } GET response and PUT body */
@Serializable data class NotificationPrefs(val prefs: Map<String, ChannelPref> = emptyMap())

// ---- Personal API keys (direct REST access for integrations) ----

@Serializable
data class ApiKeyDto(
    val id: String,
    val name: String,
    @SerialName("key_prefix") val keyPrefix: String,
    @SerialName("last_used_at") val lastUsedAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

/** only present on the create response the server never stores or replays the raw key */
@Serializable
data class CreatedApiKeyDto(
    val id: String,
    val name: String,
    @SerialName("key_prefix") val keyPrefix: String,
    @SerialName("last_used_at") val lastUsedAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("raw_key") val rawKey: String,
)

@Serializable data class CreateApiKeyRequest(val name: String)
@Serializable data class ApiKeysResponse(val keys: List<ApiKeyDto> = emptyList())
@Serializable data class CreatedApiKeyResponse(val key: CreatedApiKeyDto)

@Serializable
data class WebhookDto(
    val id: String,
    val name: String,
    val url: String? = null,
    val direction: String = "outgoing",
    val events: List<String>? = null,
    val enabled: Boolean = true,
    @SerialName("incoming_token") val incomingToken: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class WebhookDeliveryDto(
    val id: String,
    val event: String,
    @SerialName("status_code") val statusCode: JsonPrimitive? = null,
    val error: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
) {
    val statusCodeInt: Int? get() = statusCode.asIntOrNull()
}

@Serializable
data class CreateWebhookRequest(
    val name: String,
    val url: String? = null,
    val direction: String,
    val events: List<String>? = null,
)

/** sparse PATCH omitted (null) fields are left unchanged by the server */
@Serializable
data class UpdateWebhookRequest(
    val name: String? = null,
    val url: String? = null,
    val events: List<String>? = null,
    val enabled: Boolean? = null,
)

/** POST /webhooks/:id/test answers camelCase (built in the route, not from the DB) */
@Serializable
data class TestWebhookResponse(
    val statusCode: Int = 0,
    val responseBody: String? = null,
    val error: String? = null,
)

@Serializable data class WebhooksResponse(val webhooks: List<WebhookDto> = emptyList())
@Serializable data class WebhookResponse(val webhook: WebhookDto)
@Serializable data class DeliveriesResponse(val deliveries: List<WebhookDeliveryDto> = emptyList())

@Serializable
data class NotificationDto(
    val id: String,
    val type: String = "",
    val title: String,
    val body: String? = null,
    val read: Boolean = false,
    /** jsonb column; list_shared/task_assigned carry a list_id for deep links */
    val metadata: JsonObject? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable data class NotificationsResponse(val notifications: List<NotificationDto> = emptyList())

// ---- Google Keep import ----

/** the zip is unpacked on-device (like the web unzips in the browser) and the raw note JSON objects are */
@Serializable
data class KeepImportRequest(
    val notes: List<JsonObject>,
    val listName: String,
    val includeArchived: Boolean,
    val includeTrashed: Boolean,
)

@Serializable data class KeepImportList(val id: String, val name: String)

@Serializable
data class KeepImportResult(
    val list: KeepImportList,
    val imported: Int = 0,
    val subtasks: Int = 0,
    val skipped: Int = 0,
)
