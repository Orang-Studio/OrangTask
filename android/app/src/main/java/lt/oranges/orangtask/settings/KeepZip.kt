package lt.oranges.orangtask.settings

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.InputStream
import java.util.zip.ZipInputStream

/** reads a Google Takeout zip and pulls out the Keep note JSON objects, exactly like the web */
object KeepZip {

    private val json = Json { ignoreUnknownKeys = true }

    /** same duck-typing the web uses to tell notes from other Takeout JSON */
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
                // ZipInputStream must stay open across entries read, dont close
                val text = zip.readBytes().toString(Charsets.UTF_8)
                val obj = runCatching { json.parseToJsonElement(text) }.getOrNull() as? JsonObject
                    ?: continue
                if (isKeepNote(obj)) notes.add(obj)
            }
        }
        return notes
    }
}
