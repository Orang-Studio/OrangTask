package lt.oranges.orangtask.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// frontend/src/components/PriorityDot.tsx
val PRIORITIES = listOf("none", "low", "medium", "high")

fun priorityColor(priority: String): Color = when (priority) {
    "low" -> Color(0xFF3B82F6)
    "medium" -> Color(0xFFEAB308)
    "high" -> Color(0xFFEF4444)
    else -> Color(0xFF6B7280)
}

fun priorityLabel(priority: String): String = when (priority) {
    "low" -> "Low"
    "medium" -> "Medium"
    "high" -> "High"
    else -> "None"
}

@Composable
fun PriorityDot(priority: String, modifier: Modifier = Modifier) {
    if (priority == "none" || priority.isEmpty()) return
    androidx.compose.foundation.layout.Box(
        modifier = modifier
            .size(8.dp)
            .background(priorityColor(priority), CircleShape),
    )
}

/** the web 8-color list palette (ListPage.tsx) */
val LIST_COLORS = listOf(
    "#f97316", "#ef4444", "#eab308", "#22c55e",
    "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
)

fun parseHexColor(hex: String?, fallback: Color): Color =
    hex?.let { runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull() } ?: fallback

@Composable
fun listColor(hex: String?): Color = parseHexColor(hex, MaterialTheme.colorScheme.onSurfaceVariant)
