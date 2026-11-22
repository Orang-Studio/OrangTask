package lt.oranges.orangtask.scratchpads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.db.ScratchpadEntity
import javax.inject.Inject

data class ScratchpadDraft(val id: String, val title: String, val content: String)

@OptIn(FlowPreview::class)
@HiltViewModel
class ScratchpadsViewModel @Inject constructor(
    private val scratchpadRepository: ScratchpadRepository,
) : ViewModel() {

    val scratchpads: StateFlow<List<ScratchpadEntity>> = scratchpadRepository.scratchpads
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    private val pendingDraft = MutableStateFlow<ScratchpadDraft?>(null)

    init {
        viewModelScope.launch {
            pendingDraft.debounce(600).filterNotNull().collect { save(it) }
        }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _loading.value = true
            runCatching { scratchpadRepository.refreshScratchpads() }
            _loading.value = false
        }
    }

    fun onDraftChanged(id: String, title: String, content: String) {
        if (id.isEmpty()) return
        pendingDraft.value = ScratchpadDraft(id, title, content)
    }

    fun flushDraft() {
        val draft = pendingDraft.value ?: return
        pendingDraft.value = null
        viewModelScope.launch { save(draft) }
    }

    fun createScratchpad(onCreated: (String) -> Unit) {
        viewModelScope.launch {
            runCatching { scratchpadRepository.createScratchpad() }
                .onSuccess { onCreated(it.id) }
        }
    }

    fun deleteScratchpad(id: String) {
        if (pendingDraft.value?.id == id) pendingDraft.value = null
        viewModelScope.launch { runCatching { scratchpadRepository.deleteScratchpad(id) } }
    }

    private suspend fun save(draft: ScratchpadDraft) {
        val current = scratchpads.value.find { it.id == draft.id } ?: return
        if (draft.title == current.title && draft.content == current.content) return
        runCatching { scratchpadRepository.setDraft(draft.id, draft.title, draft.content) }
    }
}
