package lt.oranges.orangtask.scratchpads

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckBox
import androidx.compose.material.icons.outlined.CheckBoxOutlineBlank
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.theme.Gray200
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Ink900
import lt.oranges.orangtask.ui.theme.Gray100
import lt.oranges.orangtask.ui.theme.Orange400
import lt.oranges.orangtask.ui.theme.Orange500
import lt.oranges.orangtask.ui.theme.Orange700

private val INLINE = Regex("""\[[^\]\n]*\]\([^)\s]+\)|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`""")
private val LINK = Regex("""^\[([^\]\n]*)\]\(([^)\s]+)\)$""")
private val FENCE = Regex("""^\s*```""")
private val BULLET = Regex("""^\s*[-*]\s+(.*)$""")
private val TASK = Regex("""^\[([ xX])\]\s+(.*)$""")
private val NUMBERED = Regex("""^\s*\d+[.)]\s+(.*)$""")
private val QUOTE = Regex("""^\s*>\s?(.*)$""")
private val RULE = Regex("""^\s*(-{3,}|\*{3,}|_{3,})\s*$""")
private val HEADING = Regex("""^(#{1,3})\s+(.*)$""")

private fun safeHttpUrl(raw: String): String? {
    val trimmed = raw.trim()
    val lower = trimmed.lowercase()
    if (lower.startsWith("http://") || lower.startsWith("https://")) return trimmed
    if (lower.contains(':')) return null
    if (trimmed.isEmpty()) return null
    return "https://$trimmed"
}

private data class Bullet(val text: String, val checked: Boolean?)

private sealed interface Block {
    data class Heading(val level: Int, val text: String) : Block
    data class Bullets(val items: List<Bullet>) : Block
    data class Ordered(val items: List<String>) : Block
    data class Quote(val lines: List<String>) : Block
    data class Fence(val code: String) : Block
    data class Paragraph(val text: String) : Block
    data object Rule : Block
    data object Blank : Block
}

private fun parseBlocks(content: String): List<Block> {
    val blocks = mutableListOf<Block>()
    val bullets = mutableListOf<Bullet>()
    val ordered = mutableListOf<String>()
    val quotes = mutableListOf<String>()
    var fence: MutableList<String>? = null

    fun flushBullets() {
        if (bullets.isEmpty()) return
        blocks.add(Block.Bullets(bullets.toList()))
        bullets.clear()
    }

    fun flushOrdered() {
        if (ordered.isEmpty()) return
        blocks.add(Block.Ordered(ordered.toList()))
        ordered.clear()
    }

    fun flushQuotes() {
        if (quotes.isEmpty()) return
        blocks.add(Block.Quote(quotes.toList()))
        quotes.clear()
    }

    fun flushAll() {
        flushBullets()
        flushOrdered()
        flushQuotes()
    }

    for (line in content.split('\n')) {
        val open = fence
        if (open != null) {
            if (FENCE.containsMatchIn(line)) {
                blocks.add(Block.Fence(open.joinToString("\n")))
                fence = null
            } else {
                open.add(line)
            }
            continue
        }

        if (FENCE.containsMatchIn(line)) {
            flushAll()
            fence = mutableListOf()
            continue
        }

        val bullet = BULLET.matchEntire(line)
        if (bullet != null) {
            flushOrdered()
            flushQuotes()
            val body = bullet.groupValues[1]
            val task = TASK.matchEntire(body)
            bullets.add(
                if (task != null) Bullet(task.groupValues[2], task.groupValues[1].lowercase() == "x")
                else Bullet(body, null),
            )
            continue
        }

        val numbered = NUMBERED.matchEntire(line)
        if (numbered != null) {
            flushBullets()
            flushQuotes()
            ordered.add(numbered.groupValues[1])
            continue
        }

        val quote = QUOTE.matchEntire(line)
        if (quote != null) {
            flushBullets()
            flushOrdered()
            quotes.add(quote.groupValues[1])
            continue
        }

        flushAll()

        if (RULE.matchEntire(line) != null) {
            blocks.add(Block.Rule)
            continue
        }

        val heading = HEADING.matchEntire(line)
        if (heading != null) {
            blocks.add(Block.Heading(heading.groupValues[1].length, heading.groupValues[2]))
            continue
        }

        if (line.isBlank()) {
            blocks.add(Block.Blank)
            continue
        }

        blocks.add(Block.Paragraph(line))
    }

    fence?.takeIf { it.isNotEmpty() }?.let { blocks.add(Block.Fence(it.joinToString("\n"))) }
    flushAll()
    return blocks
}

