package lt.oranges.orangtask.ui.theme

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

enum class ThemeMode { SYSTEM, LIGHT, DARK }

@Singleton
class ThemePrefs @Inject constructor(@ApplicationContext context: Context) {
    private val prefs = context.getSharedPreferences("theme", Context.MODE_PRIVATE)

    var mode: ThemeMode by mutableStateOf(
        runCatching { ThemeMode.valueOf(prefs.getString("mode", ThemeMode.DARK.name)!!) }
            .getOrDefault(ThemeMode.DARK)
    )

        @JvmName("setModeState") private set

    fun setMode(value: ThemeMode) {
        mode = value
        prefs.edit().putString("mode", value.name).apply()
    }
}
