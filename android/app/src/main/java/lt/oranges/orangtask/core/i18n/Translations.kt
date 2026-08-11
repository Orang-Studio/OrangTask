package lt.oranges.orangtask.core.i18n

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

@Composable
fun tr(@StringRes id: Int, vararg args: Any): String {
    val context = LocalContext.current
    val update by RemoteI18n.updates.collectAsState()
    return remember(context, id, update, args.contentDeepHashCode()) {
        AppStrings.get(context, id, *args)
    }
}
