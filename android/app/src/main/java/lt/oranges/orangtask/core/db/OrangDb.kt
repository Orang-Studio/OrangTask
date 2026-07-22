package lt.oranges.orangtask.core.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

class Converters {
    @TypeConverter
    fun listToJson(value: List<String>): String =
        Json.encodeToString(ListSerializer(String.serializer()), value)

    @TypeConverter
    fun jsonToList(value: String): List<String> =
        runCatching { Json.decodeFromString(ListSerializer(String.serializer()), value) }
            .getOrDefault(emptyList())
}

@Database(
    entities = [TaskEntity::class, ListEntity::class, TagEntity::class, PendingOpEntity::class],
    version = 2,
    exportSchema = false,
)
@TypeConverters(Converters::class)
abstract class OrangDb : RoomDatabase() {
    abstract fun taskDao(): TaskDao
    abstract fun listDao(): ListDao
    abstract fun tagDao(): TagDao
    abstract fun pendingOpDao(): PendingOpDao
}
