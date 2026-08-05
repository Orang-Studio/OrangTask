package lt.oranges.orangtask.settings

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.InputStream
import java.util.zip.ZipInputStream

object KeepZip {

    private val json = Json { ignoreUnknownKeys = true }

    private fun isKeepNote(o: JsonObject): Boolean {
        fun field(name: String) = o[name]
        return field("textContent") is JsonPrimitive ||
            field("listContent") is JsonArray ||
            field("title") is JsonPrimitive ||
            (field("userEditedTimestampUsec") as? JsonPrimitive)?.isString == false
    }

    fun parse(stream: InputStream): List<JsonObject> {
        val notes = mutableListOf<JsonObject>()
        ZipInputStream(stream.buffered()).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                if (entry.isDirectory || !entry.name.lowercase().endsWith(".json")) continue

                val text = zip.readBytes().toString(Charsets.UTF_8)
                val obj = runCatching { json.parseToJsonElement(text) }.getOrNull() as? JsonObject
                    ?: continue
                if (isKeepNote(obj)) notes.add(obj)
            }
        }
        return notes
    }
}
