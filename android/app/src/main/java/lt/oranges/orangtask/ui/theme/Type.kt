package lt.oranges.orangtask.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import lt.oranges.orangtask.R

// DM Sans variable font same file family the web app uses
@OptIn(ExperimentalTextApi::class)
val DmSans = FontFamily(
    Font(R.font.dm_sans, weight = FontWeight.Normal, variationSettings = FontVariation.Settings(FontVariation.weight(400))),
    Font(R.font.dm_sans, weight = FontWeight.Medium, variationSettings = FontVariation.Settings(FontVariation.weight(500))),
    Font(R.font.dm_sans, weight = FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600))),
    Font(R.font.dm_sans, weight = FontWeight.Bold, variationSettings = FontVariation.Settings(FontVariation.weight(700))),
)

private val default = Typography()

val OrangTypography = Typography(
    displayLarge = default.displayLarge.copy(fontFamily = DmSans),
    displayMedium = default.displayMedium.copy(fontFamily = DmSans),
    displaySmall = default.displaySmall.copy(fontFamily = DmSans),
    headlineLarge = default.headlineLarge.copy(fontFamily = DmSans),
    headlineMedium = default.headlineMedium.copy(fontFamily = DmSans),
    headlineSmall = default.headlineSmall.copy(fontFamily = DmSans),
    titleLarge = default.titleLarge.copy(fontFamily = DmSans),
    titleMedium = default.titleMedium.copy(fontFamily = DmSans),
    titleSmall = default.titleSmall.copy(fontFamily = DmSans),
    bodyLarge = default.bodyLarge.copy(fontFamily = DmSans),
    bodyMedium = default.bodyMedium.copy(fontFamily = DmSans),
    bodySmall = default.bodySmall.copy(fontFamily = DmSans),
    labelLarge = default.labelLarge.copy(fontFamily = DmSans),
    labelMedium = default.labelMedium.copy(fontFamily = DmSans),
    labelSmall = default.labelSmall.copy(fontFamily = DmSans),
)
