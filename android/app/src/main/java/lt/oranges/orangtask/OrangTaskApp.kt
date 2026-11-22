package lt.oranges.orangtask

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import androidx.glance.appwidget.updateAll
import dagger.hilt.android.EntryPointAccessors
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import lt.oranges.orangtask.widget.TodayWidget
import lt.oranges.orangtask.widget.WidgetEntryPoint
import lt.oranges.orangtask.widget.todayWidgetTasks
import lt.oranges.orangtask.core.i18n.RemoteI18n

@HiltAndroidApp
class OrangTaskApp : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory

    override fun onCreate() {
        super.onCreate()
        RemoteI18n.init(applicationContext)
        RemoteI18n.start()
        // redraw the home screen widget whenever its tasks change in Room
        appScope.launch {
            todayWidgetTasks(EntryPointAccessors.fromApplication(this@OrangTaskApp, WidgetEntryPoint::class.java).taskRepository())
                .drop(1)
                .collect { runCatching { TodayWidget().updateAll(this@OrangTaskApp) } }
        }
    }

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setWorkerFactory(workerFactory).build()
}
