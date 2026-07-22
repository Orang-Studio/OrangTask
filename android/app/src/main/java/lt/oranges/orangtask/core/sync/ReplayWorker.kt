package lt.oranges.orangtask.core.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/** replays the offline queue once connectivity returns */
@HiltWorker
class ReplayWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val queue: OfflineQueue,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result =
        if (runCatching { queue.replayAll() }.getOrDefault(false)) Result.success()
        else Result.retry()
}
