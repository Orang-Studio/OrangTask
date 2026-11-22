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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.foundation.layout.size
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private val GithubIcon = ImageVector.Builder(
    name = "Github",
    defaultWidth = 16.dp,
    defaultHeight = 16.dp,
    viewportWidth = 16f,
    viewportHeight = 16f,
).apply {
    addPath(
        pathData = PathParser().parsePathString(
            "M6.766,11.328c-2.063,-0.25 -3.516,-1.734 -3.516,-3.656 " +
                "0,-0.781 0.281,-1.625 0.75,-2.188 -0.203,-0.515 -0.172,-1.609 " +
                "0.063,-2.062 0.625,-0.078 1.468,0.25 1.968,0.703 0.594,-0.187 " +
                "1.219,-0.281 1.985,-0.281 0.765,0 1.39,0.094 1.953,0.265 " +
                "0.484,-0.437 1.344,-0.765 1.969,-0.687 0.218,0.422 0.25,1.515 " +
                "0.046,2.047 0.5,0.593 0.766,1.39 0.766,2.203 0,1.922 -1.453,3.375 " +
                "-3.547,3.64 0.531,0.344 0.89,1.094 0.89,1.954v1.625c0,0.468 " +
                "0.391,0.734 0.86,0.547C13.781,14.359 16,11.53 16,8.03 " +
                "16,3.61 12.406,0 7.984,0 3.563,0 0,3.61 0,8.031a7.88,7.88 " +
                "0,0 0,5.172 7.422c0.422,0.156 0.828,-0.125 0.828,-0.547v-1.25 " +
                "c-0.219,0.094 -0.5,0.156 -0.75,0.156 -1.031,0 -1.64,-0.562 " +
                "-2.078,-1.609 -0.172,-0.422 -0.36,-0.672 -0.719,-0.719 " +
                "-0.187,-0.015 -0.25,-0.093 -0.25,-0.187 0,-0.188 0.313,-0.328 " +
                "0.625,-0.328 0.453,0 0.844,0.281 1.25,0.86 0.313,0.452 " +
                "0.64,0.655 1.031,0.655s0.641,-0.14 1,-0.5c0.266,-0.265 " +
                "0.47,-0.5 0.657,-0.656",
        ).toNodes(),
        fill = SolidColor(Color.Black),
    )
}.build()

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
    "github" to GithubIcon,
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
