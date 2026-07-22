package lt.oranges.orangtask.settings

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import lt.oranges.orangtask.core.network.ApiKeyDto
import lt.oranges.orangtask.core.network.ChannelPref
import lt.oranges.orangtask.core.network.CreateApiKeyRequest
import lt.oranges.orangtask.core.network.CreateWebhookRequest
import lt.oranges.orangtask.core.network.CreatedApiKeyDto
import lt.oranges.orangtask.core.network.DeleteAccountRequest
import lt.oranges.orangtask.core.network.KeepImportRequest
import lt.oranges.orangtask.core.network.KeepImportResult
import lt.oranges.orangtask.core.network.NotificationDto
import lt.oranges.orangtask.core.network.NotificationPrefs
import lt.oranges.orangtask.core.network.OrangApi
import lt.oranges.orangtask.core.network.PinRequest
import lt.oranges.orangtask.core.network.TestWebhookResponse
import lt.oranges.orangtask.core.network.TokenStore
import lt.oranges.orangtask.core.network.UpdateProfileRequest
import lt.oranges.orangtask.core.network.UpdateWebhookRequest
import lt.oranges.orangtask.core.network.UserDto
import lt.oranges.orangtask.core.network.WebhookDeliveryDto
import lt.oranges.orangtask.core.network.WebhookDto
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/** profile, PIN, notification prefs, webhooks, notifications, data import/export */
@Singleton
class SettingsRepository @Inject constructor(
    private val api: OrangApi,
    private val tokenStore: TokenStore,
    private val json: Json,
) {

    /** PATCH /user answers without pin_enabled, so merge into the cached user instead of replacing it */
    suspend fun updateProfile(name: String, avatarUrl: String?): UserDto {
        val updated = api.updateProfile(
            UpdateProfileRequest(name = name, avatarUrl = avatarUrl?.takeIf { it.isNotBlank() })
        ).user
        val cached = tokenStore.cachedUserJson
            ?.let { runCatching { json.decodeFromString(UserDto.serializer(), it) }.getOrNull() }
        val merged = updated.copy(pinEnabled = cached?.pinEnabled ?: false)
        tokenStore.cachedUserJson = json.encodeToString(UserDto.serializer(), merged)
        return merged
    }

    suspend fun pinStatus(): Boolean = api.pinStatus().hasPin

    suspend fun setPin(pin: String) {
        api.setPin(PinRequest(pin))
        // setting a PIN counts as having just verified it dont lock this device
        tokenStore.markPinVerified()
        cacheUserPinEnabled(true)
    }

    suspend fun removePin() {
        api.removePin()
        cacheUserPinEnabled(false)
    }

    private fun cacheUserPinEnabled(enabled: Boolean) {
        val cached = tokenStore.cachedUserJson
            ?.let { runCatching { json.decodeFromString(UserDto.serializer(), it) }.getOrNull() }
            ?: return
        tokenStore.cachedUserJson =
            json.encodeToString(UserDto.serializer(), cached.copy(pinEnabled = enabled))
    }

    suspend fun notificationPrefs(): Map<String, ChannelPref> = api.getNotificationPrefs().prefs

    suspend fun saveNotificationPrefs(prefs: Map<String, ChannelPref>): Map<String, ChannelPref> =
        api.putNotificationPrefs(NotificationPrefs(prefs)).prefs

    suspend fun apiKeys(): List<ApiKeyDto> = api.getApiKeys().keys

    /** raw key is only ever returned here show it once, then discard it */
    suspend fun createApiKey(name: String): CreatedApiKeyDto =
        api.createApiKey(CreateApiKeyRequest(name.trim())).key

    suspend fun deleteApiKey(id: String) {
        api.deleteApiKey(id)
    }

    suspend fun webhooks(): List<WebhookDto> = api.getWebhooks().webhooks

    suspend fun createWebhook(name: String, url: String?, direction: String, events: List<String>?): WebhookDto =
        api.createWebhook(CreateWebhookRequest(name, url, direction, events)).webhook

    suspend fun setWebhookEnabled(id: String, enabled: Boolean): WebhookDto =
        api.updateWebhook(id, UpdateWebhookRequest(enabled = enabled)).webhook

    suspend fun deleteWebhook(id: String) {
        api.deleteWebhook(id)
    }

    suspend fun webhookDeliveries(id: String): List<WebhookDeliveryDto> =
        api.getWebhookDeliveries(id).deliveries

    suspend fun testWebhook(id: String): TestWebhookResponse = api.testWebhook(id)

    suspend fun notifications(): List<NotificationDto> = api.getNotifications().notifications

    suspend fun markNotificationRead(id: String) {
        api.markNotificationRead(id)
    }

    suspend fun markAllNotificationsRead() {
        api.markAllNotificationsRead()
    }

    /** streams GET /user/export into [target] (cache file the share sheet can hand out) */
    suspend fun exportTo(target: File) = withContext(Dispatchers.IO) {
        api.exportData().use { body ->
            body.byteStream().use { input ->
                target.outputStream().use { input.copyTo(it) }
            }
        }
    }

    suspend fun importGoogleKeep(
        notes: List<JsonObject>,
        listName: String,
        includeArchived: Boolean,
        includeTrashed: Boolean,
    ): KeepImportResult = api.importGoogleKeep(
        KeepImportRequest(notes, listName.trim().ifEmpty { "Google Keep" }, includeArchived, includeTrashed)
    )

    suspend fun deleteAccount(email: String) {
        api.deleteAccount(DeleteAccountRequest(email))
    }
}
