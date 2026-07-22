package lt.oranges.orangtask.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import lt.oranges.orangtask.ui.theme.Orange500

/** avatar image, or an orange initial circle when there is no picture */
@Composable
fun Avatar(name: String?, url: String?, size: Dp = 24.dp, modifier: Modifier = Modifier) {
    if (url != null) {
        AsyncImage(
            model = url,
            contentDescription = name,
            contentScale = ContentScale.Crop,
            modifier = modifier.size(size).clip(CircleShape),
        )
    } else {
        Box(
            contentAlignment = Alignment.Center,
            modifier = modifier.size(size).background(Orange500, CircleShape),
        ) {
            Text(
                text = name?.trim()?.firstOrNull()?.uppercase() ?: "?",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = (size.value * 0.45f).sp,
            )
        }
    }
}
