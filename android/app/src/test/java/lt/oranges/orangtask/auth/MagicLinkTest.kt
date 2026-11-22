package lt.oranges.orangtask.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MagicLinkTest {
    private val token = "a".repeat(64)

    @Test
    fun acceptsRawTokenForManualFallback() {
        assertEquals(token, MagicLink.tokenFrom(token))
    }

    @Test
    fun extractsTokenFromVerifiedAppLink() {
        assertEquals(
            token,
            MagicLink.tokenFrom("https://task.oranges.lt/auth/magic?token=$token&platform=android"),
        )
    }

    @Test
    fun extractsTokenFromCustomSchemeFallback() {
        assertEquals(token, MagicLink.tokenFrom("orangtask://magic-link?token=$token"))
    }

    @Test
    fun rejectsMalformedToken() {
        assertNull(MagicLink.tokenFrom("https://task.oranges.lt/auth/magic?token=not-a-token"))
    }
}
