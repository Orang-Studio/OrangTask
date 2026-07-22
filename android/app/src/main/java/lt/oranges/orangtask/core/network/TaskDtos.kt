package lt.oranges.orangtask.core.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull

/** COUNT() columns come back from postgres.js as JSON strings ("3"), not numbers, so counts are */
private fun JsonPrimitive?.asIntOrNull(): Int? = this?.let { it.intOrNull ?: it.content.toIntOrNull() }

@Serializable
data class TaskDto(
    val id: String,
    @SerialName("list_id") val listId: String,
    @SerialName("list_name") val listName: String? = null,
    @SerialName("parent_id") val parentId: String? = null,
    @SerialName("created_by") val createdBy: String? = null,
    @SerialName("assigned_to") val assignedTo: String? = null,
    @SerialName("assignee_name") val assigneeName: String? = null,
    @SerialName("assignee_avatar") val assigneeAvatar: String? = null,
    val title: String,
    val notes: String? = null,
    val priority: String = "none",
    val status: String = "todo",
    @SerialName("due_date") val dueDate: String? = null,
    @SerialName("start_date") val startDate: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    val position: Int = 0,
    @SerialName("recurrence_rule") val recurrenceRule: String? = null,
    @SerialName("tag_names") val tagNames: List<String>? = null,
    @SerialName("tag_ids") val tagIds: List<String>? = null,
    @SerialName("subtask_count") val subtaskCount: JsonPrimitive? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
) {
    val subtaskCountInt: Int? get() = subtaskCount.asIntOrNull()
}

@Serializable
data class ListDto(
    val id: String,
    @SerialName("owner_id") val ownerId: String,
    val name: String,
    val color: String? = null,
    val icon: String? = null,
    val position: Int = 0,
    @SerialName("task_count") val taskCount: JsonPrimitive? = null,
    @SerialName("is_shared") val isShared: Boolean? = null,
    @SerialName("my_role") val myRole: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
) {
    val taskCountInt: Int? get() = taskCount.asIntOrNull()
}

@Serializable
data class TagDto(
    val id: String,
    @SerialName("owner_id") val ownerId: String? = null,
    val name: String,
    val color: String? = null,
)

@Serializable
data class MemberDto(
    val id: String,
    val email: String,
    val name: String,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    val role: String = "editor",
    @SerialName("created_at") val createdAt: String? = null,
)

/** one row from GET /api/search (backend/src/routes/search.ts) */
@Serializable
data class SearchResultDto(
    val id: String,
    val title: String,
    val status: String = "todo",
    val priority: String = "none",
    @SerialName("due_date") val dueDate: String? = null,
    @SerialName("list_id") val listId: String,
    @SerialName("list_name") val listName: String? = null,
)

@Serializable data class SearchResponse(val results: List<SearchResultDto> = emptyList())

@Serializable data class TasksResponse(val tasks: List<TaskDto> = emptyList())
@Serializable data class TaskResponse(val task: TaskDto)
@Serializable data class ListsResponse(val lists: List<ListDto> = emptyList())
@Serializable data class ListResponse(val list: ListDto)
@Serializable data class TagsResponse(val tags: List<TagDto> = emptyList())
@Serializable data class TagResponse(val tag: TagDto)
@Serializable data class MembersResponse(val members: List<MemberDto> = emptyList())

@Serializable
data class CreateTaskRequest(
    @SerialName("list_id") val listId: String,
    val title: String,
    val notes: String? = null,
    val priority: String? = null,
    @SerialName("due_date") val dueDate: String? = null,
    @SerialName("start_date") val startDate: String? = null,
    @SerialName("parent_id") val parentId: String? = null,
    @SerialName("assigned_to") val assignedTo: String? = null,
    @SerialName("recurrence_rule") val recurrenceRule: String? = null,
)

@Serializable
data class CreateListRequest(val name: String, val color: String? = null, val icon: String? = null)

@Serializable
data class CreateTagRequest(val name: String, val color: String? = null)
