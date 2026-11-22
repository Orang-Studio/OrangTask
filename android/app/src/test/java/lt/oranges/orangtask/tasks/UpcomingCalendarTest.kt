package lt.oranges.orangtask.tasks

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth
import java.util.Locale

class UpcomingCalendarTest {
    private val saved = Locale.getDefault()

    @After fun restore() = Locale.setDefault(saved)

    @Test fun mondayWeekStart() {
        Locale.setDefault(Locale.forLanguageTag("lt-LT"))
        // november 2026 starts on a Sunday six Monday first rows
        assertEquals(LocalDate.of(2026, 10, 26), calendarGridStart(YearMonth.of(2026, 11)))
        assertEquals(6, calendarWeeks(YearMonth.of(2026, 11)))
    }

    @Test fun sundayWeekStart() {
        Locale.setDefault(Locale.US)
        assertEquals(LocalDate.of(2026, 11, 1), calendarGridStart(YearMonth.of(2026, 11)))
        assertEquals(5, calendarWeeks(YearMonth.of(2026, 11)))
        // february 2026 starts on a Sunday and has 28 days exactly four rows
        assertEquals(4, calendarWeeks(YearMonth.of(2026, 2)))
    }
}
