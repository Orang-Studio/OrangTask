package lt.oranges.orangtask.core.network

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull

private fun JsonPrimitive?.asIntOrNull(): Int? = this?.let { it.intOrNull ?: it.content.toIntOrNull() }

@Serializable data class InviteMemberRequest(val email: String, val role: String = "editor")
@Serializable data class MemberRoleRequest(val role: String)

@Serializable
data class UpdateProfileRequest(
    val name: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
)

@Serializable data class UserResponse(val user: UserDto)
@Serializable data class DeleteAccountRequest(val email: String)
@Serializable data class PinStatusResponse(@SerialName("has_pin") val hasPin: Boolean = false)

@OptIn(ExperimentalSerializationApi::class)
@Serializable
data class ChannelPref(
    @EncodeDefault val push: Boolean = true,
    @EncodeDefault val email: Boolean = false,
)

@Serializable data class NotificationPrefs(val prefs: Map<String, ChannelPref> = emptyMap())

@Serializable
data class ApiKeyDto(
    val id: String,
    val name: String,
    @SerialName("key_prefix") val keyPrefix: String,
    @SerialName("last_used_at") val lastUsedAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

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

@Serializable
data class UpdateWebhookRequest(
    val name: String? = null,
    val url: String? = null,
    val events: List<String>? = null,
    val enabled: Boolean? = null,
)

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

    val metadata: JsonObject? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable data class NotificationsResponse(val notifications: List<NotificationDto> = emptyList())

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

@Serializable
data class GithubConnectionDto(
    @SerialName("github_login") val githubLogin: String? = null,
    @SerialName("sync_issues") val syncIssues: Boolean = true,
    @SerialName("sync_pull_requests") val syncPullRequests: Boolean = true,
    @SerialName("sync_security") val syncSecurity: Boolean = true,
    @SerialName("last_synced_at") val lastSyncedAt: String? = null,
    @SerialName("last_error") val lastError: String? = null,
)

@Serializable
data class GithubCountsDto(
    val issues: Int = 0,
    @SerialName("pull_requests") val pullRequests: Int = 0,
    val security: Int = 0,
)

@Serializable
data class GithubStatusResponse(
    val configured: Boolean = false,
    val connection: GithubConnectionDto? = null,
    val counts: GithubCountsDto = GithubCountsDto(),
)

@Serializable data class GithubConnectResponse(val url: String)

@Serializable
data class GithubSettingsRequest(
    @SerialName("sync_issues") val syncIssues: Boolean? = null,
    @SerialName("sync_pull_requests") val syncPullRequests: Boolean? = null,
    @SerialName("sync_security") val syncSecurity: Boolean? = null,
)

@Serializable data class GithubConnectionResponse(val connection: GithubConnectionDto)
@Serializable data class GithubDisconnectRequest(val deleteTasks: Boolean = false)
