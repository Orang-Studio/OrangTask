import QtQuick

PointHandler {
    id: handler

    required property int index
    required property var view
    required property var model
    property Flickable flickable: null
    property real spacing: 0
    property var ignore: []
    property Item handle: null
    property int holdMs: 300
    acceptedButtons: Qt.LeftButton

    readonly property Item row: parent
    readonly property bool reordering: grabbed || releasing
    property bool grabbed: false
    property bool releasing: false
    readonly property real offset: grabbed ? dragTop - row.y : 0

    property real grabY: 0
    property real dragTop: 0
    property real slotTop: 0
    property int slot: -1
    property point lastScene
    // row heights in the current order kept here a ListView applies model moves on its next layout so its items lag behind a fast drag
    property var heights: []

    signal grabbedRow()

    function measure() {
        const out = []
        for (let i = 0; i < view.count; ++i) {
            const item = view.itemAtIndex ? view.itemAtIndex(i) : view.itemAt(i)
            out.push(item ? item.height : row.height)
        }
        heights = out
    }

    function moveTo(to) {
        model.move(slot, to)
        heights.splice(to, 0, heights.splice(slot, 1)[0])
        slot = to
    }

    function track(scenePos) {
        lastScene = scenePos
        dragTop = row.parent.mapFromItem(null, scenePos.x, scenePos.y).y - grabY
        for (let guard = 0; guard < heights.length; ++guard) {
            const next = slot + 1 < heights.length ? heights[slot + 1] : -1
            const prev = slot > 0 ? heights[slot - 1] : -1
            if (next >= 0 && dragTop - slotTop > next / 2) {
                slotTop += next + spacing
                moveTo(slot + 1)
            } else if (prev >= 0 && slotTop - dragTop > prev / 2) {
                slotTop -= prev + spacing
                moveTo(slot - 1)
            } else {
                break
            }
        }
    }

    function edgeSpeed() {
        const f = flickable
        const y = f.mapFromItem(null, lastScene.x, lastScene.y).y
        const edge = 36
        if (y < edge && f.contentY > f.originY) return -Math.ceil((edge - y) / 4)
        if (y > f.height - edge && f.contentY < f.originY + f.contentHeight - f.height)
            return Math.ceil((y - (f.height - edge)) / 4)
        return 0
    }

    function finish() {
        hold.stop()
        edgeScroll.stop()
        if (!grabbed) return
        grabbed = false
        releasing = true
        if (flickable) flickable.interactive = true
        model.commitMove()
        Qt.callLater(() => { handler.releasing = false })
    }

    function isOver(item, scenePt) {
        return item && item.visible && item.contains(item.mapFromItem(null, scenePt.x, scenePt.y))
    }

    function beginGrab() {
        if (!handler.active || handler.grabbed) return
        const sp = handler.point.scenePressPosition
        for (const item of handler.ignore) {
            if (isOver(item, sp)) return
        }
        handler.grabY = handler.point.position.y
        handler.slot = handler.index
        handler.measure()
        handler.slotTop = handler.row.y
        handler.dragTop = handler.row.y
        handler.lastScene = handler.point.scenePosition
        if (handler.flickable) handler.flickable.interactive = false
        handler.grabbed = true
        handler.grabbedRow()
    }

    onActiveChanged: {
        if (active) {
            if (isOver(handle, point.scenePressPosition)) {
                beginGrab()
            } else {
                hold.restart()
            }
        } else {
            finish()
        }
    }

    onPointChanged: {
        if (!active) return
        if (!grabbed) {
            const d = Qt.styleHints.startDragDistance
            if (Math.abs(point.position.x - point.pressPosition.x) > d
                    || Math.abs(point.position.y - point.pressPosition.y) > d)
                hold.stop()
            return
        }
        track(point.scenePosition)
        edgeScroll.running = flickable !== null && edgeSpeed() !== 0
    }

    readonly property Timer hold: Timer {
        interval: handler.holdMs
        onTriggered: handler.beginGrab()
    }

    readonly property Timer edgeScroll: Timer {
        interval: 16
        repeat: true
        onTriggered: {
            const f = handler.flickable
            const v = handler.edgeSpeed()
            if (!handler.grabbed || v === 0) { stop(); return }
            f.contentY = Math.max(f.originY, Math.min(f.originY + f.contentHeight - f.height, f.contentY + v))
            handler.track(handler.lastScene)
        }
    }
}
