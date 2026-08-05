package lt.oranges.orangtask

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalView
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.activity.viewModels
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import lt.oranges.orangtask.auth.CaptchaCallback
import lt.oranges.orangtask.auth.CaptchaTokenStore
import lt.oranges.orangtask.auth.SessionState
import lt.oranges.orangtask.auth.SessionViewModel
import lt.oranges.orangtask.navigation.AppNavHost
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.theme.OrangTaskTheme
import lt.oranges.orangtask.ui.theme.ThemePrefs

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val sessionViewModel: SessionViewModel by viewModels()

    @Inject
    lateinit var captchaTokenStore: CaptchaTokenStore

    @Inject
    lateinit var themePrefs: ThemePrefs

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        splash.setKeepOnScreenCondition {
            sessionViewModel.state.value is SessionState.Loading
        }

        setContent {
            OrangTaskTheme(mode = themePrefs.mode) {

                val dark = isDarkTheme()
                val view = LocalView.current
                SideEffect {
                    val controller = WindowCompat.getInsetsController(window, view)
                    controller.isAppearanceLightStatusBars = !dark
                    controller.isAppearanceLightNavigationBars = !dark
                }
                val state by sessionViewModel.state.collectAsStateWithLifecycle()
                AppNavHost(sessionState = state, sessionViewModel = sessionViewModel)
            }
        }

        handleDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        when {
            data.scheme == "orangtask" && data.host == "auth-callback" -> handleOAuthCallback(data)
            data.scheme == "orangtask" && data.host == "recaptcha" -> {
                CaptchaCallback.tokenFrom(data.toString())?.let(captchaTokenStore::set)
            }
            data.scheme == "https" && data.host == "task.oranges.lt" -> handleAppLink(data)
        }
    }

    private fun handleOAuthCallback(data: Uri) {
        val access = data.getQueryParameter("access")
        val refresh = data.getQueryParameter("refresh")
        val error = data.getQueryParameter("error")
        when {
            access != null && refresh != null -> sessionViewModel.onOAuthTokens(access, refresh)
            error != null -> Toast.makeText(this, oauthErrorMessage(error), Toast.LENGTH_LONG).show()
        }
    }

    private fun handleAppLink(data: Uri) {
        when {
            data.path?.startsWith("/auth/magic") == true -> {
                sessionViewModel.onMagicLink(data.toString()) { message ->
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                }
            }
            data.path == "/login" && data.getQueryParameter("verification") == "success" -> {
                Toast.makeText(this, "Email verified. Sign in to continue.", Toast.LENGTH_LONG).show()
            }
            data.path == "/login" && data.getQueryParameter("verification") == "invalid" -> {
                Toast.makeText(this, "That verification link is invalid or expired.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun oauthErrorMessage(code: String): String = when (code) {
        "no_email" -> "That account has no verified email to sign in with."
        "link_in_use" -> "That provider is already linked to another account."
        "state" -> "Sign-in expired or was interrupted. Please try again."
        else -> "Couldn't sign in with that provider. Please try again."
    }
}
