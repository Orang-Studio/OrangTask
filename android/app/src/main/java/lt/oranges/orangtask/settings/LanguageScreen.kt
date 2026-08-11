package lt.oranges.orangtask.settings

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.i18n.AppLanguage
import lt.oranges.orangtask.core.i18n.LocalePreferences
import lt.oranges.orangtask.core.i18n.RemoteI18n
import lt.oranges.orangtask.core.i18n.labelRes
import lt.oranges.orangtask.core.i18n.tr
import lt.oranges.orangtask.ui.components.SurfaceCard
import lt.oranges.orangtask.ui.theme.Orange500

private fun Context.findActivity(): Activity? {
    var current = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return current as? Activity
}

@Composable
fun LanguageSection() {
    val context = LocalContext.current
    val systemTag = AppLanguage.SYSTEM.storageValue
    var selected by remember { mutableStateOf(LocalePreferences.getTag(context) ?: systemTag) }

    val options = buildList {
        AppLanguage.entries.forEach { language ->
            add(language.storageValue to tr(language.labelRes()))
        }
        RemoteI18n.languages().forEach { remote ->
            if (none { it.first == remote.code }) add(remote.code to remote.endonym)
        }
        if (selected != systemTag && none { it.first == selected }) {
            add(selected to LocalePreferences.label(context, selected))
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            tr(R.string.language_subtitle),
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        SurfaceCard(modifier = Modifier.fillMaxWidth()) {
            Column {
                options.forEach { (tag, label) ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                selected = tag
                                if (tag == systemTag) LocalePreferences.setSystem(context)
                                else LocalePreferences.set(context, tag)
                                RemoteI18n.refreshNow()
                                context.findActivity()?.recreate()
                            }
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                    ) {
                        RadioButton(
                            selected = selected == tag,
                            onClick = null,
                            colors = RadioButtonDefaults.colors(selectedColor = Orange500),
                        )
                        Text(
                            label,
                            fontSize = 14.sp,
                            fontWeight = if (selected == tag) FontWeight.Medium else FontWeight.Normal,
                        )
                    }
                }
            }
        }
        Text(
            tr(R.string.language_hint),
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
