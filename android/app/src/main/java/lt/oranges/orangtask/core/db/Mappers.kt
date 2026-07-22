package lt.oranges.orangtask.core.db

import lt.oranges.orangtask.core.network.ListDto
import lt.oranges.orangtask.core.network.TagDto
import lt.oranges.orangtask.core.network.TaskDto
import java.time.Instant

fun isoToMillis(iso: String?): Long? =
    iso?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }

/** different endpoints return different projections of a task */
fun TaskDto.toEntity(existing: TaskEntity? = null) = TaskEntity(
    id = id,
    listId = listId,
    listName = listName ?: existing?.listName,
    parentId = parentId,
    createdBy = createdBy ?: existing?.createdBy,
    assignedTo = assignedTo,
    assigneeName = if (assignedTo == null) null else assigneeName
        ?: existing?.takeIf { it.assignedTo == assignedTo }?.assigneeName,
    assigneeAvatar = if (assignedTo == null) null else assigneeAvatar
        ?: existing?.takeIf { it.assignedTo == assignedTo }?.assigneeAvatar,
    title = title,
    notes = notes,
    priority = priority,
    status = status,
    dueDate = dueDate,
    dueAtMillis = isoToMillis(dueDate),
    startDate = startDate,
    startAtMillis = isoToMillis(startDate),
    completedAt = completedAt,
    position = position,
    recurrenceRule = recurrenceRule,
    tagIds = tagIds ?: existing?.tagIds ?: emptyList(),
    tagNames = tagNames ?: existing?.tagNames ?: emptyList(),
    subtaskCount = subtaskCountInt ?: existing?.subtaskCount ?: 0,
    createdAt = createdAt ?: existing?.createdAt,
    updatedAt = updatedAt,
)

fun ListDto.toEntity(existing: ListEntity? = null) = ListEntity(
    id = id,
    ownerId = ownerId,
    name = name,
    color = color,
    icon = icon,
    position = position,
    taskCount = taskCountInt ?: existing?.taskCount ?: 0,
    isShared = isShared ?: existing?.isShared ?: false,
    myRole = myRole ?: existing?.myRole,
    createdAt = createdAt ?: existing?.createdAt,
)

fun TagDto.toEntity() = TagEntity(id = id, name = name, color = color)
