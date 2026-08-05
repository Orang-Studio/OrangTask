package lt.oranges.orangtask.auth

import android.net.Uri

object CaptchaCallback {
    fun tokenFrom(url: String): String? {
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return null
        return uri.takeIf { it.scheme == "orangtask" && it.host == "recaptcha" }
            ?.getQueryParameter("token")
            ?.takeIf { it.isNotBlank() }
    }
}
