package lt.oranges.orangtask.home

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MainScaffoldTest {
    @Test
    fun `bottom navigation destinations switch without screen transitions`() {
        assertTrue(isMainMenuRoute("view/{kind}"))
        assertTrue(isMainMenuRoute("lists"))
        assertTrue(isMainMenuRoute("search"))
        assertTrue(isMainMenuRoute("settings"))

        assertTrue(disablesTabTransition("view/{kind}", "lists"))
        assertTrue(disablesTabTransition("lists", "search"))
        assertTrue(disablesTabTransition("search", "settings"))
    }

    @Test
    fun `screens reached from lists switch tabs without screen transitions`() {
        assertTrue(disablesTabTransition("list/{listId}?task={task}", "view/{kind}"))
        assertTrue(disablesTabTransition("list/{listId}?task={task}", "search"))
        assertTrue(disablesTabTransition("scratchpads", "settings"))
        assertTrue(disablesTabTransition("search", "list/{listId}?task={task}"))
    }

    @Test
    fun `navigation within a tab keeps directional screen transitions`() {
        assertFalse(isMainMenuRoute("list/{listId}?task={task}"))
        assertFalse(isMainMenuRoute("scratchpads"))
        assertFalse(isMainMenuRoute("notifications"))
        assertFalse(isMainMenuRoute(null))

        assertFalse(disablesTabTransition("lists", "list/{listId}?task={task}"))
        assertFalse(disablesTabTransition("lists", "scratchpads"))
        assertFalse(disablesTabTransition("view/{kind}", "notifications"))
        assertFalse(disablesTabTransition(null, "lists"))
    }
}
