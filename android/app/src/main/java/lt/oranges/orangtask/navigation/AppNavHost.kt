package lt.oranges.orangtask.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import lt.oranges.orangtask.auth.LoginScreen
import lt.oranges.orangtask.auth.PinScreen
import lt.oranges.orangtask.auth.SessionState
import lt.oranges.orangtask.auth.SessionViewModel
import lt.oranges.orangtask.home.MainScaffold

@Composable
fun AppNavHost(
    sessionState: SessionState,
    sessionViewModel: SessionViewModel,
) {
    when (sessionState) {
        SessionState.Loading -> {

            Surface(color = MaterialTheme.colorScheme.background) {
                Box(Modifier.fillMaxSize())
            }
        }

        SessionState.LoggedOut -> LoginScreen(
            onAuthenticated = { sessionViewModel.refresh() },
        )

        SessionState.RequiresPin -> PinScreen(
            onUnlocked = { sessionViewModel.refresh() },
            onSignOut = { sessionViewModel.logout() },
        )

        is SessionState.Active -> MainScaffold(
            user = sessionState.user,
            onLogout = { sessionViewModel.logout() },

            onUserChanged = { sessionViewModel.refresh() },
        )
    }
}
