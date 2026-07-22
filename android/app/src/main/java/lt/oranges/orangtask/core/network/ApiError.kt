package lt.oranges.orangtask.core.network

import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException

private val errorJson = Json { ignoreUnknownKeys = true }

/** human-readable message: prefers the backends `{ "error": "..." }` body */
fun Throwable.userMessage(): String = when (this) {
    is HttpException -> {
        val serverError = runCatching {
            response()?.errorBody()?.string()
                ?.let { errorJson.decodeFromString(ApiErrorBody.serializer(), it).error }
        }.getOrNull()
        serverError ?: "Request failed (${code()})"
    }
    is IOException -> "Network error, check your connection"
    else -> message ?: "Something went wrong"
}
