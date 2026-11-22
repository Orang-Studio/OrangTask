package lt.oranges.orangtask.scratchpads

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import lt.oranges.orangtask.core.db.ScratchpadDao
import lt.oranges.orangtask.core.db.ScratchpadEntity
import lt.oranges.orangtask.core.db.toEntity
import lt.oranges.orangtask.core.network.CreateScratchpadRequest
import lt.oranges.orangtask.core.network.OrangApi
import lt.oranges.orangtask.core.network.ScratchpadDto
import lt.oranges.orangtask.core.network.fetchAllPages
import lt.oranges.orangtask.core.sync.OfflineQueue
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ScratchpadRepository @Inject constructor(
    private val api: OrangApi,
    private val scratchpadDao: ScratchpadDao,
    private val offlineQueue: OfflineQueue,
) {
    val scratchpads: Flow<List<ScratchpadEntity>> = scratchpadDao.observeAll()

    fun observeById(id: String): Flow<ScratchpadEntity?> = scratchpadDao.observeById(id)

    suspend fun refreshScratchpads() {
        val pads = fetchAllPages { offset ->
            api.getScratchpads(offset = offset).let { it.scratchpads to it.nextOffset }
        }
        scratchpadDao.upsertAll(pads.map { it.toEntity(scratchpadDao.getById(it.id)) })
        scratchpadDao.deleteNotIn(pads.map { it.id })
    }

    suspend fun upsertFromServer(dto: ScratchpadDto) {
        scratchpadDao.upsert(dto.toEntity(scratchpadDao.getById(dto.id)))
    }

    suspend fun deleteLocal(id: String) {
        scratchpadDao.deleteById(id)
    }

    suspend fun createScratchpad(title: String = "", content: String = ""): ScratchpadEntity {
        val dto = api.createScratchpad(CreateScratchpadRequest(title = title, content = content)).scratchpad
        val entity = dto.toEntity()
        scratchpadDao.upsert(entity)
        return entity
    }

    suspend fun deleteScratchpad(id: String) {
        val before = scratchpadDao.getById(id) ?: return
        scratchpadDao.deleteById(id)
        try {
            api.deleteScratchpad(id)
        } catch (e: IOException) {
            offlineQueue.enqueue("DELETE", "api/scratchpads/$id")
        } catch (e: Exception) {
            scratchpadDao.upsert(before)
            throw e
        }
    }

    suspend fun patchScratchpad(
        id: String,
        fields: JsonObject,
        optimistic: (ScratchpadEntity) -> ScratchpadEntity,
    ) {
        val before = scratchpadDao.getById(id) ?: return
        scratchpadDao.upsert(optimistic(before))
        try {
            val dto = api.updateScratchpad(id, fields).scratchpad
            scratchpadDao.upsert(dto.toEntity(scratchpadDao.getById(id)))
        } catch (e: IOException) {
            offlineQueue.enqueue("PATCH", "api/scratchpads/$id", fields)
        } catch (e: Exception) {
            scratchpadDao.upsert(before)
            throw e
        }
    }

    suspend fun setTitle(id: String, title: String) =
        patchScratchpad(id, fieldsOf("title" to JsonPrimitive(title))) { it.copy(title = title) }

    suspend fun setContent(id: String, content: String) =
        patchScratchpad(id, fieldsOf("content" to JsonPrimitive(content))) { it.copy(content = content) }

    suspend fun setDraft(id: String, title: String, content: String) =
        patchScratchpad(
            id,
            fieldsOf("title" to JsonPrimitive(title), "content" to JsonPrimitive(content)),
        ) { it.copy(title = title, content = content) }

    suspend fun setPosition(id: String, position: Int) =
        patchScratchpad(id, fieldsOf("position" to JsonPrimitive(position))) { it.copy(position = position) }

    private fun fieldsOf(vararg pairs: Pair<String, JsonElement>) = JsonObject(mapOf(*pairs))
}
