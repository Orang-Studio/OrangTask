package lt.oranges.orangtask.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
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
import lt.oranges.orangtask.core.network.OrangApi
import lt.oranges.orangtask.core.network.SearchResultDto
import lt.oranges.orangtask.core.network.userMessage
import javax.inject.Inject

sealed interface SearchUiState {
    /** fewer than 2 characters the server would return nothing anyway */
    data object Idle : SearchUiState
    data object Searching : SearchUiState
    data class Results(val query: String, val results: List<SearchResultDto>) : SearchUiState
    data class Error(val message: String) : SearchUiState
}

/** CommandPalette.tsx as a screen: debounce typing pauses (250ms, like the web), then hit GET */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class SearchViewModel @Inject constructor(
    private val api: OrangApi,
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
                    .getOrElse { SearchUiState.Error(it.userMessage()) }
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SearchUiState.Idle)
}
