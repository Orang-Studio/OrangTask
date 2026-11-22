import QtQuick
import OrangTask

Rectangle {
    id: root
    property string iconName: "list"
    property color iconColor: Theme.textMuted
    property string label: ""
    property int count: 0
    property bool selected: false
    property bool showLabel: selected
    readonly property bool hovered: mouse.containsMouse
    signal clicked()

    implicitHeight: 30
    implicitWidth: row.implicitWidth + 16
    radius: 4
    color: selected ? (Theme.dark ? Theme.ink700 : Theme.orange50) : hovered ? Theme.hover : "transparent"
    border.width: selected ? 1 : 0
    border.color: Theme.accent
    Behavior on implicitWidth { NumberAnimation { duration: 150; easing.type: Easing.OutCubic } }

    Row {
        id: row
        anchors.centerIn: parent
        spacing: 6
        Icon {
            name: root.iconName
            size: 15
            color: root.selected ? (root.iconColor.a > 0 ? root.iconColor : Theme.accent) : root.iconColor
            anchors.verticalCenter: parent.verticalCenter
        }
        Text {
            visible: root.showLabel && root.label !== ""
            text: root.label
            color: Theme.text
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontXs
            font.weight: Font.DemiBold
            elide: Text.ElideRight
            width: Math.min(implicitWidth, 110)
            anchors.verticalCenter: parent.verticalCenter
        }
        Text {
            visible: root.count > 0
            text: root.count > 99 ? "99+" : root.count
            color: root.selected ? Theme.accent : Theme.textFaint
            font.family: Theme.fontFamily
            font.pixelSize: 11
            font.weight: Font.Bold
            anchors.verticalCenter: parent.verticalCenter
        }
    }

    MouseArea {
        id: mouse
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.clicked()
    }
}
