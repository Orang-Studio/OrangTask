package lt.oranges.orangtask.auth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
class CaptchaCallbackTest {
    @Test
    fun `extracts token only from the OrangTask CAPTCHA callback`() {
        assertEquals(
            "captcha-token",
            CaptchaCallback.tokenFrom("orangtask://recaptcha?token=captcha-token"),
        )
    }
    @Test
    fun `rejects unrelated or empty callbacks`() {
        assertNull(CaptchaCallback.tokenFrom("orangtask://auth-callback?token=captcha-token"))
        assertNull(CaptchaCallback.tokenFrom("orangtask://recaptcha"))
    }
}