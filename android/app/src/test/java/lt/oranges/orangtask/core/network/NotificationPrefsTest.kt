package lt.oranges.orangtask.core.network

import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

class NotificationPrefsTest {
    private val json = NetworkModule.provideJson()

    @Test
    fun disablingDueSoonEmailSendsExplicitFalse() {
        val request = NotificationPrefs(mapOf("task_due_soon" to ChannelPref(email = false)))
        val encoded = json.encodeToString(NotificationPrefs.serializer(), request)
        val pref = json.parseToJsonElement(encoded).jsonObject
            .getValue("prefs").jsonObject.getValue("task_due_soon").jsonObject

        // missing email falls back to true on the server for task_due_soon
        assertEquals("false", pref.getValue("email").jsonPrimitive.content)
        assertEquals("true", pref.getValue("push").jsonPrimitive.content)
        assertEquals(request, json.decodeFromString(NotificationPrefs.serializer(), encoded))
    }

    @Test
    fun bothChannelsRemainExplicitWhenToggled() {
        for (push in listOf(false, true)) {
            for (email in listOf(false, true)) {
                val encoded = json.encodeToString(ChannelPref.serializer(), ChannelPref(push, email))
                val pref = json.parseToJsonElement(encoded).jsonObject
                assertEquals(push.toString(), pref.getValue("push").jsonPrimitive.content)
                assertEquals(email.toString(), pref.getValue("email").jsonPrimitive.content)
            }
        }
    }
}
