package lt.oranges.orangtask.notifications

import android.content.Context
import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.network.NotificationDto
import lt.oranges.orangtask.settings.SettingsRepository
import javax.inject.Inject

/** the bell (on any tab) and the notifications screen (its own route) live on different back-stack */
@Composable
fun sharedNotificationsViewModel(): NotificationsViewModel {
    var context: Context = LocalContext.current
    while (context is ContextWrapper) {
        if (context is ComponentActivity) return hiltViewModel(context)
        context = context.baseContext
    }
    error("NotificationsViewModel requires a ComponentActivity host")
}

/** NotificationsPage.tsx + the bell badge */
@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val repo: SettingsRepository,
) : ViewModel() {

    private val cache = MutableStateFlow<List<NotificationDto>>(emptyList())

    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading

    /** the cached list, kept fresh by a 60s poll while anyone is subscribed */
    val items: StateFlow<List<NotificationDto>> = channelFlow {
        launch {
            while (true) {
                runCatching { repo.notifications() }.onSuccess {
                    cache.value = it
                    _loading.value = false
                }
                delay(60_000)
            }
        }
        cache.collect { send(it) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** derived from [items], so collecting the badge also drives the poll */
    val unreadCount: StateFlow<Int> = items
        .map { list -> list.count { !it.read } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    fun markRead(id: String) {
        cache.value = cache.value.map { if (it.id == id) it.copy(read = true) else it }
        viewModelScope.launch { runCatching { repo.markNotificationRead(id) } }
    }

    fun markAllRead() {
        cache.value = cache.value.map { it.copy(read = true) }
        viewModelScope.launch { runCatching { repo.markAllNotificationsRead() } }
    }
}
