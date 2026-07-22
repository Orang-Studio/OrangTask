package lt.oranges.orangtask.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// sharp corners everywhere the brand uses border-radius: 0 (inputs get 4px)
val OrangShapes = Shapes(
    extraSmall = RoundedCornerShape(0.dp),
    small = RoundedCornerShape(0.dp),
    medium = RoundedCornerShape(0.dp),
    large = RoundedCornerShape(0.dp),
    extraLarge = RoundedCornerShape(0.dp),
)

private val DarkColors = darkColorScheme(
    primary = Orange500,
    onPrimary = Color.White,
    primaryContainer = Orange600,
    onPrimaryContainer = Color.White,
    secondary = Orange400,
    onSecondary = Color.White,
    background = Ink800,
    onBackground = Color.White,
    surface = Ink800,
    onSurface = Color.White,
    surfaceVariant = Ink750,
    onSurfaceVariant = Ink400,
    surfaceContainer = Ink750,
    surfaceContainerHigh = Ink700,
    surfaceContainerHighest = Ink600,
    surfaceContainerLow = Ink850,
    surfaceContainerLowest = Ink900,
    outline = Ink600,
    outlineVariant = Ink500,
    error = ErrorRedDark,
    onError = Color.White,
)

private val LightColors = lightColorScheme(
    primary = Orange500,
    onPrimary = Color.White,
    primaryContainer = Orange100,
    onPrimaryContainer = Orange800,
    secondary = Orange600,
    onSecondary = Color.White,
    background = LightBackground,
    onBackground = Ink800,
    surface = Color.White,
    onSurface = Ink800,
    surfaceVariant = Gray100,
    onSurfaceVariant = Gray500,
    surfaceContainer = Gray100,
    surfaceContainerHigh = Gray200,
    surfaceContainerHighest = Gray300,
    surfaceContainerLow = Gray50,
    surfaceContainerLowest = Color.White,
    outline = Gray200,
    outlineVariant = Gray300,
    error = ErrorRed,
    onError = Color.White,
)

@Composable
fun OrangTaskTheme(
    mode: ThemeMode = ThemeMode.DARK,
    content: @Composable () -> Unit,
) {
    val dark = when (mode) {
        ThemeMode.DARK -> true
        ThemeMode.LIGHT -> false
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }
    MaterialTheme(
        colorScheme = if (dark) DarkColors else LightColors,
        typography = OrangTypography,
        shapes = OrangShapes,
        content = content,
    )
}
