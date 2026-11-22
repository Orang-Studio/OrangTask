import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Templates as T
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Popup {
    id: root
    signal navigate(string page, string view, string listId)
    signal taskChosen(string taskId)

    property int selectedIdx: 0
    readonly property string query: input.text.trim()

    readonly property var results: {
        Store.listsRevision
        Store.tasksRevision
        I18n.revision
        const q = query.toLowerCase()
        const places = []
        for (const v of Views.smart)
            places.push({ kind: "place", page: "tasks", view: v, listId: "", icon: Views.icon(v), title: Views.shortTitle(v) })
        for (const l of Store.listList())
            places.push({ kind: "place", page: "tasks", view: "list", listId: l.id, icon: l.icon || "hash", color: l.color || "", title: l.name })
        places.push({ kind: "place", page: "scratchpads", view: "", listId: "", icon: "notebook-pen", title: Tr.t("scratchpads.title") })
        places.push({ kind: "place", page: "settings", view: "", listId: "", icon: "settings", title: Tr.t("settings.title") })
        const matched = q ? places.filter(p => p.title.toLowerCase().includes(q)) : places
        if (q.length < 2) return matched
        const tasks = Store.search(query, 30).map(t => Object.assign({ kind: "task" }, t))
        return matched.slice(0, 4).concat(tasks)
    }
    onResultsChanged: selectedIdx = 0

    function choose(i) {
        const r = results[i]
        if (!r) return
        close()
        if (r.kind === "task") taskChosen(r.id)
        else navigate(r.page, r.view, r.listId)
    }

    parent: T.Overlay.overlay
    x: Math.round((parent.width - width) / 2)
    y: Math.round(parent.height * 0.15)
    width: Math.min(576, parent.width - 32)
    height: Math.min(implicitHeight, parent.height * 0.7)
    padding: 0
    modal: true
    focus: true
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
    T.Overlay.modal: Rectangle { color: Qt.rgba(0, 0, 0, 0.5) }

    onOpened: {
        input.text = ""
        selectedIdx = 0
        input.forceActiveFocus()
    }

    enter: Transition {
        ParallelAnimation {
            NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Theme.slideIn }
            NumberAnimation { property: "y"; from: root.parent.height * 0.15 - 20; to: root.parent.height * 0.15; duration: Theme.slideIn; easing.type: Easing.OutCubic }
        }
    }
    exit: Transition { NumberAnimation { property: "opacity"; to: 0; duration: 120 } }

    background: Rectangle {
        color: Theme.dark ? Theme.ink850 : "#ffffff"
        border.width: 1
        border.color: Theme.dark ? Theme.ink600 : Theme.gray200
    }

    contentItem: ColumnLayout {
        spacing: 0

        RowLayout {
            Layout.fillWidth: true
            Layout.leftMargin: 16
            Layout.rightMargin: 16
            spacing: 12
            Icon { name: "search"; size: 18; color: Theme.textFaint }
            TextField {
                id: input
                Layout.fillWidth: true
                implicitHeight: 54
                background: null
                leftPadding: 0
                placeholderText: Tr.t("commandPalette.searchPlaceholder")
                placeholderTextColor: Theme.textFaint
                color: Theme.text
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontBase
                selectionColor: Theme.orange300
                selectedTextColor: Theme.ink900
                selectByMouse: true
                Keys.onPressed: (e) => {
                    if (e.key === Qt.Key_Down) {
                        root.selectedIdx = Math.min(root.selectedIdx + 1, root.results.length - 1)
                        resultList.positionViewAtIndex(root.selectedIdx, ListView.Contain)
                    } else if (e.key === Qt.Key_Up) {
                        root.selectedIdx = Math.max(root.selectedIdx - 1, 0)
                        resultList.positionViewAtIndex(root.selectedIdx, ListView.Contain)
                    } else if (e.key === Qt.Key_Return || e.key === Qt.Key_Enter) {
                        root.choose(root.selectedIdx)
                    } else {
                        return
                    }
                    e.accepted = true
                }
            }
        }
        Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Theme.border }

        Text {
            visible: root.results.length === 0
            Layout.fillWidth: true
            Layout.topMargin: 32
            Layout.bottomMargin: 32
            horizontalAlignment: Text.AlignHCenter
            text: root.query.length < 2 ? Tr.t("commandPalette.minChars")
                                        : Tr.t("commandPalette.noResults", { query: root.query })
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontSm
            color: Theme.textFaint
        }

        ListView {
            id: resultList
            visible: count > 0
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.preferredHeight: contentHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            model: root.results
            ScrollBar.vertical: OScrollBar {}

            delegate: AbstractButton {
                id: row
                required property var modelData
                required property int index
                readonly property bool current: index === root.selectedIdx
                readonly property bool isTask: modelData.kind === "task"
                width: resultList.width
                implicitHeight: isTask ? 56 : 44
                leftPadding: 16
                rightPadding: 16
                hoverEnabled: true
                onHoveredChanged: if (hovered) root.selectedIdx = index
                onClicked: root.choose(index)

                background: Rectangle { color: row.current ? Theme.selected : "transparent" }
                contentItem: RowLayout {
                    spacing: 12

                    PriorityDot {
                        visible: row.isTask
                        priority: row.modelData.priority || "none"
                    }
                    Icon {
                        visible: !row.isTask
                        name: row.modelData.icon || "list"
                        size: 16
                        color: row.modelData.color || Theme.textMuted
                    }
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Text {
                            Layout.fillWidth: true
                            text: row.modelData.title || ""
                            elide: Text.ElideRight
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontSm
                            font.strikeout: row.isTask && row.modelData.status === "done"
                            color: row.isTask && row.modelData.status === "done" ? Theme.textFaint : Theme.text
                        }
                        Text {
                            visible: row.isTask
                            Layout.fillWidth: true
                            text: (row.modelData.list_name || "")
                                  + (row.modelData.due_date ? " · " + Format.dueLabel(row.modelData.due_date) : "")
                            elide: Text.ElideRight
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontXs
                            color: Theme.textFaint
                        }
                    }
                    Icon {
                        visible: row.current
                        name: "corner-down-left"
                        size: 14
                        color: Theme.textFaint
                    }
                }
            }
        }
    }
}
