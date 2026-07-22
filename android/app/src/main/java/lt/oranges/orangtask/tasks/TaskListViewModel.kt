package lt.oranges.orangtask.tasks

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import lt.oranges.orangtask.auth.AuthRepository
import lt.oranges.orangtask.core.db.ListEntity
import lt.oranges.orangtask.core.db.TagEntity
import lt.oranges.orangtask.core.db.TaskEntity
import lt.oranges.orangtask.core.network.MemberDto
import lt.oranges.orangtask.core.network.userMessage
import lt.oranges.orangtask.lists.ListRepository
import lt.oranges.orangtask.ui.format.DAY_MILLIS
import lt.oranges.orangtask.ui.format.dayStartMillis
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

/** one view model for every task surface the smart views */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class TaskListViewModel @Inject constructor(
    savedState: SavedStateHandle,
    private val taskRepository: TaskRepository,
    private val listRepository: ListRepository,
    authRepository: AuthRepository,
) : ViewModel() {

    val listId: String? = savedState["listId"]
    val kind: String = savedState["kind"] ?: if (listId != null) "list" else "today"

    /** set when a search result deep-links straight into a task ("?task=…") */
    private val initialTaskId: String? = savedState["task"]

    val myUserId: String = authRepository.cachedUser()?.id ?: ""

    /** skeleton until the first server sync for this screen settles */
    var initialLoading by mutableStateOf(true)
        private set

    val errors = MutableSharedFlow<String>(extraBufferCapacity = 4)

    val tasks: StateFlow<List<TaskEntity>> = taskFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** present only on the list route: header title, role, menu state */
    val list: StateFlow<ListEntity?> = (listId?.let { listRepository.observeList(it) } ?: flowOf(null))
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** quick-add on smart views files into the first list, like the web quickAdd() reads `lists.value` */
    val lists: StateFlow<List<ListEntity>> = listRepository.lists
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val tags: StateFlow<List<TagEntity>> = listRepository.tags
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val selectedId = MutableStateFlow<String?>(null)

    val selectedTask: StateFlow<TaskEntity?> = selectedId
        .flatMapLatest { id -> if (id == null) flowOf(null) else taskRepository.observeById(id) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val subtasks: StateFlow<List<TaskEntity>> = selectedId
        .flatMapLatest { id -> if (id == null) flowOf(emptyList()) else taskRepository.observeSubtasks(id) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    var members by mutableStateOf<List<MemberDto>>(emptyList())
        private set

    init {
        viewModelScope.launch {
            mutate {
                if (listId != null) taskRepository.refreshListTasks(listId)
                else taskRepository.refreshAllTasks()
            }
            initialLoading = false
        }
        if (initialTaskId != null && listId != null) {
            selectedId.value = initialTaskId
            viewModelScope.launch {
                runCatching { taskRepository.refreshSubtasks(listId, initialTaskId) }
                runCatching { members = listRepository.members(listId) }
            }
        }
    }

    private fun taskFlow(): Flow<List<TaskEntity>> {
        if (listId != null) return taskRepository.observeForList(listId)
        val dayStart = dayStartMillis()
        return when (kind) {
            "today" -> taskRepository.observeToday(dayStart, dayStart + DAY_MILLIS - 1)
            "upcoming" -> taskRepository.observeWeek(dayStart, dayStart + 8 * DAY_MILLIS - 1)
            "overdue" -> taskRepository.observeOverdue(dayStart)
            "assigned" -> taskRepository.observeAssigned(myUserId)
            else -> taskRepository.observeAll().map { it }
        }
    }

    fun openTask(task: TaskEntity) {
        selectedId.value = task.id
        members = emptyList()
        viewModelScope.launch {
            runCatching { taskRepository.refreshSubtasks(task.listId, task.id) }
            runCatching { members = listRepository.members(task.listId) }
        }
    }

    fun closeTask() {
        selectedId.value = null
    }

    // ---- Mutations (optimistic in the repository; errors surface here) ----

    fun quickAdd(title: String) {
        if (title.isBlank()) return
        // "report friday 5pm high priority" title/date/priority/RRULE
        val parsed = parseQuickAdd(title.trim())
        if (parsed.title.isBlank()) return
        val targetList = listId ?: lists.value.firstOrNull()?.id
        if (targetList == null) {
            errors.tryEmit("Create a list first")
            return
        }
        // the Today view defaults undated tasks to tonight, like the web
        val due = parsed.dueAt ?: if (kind == "today") {
            LocalDate.now().atTime(23, 59).atZone(ZoneId.systemDefault()).toInstant()
        } else null
        viewModelScope.launch {
            mutate {
                taskRepository.createTask(
                    listId = targetList,
                    title = parsed.title,
                    dueDate = due,
                    priority = parsed.priority.takeIf { it != "none" },
                    recurrenceRule = parsed.recurrenceRule,
                )
            }
        }
    }

    fun toggleComplete(task: TaskEntity) = launchMutation {
        taskRepository.setCompleted(task.id, !task.done)
    }

    fun deleteTask(task: TaskEntity) = launchMutation {
        if (selectedId.value == task.id) selectedId.value = null
        taskRepository.deleteTask(task.id)
    }

    fun setTitle(id: String, title: String) = launchMutation {
        if (title.isNotBlank()) taskRepository.setTitle(id, title.trim())
    }

    fun setNotes(id: String, notes: String) = launchMutation { taskRepository.setNotes(id, notes) }

    fun setPriority(id: String, priority: String) = launchMutation { taskRepository.setPriority(id, priority) }

    fun setDueDate(id: String, due: Instant?) = launchMutation { taskRepository.setDueDate(id, due) }

    fun setRecurrence(id: String, rule: String) = launchMutation {
        taskRepository.setRecurrence(id, rule.trim().ifEmpty { null })
    }

    fun setAssignee(id: String, member: MemberDto?) = launchMutation {
        taskRepository.setAssignee(id, member?.id, member?.name, member?.avatarUrl)
    }

    fun addSubtask(parent: TaskEntity, title: String) = launchMutation {
        if (title.isNotBlank()) {
            taskRepository.createTask(listId = parent.listId, title = title.trim(), parentId = parent.id)
        }
    }

    fun addTag(taskId: String, tag: TagEntity) = launchMutation { taskRepository.addTag(taskId, tag) }

    fun removeTag(taskId: String, tag: TagEntity) = launchMutation { taskRepository.removeTag(taskId, tag) }

    fun createAndAddTag(taskId: String, name: String) = launchMutation {
        if (name.isNotBlank()) taskRepository.addTag(taskId, listRepository.createTag(name.trim()))
    }

    // ---- Sharing (list route only, ShareModal.tsx) ----

    /** loads members when the share sheet opens (theyre not cached) */
    fun loadMembers() {
        val id = listId ?: return
        viewModelScope.launch {
            runCatching { members = listRepository.members(id) }
        }
    }

    fun inviteMember(email: String, role: String) = launchMutation {
        listId?.let { members = listRepository.inviteMember(it, email, role) }
    }

    fun setMemberRole(userId: String, role: String) = launchMutation {
        listId?.let { members = listRepository.updateMemberRole(it, userId, role) }
    }

    fun removeMember(userId: String) = launchMutation {
        listId?.let { members = listRepository.removeMember(it, userId) }
    }

    fun leaveList(onLeft: () -> Unit) {
        val id = listId ?: return
        viewModelScope.launch {
            mutate {
                listRepository.leaveList(id, myUserId)
                onLeft()
            }
        }
    }

    fun renameList(name: String) = launchMutation {
        listId?.let { if (name.isNotBlank()) listRepository.renameList(it, name.trim()) }
    }

    fun setListColor(color: String) = launchMutation { listId?.let { listRepository.setListColor(it, color) } }

    fun setListIcon(icon: String) = launchMutation { listId?.let { listRepository.setListIcon(it, icon) } }

    fun deleteList(onDeleted: () -> Unit) {
        val id = listId ?: return
        viewModelScope.launch {
            mutate { listRepository.deleteList(id) }
            onDeleted()
        }
    }

    private fun launchMutation(block: suspend () -> Unit) {
        viewModelScope.launch { mutate(block) }
    }

    private suspend fun mutate(block: suspend () -> Unit) {
        try {
            block()
        } catch (e: Exception) {
            errors.tryEmit(e.userMessage())
        }
    }
}
