package lt.oranges.orangtask.tasks

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitLongPressOrCancellation
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.lazy.LazyListItemInfo
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChangeIgnoreConsumed
import androidx.compose.ui.layout.onSizeChanged
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class ReorderState internal constructor(
    val listState: LazyListState,
    private val scope: CoroutineScope,
    private val onMove: (fromKey: Any, toKey: Any) -> Unit,
    private val onDrop: () -> Unit,
) {
    var draggingKey by mutableStateOf<Any?>(null)
        private set

    private var initialOffset by mutableFloatStateOf(0f)
    private var draggedDelta by mutableFloatStateOf(0f)

    private val draggingItem: LazyListItemInfo?
        get() = listState.layoutInfo.visibleItemsInfo.firstOrNull { it.key == draggingKey }

    val draggingOffset: Float
        get() = draggingItem?.let { initialOffset + draggedDelta - it.offset } ?: 0f

    fun start(key: Any) {
        val item = listState.layoutInfo.visibleItemsInfo.firstOrNull { it.key == key } ?: return
        draggingKey = key
        initialOffset = item.offset.toFloat()
        draggedDelta = 0f
    }

    fun drag(deltaY: Float) {
        draggedDelta += deltaY
        val item = draggingItem ?: return
        val top = item.offset + draggingOffset
        val middle = top + item.size / 2f
        val target = listState.layoutInfo.visibleItemsInfo.firstOrNull {
            it.key != item.key && middle.toInt() in it.offset..(it.offset + it.size)
        }
        if (target != null) {
            // keep the first row anchored or the list scrolls with the swap
            if (item.index == listState.firstVisibleItemIndex || target.index == listState.firstVisibleItemIndex) {
                scope.launch {
                    listState.scrollToItem(listState.firstVisibleItemIndex, listState.firstVisibleItemScrollOffset)
                }
            }
            onMove(item.key, target.key)
            return
        }
        val info = listState.layoutInfo
        val overTop = top - info.viewportStartOffset
        val overBottom = top + item.size - info.viewportEndOffset
        val scrollBy = when {
            draggedDelta < 0 && overTop < 0 -> overTop
            draggedDelta > 0 && overBottom > 0 -> overBottom
            else -> 0f
        }
        if (scrollBy != 0f) scope.launch { listState.scrollBy(scrollBy) }
    }

    fun end() {
        if (draggingKey == null) return
        draggingKey = null
        draggedDelta = 0f
        onDrop()
    }
}

@Composable
fun rememberReorderState(
    listState: LazyListState,
    onMove: (fromKey: Any, toKey: Any) -> Unit,
    onDrop: () -> Unit,
): ReorderState {
    val scope = rememberCoroutineScope()
    val move by rememberUpdatedState(onMove)
    val drop by rememberUpdatedState(onDrop)
    return remember(listState) { ReorderState(listState, scope, { a, b -> move(a, b) }, { drop() }) }
}

fun Modifier.reorderOnHold(state: ReorderState, key: Any, onStart: () -> Unit = {}): Modifier =
    pointerInput(state, key) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            val hold = awaitLongPressOrCancellation(down.id) ?: return@awaitEachGesture
            onStart()
            state.start(key)
            try {
                while (true) {
                    val change = awaitPointerEvent(PointerEventPass.Initial)
                        .changes.firstOrNull { it.id == hold.id } ?: break
                    val delta = change.positionChangeIgnoreConsumed().y
                    change.consume()
                    if (change.changedToUpIgnoreConsumed()) break
                    state.drag(delta)
                }
            } finally {
                state.end()
            }
        }
    }

// hold to drag for the few rows of a plain Column subtasks in the detail sheet which has no LazyListState to measure against
class ColumnReorderState internal constructor(
    private val onMove: (fromKey: Any, toKey: Any) -> Unit,
    private val onDrop: () -> Unit,
) {
    var draggingKey by mutableStateOf<Any?>(null)
        private set

    var draggingOffset by mutableFloatStateOf(0f)
        private set

    var keys: List<Any> = emptyList()

    internal val heights = mutableMapOf<Any, Int>()

    fun start(key: Any) {
        draggingKey = key
        draggingOffset = 0f
    }

    fun drag(deltaY: Float) {
        val key = draggingKey ?: return
        draggingOffset += deltaY
        val i = keys.indexOf(key)
        if (i < 0) return
        val next = keys.getOrNull(i + 1)
        val prev = keys.getOrNull(i - 1)
        // swap once the row is past half of its neighbour then keep it under the finger
        val swapWith = when {
            next != null && draggingOffset > (heights[next] ?: 0) / 2f -> next
            prev != null && draggingOffset < -(heights[prev] ?: 0) / 2f -> prev
            else -> return
        }
        val height = heights[swapWith] ?: 0
        draggingOffset += if (swapWith == next) -height.toFloat() else height.toFloat()
        // the new order only arrives on the next composition dont swap twice before it
        val target = keys.indexOf(swapWith)
        keys = keys.toMutableList().apply { add(target, removeAt(i)) }
        onMove(key, swapWith)
    }

    fun end() {
        if (draggingKey == null) return
        draggingKey = null
        draggingOffset = 0f
        onDrop()
    }
}

@Composable
fun rememberColumnReorderState(
    onMove: (fromKey: Any, toKey: Any) -> Unit,
    onDrop: () -> Unit,
): ColumnReorderState {
    val move by rememberUpdatedState(onMove)
    val drop by rememberUpdatedState(onDrop)
    return remember { ColumnReorderState({ a, b -> move(a, b) }, { drop() }) }
}

fun Modifier.reorderOnHold(state: ColumnReorderState, key: Any, onStart: () -> Unit = {}): Modifier =
    onSizeChanged { state.heights[key] = it.height }
        .pointerInput(state, key) {
            val holdMillis = viewConfiguration.longPressTimeoutMillis * 3 / 4
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                // non null when the finger lifts moves away or is taken before the hold ends
                val letGo = withTimeoutOrNull(holdMillis) {
                    while (true) {
                        val change = awaitPointerEvent(PointerEventPass.Initial)
                            .changes.firstOrNull { it.id == down.id }
                        if (change == null || change.changedToUpIgnoreConsumed() || change.isConsumed ||
                            (change.position - down.position).getDistance() > viewConfiguration.touchSlop
                        ) {
                            break
                        }
                    }
                }
                if (letGo != null) return@awaitEachGesture
                onStart()
                state.start(key)
                try {
                    while (true) {
                        val change = awaitPointerEvent(PointerEventPass.Initial)
                            .changes.firstOrNull { it.id == down.id } ?: break
                        val delta = change.positionChangeIgnoreConsumed().y
                        change.consume()
                        if (change.changedToUpIgnoreConsumed()) break
                        state.drag(delta)
                    }
                } finally {
                    state.end()
                }
            }
        }
