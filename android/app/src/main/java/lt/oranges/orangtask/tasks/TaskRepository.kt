package lt.oranges.orangtask.tasks

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import lt.oranges.orangtask.core.db.ListDao
import lt.oranges.orangtask.core.db.TagEntity
import lt.oranges.orangtask.core.db.TaskDao
import lt.oranges.orangtask.core.db.TaskEntity
import lt.oranges.orangtask.core.db.isoToMillis
import lt.oranges.orangtask.core.db.toEntity
import lt.oranges.orangtask.core.network.CreateTaskRequest
import lt.oranges.orangtask.core.network.OrangApi
import lt.oranges.orangtask.core.network.TaskDto
import lt.oranges.orangtask.core.sync.OfflineQueue
import java.io.IOException
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/** room is the source of truth for the UI; every mutation is applied to Room optimistically, then sent */
@Singleton
class TaskRepository @Inject constructor(
    private val api: OrangApi,
    private val taskDao: TaskDao,
    private val listDao: ListDao,
    private val offlineQueue: OfflineQueue,
    private val json: Json,
) {
    fun observeForList(listId: String): Flow<List<TaskEntity>> = taskDao.observeForList(listId)
    fun observeSubtasks(parentId: String): Flow<List<TaskEntity>> = taskDao.observeSubtasks(parentId)
    fun observeById(id: String): Flow<TaskEntity?> = taskDao.observeById(id)
    fun observeToday(dayStart: Long, dayEnd: Long): Flow<List<TaskEntity>> = taskDao.observeToday(dayStart, dayEnd)
    fun observeWeek(dayStart: Long, weekEnd: Long): Flow<List<TaskEntity>> = taskDao.observeWeek(dayStart, weekEnd)
    fun observeOverdue(dayStart: Long): Flow<List<TaskEntity>> = taskDao.observeOverdue(dayStart)
    fun observeAssigned(userId: String): Flow<List<TaskEntity>> = taskDao.observeAssigned(userId)
    fun observeAll(): Flow<List<TaskEntity>> = taskDao.observeAll()

    // ---- Sync ----

    /** smart=all returns every top-level task the user can see, with tags */
    suspend fun refreshAllTasks() {
        val tasks = api.getTasks(smart = "all").tasks
        upsertMerged(tasks)
        taskDao.deleteTopLevelNotIn(tasks.map { it.id })
    }

    /** the per-list query is the only one that carries subtask_count */
    suspend fun refreshListTasks(listId: String) {
        val tasks = api.getTasks(listId = listId).tasks
        upsertMerged(tasks)
        taskDao.deleteTopLevelForListNotIn(listId, tasks.map { it.id })
    }

    suspend fun refreshSubtasks(listId: String, parentId: String) {
        val tasks = api.getTasks(listId = listId, parentId = parentId).tasks
        upsertMerged(tasks)
        taskDao.deleteSubtasksNotIn(parentId, tasks.map { it.id })
    }

    /** applies a full task row pushed over the WebSocket */
    suspend fun upsertFromServer(dto: TaskDto) {
        taskDao.upsert(dto.toEntity(taskDao.getById(dto.id)))
    }

    suspend fun deleteLocal(id: String) {
        taskDao.deleteSubtasksOf(id)
        taskDao.deleteById(id)
    }

    private suspend fun upsertMerged(tasks: List<TaskDto>) {
        taskDao.upsertAll(tasks.map { it.toEntity(taskDao.getById(it.id)) })
    }

    // ---- Mutations ----

    suspend fun createTask(
        listId: String,
        title: String,
        dueDate: Instant? = null,
        priority: String? = null,
        parentId: String? = null,
        recurrenceRule: String? = null,
    ): TaskEntity {
        val request = CreateTaskRequest(
            listId = listId,
            title = title,
            dueDate = dueDate?.toString(),
            priority = priority,
            parentId = parentId,
            recurrenceRule = recurrenceRule,
        )
        val entity = try {
            api.createTask(request).task.toEntity()
        } catch (e: IOException) {
            localDraft(request)
        }
        taskDao.upsert(entity)
        if (parentId != null) taskDao.adjustSubtaskCount(parentId, +1)
        listDao.adjustTaskCount(listId, +1)
        return entity
    }

    /** offline create: a `local-` draft row renders immediately and survives reconciliation; the queued */
    private suspend fun localDraft(request: CreateTaskRequest): TaskEntity {
        val tempId = "local-" + UUID.randomUUID()
        offlineQueue.enqueue(
            method = "POST",
            path = "api/tasks",
            body = json.encodeToJsonElement(CreateTaskRequest.serializer(), request).jsonObject,
            tempId = tempId,
        )
        val now = Instant.now().toString()
        return TaskEntity(
            id = tempId,
            listId = request.listId,
            listName = listDao.getById(request.listId)?.name,
            parentId = request.parentId,
            createdBy = null,
            assignedTo = request.assignedTo,
            assigneeName = null,
            assigneeAvatar = null,
            title = request.title,
            notes = request.notes,
            priority = request.priority ?: "none",
            status = "todo",
            dueDate = request.dueDate,
            dueAtMillis = isoToMillis(request.dueDate),
            startDate = request.startDate,
            startAtMillis = isoToMillis(request.startDate),
            completedAt = null,
            position = Int.MAX_VALUE, // sorts after every server row
            recurrenceRule = request.recurrenceRule,
            tagIds = emptyList(),
            tagNames = emptyList(),
            subtaskCount = 0,
            createdAt = now,
            updatedAt = now,
        )
    }

    suspend fun setCompleted(id: String, complete: Boolean) {
        val before = taskDao.getById(id) ?: return
        taskDao.upsert(
            before.copy(
                status = if (complete) "done" else "todo",
                completedAt = if (complete) Instant.now().toString() else null,
            )
        )
        // open-task counter on the list card mirrors the servers task_count
        if (before.done != complete) listDao.adjustTaskCount(before.listId, if (complete) -1 else +1)
        try {
            val dto = (if (complete) api.completeTask(id) else api.uncompleteTask(id)).task
            taskDao.upsert(dto.toEntity(taskDao.getById(id)))
        } catch (e: IOException) {
            offlineQueue.enqueue("POST", "api/tasks/$id/${if (complete) "complete" else "uncomplete"}")
        } catch (e: Exception) {
            taskDao.upsert(before)
            if (before.done != complete) listDao.adjustTaskCount(before.listId, if (complete) +1 else -1)
            throw e
        }
    }

    suspend fun deleteTask(id: String) {
        val before = taskDao.getById(id) ?: return
        deleteLocal(id)
        if (!before.done) listDao.adjustTaskCount(before.listId, -1)
        before.parentId?.let { taskDao.adjustSubtaskCount(it, -1) }
        try {
            api.deleteTask(id)
        } catch (e: IOException) {
            offlineQueue.enqueue("DELETE", "api/tasks/$id")
        } catch (e: Exception) {
            taskDao.upsert(before)
            if (!before.done) listDao.adjustTaskCount(before.listId, +1)
            before.parentId?.let { taskDao.adjustSubtaskCount(it, +1) }
            throw e
        }
    }

    /** optimistic PATCH; [fields] holds exactly the keys to send */
    suspend fun patchTask(id: String, fields: JsonObject, optimistic: (TaskEntity) -> TaskEntity) {
        val before = taskDao.getById(id) ?: return
        taskDao.upsert(optimistic(before))
        try {
            val dto = api.updateTask(id, fields).task
            taskDao.upsert(dto.toEntity(taskDao.getById(id)))
        } catch (e: IOException) {
            offlineQueue.enqueue("PATCH", "api/tasks/$id", fields)
        } catch (e: Exception) {
            taskDao.upsert(before)
            throw e
        }
    }

    suspend fun setTitle(id: String, title: String) =
        patchTask(id, fieldsOf("title" to JsonPrimitive(title))) { it.copy(title = title) }

    suspend fun setNotes(id: String, notes: String) =
        patchTask(id, fieldsOf("notes" to JsonPrimitive(notes))) { it.copy(notes = notes) }

    suspend fun setPriority(id: String, priority: String) =
        patchTask(id, fieldsOf("priority" to JsonPrimitive(priority))) { it.copy(priority = priority) }

    suspend fun setDueDate(id: String, due: Instant?) {
        val iso = due?.toString()
        patchTask(id, fieldsOf("due_date" to (iso?.let(::JsonPrimitive) ?: JsonNull))) {
            it.copy(dueDate = iso, dueAtMillis = isoToMillis(iso))
        }
    }

    suspend fun setRecurrence(id: String, rule: String?) =
        patchTask(id, fieldsOf("recurrence_rule" to (rule?.let(::JsonPrimitive) ?: JsonNull))) {
            it.copy(recurrenceRule = rule)
        }

    suspend fun setAssignee(id: String, userId: String?, name: String?, avatar: String?) =
        patchTask(id, fieldsOf("assigned_to" to (userId?.let(::JsonPrimitive) ?: JsonNull))) {
            it.copy(assignedTo = userId, assigneeName = name, assigneeAvatar = avatar)
        }

    suspend fun addTag(taskId: String, tag: TagEntity) {
        val before = taskDao.getById(taskId) ?: return
        if (tag.id in before.tagIds) return
        taskDao.upsert(before.copy(tagIds = before.tagIds + tag.id, tagNames = before.tagNames + tag.name))
        try {
            api.addTagToTask(taskId, tag.id)
        } catch (e: IOException) {
            offlineQueue.enqueue("POST", "api/tasks/$taskId/tags/${tag.id}")
        } catch (e: Exception) {
            taskDao.upsert(before)
            throw e
        }
    }

    suspend fun removeTag(taskId: String, tag: TagEntity) {
        val before = taskDao.getById(taskId) ?: return
        taskDao.upsert(
            before.copy(tagIds = before.tagIds - tag.id, tagNames = before.tagNames - tag.name)
        )
        try {
            api.removeTagFromTask(taskId, tag.id)
        } catch (e: IOException) {
            offlineQueue.enqueue("DELETE", "api/tasks/$taskId/tags/${tag.id}")
        } catch (e: Exception) {
            taskDao.upsert(before)
            throw e
        }
    }

    private fun fieldsOf(vararg pairs: Pair<String, JsonElement>) = JsonObject(mapOf(*pairs))
}
