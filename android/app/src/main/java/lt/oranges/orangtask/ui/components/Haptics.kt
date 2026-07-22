package lt.oranges.orangtask.ui.components

import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalView

/** native counterpart of the web apps useHaptics (swipe/PIN feedback) */
class Haptics(private val view: View) {
    fun tap() = view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)

    fun success() {
        if (Build.VERSION.SDK_INT >= 30) {
            view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
        } else {
            view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
        }
    }

    fun error() {
        if (Build.VERSION.SDK_INT >= 30) {
            view.performHapticFeedback(HapticFeedbackConstants.REJECT)
        } else {
            view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        }
    }
}

@Composable
fun rememberHaptics(): Haptics {
    val view = LocalView.current
    return remember(view) { Haptics(view) }
}
