import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Item {
    id: root
    property string view: "today"
    property string listId: ""
    property string selectedId: ""
    signal taskDeleted(string taskId, string title)

    readonly property bool isList: view === "list"
    readonly property var list: { Store.listsRevision; return isList ? Store.listMap(listId) : ({}) }
    readonly property bool listMissing: isList && !list.id
    readonly property bool canAdd: { Store.listsRevision; return Views.canAdd(view, listId) }
    readonly property bool isOwner: (list.my_role || "owner") === "owner"
    readonly property bool loading: isList && Sync.loadingLists.indexOf(listId) >= 0
    property string shownView: view
    property string shownListId: listId
    property bool switching: false

    function focusQuickAdd() {
        if (quickAdd.visible) quickAdd.focusInput()
    }
    function openTask(id) {
        selectedId = id
        const row = tasks.indexOf(id)
        if (row >= 0) {
            taskList.currentIndex = row
            taskList.positionViewAtIndex(row, ListView.Contain)
        }
    }
    function closeDetail() {
        selectedId = ""
        taskList.forceActiveFocus()
    }
    function deleteTask(id) {
        const t = Store.taskMap(id)
        if (!t.id) return
        if (id === selectedId) selectedId = ""
        Sync.deleteTask(id)
        taskDeleted(id, t.title || "")
    }
    function cyclePriority(id) {
        const order = ["none", "low", "medium", "high"]
        const cur = Store.taskMap(id).priority || "none"
        Sync.updateTask(id, { priority: order[(order.indexOf(cur) + 1) % order.length] })
    }

    onViewChanged: reset()
    onListIdChanged: reset()
    Component.onCompleted: if (isList) Sync.openList(listId)
    function reset() {
        switching = true
        if (isList) Sync.openList(listId)
        tasks.releaseHolds()
        selectedId = ""
        taskList.currentIndex = -1
        taskList.positionViewAtBeginning()
    }

    Connections {
        target: root.Window.window
        enabled: root.switching
        function onFrameSwapped() {
            const changed = root.shownView !== root.view || root.shownListId !== root.listId
            root.shownView = root.view
            root.shownListId = root.listId
            if (!changed) root.switching = false
        }
    }
    Connections {
        target: tasks
        function onModelReset() {
            root.switching = false
            const row = root.selectedId ? tasks.indexOf(root.selectedId) : -1
            if (row >= 0) {
                taskList.currentIndex = row
                taskList.positionViewAtIndex(row, ListView.Contain)
            }
        }
    }

    TaskModel {
        id: tasks
        view: root.shownView
        targetId: root.shownListId
        includeDone: root.shownView === "list" || root.shownView === "all"
        holdMs: 600
    }

    RowLayout {
        anchors.fill: parent
        spacing: 0

        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.minimumWidth: 320
            spacing: 0

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 56
                color: "transparent"
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 24
                    anchors.rightMargin: 16
                    spacing: 10
                    Icon {
                        name: Views.icon(root.view, root.listId)
                        size: 20
                        color: root.isList && root.list.color ? root.list.color : Theme.accent
                    }
                    Text {
                        Layout.fillWidth: true
                        text: root.listMissing ? Tr.t("list.notFound") : Views.title(root.view, root.listId)
                        elide: Text.ElideRight
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontLg
                        font.weight: Font.Bold
                        font.capitalization: Font.AllUppercase
                        font.letterSpacing: 0.8
                        color: Theme.text
                    }
                    Icon {
                        id: headerSpinner
                        visible: root.loading && taskList.count > 0 && !root.switching
                        name: "loader"
                        size: 15
                        color: Theme.textFaint
                        RotationAnimator on rotation { running: headerSpinner.visible; loops: Animation.Infinite; from: 0; to: 360; duration: 900 }
                    }
                    Text {
                        visible: tasks.openCount > 0
                        text: tasks.openCount
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontSm
                        font.weight: Font.DemiBold
                        color: Theme.textMuted
                    }
                    IconButton {
                        visible: root.isList && !root.listMissing
                        iconName: root.list.is_shared ? "users" : "user-plus"
                        tip: Tr.t("list.shareLabel")
                        onClicked: shareDialog.open()
                    }
                    IconButton {
                        id: optionsButton
                        visible: root.isList && !root.listMissing
                        iconName: "more-horizontal"
                        tip: Tr.t("list.optionsLabel")
                        active: listMenu.visible
                        onClicked: listMenu.popup(optionsButton, 0, optionsButton.height + 4)
                        OMenu {
                            id: listMenu
                            OMenuItem {
                                enabled: root.isOwner
                                text: Tr.t("common.edit")
                                iconName: "pencil"
                                onTriggered: listEditor.openFor(root.listId)
                            }
                            OMenuItem {
                                text: Tr.t("list.shareLabel")
                                iconName: "user-plus"
                                onTriggered: shareDialog.open()
                            }
                            OMenuItem {
                                visible: root.isOwner
                                height: visible ? implicitHeight : 0
                                text: Tr.t("list.deleteList")
                                iconName: "trash"
                                danger: true
                                onTriggered: deleteConfirm.open()
                            }
                        }
                    }
                }
                Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
            }

            ListView {
                id: taskList
                Layout.fillWidth: true
                Layout.fillHeight: true
                clip: true
                model: tasks
                currentIndex: -1
                keyNavigationEnabled: true
                activeFocusOnTab: true
                boundsBehavior: Flickable.StopAtBounds
                highlightMoveDuration: 0
                ScrollBar.vertical: OScrollBar {}

                readonly property string currentTaskId: currentIndex >= 0 ? tasks.idAt(currentIndex) : ""

                add: Transition {
                    NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Theme.slideIn }
                    NumberAnimation { property: "x"; from: -8; to: 0; duration: Theme.slideIn; easing.type: Easing.OutCubic }
                }
                remove: Transition {
                    NumberAnimation { property: "opacity"; to: 0; duration: Theme.fadeOut }
                }
                displaced: Transition {
                    NumberAnimation { properties: "y"; duration: 180; easing.type: Easing.OutCubic }
                }

                delegate: TaskDelegate {
                    id: row
                    visible: !root.switching
                    width: taskList.width
                    selected: root.selectedId === taskId
                    focused: taskList.activeFocus && taskList.currentIndex === index
                    showList: !root.isList
                    reorderable: root.isList && root.canAdd
                    reorderView: taskList
                    reorderModel: tasks
                    reorderFlickable: taskList
                    onOpenRequested: {
                        taskList.currentIndex = index
                        root.selectedId = taskId
                    }
                    onToggleRequested: tasks.toggle(taskId)
                    onDeleteRequested: root.deleteTask(taskId)
                }

                Keys.onPressed: (e) => {
                    const id = currentTaskId
                    if (e.key === Qt.Key_J) {
                        incrementCurrentIndex()
                    } else if (e.key === Qt.Key_K && !(e.modifiers & Qt.ControlModifier)) {
                        decrementCurrentIndex()
                    } else if (!id) {
                        if ((e.key === Qt.Key_Down || e.key === Qt.Key_Up) && count > 0)
                            currentIndex = 0
                        else
                            return
                    } else if (e.key === Qt.Key_Space || e.key === Qt.Key_X) {
                        tasks.toggle(id)
                    } else if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter || e.key === Qt.Key_E) {
                        root.selectedId = id
                    } else if (e.key === Qt.Key_Delete || e.key === Qt.Key_Backspace) {
                        root.deleteTask(id)
                    } else if (e.key === Qt.Key_P) {
                        root.cyclePriority(id)
                    } else if (e.key === Qt.Key_D) {
                        root.selectedId = id
                    } else if (e.key === Qt.Key_Escape) {
                        if (root.selectedId) root.closeDetail()
                        else currentIndex = -1
                    } else {
                        return
                    }
                    e.accepted = true
                }

                Icon {
                    id: listSpinner
                    anchors.centerIn: parent
                    visible: root.switching || (root.loading && taskList.count === 0)
                    name: "loader"
                    size: 28
                    color: Theme.textFaint
                    RotationAnimator on rotation { running: listSpinner.visible; loops: Animation.Infinite; from: 0; to: 360; duration: 900 }
                }
                EmptyState {
                    anchors.centerIn: parent
                    visible: taskList.count === 0 && !root.listMissing && !root.loading && !root.switching
                    title: Views.emptyTitle(root.view)
                    description: Views.emptyDescription(root.view)
                }
            }

            QuickAddBar {
                id: quickAdd
                Layout.fillWidth: true
                visible: root.canAdd && !root.listMissing
                view: root.view
                listId: root.listId
                onAdded: (id) => {
                    const row = tasks.indexOf(id)
                    if (row >= 0) taskList.positionViewAtIndex(row, ListView.Contain)
                }
            }
        }

        TaskDetail {
            id: detail
            visible: root.selectedId !== ""
            Layout.fillHeight: true
            Layout.preferredWidth: implicitWidth
            Layout.maximumWidth: root.width * 0.6
            taskId: root.selectedId
            onCloseRequested: root.closeDetail()
            onDeleteRequested: (id) => root.deleteTask(id)
        }
    }

    ListEditor { id: listEditor }

    ShareDialog {
        id: shareDialog
        listId: root.listId
        listName: root.list.name || ""
        isOwner: root.isOwner
    }

    ODialog {
        id: deleteConfirm
        title: Tr.t("list.deleteList")
        preferredWidth: 400
        Text {
            Layout.fillWidth: true
            Layout.topMargin: 4
            wrapMode: Text.Wrap
            text: Tr.t("list.deleteConfirm", { name: root.list.name || "" })
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontSm
            color: Theme.text
        }
        footer: [
            OButton {
                danger: true
                text: Tr.t("common.delete")
                onClicked: {
                    const id = root.listId
                    deleteConfirm.close()
                    App.showPage("today")
                    Sync.deleteList(id)
                }
            },
            OButton {
                primary: false
                text: Tr.t("common.cancel")
                onClicked: deleteConfirm.close()
            }
        ]
    }
}
