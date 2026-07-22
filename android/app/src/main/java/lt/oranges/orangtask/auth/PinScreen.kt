package lt.oranges.orangtask.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lt.oranges.orangtask.ui.components.BrandButton
import lt.oranges.orangtask.ui.components.FieldLabel
import lt.oranges.orangtask.ui.components.Logo
import lt.oranges.orangtask.ui.components.OrangTextField
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.theme.Gray400
import lt.oranges.orangtask.ui.theme.Ink900

@Composable
fun PinScreen(
    onUnlocked: () -> Unit,
    onSignOut: () -> Unit,
    viewModel: PinViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()

    LaunchedEffect(state.unlocked) {
        if (state.unlocked) {
            haptics.success()
            onUnlocked()
        }
    }
    LaunchedEffect(state.error) {
        if (state.error) haptics.error()
    }

    val background = if (isDarkTheme()) Ink900 else MaterialTheme.colorScheme.background
    val pinTextStyle = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = 12.sp)

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
                .padding(16.dp),
        ) {
            Logo(48.dp)

            if (state.recoverMessage != null) {
                // ---- Forgot-PIN recovery: enter the emailed 6-digit code ----
                Text(
                    "RESET YOUR PIN",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(top = 16.dp),
                )
                Text(
                    state.recoverMessage ?: "",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp, bottom = 32.dp),
                )

                OrangTextField(
                    value = state.recoverCode,
                    onValueChange = viewModel::onRecoverCodeChange,
                    placeholder = "123456",
                    centered = true,
                    textStyle = pinTextStyle,
                    minHeight = 64.dp,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                )

                state.recoverError?.let {
                    Text(it, fontSize = 14.sp, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 16.dp))
                }

                Spacer(Modifier.height(24.dp))
                BrandButton(
                    text = if (state.recoverBusy) "Please wait…" else "Remove PIN & continue",
                    onClick = viewModel::submitPinReset,
                    enabled = state.recoverCode.length == 6 && !state.recoverBusy,
                    modifier = Modifier.fillMaxWidth(),
                )
                TextButton(onClick = viewModel::requestPinReset, enabled = !state.recoverBusy, modifier = Modifier.padding(top = 8.dp)) {
                    Text("Resend code", fontSize = 14.sp, color = Gray400)
                }
                TextButton(onClick = viewModel::backToPinEntry) {
                    Text("Back to PIN entry", fontSize = 14.sp, color = Gray400)
                }
            } else {
                // ---- Normal PIN entry ----
                Text(
                    "ENTER YOUR PIN",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(top = 16.dp),
                )
                Text(
                    "Unlock your tasks",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp, bottom = 32.dp),
                )

                OrangTextField(
                    value = state.pin,
                    onValueChange = viewModel::onPinChange,
                    placeholder = "••••",
                    centered = true,
                    isError = state.error,
                    isPassword = true,
                    textStyle = pinTextStyle,
                    minHeight = 64.dp,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                )

                if (state.error) {
                    Text(
                        "Wrong PIN, try again",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 16.dp),
                    )
                }

                Spacer(Modifier.height(24.dp))
                BrandButton(
                    text = "Unlock",
                    onClick = viewModel::verify,
                    enabled = state.pin.length >= 4 && !state.submitting,
                    modifier = Modifier.fillMaxWidth(),
                )

                TextButton(onClick = viewModel::requestPinReset, enabled = !state.recoverBusy, modifier = Modifier.padding(top = 16.dp)) {
                    Text(
                        if (state.recoverBusy) "Sending reset code…" else "Forgot PIN?",
                        fontSize = 14.sp,
                        color = Gray400,
                    )
                }
                state.recoverError?.let {
                    Text(it, fontSize = 14.sp, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 4.dp))
                }
                TextButton(onClick = onSignOut) {
                    Text("Sign out instead", fontSize = 14.sp, color = Gray400)
                }
            }
        }
    }
}
