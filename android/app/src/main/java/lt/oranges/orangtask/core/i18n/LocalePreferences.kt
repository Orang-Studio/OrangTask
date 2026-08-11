package lt.oranges.orangtask.core.i18n

import android.content.Context
import android.content.res.Configuration
import android.os.LocaleList
import java.util.Locale
import lt.oranges.orangtask.R

enum class AppLanguage(val storageValue: String) {
    SYSTEM("system"),
    ENGLISH("en"),
    LITHUANIAN("lt"),
}

fun AppLanguage.labelRes(): Int = when (this) {
    AppLanguage.SYSTEM -> R.string.language_system
    AppLanguage.ENGLISH -> R.string.language_english
    AppLanguage.LITHUANIAN -> R.string.language_lithuanian
}

object LocalePreferences {
    private const val FILE = "orangtask_preferences"
    private const val LANGUAGE = "language"

    fun getTag(context: Context): String? =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getString(LANGUAGE, null)
            ?.takeIf { it != AppLanguage.SYSTEM.storageValue }

    fun set(context: Context, tag: String) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putString(LANGUAGE, tag)
            .apply()
    }

    fun setSystem(context: Context) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putString(LANGUAGE, AppLanguage.SYSTEM.storageValue)
            .apply()
    }

    fun localizedContext(base: Context): Context {
        val tag = getTag(base)
        if (tag == null) {
            Locale.setDefault(base.resources.configuration.locales[0])
            return base
        }
        val locale = Locale.forLanguageTag(tag)
        Locale.setDefault(locale)
        val configuration = Configuration(base.resources.configuration)
        configuration.setLocale(locale)
        configuration.setLocales(LocaleList(locale))
        return base.createConfigurationContext(configuration)
    }

    fun label(context: Context, tag: String?): String {
        if (tag == null) return AppStrings.get(context, R.string.language_system)
        AppLanguage.entries.firstOrNull { it.storageValue == tag }?.let {
            return AppStrings.get(context, it.labelRes())
        }
        return RemoteI18n.languages().firstOrNull { it.code == tag }?.endonym ?: tag
    }
}
