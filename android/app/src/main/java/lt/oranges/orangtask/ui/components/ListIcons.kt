package lt.oranges.orangtask.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.outlined.AttachMoney
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.Book
import androidx.compose.material.icons.outlined.Bookmark
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.Code
import androidx.compose.material.icons.outlined.Coffee
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.Eco
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Flight
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.LocalPizza
import androidx.compose.material.icons.outlined.Mood
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.Pets
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Rocket
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.SportsEsports
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Tag
import androidx.compose.material.icons.outlined.TrackChanges
import androidx.compose.material.icons.outlined.WbSunny
import androidx.compose.material.icons.outlined.Webhook
import androidx.compose.material.icons.outlined.Work
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.foundation.layout.size
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** material equivalents of the web lucide list-icon registry (frontend/src/lib/listIcons.tsx) */
val LIST_ICONS: Map<String, ImageVector> = linkedMapOf(
    "hash" to Icons.Outlined.Tag,
    "inbox" to Icons.Outlined.Inbox,
    "briefcase" to Icons.Outlined.Work,
    "home" to Icons.Outlined.Home,
    "star" to Icons.Outlined.Star,
    "heart" to Icons.Outlined.Favorite,
    "cart" to Icons.Outlined.ShoppingCart,
    "list" to Icons.AutoMirrored.Outlined.List,
    "checks" to Icons.Outlined.Checklist,
    "calendar" to Icons.Outlined.CalendarMonth,
    "book" to Icons.Outlined.Book,
    "code" to Icons.Outlined.Code,
    "music" to Icons.Outlined.MusicNote,
    "camera" to Icons.Outlined.PhotoCamera,
    "coffee" to Icons.Outlined.Coffee,
    "zap" to Icons.Outlined.Bolt,
    "flag" to Icons.Outlined.Flag,
    "bell" to Icons.Outlined.Notifications,
    "bookmark" to Icons.Outlined.Bookmark,
    "folder" to Icons.Outlined.Folder,
    "file" to Icons.Outlined.Description,
    "tag" to Icons.Outlined.LocalOffer,
    "dollar" to Icons.Outlined.AttachMoney,
    "gift" to Icons.Outlined.CardGiftcard,
    "plane" to Icons.Outlined.Flight,
    "car" to Icons.Outlined.DirectionsCar,
    "dumbbell" to Icons.Outlined.FitnessCenter,
    "graduation" to Icons.Outlined.School,
    "lightbulb" to Icons.Outlined.Lightbulb,
    "leaf" to Icons.Outlined.Eco,
    "sun" to Icons.Outlined.WbSunny,
    "moon" to Icons.Outlined.DarkMode,
    "cloud" to Icons.Outlined.Cloud,
    "pizza" to Icons.Outlined.LocalPizza,
    "game" to Icons.Outlined.SportsEsports,
    "wrench" to Icons.Outlined.Build,
    "palette" to Icons.Outlined.Palette,
    "target" to Icons.Outlined.TrackChanges,
    "trophy" to Icons.Outlined.EmojiEvents,
    "users" to Icons.Outlined.Group,
    "phone" to Icons.Outlined.Phone,
    "mail" to Icons.Outlined.Email,
    "map" to Icons.Outlined.Place,
    "shield" to Icons.Outlined.Shield,
    "smile" to Icons.Outlined.Mood,
    "paw" to Icons.Outlined.Pets,
    "rocket" to Icons.Outlined.Rocket,
    "webhook" to Icons.Outlined.Webhook,
)

const val DEFAULT_LIST_ICON = "list"

fun listIconFor(key: String?): ImageVector =
    LIST_ICONS[key] ?: LIST_ICONS.getValue(DEFAULT_LIST_ICON)

@Composable
fun ListIcon(icon: String?, colorHex: String?, size: Dp = 18.dp, modifier: Modifier = Modifier) {
    Icon(
        imageVector = listIconFor(icon),
        contentDescription = null,
        tint = listColor(colorHex),
        modifier = modifier.size(size),
    )
}
