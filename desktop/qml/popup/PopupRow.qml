import QtQuick
import QtQuick.Layouts
import OrangTask

Rectangle {
    id: root
    required property string taskId
    required property string title
    required property bool done
    required property string priority
    required property string dueLabel
    required property bool overdue
    required property string listName
    required property string listColor
    required property string listIcon
    required property int subtaskCount
    required property string recurrenceRule
    required property bool held
    property bool showList: false
    signal activated()
    signal openRequested()

    implicitHeight: 44
    color: mouse.containsMouse ? Theme.hover : "transparent"
    Behavior on color { ColorAnimation { duration: Theme.hoverMs } }

    MouseArea {
        id: mouse
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        acceptedButtons: Qt.LeftButton | Qt.MiddleButton
        onClicked: (e) => e.button === Qt.MiddleButton ? root.openRequested() : root.activated()

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 14
            anchors.rightMargin: 10
            spacing: 10

            OCheckbox {
                checked: root.done
                size: 20
                hovered: mouse.containsMouse
                interactive: false
                Layout.alignment: Qt.AlignVCenter
            }

            Text {
                id: titleText
                Layout.fillWidth: true
                text: root.title
                elide: Text.ElideRight
                color: root.done ? Theme.textFaint : Theme.text
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontSm
                font.strikeout: root.done
                Behavior on color { ColorAnimation { duration: 200 } }
            }

            Icon {
                visible: root.recurrenceRule !== ""
                name: "repeat"
                size: 12
                color: Theme.textFaint
            }

            PriorityDot { priority: root.priority; size: 7 }

            Text {
                visible: root.dueLabel !== ""
                text: root.dueLabel
                color: root.overdue && !root.done ? Theme.overdueText : Theme.textMuted
                font.family: Theme.fontFamily
                font.pixelSize: 11
                font.weight: Font.DemiBold
            }

            Icon {
                visible: root.showList && root.listIcon !== ""
                name: root.listIcon
                size: 13
                color: root.listColor !== "" ? root.listColor : Theme.textFaint
            }

            IconButton {
                visible: mouse.containsMouse && !root.done
                implicitWidth: 24
                implicitHeight: 24
                iconName: "arrow-up-right"
                iconSize: 14
                tip: Tr.t("desktop.popup.openTask")
                onClicked: root.openRequested()
            }
        }

    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.leftMargin: 14
        height: 1
        color: Theme.border
        opacity: 0.6
    }

    Accessible.role: Accessible.CheckBox
    Accessible.name: title
    Accessible.checked: done
}
