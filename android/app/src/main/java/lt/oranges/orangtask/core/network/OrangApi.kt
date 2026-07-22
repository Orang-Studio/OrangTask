package lt.oranges.orangtask.core.network

import kotlinx.serialization.json.JsonObject
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming
import retrofit2.http.Url

/** tasks / lists / tags surface of the backend (backend/src/routes) */
interface OrangApi {

    // ---- Tasks ----

    @GET("api/tasks")
    suspend fun getTasks(
        @Query("listId") listId: String? = null,
        @Query("smart") smart: String? = null,
        @Query("parentId") parentId: String? = null,
    ): TasksResponse

    @POST("api/tasks")
    suspend fun createTask(@Body body: CreateTaskRequest): TaskResponse

    /** patch semantics: only keys present are updated; JsonNull clears a field */
    @PATCH("api/tasks/{id}")
    suspend fun updateTask(@Path("id") id: String, @Body body: JsonObject): TaskResponse

    @DELETE("api/tasks/{id}")
    suspend fun deleteTask(@Path("id") id: String): OkResponse

    @POST("api/tasks/{id}/complete")
    suspend fun completeTask(@Path("id") id: String): TaskResponse

    @POST("api/tasks/{id}/uncomplete")
    suspend fun uncompleteTask(@Path("id") id: String): TaskResponse

    @POST("api/tasks/{id}/tags/{tagId}")
    suspend fun addTagToTask(@Path("id") id: String, @Path("tagId") tagId: String): OkResponse

    @DELETE("api/tasks/{id}/tags/{tagId}")
    suspend fun removeTagFromTask(@Path("id") id: String, @Path("tagId") tagId: String): OkResponse

    // ---- Lists ----

    @GET("api/lists")
    suspend fun getLists(): ListsResponse

    @POST("api/lists")
    suspend fun createList(@Body body: CreateListRequest): ListResponse

    @PATCH("api/lists/{id}")
    suspend fun updateList(@Path("id") id: String, @Body body: JsonObject): ListResponse

    @DELETE("api/lists/{id}")
    suspend fun deleteList(@Path("id") id: String): OkResponse

    @GET("api/lists/{id}/members")
    suspend fun getMembers(@Path("id") id: String): MembersResponse

    /** returns the bare list_members row (no email/name) refetch members after */
    @POST("api/lists/{id}/members")
    suspend fun inviteMember(@Path("id") id: String, @Body body: InviteMemberRequest): JsonObject

    @PATCH("api/lists/{id}/members/{userId}")
    suspend fun updateMemberRole(
        @Path("id") id: String,
        @Path("userId") userId: String,
        @Body body: MemberRoleRequest,
    ): OkResponse

    @DELETE("api/lists/{id}/members/{userId}")
    suspend fun removeMember(@Path("id") id: String, @Path("userId") userId: String): OkResponse

    @GET("api/tags")
    suspend fun getTags(): TagsResponse

    @POST("api/tags")
    suspend fun createTag(@Body body: CreateTagRequest): TagResponse

    // ---- Search ----

    /** substring + full-text search over the users tasks (min 2 chars) */
    @GET("api/search")
    suspend fun search(@Query("q") query: String): SearchResponse

    // ---- User / settings (backend/src/routes/user.ts) ----

    @PATCH("api/user")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): UserResponse

    // retrofits plain @DELETE refuses a body, and this endpoint requires one
    @HTTP(method = "DELETE", path = "api/user", hasBody = true)
    suspend fun deleteAccount(@Body body: DeleteAccountRequest): OkResponse

    @Streaming
    @GET("api/user/export")
    suspend fun exportData(): ResponseBody

    @POST("api/user/pin")
    suspend fun setPin(@Body body: PinRequest): OkResponse

    @DELETE("api/user/pin")
    suspend fun removePin(): OkResponse

    @GET("api/user/pin/status")
    suspend fun pinStatus(): PinStatusResponse

    @GET("api/user/notification-prefs")
    suspend fun getNotificationPrefs(): NotificationPrefs

    @PUT("api/user/notification-prefs")
    suspend fun putNotificationPrefs(@Body body: NotificationPrefs): NotificationPrefs

    @POST("api/user/import/google-keep")
    suspend fun importGoogleKeep(@Body body: KeepImportRequest): KeepImportResult

    @GET("api/api-keys")
    suspend fun getApiKeys(): ApiKeysResponse

    @POST("api/api-keys")
    suspend fun createApiKey(@Body body: CreateApiKeyRequest): CreatedApiKeyResponse

    @DELETE("api/api-keys/{id}")
    suspend fun deleteApiKey(@Path("id") id: String): OkResponse

    @GET("api/webhooks")
    suspend fun getWebhooks(): WebhooksResponse

    @POST("api/webhooks")
    suspend fun createWebhook(@Body body: CreateWebhookRequest): WebhookResponse

    @PATCH("api/webhooks/{id}")
    suspend fun updateWebhook(@Path("id") id: String, @Body body: UpdateWebhookRequest): WebhookResponse

    @DELETE("api/webhooks/{id}")
    suspend fun deleteWebhook(@Path("id") id: String): OkResponse

    @GET("api/webhooks/{id}/deliveries")
    suspend fun getWebhookDeliveries(@Path("id") id: String): DeliveriesResponse

    @POST("api/webhooks/{id}/test")
    suspend fun testWebhook(@Path("id") id: String): TestWebhookResponse

    @GET("api/notifications")
    suspend fun getNotifications(): NotificationsResponse

    @POST("api/notifications/read-all")
    suspend fun markAllNotificationsRead(): OkResponse

    @PATCH("api/notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: String): OkResponse

    // ---- Push (FCM device token) ----

    @POST("api/push/device")
    suspend fun registerDevice(@Body body: DeviceTokenRequest): OkResponse

    @HTTP(method = "DELETE", path = "api/push/device", hasBody = true)
    suspend fun unregisterDevice(@Body body: DeviceTokenRequest): OkResponse

    // ---- Offline replay ---- Queued ops carry their own relative path, so these are untyped: every

    @POST
    suspend fun replayPost(@Url path: String, @Body body: JsonObject): JsonObject

    @PATCH
    suspend fun replayPatch(@Url path: String, @Body body: JsonObject): JsonObject

    @DELETE
    suspend fun replayDelete(@Url path: String): JsonObject
}
