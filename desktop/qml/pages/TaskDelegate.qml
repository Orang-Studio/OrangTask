import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Rectangle {
    id: root
    required property int index
    required property string taskId
    required property string title
    required property bool done
    required property string priority
    required property string dueLabel
    required property bool overdue
    required property string listName
    required property int subtaskCount
    required property var tagNames
    required property string assignedTo
    required property string assigneeName
    required property string assigneeAvatar
    required property int assigneeCount
    required property string recurrenceRule
    required property bool pending
    required property bool held
    property bool selected: false
    property bool focused: false
    property bool showList: true
    property bool reorderable: false
    property var reorderView: null
    property var reorderModel: null
    property Flickable reorderFlickable: null
    signal openRequested()
    signal toggleRequested()
    signal deleteRequested()

    readonly property bool hasMeta: dueLabel !== "" || subtaskCount > 0 || (tagNames && tagNames.length > 0)
                                    || assignedTo !== "" || (showList && listName !== "") || recurrenceRule !== ""

    implicitHeight: Math.max(52, content.implicitHeight + 24)
    color: reorder.grabbed ? Theme.surface : selected ? Theme.selected : mouse.containsMouse ? Theme.hover : Theme.surface
    z: reorder.grabbed ? 10 : 0
    transform: Translate { y: reorder.offset }
    opacity: held ? 0.55 : pending ? 0.8 : 1
    Behavior on color { ColorAnimation { duration: Theme.hoverMs } }
    Behavior on opacity { NumberAnimation { duration: Theme.fadeOut } }

    Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
    Rectangle {
        visible: root.focused || reorder.grabbed
        anchors.fill: parent
        color: "transparent"
        border.width: 1
        border.color: Theme.accent
    }

    MouseArea {
        id: mouse
        anchors.fill: parent
        hoverEnabled: true
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        cursorShape: reorder.grabbed ? Qt.ClosedHandCursor : Qt.PointingHandCursor
        onClicked: (e) => {
            if (reorder.reordering) return
            e.button === Qt.RightButton ? root.openMenu() : root.openRequested()
        }
    }

    HoldToReorder {
        id: reorder
        enabled: root.reorderable && root.reorderView !== null
        index: root.index
        view: root.reorderView
        model: root.reorderModel
        flickable: root.reorderFlickable
        handle: gripHandle
        ignore: [check, trash]
    }

    function openMenu() {
        const m = menuComponent.createObject(root)
        m.closed.connect(m.destroy)
        m.popup()
    }
    Component {
        id: menuComponent
        OMenu {
            OMenuItem {
                text: root.done ? Tr.t("taskItem.markIncomplete") : Tr.t("taskItem.markComplete")
                iconName: root.done ? "rotate-ccw" : "check"
                onTriggered: root.toggleRequested()
            }
            OMenuItem {
                text: Tr.t("desktop.popup.openTask")
                iconName: "pencil"
                onTriggered: root.openRequested()
            }
            OMenu {
                title: Tr.t("desktop.task.priority")
                Repeater {
                    model: ["high", "medium", "low", "none"]
                    delegate: OMenuItem {
                        required property string modelData
                        text: Tr.t("priority." + modelData)
                        checkable: true
                        checked: root.priority === modelData
                        onTriggered: Sync.updateTask(root.taskId, { priority: modelData })
                    }
                }
            }
            OMenuItem {
                text: Tr.t("common.delete")
                iconName: "trash"
                danger: true
                onTriggered: root.deleteRequested()
            }
        }
    }

    RowLayout {
        id: content
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        anchors.leftMargin: root.reorderable ? 6 : 16
        anchors.rightMargin: 12
        spacing: 12

        Item {
            id: gripHandle
            visible: root.reorderable
            implicitWidth: 24
            implicitHeight: 32
            Layout.alignment: Qt.AlignVCenter

            HoverHandler {
                id: gripHover
                cursorShape: reorder.grabbed ? Qt.ClosedHandCursor : Qt.OpenHandCursor
            }

            Icon {
                id: grip
                anchors.centerIn: parent
                name: "grip-vertical"
                size: 14
                color: gripHover.hovered || reorder.grabbed ? Theme.textMuted : Theme.textFaint
                opacity: mouse.containsMouse || gripHover.hovered || reorder.grabbed ? 1 : 0.35
                Behavior on opacity { NumberAnimation { duration: Theme.hoverMs } }
            }
        }

        OCheckbox {
            id: check
            checked: root.done
            size: 24
            Layout.alignment: Qt.AlignVCenter
            Accessible.name: root.done ? Tr.t("taskItem.markIncomplete") : Tr.t("taskItem.markComplete")
            onToggled: root.toggleRequested()
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4

            RowLayout {
                spacing: 8
                Layout.fillWidth: true
                PriorityDot {
                    priority: root.priority
                    visible: root.priority !== "none" && root.priority !== ""
                }
                Text {
                    Layout.fillWidth: true
                    text: root.title
                    elide: Text.ElideRight
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontBase
                    font.strikeout: root.done
                    color: root.done ? Theme.textFaint : Theme.text
                    Behavior on color { ColorAnimation { duration: 200 } }
                }
            }

            Flow {
                visible: root.hasMeta
                Layout.fillWidth: true
                spacing: 8

                Rectangle {
                    visible: root.dueLabel !== ""
                    implicitWidth: dueText.implicitWidth + 12
                    implicitHeight: 20
                    radius: 2
                    color: root.overdue && !root.done ? Theme.overdueBg : Theme.badgeBg
                    Text {
                        id: dueText
                        anchors.centerIn: parent
                        text: root.dueLabel
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontXs
                        color: root.overdue && !root.done ? Theme.overdueText : Theme.badgeText
                    }
                }
                Row {
                    visible: root.recurrenceRule !== ""
                    height: 20
                    Icon { name: "repeat"; size: 12; color: Theme.textMuted; anchors.verticalCenter: parent.verticalCenter }
                }
                Row {
                    visible: root.subtaskCount > 0
                    height: 20
                    spacing: 3
                    Icon { name: "git-branch"; size: 11; color: Theme.textMuted; anchors.verticalCenter: parent.verticalCenter }
                    Text {
                        text: root.subtaskCount
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontXs
                        color: Theme.textMuted
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
                Repeater {
                    model: root.tagNames || []
                    delegate: Rectangle {
                        required property string modelData
                        implicitWidth: tagText.implicitWidth + 12
                        implicitHeight: 20
                        radius: 2
                        color: Theme.tagBg
                        Text {
                            id: tagText
                            anchors.centerIn: parent
                            text: parent.modelData
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontXs
                            color: Theme.tagText
                        }
                    }
                }
                Row {
                    visible: root.assignedTo !== ""
                    height: 20
                    spacing: 4
                    Avatar {
                        size: 16
                        name: root.assigneeName
                        url: root.assigneeAvatar
                        anchors.verticalCenter: parent.verticalCenter
                    }
                    Text {
                        text: root.assigneeName + (root.assigneeCount > 1 ? " +" + (root.assigneeCount - 1) : "")
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontXs
                        color: Theme.textMuted
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
                Text {
                    visible: root.showList && root.listName !== ""
                    height: 20
                    verticalAlignment: Text.AlignVCenter
                    text: root.listName
                    elide: Text.ElideRight
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontXs
                    color: Theme.textFaint
                }
            }
        }

        IconButton {
            id: trash
            iconName: "trash"
            iconSize: 16
            hoverColor: Theme.red500
            tip: Tr.t("common.delete")
            opacity: mouse.containsMouse || hovered ? 1 : 0
            Behavior on opacity { NumberAnimation { duration: Theme.hoverMs } }
            onClicked: root.deleteRequested()
        }
    }
}
