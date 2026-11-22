package lt.oranges.orangtask.tasks

import android.content.Context
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.db.TaskEntity
import lt.oranges.orangtask.core.i18n.AppStrings
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

data class TaskDeletionNotice(
    val taskId: String,
    val title: String,
)

// keeps deletes pending until the app wide snackbar has either timed out or been undone
@Singleton
class UndoableTaskDeleteCoordinator @Inject constructor(
    private val taskRepository: TaskRepository,
    @ApplicationContext private val context: Context,
) {
    private val stagedIds = ConcurrentHashMap.newKeySet<String>()
    private val noticeChannel = Channel<TaskDeletionNotice>(Channel.UNLIMITED)
    private val errorChannel = Channel<String>(Channel.UNLIMITED)
    private val _pendingIds = MutableStateFlow<Set<String>>(emptySet())

    val pendingIds: StateFlow<Set<String>> = _pendingIds.asStateFlow()
    val notices: Flow<TaskDeletionNotice> = noticeChannel.receiveAsFlow()
    val errors: Flow<String> = errorChannel.receiveAsFlow()

    fun stage(task: TaskEntity) {
        if (!stagedIds.add(task.id)) return
        _pendingIds.update { it + task.id }
        noticeChannel.trySend(TaskDeletionNotice(task.id, task.title))
    }

    suspend fun undo(taskId: String) {
        release(taskId)
    }

    suspend fun commit(taskId: String) {
        if (taskId !in stagedIds) return
        try {
            taskRepository.deleteTask(taskId)
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (_: Exception) {
            errorChannel.send(AppStrings.get(context, R.string.could_not_delete_task))
        } finally {
            release(taskId)
        }
    }

    private fun release(taskId: String): Boolean {
        if (!stagedIds.remove(taskId)) return false
        _pendingIds.update { it - taskId }
        return true
    }
}

@HiltViewModel
class UndoableTaskDeleteViewModel @Inject constructor(
    private val coordinator: UndoableTaskDeleteCoordinator,
) : ViewModel() {
    val notices: Flow<TaskDeletionNotice> = coordinator.notices
    val errors: Flow<String> = coordinator.errors

    suspend fun undo(taskId: String) = coordinator.undo(taskId)
    suspend fun commit(taskId: String) = coordinator.commit(taskId)
}
