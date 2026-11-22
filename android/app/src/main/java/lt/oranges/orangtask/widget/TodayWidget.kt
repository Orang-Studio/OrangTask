package lt.oranges.orangtask.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.CheckBox
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import lt.oranges.orangtask.MainActivity
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.db.TaskEntity
import lt.oranges.orangtask.core.i18n.AppStrings
import lt.oranges.orangtask.tasks.TaskRepository
import lt.oranges.orangtask.ui.format.DAY_MILLIS
import lt.oranges.orangtask.ui.format.dayStartMillis

@EntryPoint
@InstallIn(SingletonComponent::class)
interface WidgetEntryPoint {
    fun taskRepository(): TaskRepository
}

private fun repo(context: Context) =
    EntryPointAccessors.fromApplication(context, WidgetEntryPoint::class.java).taskRepository()

fun todayWidgetTasks(repo: TaskRepository): Flow<List<TaskEntity>> {
    val dayStart = dayStartMillis()
    return combine(repo.observeOverdue(dayStart), repo.observeToday(dayStart, dayStart + DAY_MILLIS - 1)) { overdue, today ->
        (overdue + today).distinctBy { it.id }
    }.distinctUntilChanged()
}

private val TaskIdKey = ActionParameters.Key<String>("taskId")
private val Orange = Color(0xFFF97316)

class TodayWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val flow = todayWidgetTasks(repo(context))
        val title = AppStrings.get(context, R.string.today)
        val empty = AppStrings.get(context, R.string.nothing_due_today)
        provideContent {
            val tasks by remember { flow }.collectAsState(initial = emptyList())
            Content(title, empty, tasks)
        }
    }

    @Composable
    private fun Content(title: String, empty: String, tasks: List<TaskEntity>) {
        val text = ColorProvider(day = Color(0xFF111827), night = Color(0xFFF3F4F6))
        val muted = ColorProvider(day = Color(0xFF6B7280), night = Color(0xFF9CA3AF))
        val openApp = actionStartActivity<MainActivity>()
        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .cornerRadius(16.dp)
                .background(ColorProvider(day = Color.White, night = Color(0xFF141414)))
                .padding(12.dp),
        ) {
            Text(
                title.uppercase(),
                style = TextStyle(color = ColorProvider(Orange, Orange), fontSize = 13.sp, fontWeight = FontWeight.Bold),
                modifier = GlanceModifier.fillMaxWidth().padding(bottom = 6.dp).clickable(openApp),
            )
            if (tasks.isEmpty()) {
                Text(
                    empty,
                    style = TextStyle(color = muted, fontSize = 13.sp),
                    modifier = GlanceModifier.fillMaxSize().clickable(openApp),
                )
            } else {
                LazyColumn {
                    items(tasks, itemId = { it.id.hashCode().toLong() }) { task ->
                        CheckBox(
                            checked = false,
                            onCheckedChange = actionRunCallback<CompleteTask>(actionParametersOf(TaskIdKey to task.id)),
                            text = task.title,
                            style = TextStyle(color = text, fontSize = 14.sp),
                            maxLines = 1,
                            modifier = GlanceModifier.fillMaxWidth(),
                        )
                    }
                }
            }
        }
    }
}

class CompleteTask : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val id = parameters[TaskIdKey] ?: return
        runCatching { repo(context).setCompleted(id, true) }
        TodayWidget().updateAll(context)
    }
}

class TodayWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TodayWidget()
}
