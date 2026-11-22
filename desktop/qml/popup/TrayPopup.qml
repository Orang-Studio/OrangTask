import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Window {
    id: win
    width: 400
    height: 540
    color: "transparent"
    title: "OrangTask"

    property string view: "today"
    property string listId: ""
    readonly property bool loggedIn: Auth.state === AuthState.LoggedIn

    function applyRemembered() {
        const last = AppSettings.popupView
        if (last.startsWith("list:")) {
            const id = last.slice(5)
            if (Store.listMap(id).id) {
                show_("list", id)
                return
            }
        }
        show_(Views.smart.indexOf(last) >= 0 ? last : "today", "")
    }
    function show_(v, id) {
        if (v === "list") Sync.openList(id)
        if (view === v && listId === id)
            return
        tasks.releaseHolds()
        view = v
        listId = id
        taskList.currentIndex = -1
        taskList.positionViewAtBeginning()
        AppSettings.popupView = key(v, id)
    }
    function key(v, id) { return v === "list" ? "list:" + id : v }

    onVisibleChanged: {
        if (visible) {
            applyRemembered()
            input.text = ""
            content.forceActiveFocus()
        } else {
            tasks.releaseHolds()
        }
    }

    TaskModel {
        id: tasks
        view: win.view
        targetId: win.listId
        includeDone: false
        holdMs: 1500
    }

    ListsModel { id: lists }

    Shortcut {
        sequence: "Esc"
        onActivated: App.hidePopup()
    }

    Rectangle {
        id: frame
        anchors.fill: parent
        color: Theme.surface
        border.width: 1
        border.color: Theme.dark ? Theme.ink600 : Theme.gray200
        radius: 6
        clip: true

        opacity: win.visible ? 1 : 0
        Behavior on opacity { NumberAnimation { duration: 140 } }

        DropArea {
            id: drop
            anchors.fill: parent
            enabled: win.loggedIn
            onDropped: (d) => {
                const id = App.captureDrop(d.hasText ? d.text : "", d.hasUrls ? d.urls : [],
                                           win.view === "list" ? win.listId : "")
                if (id) d.acceptProposedAction()
            }
        }

        Item {
            id: content
            anchors.fill: parent
            anchors.margins: 1
            focus: true

            Keys.onPressed: (e) => {
                if (!win.loggedIn) return
                if (e.key === Qt.Key_Down || e.key === Qt.Key_J) {
                    taskList.currentIndex = Math.min(taskList.count - 1, taskList.currentIndex + 1); e.accepted = true
                } else if (e.key === Qt.Key_Up || e.key === Qt.Key_K) {
                    taskList.currentIndex = Math.max(0, taskList.currentIndex - 1); e.accepted = true
                } else if ((e.key === Qt.Key_Space || e.key === Qt.Key_Return || e.key === Qt.Key_X) && taskList.currentIndex >= 0) {
                    tasks.toggle(tasks.idAt(taskList.currentIndex)); e.accepted = true
                } else if (e.key === Qt.Key_N || e.key === Qt.Key_A) {
                    input.forceActiveFocus(); e.accepted = true
                } else if (e.key === Qt.Key_Left || e.key === Qt.Key_Right) {
                    const i = chipRepeater.indexOf(win.key(win.view, win.listId))
                    const n = chipRepeater.keys.length
                    const k = chipRepeater.keys[(i + (e.key === Qt.Key_Right ? 1 : n - 1)) % n]
                    k.startsWith("list:") ? win.show_("list", k.slice(5)) : win.show_(k, "")
                    e.accepted = true
                }
            }

            ColumnLayout {
                anchors.centerIn: parent
                width: parent.width - 64
                visible: !win.loggedIn
                spacing: 16
                Logo { size: 56; Layout.alignment: Qt.AlignHCenter }
                Text {
                    Layout.fillWidth: true
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: Auth.state === AuthState.NeedsPin ? Tr.t("desktop.popup.locked") : Tr.t("desktop.popup.signedOut")
                    color: Theme.textMuted
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontSm
                }
                OButton {
                    Layout.alignment: Qt.AlignHCenter
                    text: Auth.state === AuthState.NeedsPin ? Tr.t("desktop.popup.unlock") : Tr.t("login.signIn")
                    onClicked: App.showMain()
                }
            }

            ColumnLayout {
                anchors.fill: parent
                spacing: 0
                visible: win.loggedIn

                RowLayout {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 48
                    Layout.leftMargin: 14
                    Layout.rightMargin: 8
                    spacing: 8

                    Icon {
                        name: Views.icon(win.view, win.listId)
                        size: 18
                        color: (Store.listsRevision, win.view === "list" && Store.listMap(win.listId).color) || Theme.accent
                    }
                    Text {
                        Layout.fillWidth: true
                        text: Views.title(win.view, win.listId)
                        elide: Text.ElideRight
                        color: Theme.text
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontLg - 2
                        font.weight: Font.Bold
                    }
                    // empty rather than hidden so the layout keeps it in place
                    Text {
                        text: tasks.openCount > 0 ? tasks.openCount : ""
                        color: Theme.textMuted
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontSm
                        font.weight: Font.DemiBold
                    }
                    Icon {
                        name: "wifi-off"
                        size: 15
                        opacity: Sync.online ? 0 : 1
                        implicitWidth: Sync.online ? 0 : size
                        color: Theme.textFaint
                        HoverHandler { id: offHover }
                        ToolTip.visible: offHover.hovered
                        ToolTip.text: Tr.t("layout.offline")
                    }
                    IconButton {
                        id: syncButton
                        iconName: "refresh-cw"
                        iconSize: 15
                        tip: Tr.t("desktop.tray.syncNow")
                        onClicked: Sync.refresh()
                        RotationAnimator on rotation {
                            running: Sync.syncing
                            loops: Animation.Infinite
                            from: 0; to: 360; duration: 900
                            onStopped: syncButton.rotation = 0
                        }
                    }
                    IconButton {
                        iconName: "sticky-note"
                        iconSize: 15
                        active: App.stickyVisible
                        tip: Tr.t("desktop.tray.sticky")
                        onClicked: App.toggleSticky()
                    }
                    IconButton {
                        iconName: "app-window"
                        iconSize: 15
                        tip: Tr.t("desktop.tray.open")
                        onClicked: App.showMain()
                    }
                }

                Flickable {
                    id: chipFlick
                    Layout.fillWidth: true
                    Layout.preferredHeight: 42
                    contentWidth: chipRow.implicitWidth + 20
                    flickableDirection: Flickable.HorizontalFlick
                    boundsBehavior: Flickable.StopAtBounds
                    clip: true
                    ScrollBar.horizontal: OScrollBar { policy: ScrollBar.AsNeeded }

                    WheelHandler {
                        acceptedDevices: PointerDevice.Mouse
                        orientation: Qt.Vertical
                        onWheel: (ev) => chipFlick.contentX = Math.max(0, Math.min(chipFlick.contentWidth - chipFlick.width,
                                                                                  chipFlick.contentX - ev.angleDelta.y / 2))
                    }

                    Row {
                        id: chipRow
                        x: 10
                        anchors.verticalCenter: parent.verticalCenter
                        spacing: 2

                        Repeater {
                            id: chipRepeater
                            readonly property var keys: {
                                const k = ["today", "week", "overdue", "all"]
                                for (let i = 0; i < lists.count; ++i)
                                    k.push("list:" + lists.get(i).listId)
                                return k
                            }
                            function indexOf(k) { return Math.max(0, keys.indexOf(k)) }
                            model: ["today", "week", "overdue", "all"]
                            delegate: Chip {
                                required property string modelData
                                iconName: Views.icon(modelData)
                                iconColor: modelData === "overdue" && Store.overdueCount > 0 ? Theme.red500 : Theme.textMuted
                                label: Views.shortTitle(modelData)
                                count: (Store.tasksRevision, Store.countFor(modelData))
                                selected: win.view === modelData
                                onClicked: win.show_(modelData, "")
                                ToolTip.visible: hovered && !selected
                                ToolTip.delay: 500
                                ToolTip.text: label
                            }
                        }

                        Rectangle {
                            width: 1
                            height: 18
                            anchors.verticalCenter: parent.verticalCenter
                            color: Theme.border
                            visible: lists.count > 0
                        }

                        Repeater {
                            model: lists
                            // chip is a Rectangle so the lists own color role is read through model rather than as a property
                            delegate: Chip {
                                required property var model
                                iconName: model.icon || "list"
                                iconColor: model.color || Theme.textMuted
                                label: model.name
                                count: model.openCount
                                selected: win.view === "list" && win.listId === model.listId
                                onClicked: win.show_("list", model.listId)
                                ToolTip.visible: hovered && !selected
                                ToolTip.delay: 500
                                ToolTip.text: model.name
                            }
                        }
                    }
                }

                Rectangle { Layout.fillWidth: true; height: 1; color: Theme.border }

                Item {
                    Layout.fillWidth: true
                    Layout.fillHeight: true

                    ListView {
                        id: taskList
                        anchors.fill: parent
                        model: tasks
                        clip: true
                        currentIndex: -1
                        boundsBehavior: Flickable.StopAtBounds
                        keyNavigationEnabled: false
                        ScrollBar.vertical: OScrollBar {}

                        highlight: Rectangle {
                            color: "transparent"
                            border.width: 1
                            border.color: Theme.accent
                            visible: content.activeFocus
                        }
                        highlightMoveDuration: 80

                        delegate: PopupRow {
                            width: ListView.view.width
                            showList: win.view !== "list"
                            onActivated: tasks.toggle(taskId)
                            onOpenRequested: App.openTask(taskId)
                        }

                        add: Transition {
                            NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Theme.slideIn }
                            NumberAnimation { property: "x"; from: -12; to: 0; duration: Theme.slideIn; easing.type: Easing.OutCubic }
                        }
                        remove: Transition {
                            NumberAnimation { property: "opacity"; to: 0; duration: Theme.fadeOut }
                            NumberAnimation { property: "x"; to: 24; duration: Theme.fadeOut; easing.type: Easing.InCubic }
                        }
                        displaced: Transition {
                            NumberAnimation { property: "y"; duration: Theme.fadeOut; easing.type: Easing.OutCubic }
                        }
                    }

                    EmptyState {
                        anchors.centerIn: parent
                        visible: taskList.count === 0
                        mascotSize: 84
                        title: Views.emptyTitle(win.view)
                        description: Store.empty ? Tr.t("desktop.popup.noLists") : ""
                    }
                }

                Rectangle { Layout.fillWidth: true; height: 1; color: Theme.border }

                Item {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 60
                    visible: Views.canAdd(win.view, win.listId)

                    OInput {
                        id: input
                        anchors.fill: parent
                        anchors.margins: 10
                        compact: true
                        leadingIcon: "plus"
                        placeholderText: win.view === "list"
                            ? Tr.t("desktop.popup.addTo", { list: Views.title("list", win.listId) })
                            : Tr.t("common.addTask")
                        Keys.onReturnPressed: submit()
                        Keys.onEnterPressed: submit()
                        Keys.onEscapePressed: (e) => {
                            if (text !== "") { text = ""; e.accepted = true }
                            else App.hidePopup()
                        }
                        function submit() {
                            if (text.trim() === "") return
                            if (Views.addTask(win.view, win.listId, text))
                                text = ""
                        }
                    }

                    Row {
                        anchors.right: input.right
                        anchors.rightMargin: 10
                        anchors.verticalCenter: input.verticalCenter
                        spacing: 6
                        readonly property var p: input.text.length > 2 ? QuickAdd.preview(input.text) : ({})
                        Text {
                            visible: !!parent.p.dueLabel
                            text: parent.p.dueLabel || ""
                            color: Theme.accent
                            font.family: Theme.fontFamily
                            font.pixelSize: 11
                            font.weight: Font.Bold
                        }
                        PriorityDot { priority: parent.p.priority || "none"; anchors.verticalCenter: parent.verticalCenter }
                        Icon { visible: !!parent.p.recurrence; name: "repeat"; size: 12; color: Theme.accent }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 34
                    color: Theme.dark ? Theme.ink900 : Theme.gray50

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 14
                        anchors.rightMargin: 14
                        Text {
                            Layout.fillWidth: true
                            elide: Text.ElideRight
                            text: !Sync.online ? Tr.t("layout.offline")
                                : Sync.stalePendingCount > 0 ? Tr.tc("layout.syncing", Sync.stalePendingCount)
                                : Tr.t("desktop.popup.hint")
                            color: Theme.textFaint
                            font.family: Theme.fontFamily
                            font.pixelSize: 11
                        }
                        Text {
                            text: Tr.t("desktop.tray.open")
                            color: openHover.hovered ? Theme.accentHover : Theme.accent
                            font.family: Theme.fontFamily
                            font.pixelSize: 11
                            font.weight: Font.Bold
                            font.capitalization: Font.AllUppercase
                            font.letterSpacing: 0.5
                            HoverHandler { id: openHover; cursorShape: Qt.PointingHandCursor }
                            TapHandler { onTapped: App.showMain() }
                        }
                    }
                }
            }
        }
    }

    Connections {
        target: Store
        function onListsChanged() {
            if (win.view === "list" && !Store.listMap(win.listId).id)
                win.show_("today", "")
        }
    }
}
