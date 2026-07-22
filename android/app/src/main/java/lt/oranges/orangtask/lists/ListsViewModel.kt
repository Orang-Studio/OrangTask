package lt.oranges.orangtask.lists

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.db.ListEntity
import javax.inject.Inject

@HiltViewModel
class ListsViewModel @Inject constructor(
    private val listRepository: ListRepository,
) : ViewModel() {

    val lists: StateFlow<List<ListEntity>> = listRepository.lists
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** creates the list, then jumps straight into it (like the web) */
    fun createList(name: String, onCreated: (String) -> Unit) {
        viewModelScope.launch {
            runCatching { listRepository.createList(name) }
                .onSuccess { onCreated(it.id) }
        }
    }
}
