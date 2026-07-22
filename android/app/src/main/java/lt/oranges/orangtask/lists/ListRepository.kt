package lt.oranges.orangtask.lists

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import lt.oranges.orangtask.core.db.ListDao
import lt.oranges.orangtask.core.db.ListEntity
import lt.oranges.orangtask.core.db.TagDao
import lt.oranges.orangtask.core.db.TagEntity
import lt.oranges.orangtask.core.db.TaskDao
import lt.oranges.orangtask.core.db.toEntity
import lt.oranges.orangtask.core.network.CreateListRequest
import lt.oranges.orangtask.core.network.CreateTagRequest
import lt.oranges.orangtask.core.network.InviteMemberRequest
import lt.oranges.orangtask.core.network.MemberDto
import lt.oranges.orangtask.core.network.MemberRoleRequest
import lt.oranges.orangtask.core.network.OrangApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ListRepository @Inject constructor(
    private val api: OrangApi,
    private val listDao: ListDao,
    private val tagDao: TagDao,
    private val taskDao: TaskDao,
) {
    val lists: Flow<List<ListEntity>> = listDao.observeAll()
    val tags: Flow<List<TagEntity>> = tagDao.observeAll()

    fun observeList(id: String): Flow<ListEntity?> = listDao.observeById(id)

    /** GET /lists is authoritative for the whole set: upsert + drop the rest */
    suspend fun refreshLists() {
        val lists = api.getLists().lists
        listDao.upsertAll(lists.map { it.toEntity(listDao.getById(it.id)) })
        val ids = lists.map { it.id }
        listDao.deleteNotIn(ids)
        taskDao.deleteWhereListNotIn(ids)
    }

    suspend fun refreshTags() {
        val tags = api.getTags().tags
        tagDao.upsertAll(tags.map { it.toEntity() })
        tagDao.deleteNotIn(tags.map { it.id })
    }

    suspend fun createList(name: String, color: String? = "#f97316", icon: String? = "list"): ListEntity {
        val dto = api.createList(CreateListRequest(name = name, color = color, icon = icon)).list
        val entity = dto.toEntity()
        listDao.upsert(entity)
        return entity
    }

    /** optimistic PATCH: apply [optimistic] locally, send only [fields], and reconcile with the server row */
    suspend fun updateList(id: String, fields: JsonObject, optimistic: (ListEntity) -> ListEntity) {
        val before = listDao.getById(id) ?: return
        listDao.upsert(optimistic(before))
        try {
            val dto = api.updateList(id, fields).list
            listDao.upsert(dto.toEntity(listDao.getById(id)))
        } catch (e: Exception) {
            listDao.upsert(before)
            throw e
        }
    }

    suspend fun renameList(id: String, name: String) =
        updateList(id, JsonObject(mapOf("name" to JsonPrimitive(name)))) { it.copy(name = name) }

    suspend fun setListColor(id: String, color: String) =
        updateList(id, JsonObject(mapOf("color" to JsonPrimitive(color)))) { it.copy(color = color) }

    suspend fun setListIcon(id: String, icon: String) =
        updateList(id, JsonObject(mapOf("icon" to JsonPrimitive(icon)))) { it.copy(icon = icon) }

    suspend fun deleteList(id: String) {
        listDao.deleteById(id)
        taskDao.deleteForList(id)
        api.deleteList(id)
    }

    suspend fun createTag(name: String): TagEntity {
        val entity = api.createTag(CreateTagRequest(name)).tag.toEntity()
        tagDao.upsert(entity)
        return entity
    }

    /** members are only needed while the detail sheet is open not cached */
    suspend fun members(listId: String): List<MemberDto> = api.getMembers(listId).members

    // ---- Sharing (ShareModal.tsx)

    suspend fun inviteMember(listId: String, email: String, role: String): List<MemberDto> {
        api.inviteMember(listId, InviteMemberRequest(email = email.trim(), role = role))
        return refreshMembersAndListFlags(listId)
    }

    suspend fun updateMemberRole(listId: String, userId: String, role: String): List<MemberDto> {
        api.updateMemberRole(listId, userId, MemberRoleRequest(role))
        return api.getMembers(listId).members
    }

    suspend fun removeMember(listId: String, userId: String): List<MemberDto> {
        api.removeMember(listId, userId)
        return refreshMembersAndListFlags(listId)
    }

    /** leaving a shared list = removing yourself; the list disappears locally */
    suspend fun leaveList(listId: String, myUserId: String) {
        api.removeMember(listId, myUserId)
        listDao.deleteById(listId)
        taskDao.deleteForList(listId)
    }

    private suspend fun refreshMembersAndListFlags(listId: String): List<MemberDto> {
        // is_shared / task counts may have changed refresh the cached row too
        runCatching { refreshLists() }
        return api.getMembers(listId).members
    }
}
