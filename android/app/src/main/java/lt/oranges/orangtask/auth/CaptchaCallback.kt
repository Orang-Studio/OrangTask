package lt.oranges.orangtask.auth

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

object CaptchaCallback {
    fun tokenFrom(url: String): String? {
        val uri = runCatching { URI(url) }.getOrNull() ?: return null
        if (uri.scheme != "orangtask" || uri.host != "recaptcha") return null

        return uri.rawQuery
            ?.split('&')
            ?.firstOrNull { it.substringBefore('=') == "token" }
            ?.substringAfter('=', "")
            ?.let { URLDecoder.decode(it, StandardCharsets.UTF_8.name()) }
            ?.takeIf { it.isNotBlank() }
    }
}
