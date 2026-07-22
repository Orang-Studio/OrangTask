package lt.oranges.orangtask.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lt.oranges.orangtask.R
import lt.oranges.orangtask.ui.theme.Gray400
import lt.oranges.orangtask.ui.theme.Ink750
import lt.oranges.orangtask.ui.theme.Ink800

@Composable
fun isDarkTheme(): Boolean = MaterialTheme.colorScheme.background == Ink800

@Composable
fun Logo(size: Dp = 56.dp, modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(R.drawable.orangtask_logo),
        contentDescription = "OrangTask",
        modifier = modifier.size(size),
    )
}

/** btn-primary / btn-secondary: sharp corners, uppercase, bold, 44dp tall */
@Composable
fun BrandButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    secondary: Boolean = false,
    icon: ImageVector? = null,
    iconPainter: Painter? = null,
    // brand marks (e.g Googles multi-color "G") must keep their own colors only monochrome icons
    tintIcon: Boolean = true,
) {
    val colors = if (secondary) {
        ButtonDefaults.buttonColors(
            containerColor = if (isDarkTheme()) MaterialTheme.colorScheme.surfaceContainerHigh else Color.White,
            contentColor = MaterialTheme.colorScheme.onSurface,
            disabledContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.6f),
            disabledContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
        )
    } else {
        ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = Color.White,
            disabledContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
            disabledContentColor = Color.White.copy(alpha = 0.7f),
        )
    }
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RectangleShape,
        colors = colors,
        modifier = modifier.height(44.dp),
    ) {
        if (iconPainter != null) {
            Icon(
                iconPainter,
                contentDescription = null,
                tint = if (tintIcon) LocalContentColor.current else Color.Unspecified,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(8.dp))
        } else if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text = text.uppercase(),
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            letterSpacing = 1.sp,
        )
    }
}

/** uppercase micro-label above inputs */
@Composable
fun FieldLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        letterSpacing = 1.5.sp,
        color = Gray400,
        modifier = modifier,
    )
}

/** input-field: 44dp, 4dp radius, orange border on focus */
@Composable
fun OrangTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    enabled: Boolean = true,
    isError: Boolean = false,
    isPassword: Boolean = false,
    centered: Boolean = false,
    textStyle: TextStyle = TextStyle.Default,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    singleLine: Boolean = true,
    minHeight: Dp = 44.dp,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()

    val borderColor = when {
        isError -> MaterialTheme.colorScheme.error
        focused -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.outlineVariant
    }
    val background = if (isDarkTheme()) Ink750 else Color.White
    val contentColor = MaterialTheme.colorScheme.onSurface

    val mergedStyle = MaterialTheme.typography.bodyLarge
        .copy(color = contentColor, textAlign = if (centered) TextAlign.Center else TextAlign.Start)
        .merge(textStyle)

    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled,
        singleLine = singleLine,
        textStyle = mergedStyle,
        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        interactionSource = interactionSource,
        modifier = modifier,
        decorationBox = { inner ->
            Box(
                contentAlignment = if (centered) Alignment.Center else Alignment.CenterStart,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(minHeight)
                    .background(if (enabled) background else background.copy(alpha = 0.6f), RoundedCornerShape(4.dp))
                    .border(1.dp, borderColor, RoundedCornerShape(4.dp))
                    .padding(horizontal = 12.dp),
            ) {
                if (value.isEmpty()) {
                    Text(
                        text = placeholder,
                        style = mergedStyle.copy(color = contentColor.copy(alpha = 0.35f)),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                inner()
            }
        },
    )
}

/** the red error banner used across auth screens */
@Composable
fun ErrorBanner(text: String, modifier: Modifier = Modifier) {
    val dark = isDarkTheme()
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(if (dark) Color(0xFF450A0A) else Color(0xFFFEE2E2))
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(
            text = text,
            fontSize = 14.sp,
            color = if (dark) Color(0xFFF87171) else Color(0xFFB91C1C),
        )
    }
}

/** surface: card with 1px border, no radius */
@Composable
fun SurfaceCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val dark = isDarkTheme()
    Box(
        modifier = modifier
            .background(if (dark) Ink800 else Color.White)
            .border(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        content()
    }
}
