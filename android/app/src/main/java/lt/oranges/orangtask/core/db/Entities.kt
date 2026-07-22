package lt.oranges.orangtask.core.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** task rows mirror the API payload, denormalized: tag names/ids, assignee name/avatar, list name and */
@Entity(
    tableName = "tasks",
    indices = [Index("listId"), Index("parentId"), Index("dueAtMillis"), Index("assignedTo")],
)
data class TaskEntity(
    @PrimaryKey val id: String,
    val listId: String,
    val listName: String?,
    val parentId: String?,
    val createdBy: String?,
    val assignedTo: String?,
    val assigneeName: String?,
    val assigneeAvatar: String?,
    val title: String,
    val notes: String?,
    val priority: String,
    val status: String,
    val dueDate: String?,
    val dueAtMillis: Long?,
    val startDate: String?,
    val startAtMillis: Long?,
    val completedAt: String?,
    val position: Int,
    val recurrenceRule: String?,
    val tagIds: List<String>,
    val tagNames: List<String>,
    val subtaskCount: Int,
    val createdAt: String?,
    val updatedAt: String?,
) {
    val done: Boolean get() = status == "done"
}

@Entity(tableName = "lists")
data class ListEntity(
    @PrimaryKey val id: String,
    val ownerId: String,
    val name: String,
    val color: String?,
    val icon: String?,
    val position: Int,
    val taskCount: Int,
    val isShared: Boolean,
    val myRole: String?,
    val createdAt: String?,
)

@Entity(tableName = "tags")
data class TagEntity(
    @PrimaryKey val id: String,
    val name: String,
    val color: String?,
)

/** a mutation made while offline, waiting to be replayed in order the durable version of the web */
@Entity(tableName = "pending_ops")
data class PendingOpEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val method: String,
    val path: String,
    val body: String?,
    val tempId: String?,
    val createdAt: Long,
)
