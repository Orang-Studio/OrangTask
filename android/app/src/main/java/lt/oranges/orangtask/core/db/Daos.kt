package lt.oranges.orangtask.core.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

/** the smart-view queries reproduce backend/src/routes/tasks.ts predicates locally */
@Dao
interface TaskDao {

    @Query("SELECT * FROM tasks WHERE listId = :listId AND parentId IS NULL ORDER BY position, createdAt")
    fun observeForList(listId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE parentId = :parentId ORDER BY position, createdAt")
    fun observeSubtasks(parentId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE id = :id")
    fun observeById(id: String): Flow<TaskEntity?>

    @Query(
        "SELECT * FROM tasks WHERE status != 'done' AND parentId IS NULL AND " +
            "((dueAtMillis IS NOT NULL AND dueAtMillis BETWEEN :dayStart AND :dayEnd) OR " +
            "(startAtMillis IS NOT NULL AND startAtMillis BETWEEN :dayStart AND :dayEnd)) " +
            "ORDER BY position, dueAtMillis"
    )
    fun observeToday(dayStart: Long, dayEnd: Long): Flow<List<TaskEntity>>

    @Query(
        "SELECT * FROM tasks WHERE status != 'done' AND parentId IS NULL AND " +
            "dueAtMillis IS NOT NULL AND dueAtMillis BETWEEN :dayStart AND :weekEnd " +
            "ORDER BY dueAtMillis, position"
    )
    fun observeWeek(dayStart: Long, weekEnd: Long): Flow<List<TaskEntity>>

    @Query(
        "SELECT * FROM tasks WHERE status != 'done' AND parentId IS NULL AND " +
            "dueAtMillis IS NOT NULL AND dueAtMillis < :dayStart " +
            "ORDER BY dueAtMillis, position"
    )
    fun observeOverdue(dayStart: Long): Flow<List<TaskEntity>>

    @Query(
        "SELECT * FROM tasks WHERE status != 'done' AND assignedTo = :userId " +
            "ORDER BY CASE WHEN dueAtMillis IS NULL THEN 1 ELSE 0 END, dueAtMillis, position"
    )
    fun observeAssigned(userId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE parentId IS NULL ORDER BY position, createdAt DESC")
    fun observeAll(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE id = :id")
    suspend fun getById(id: String): TaskEntity?

    @Upsert
    suspend fun upsert(task: TaskEntity)

    @Upsert
    suspend fun upsertAll(tasks: List<TaskEntity>)

    @Query("DELETE FROM tasks WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM tasks WHERE parentId = :parentId")
    suspend fun deleteSubtasksOf(parentId: String)

    // reconciliation deletes spare `local-` drafts: rows created offline that the server cant know about

    @Query("DELETE FROM tasks WHERE parentId IS NULL AND id NOT IN (:ids) AND id NOT LIKE 'local-%'")
    suspend fun deleteTopLevelNotIn(ids: List<String>)

    @Query("DELETE FROM tasks WHERE listId = :listId AND parentId IS NULL AND id NOT IN (:ids) AND id NOT LIKE 'local-%'")
    suspend fun deleteTopLevelForListNotIn(listId: String, ids: List<String>)

    @Query("DELETE FROM tasks WHERE parentId = :parentId AND id NOT IN (:ids) AND id NOT LIKE 'local-%'")
    suspend fun deleteSubtasksNotIn(parentId: String, ids: List<String>)

    @Query("DELETE FROM tasks WHERE listId = :listId")
    suspend fun deleteForList(listId: String)

    @Query("DELETE FROM tasks WHERE listId NOT IN (:listIds)")
    suspend fun deleteWhereListNotIn(listIds: List<String>)

    @Query("UPDATE tasks SET subtaskCount = MAX(0, subtaskCount + :delta) WHERE id = :id")
    suspend fun adjustSubtaskCount(id: String, delta: Int)

    /** subtasks added offline under a draft parent follow it to its real id */
    @Query("UPDATE tasks SET parentId = :realId WHERE parentId = :tempId")
    suspend fun remapParent(tempId: String, realId: String)
}

@Dao
interface ListDao {

    @Query("SELECT * FROM lists ORDER BY position, createdAt")
    fun observeAll(): Flow<List<ListEntity>>

    @Query("SELECT * FROM lists WHERE id = :id")
    fun observeById(id: String): Flow<ListEntity?>

    @Query("SELECT * FROM lists WHERE id = :id")
    suspend fun getById(id: String): ListEntity?

    @Upsert
    suspend fun upsert(list: ListEntity)

    @Upsert
    suspend fun upsertAll(lists: List<ListEntity>)

    @Query("DELETE FROM lists WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM lists WHERE id NOT IN (:ids)")
    suspend fun deleteNotIn(ids: List<String>)

    @Query("UPDATE lists SET taskCount = MAX(0, taskCount + :delta) WHERE id = :id")
    suspend fun adjustTaskCount(id: String, delta: Int)
}

/** FIFO queue of offline mutations; replay order is the insertion order */
@Dao
interface PendingOpDao {

    @Insert
    suspend fun insert(op: PendingOpEntity)

    @Query("SELECT * FROM pending_ops ORDER BY id LIMIT 1")
    suspend fun oldest(): PendingOpEntity?

    @Query("DELETE FROM pending_ops WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("SELECT COUNT(*) FROM pending_ops")
    suspend fun count(): Int

    /** once a queued create resolves, later ops that referenced its draft id follow */
    @Query("UPDATE pending_ops SET path = REPLACE(path, :tempId, :realId), body = REPLACE(body, :tempId, :realId)")
    suspend fun replaceId(tempId: String, realId: String)
}

@Dao
interface TagDao {

    @Query("SELECT * FROM tags ORDER BY name")
    fun observeAll(): Flow<List<TagEntity>>

    @Upsert
    suspend fun upsert(tag: TagEntity)

    @Upsert
    suspend fun upsertAll(tags: List<TagEntity>)

    @Query("DELETE FROM tags WHERE id NOT IN (:ids)")
    suspend fun deleteNotIn(ids: List<String>)
}
