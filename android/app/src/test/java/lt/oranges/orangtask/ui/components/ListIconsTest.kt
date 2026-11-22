package lt.oranges.orangtask.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ListIconsTest {
    @Test
    fun `github list icon matches web icon key`() {
        assertTrue("github" in LIST_ICONS)
        assertEquals(LIST_ICONS.getValue("github"), listIconFor("github"))
    }
}
