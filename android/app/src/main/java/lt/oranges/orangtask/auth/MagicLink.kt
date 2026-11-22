package lt.oranges.orangtask.auth

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

object MagicLink {
    private val tokenPattern = Regex("^[0-9a-fA-F]{64}$")

    fun tokenFrom(value: String): String? {
        val candidate = value.trim()
        if (tokenPattern.matches(candidate)) return candidate

        val uri = runCatching { URI(candidate) }.getOrNull() ?: return null
        return uri.rawQuery
            ?.split('&')
            ?.firstOrNull { it.substringBefore('=') == "token" }
            ?.substringAfter('=', "")
            ?.let { URLDecoder.decode(it, StandardCharsets.UTF_8.name()) }
            ?.takeIf(tokenPattern::matches)
    }
}
