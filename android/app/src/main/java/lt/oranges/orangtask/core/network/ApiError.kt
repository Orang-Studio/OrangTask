package lt.oranges.orangtask.core.network

import android.content.Context
import kotlinx.serialization.json.Json
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.i18n.AppStrings
import retrofit2.HttpException
import java.io.IOException

private val errorJson = Json { ignoreUnknownKeys = true }

fun Throwable.userMessage(context: Context): String = when (this) {
    is HttpException -> {
        val serverError = runCatching {
            response()?.errorBody()?.string()
                ?.let { errorJson.decodeFromString(ApiErrorBody.serializer(), it).error }
        }.getOrNull()
        serverError ?: AppStrings.get(context, R.string.request_failed, code())
    }
    is IOException -> AppStrings.get(context, R.string.network_error)
    else -> message ?: AppStrings.get(context, R.string.something_went_wrong)
}
