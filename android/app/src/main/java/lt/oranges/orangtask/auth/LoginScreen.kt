package lt.oranges.orangtask.auth

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lt.oranges.orangtask.BuildConfig
import lt.oranges.orangtask.R
import lt.oranges.orangtask.ui.components.BrandButton
import lt.oranges.orangtask.ui.components.ErrorBanner
import lt.oranges.orangtask.ui.components.FieldLabel
import lt.oranges.orangtask.ui.components.Logo
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.SurfaceCard
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.theme.Gray400
import lt.oranges.orangtask.ui.theme.Ink900

@Composable
fun LoginScreen(
    onAuthenticated: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    viewModel.onAuthenticated = onAuthenticated

    val context = LocalContext.current
    // opens the providers consent page in a Chrome Custom Tab; the backend redirects back to
    val onOAuth: (String) -> Unit = { provider ->
        val url = "${BuildConfig.API_BASE_URL.trimEnd('/')}/api/auth/$provider?platform=android"
        CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
    }

    val background = if (isDarkTheme()) Ink900 else MaterialTheme.colorScheme.background

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(background)
            .imePadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .widthIn(max = 400.dp)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            // brand
            Logo(56.dp)
            Text(
                "ORANGTASK",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(top = 16.dp),
            )
            Text(
                "Tasks that sync everywhere",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp, bottom = 32.dp),
            )

            SurfaceCard(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(24.dp)) {
                    state.error?.let {
                        ErrorBanner(it, Modifier.padding(bottom = 16.dp))
                    }

                    if (state.magicSent) {
                        MagicSentContent(state, viewModel)
                    } else {
                        when (state.mode) {
                            LoginMode.MAGIC -> MagicForm(state, viewModel)
                            LoginMode.PASSWORD, LoginMode.REGISTER -> PasswordForm(state, viewModel)
                            LoginMode.RESET -> ResetForm(state, viewModel)
                        }
                        if (state.mode != LoginMode.RESET &&
                            (state.providers.github || state.providers.google)
                        ) {
                            OAuthSection(state, onOAuth)
                        }
                        ModeToggles(state, viewModel)
                    }
                }
            }

            Text(
                "Free and open source. Self-host it yourself.",
                fontSize = 12.sp,
                color = Gray400,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 24.dp),
            )
        }
    }
}

