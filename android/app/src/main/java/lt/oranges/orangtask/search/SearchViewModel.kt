package lt.oranges.orangtask.search

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.transformLatest
import kotlinx.serialization.json.Json
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.network.ApiErrorBody
import lt.oranges.orangtask.core.network.OrangApi
import lt.oranges.orangtask.core.network.SearchResultDto
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject

private val searchErrorJson = Json { ignoreUnknownKeys = true }

private fun Throwable.localizedErrorMessage(context: Context): String = when (this) {
    is HttpException -> runCatching {
        response()?.errorBody()?.string()
            ?.let { searchErrorJson.decodeFromString(ApiErrorBody.serializer(), it).error }
            ?.takeIf { it.isNotBlank() }
    }.getOrNull() ?: context.getString(R.string.request_failed, code())
    is IOException -> context.getString(R.string.network_error)
    else -> context.getString(R.string.something_went_wrong)
}

sealed interface SearchUiState {

    data object Idle : SearchUiState
    data object Searching : SearchUiState
    data class Results(val query: String, val results: List<SearchResultDto>) : SearchUiState
    data class Error(val message: String) : SearchUiState
}

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class SearchViewModel @Inject constructor(
    private val api: OrangApi,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    fun onQueryChange(value: String) {
        _query.value = value
    }

    val state: StateFlow<SearchUiState> = _query
        .map { it.trim() }
        .distinctUntilChanged()
        .transformLatest<String, SearchUiState> { q ->
            if (q.length < 2) {
                emit(SearchUiState.Idle)
                return@transformLatest
            }
            emit(SearchUiState.Searching)
            delay(250)
            emit(
                runCatching<SearchUiState> { SearchUiState.Results(q, api.search(q).results) }
                    .getOrElse { SearchUiState.Error(it.localizedErrorMessage(context)) }
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SearchUiState.Idle)
}
