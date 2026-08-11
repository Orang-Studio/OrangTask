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
import lt.oranges.orangtask.core.i18n.tr
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

    val onOAuth: (String) -> Unit = { provider ->
        val url = "${BuildConfig.API_BASE_URL.trimEnd('/')}/api/auth/$provider?platform=android"
        CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
    }

    val onCaptcha: () -> Unit = {
        val url = "${BuildConfig.API_BASE_URL.trimEnd('/')}/api/auth/recaptcha/mobile?return_to=orangtask%3A%2F%2Frecaptcha"
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
                tr(R.string.login_tagline),
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
                            LoginMode.PASSWORD, LoginMode.REGISTER -> PasswordForm(state, viewModel, onCaptcha)
                            LoginMode.RESET -> ResetForm(state, viewModel)
                            LoginMode.EMAIL_2FA -> EmailTwoFactorForm(state, viewModel)
                            LoginMode.VERIFY_EMAIL -> VerifyEmailContent(state, viewModel)
                        }
                        if (state.mode in setOf(LoginMode.MAGIC, LoginMode.PASSWORD, LoginMode.REGISTER) &&
                            (state.providers.github || state.providers.google)
                        ) {
                            OAuthSection(state, onOAuth)
                        }
                        ModeToggles(state, viewModel)
                    }
                }
            }

            Text(
                tr(R.string.login_footer),
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
        FieldLabel(tr(R.string.email_label))
        OrangTextField(
            value = state.email,
            onValueChange = vm::setEmail,
            placeholder = tr(R.string.email_placeholder),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        )
        BrandButton(
            text = if (state.loading) tr(R.string.sending) else tr(R.string.send_magic_link),
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
            tr(R.string.check_your_email),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            tr(R.string.sign_in_link_sent, state.email),
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )

        Spacer(Modifier.height(20.dp))
        FieldLabel(tr(R.string.sign_in_link_label), Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OrangTextField(
            value = state.pastedLink,
            onValueChange = vm::setPastedLink,
            placeholder = tr(R.string.magic_link_placeholder),
        )
        Spacer(Modifier.height(12.dp))
        BrandButton(
            text = if (state.loading) tr(R.string.signing_in) else tr(R.string.sign_in),
            onClick = vm::completeMagicLink,
            enabled = !state.loading,
            modifier = Modifier.fillMaxWidth(),
        )

        TextButton(onClick = vm::useDifferentEmail, modifier = Modifier.padding(top = 8.dp)) {
            Text(tr(R.string.use_different_email), fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun PasswordForm(state: LoginUiState, vm: LoginViewModel, onCaptcha: () -> Unit) {
    val register = state.mode == LoginMode.REGISTER
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (register) {
            FieldLabel(tr(R.string.name_label))
            OrangTextField(
                value = state.name,
                onValueChange = vm::setName,
                placeholder = tr(R.string.name_placeholder),
            )
        }
        FieldLabel(tr(R.string.email_label))
        OrangTextField(
            value = state.email,
            onValueChange = vm::setEmail,
            placeholder = tr(R.string.email_placeholder),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        )
        FieldLabel(tr(R.string.password_label))
        OrangTextField(
            value = state.password,
            onValueChange = vm::setPassword,
            placeholder = tr(R.string.password_placeholder),
            isPassword = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        )
        if (state.captchaRequired) {
            Text(
                if (state.captchaToken == null) {
                    tr(R.string.captcha_security_check_incomplete)
                } else {
                    tr(R.string.captcha_security_check_complete)
                },
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            BrandButton(
                text = if (state.captchaToken == null) {
                    tr(R.string.complete_security_check)
                } else {
                    tr(R.string.captcha_security_check_complete)
                },
                onClick = onCaptcha,
                enabled = !state.loading && state.captchaToken == null,
                icon = Icons.Default.Check,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        BrandButton(
            text = when {
                state.loading -> tr(R.string.please_wait)
                register -> tr(R.string.create_account)
                else -> tr(R.string.sign_in)
            },
            onClick = vm::submitPassword,
            enabled = !state.loading,
            icon = Icons.Outlined.Lock,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun EmailTwoFactorForm(state: LoginUiState, vm: LoginViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            tr(R.string.email_security_code_message, state.email),
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        FieldLabel(tr(R.string.email_security_code_label))
        OrangTextField(
            value = state.emailCode,
            onValueChange = vm::setEmailCode,
            placeholder = tr(R.string.six_digit_code_placeholder),
            centered = true,
            textStyle = androidx.compose.ui.text.TextStyle(letterSpacing = 8.sp),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        )
        BrandButton(
            text = if (state.loading) tr(R.string.verifying) else tr(R.string.verify_and_sign_in),
            onClick = vm::verifyEmailCode,
            enabled = !state.loading,
            icon = Icons.Outlined.Lock,
            modifier = Modifier.fillMaxWidth(),
        )
        TextButton(onClick = vm::resendLoginCode, enabled = !state.loading) {
            Text(tr(R.string.resend_code), fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun VerifyEmailContent(state: LoginUiState, vm: LoginViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            tr(R.string.verify_email_message, state.email),
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        BrandButton(
            text = if (state.loading) tr(R.string.sending) else tr(R.string.resend_verification_email),
            onClick = vm::resendVerification,
            enabled = !state.loading,
            icon = Icons.Outlined.MailOutline,
            modifier = Modifier.fillMaxWidth(),
        )
        TextButton(onClick = { vm.setMode(LoginMode.PASSWORD) }) {
            Text(tr(R.string.back_to_sign_in), fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun ResetForm(state: LoginUiState, vm: LoginViewModel) {
    val requesting = state.resetStep == ResetStep.REQUEST
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            if (requesting) {
                tr(R.string.reset_password_request_message)
            } else {
                tr(R.string.reset_password_confirm_message, state.email)
            },
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        FieldLabel(tr(R.string.email_label))
        OrangTextField(
            value = state.email,
            onValueChange = vm::setEmail,
            placeholder = tr(R.string.email_placeholder),
            enabled = requesting,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        )
        if (requesting) {
            BrandButton(
                text = if (state.loading) tr(R.string.sending) else tr(R.string.send_reset_code),
                onClick = vm::requestReset,
                enabled = !state.loading,
                icon = Icons.Outlined.Key,
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            FieldLabel(tr(R.string.reset_code_label))
            OrangTextField(
                value = state.resetCode,
                onValueChange = vm::setResetCode,
                placeholder = tr(R.string.six_digit_code_placeholder),
                centered = true,
                textStyle = androidx.compose.ui.text.TextStyle(letterSpacing = 8.sp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            )
            FieldLabel(tr(R.string.new_password_label))
            OrangTextField(
                value = state.password,
                onValueChange = vm::setPassword,
                placeholder = tr(R.string.new_password_placeholder),
                isPassword = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            )
            BrandButton(
                text = if (state.loading) tr(R.string.please_wait) else tr(R.string.reset_password_and_sign_in),
                onClick = vm::submitReset,
                enabled = !state.loading,
                icon = Icons.Outlined.Lock,
                modifier = Modifier.fillMaxWidth(),
            )
            TextButton(onClick = vm::requestReset, enabled = !state.loading, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text(tr(R.string.resend_code), fontSize = 12.sp, color = Gray400)
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
            Text(tr(R.string.or), fontSize = 12.sp, color = muted)
            HorizontalDivider(modifier = Modifier.weight(1f))
        }
        if (state.providers.github) {
            BrandButton(
                text = tr(R.string.continue_with_github),
                secondary = true,
                onClick = { onOAuth("github") },
                enabled = !state.loading,
                iconPainter = painterResource(R.drawable.ic_github),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (state.providers.google) {
            BrandButton(
                text = tr(R.string.continue_with_google),
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
                    Text(tr(R.string.use_password_instead), fontSize = 14.sp, color = muted)
                }
            }
            LoginMode.PASSWORD -> {
                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TextButton(onClick = { vm.setMode(LoginMode.MAGIC) }) {
                        Text(tr(R.string.magic_link), fontSize = 14.sp, color = muted)
                    }
                    TextButton(onClick = { vm.setMode(LoginMode.REGISTER) }) {
                        Text(tr(R.string.create_account_arrow), fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
                    }
                }
                TextButton(onClick = { vm.setMode(LoginMode.RESET) }) {
                    Text(tr(R.string.forgot_password), fontSize = 14.sp, color = Gray400)
                }
            }
            LoginMode.REGISTER -> {
                TextButton(onClick = { vm.setMode(LoginMode.PASSWORD) }) {
                    Text(tr(R.string.already_have_account_sign_in), fontSize = 14.sp, color = muted)
                }
            }
            LoginMode.RESET -> {
                TextButton(onClick = { vm.setMode(LoginMode.PASSWORD) }) {
                    Text(tr(R.string.back_to_sign_in), fontSize = 14.sp, color = muted)
                }
            }
            LoginMode.EMAIL_2FA, LoginMode.VERIFY_EMAIL -> Unit
        }
    }
}