@Composable
private fun MagicForm(state: LoginUiState, vm: LoginViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FieldLabel("Email")
        OrangTextField(
            value = state.email,
            onValueChange = vm::setEmail,
            placeholder = "you@example.com",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        )
        BrandButton(
            text = if (state.loading) "Sending..." else "Send magic link",
            onClick = vm::sendMagic,
            enabled = !state.loading,
            icon = Icons.Outlined.MailOutline,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun MagicSentContent(state: LoginUiState, vm: LoginViewModel) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .padding(top = 8.dp)
                .size(48.dp)
                .background(MaterialTheme.colorScheme.primary),
        ) {
            Icon(Icons.Default.Check, contentDescription = null, tint = Color.White)
        }
        Text(
            "Check your email",
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "We sent a sign-in link to ${state.email}",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )

        // native flow: opening the link lands in the browser, so let the user finish here by pasting the link
        Spacer(Modifier.height(20.dp))
        FieldLabel("Paste the sign-in link", Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OrangTextField(
            value = state.pastedLink,
            onValueChange = vm::setPastedLink,
            placeholder = "https://…/auth/magic?token=…",
        )
        Spacer(Modifier.height(12.dp))
        BrandButton(
            text = if (state.loading) "Signing in..." else "Sign in",
            onClick = vm::completeMagicLink,
            enabled = !state.loading,
            modifier = Modifier.fillMaxWidth(),
        )

        TextButton(onClick = vm::useDifferentEmail, modifier = Modifier.padding(top = 8.dp)) {
            Text("Use a different email", fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun PasswordForm(state: LoginUiState, vm: LoginViewModel) {
    val register = state.mode == LoginMode.REGISTER
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (register) {
            FieldLabel("Name")
            OrangTextField(value = state.name, onValueChange = vm::setName, placeholder = "Your name")
        }
        FieldLabel("Email")
        OrangTextField(
            value = state.email,
            onValueChange = vm::setEmail,
            placeholder = "you@example.com",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        )
        FieldLabel("Password")
        OrangTextField(
            value = state.password,
            onValueChange = vm::setPassword,
            placeholder = "••••••••",
            isPassword = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        )
        BrandButton(
            text = when {
                state.loading -> "Please wait..."
                register -> "Create account"
                else -> "Sign in"
            },
            onClick = vm::submitPassword,
            enabled = !state.loading,
            icon = Icons.Outlined.Lock,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun ResetForm(state: LoginUiState, vm: LoginViewModel) {
    val requesting = state.resetStep == ResetStep.REQUEST
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            if (requesting) {
                "Enter your email and we’ll send you a 6-digit code to reset your password."
            } else {
                "Enter the code we sent to ${state.email} and choose a new password."
            },
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        FieldLabel("Email")
        OrangTextField(
            value = state.email,
            onValueChange = vm::setEmail,
            placeholder = "you@example.com",
            enabled = requesting,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        )
        if (requesting) {
            BrandButton(
                text = if (state.loading) "Sending..." else "Send reset code",
                onClick = vm::requestReset,
                enabled = !state.loading,
                icon = Icons.Outlined.Key,
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            FieldLabel("Reset code")
            OrangTextField(
                value = state.resetCode,
                onValueChange = vm::setResetCode,
                placeholder = "123456",
                centered = true,
                textStyle = androidx.compose.ui.text.TextStyle(letterSpacing = 8.sp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            )
            FieldLabel("New password")
            OrangTextField(
                value = state.password,
                onValueChange = vm::setPassword,
                placeholder = "At least 8 characters",
                isPassword = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            )
            BrandButton(
                text = if (state.loading) "Please wait..." else "Reset password & sign in",
                onClick = vm::submitReset,
                enabled = !state.loading,
                icon = Icons.Outlined.Lock,
                modifier = Modifier.fillMaxWidth(),
            )
            TextButton(onClick = vm::requestReset, enabled = !state.loading, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text("Resend code", fontSize = 12.sp, color = Gray400)
            }
        }
    }
}

@Composable
private fun OAuthSection(state: LoginUiState, onOAuth: (String) -> Unit) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(top = 20.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            HorizontalDivider(modifier = Modifier.weight(1f))
            Text("OR", fontSize = 12.sp, color = muted)
            HorizontalDivider(modifier = Modifier.weight(1f))
        }
        if (state.providers.github) {
            BrandButton(
                text = "Continue with GitHub",
                secondary = true,
                onClick = { onOAuth("github") },
                enabled = !state.loading,
                iconPainter = painterResource(R.drawable.ic_github),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (state.providers.google) {
            BrandButton(
                text = "Continue with Google",
                secondary = true,
                onClick = { onOAuth("google") },
                enabled = !state.loading,
                iconPainter = painterResource(R.drawable.ic_google),
                tintIcon = false,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun ModeToggles(state: LoginUiState, vm: LoginViewModel) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 20.dp),
    ) {
        when (state.mode) {
            LoginMode.MAGIC -> {
                TextButton(onClick = { vm.setMode(LoginMode.PASSWORD) }) {
                    Text("Use password instead", fontSize = 14.sp, color = muted)
                }
            }
            LoginMode.PASSWORD -> {
                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TextButton(onClick = { vm.setMode(LoginMode.MAGIC) }) {
                        Text("Magic link", fontSize = 14.sp, color = muted)
                    }
                    TextButton(onClick = { vm.setMode(LoginMode.REGISTER) }) {
                        Text("Create account →", fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
                    }
                }
                TextButton(onClick = { vm.setMode(LoginMode.RESET) }) {
                    Text("Forgot password?", fontSize = 14.sp, color = Gray400)
                }
            }
            LoginMode.REGISTER -> {
                TextButton(onClick = { vm.setMode(LoginMode.PASSWORD) }) {
                    Text("Already have an account? Sign in", fontSize = 14.sp, color = muted)
                }
            }
            LoginMode.RESET -> {
                TextButton(onClick = { vm.setMode(LoginMode.PASSWORD) }) {
                    Text("Back to sign in", fontSize = 14.sp, color = muted)
                }
            }
        }
    }
}