private fun inlineText(text: String, codeBackground: Color, linkColor: Color): AnnotatedString =
    buildAnnotatedString {
        var cursor = 0
        for (match in INLINE.findAll(text)) {
            if (match.range.first > cursor) append(text.substring(cursor, match.range.first))
            val part = match.value
            val link = LINK.matchEntire(part)
            when {
                link != null -> {
                    val url = safeHttpUrl(link.groupValues[2])
                    if (url == null) {
                        append(part)
                    } else {
                        val label = link.groupValues[1].ifEmpty { url }
                        withLink(
                            LinkAnnotation.Url(
                                url,
                                TextLinkStyles(
                                    SpanStyle(color = linkColor, textDecoration = TextDecoration.Underline),
                                ),
                            ),
                        ) { append(label) }
                    }
                }
                part.startsWith("**") -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                    append(part.substring(2, part.length - 2))
                }
                part.startsWith("~~") -> withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough)) {
                    append(part.substring(2, part.length - 2))
                }
                part.startsWith("`") -> withStyle(
                    SpanStyle(fontFamily = FontFamily.Monospace, background = codeBackground),
                ) {
                    append(part.substring(1, part.length - 1))
                }
                else -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                    append(part.substring(1, part.length - 1))
                }
            }
            cursor = match.range.last + 1
        }
        if (cursor < text.length) append(text.substring(cursor))
    }

@Composable
fun RichText(content: String, modifier: Modifier = Modifier) {
    val dark = isDarkTheme()
    val blocks = remember(content) { parseBlocks(content) }
    val body = MaterialTheme.colorScheme.onSurface
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val codeBackground = if (dark) Ink900 else Gray100
    val linkColor = if (dark) Orange400 else Orange700
    val divider = if (dark) Ink700 else Gray200

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        for (block in blocks) {
            when (block) {
                is Block.Heading -> Text(
                    text = inlineText(block.text, codeBackground, linkColor),
                    fontSize = when (block.level) {
                        1 -> 17.sp
                        2 -> 15.sp
                        else -> 14.sp
                    },
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = body,
                )

                is Block.Bullets -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (item in block.items) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (item.checked == null) {
                                Text("•", fontSize = 14.sp, color = muted)
                            } else {
                                Icon(
                                    if (item.checked) Icons.Outlined.CheckBox else Icons.Outlined.CheckBoxOutlineBlank,
                                    contentDescription = null,
                                    tint = if (item.checked) Orange500 else muted,
                                    modifier = Modifier.size(16.dp),
                                )
                            }
                            Text(
                                text = inlineText(item.text, codeBackground, linkColor),
                                fontSize = 14.sp,
                                color = if (item.checked == true) muted else body,
                                textDecoration = if (item.checked == true) TextDecoration.LineThrough else null,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }

                is Block.Ordered -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    block.items.forEachIndexed { index, item ->
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("${index + 1}.", fontSize = 14.sp, color = muted)
                            Text(
                                text = inlineText(item, codeBackground, linkColor),
                                fontSize = 14.sp,
                                color = body,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }

                is Block.Quote -> Row(modifier = Modifier.fillMaxWidth()) {
                    Spacer(
                        Modifier
                            .width(2.dp)
                            .height((20 * block.lines.size).dp)
                            .background(Orange500),
                    )
                    Column(
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                        modifier = Modifier.padding(start = 10.dp),
                    ) {
                        for (line in block.lines) {
                            Text(
                                text = inlineText(line, codeBackground, linkColor),
                                fontSize = 14.sp,
                                color = muted,
                            )
                        }
                    }
                }

                is Block.Fence -> Text(
                    text = block.code,
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                    color = body,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(codeBackground)
                        .horizontalScroll(rememberScrollState())
                        .padding(12.dp),
                )

                is Block.Paragraph -> Text(
                    text = inlineText(block.text, codeBackground, linkColor),
                    fontSize = 14.sp,
                    color = body,
                    modifier = Modifier.fillMaxWidth(),
                )

                Block.Rule -> HorizontalDivider(color = divider)

                Block.Blank -> Spacer(Modifier.height(4.dp))
            }
        }
    }
}
