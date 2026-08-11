package lt.oranges.orangtask

import android.content.Context
import androidx.activity.ComponentActivity
import lt.oranges.orangtask.core.i18n.LocalePreferences

abstract class LocalizedActivity : ComponentActivity() {
    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(LocalePreferences.localizedContext(newBase))
    }
}
