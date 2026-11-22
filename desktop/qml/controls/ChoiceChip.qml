import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask

AbstractButton {
    id: root
    property bool selected: false
    property string iconName: ""
    property color tint: Theme.text
    property bool compact: false

    hoverEnabled: true
    focusPolicy: Qt.StrongFocus
    implicitHeight: compact ? 28 : 36
    implicitWidth: Math.max(implicitHeight, row.implicitWidth + (compact ? 16 : 24))
    Accessible.name: text
    Accessible.checkable: true
    Accessible.checked: selected

    readonly property color fg: selected ? (Theme.dark ? Theme.orange300 : Theme.orange700) : tint

    background: Rectangle {
        radius: 2
        color: root.selected ? (Theme.dark ? Qt.rgba(0.26, 0.08, 0.03, 0.4) : Theme.orange50)
                             : root.hovered ? Theme.hover : "transparent"
        border.width: 1
        border.color: root.selected ? Theme.accent : root.activeFocus ? Theme.accent : Theme.inputBorder
        Behavior on color { ColorAnimation { duration: Theme.hoverMs } }
    }
    contentItem: Item {
        RowLayout {
            id: row
            anchors.centerIn: parent
            spacing: 6
            Icon {
                visible: root.iconName !== ""
                name: root.iconName
                size: 14
                color: root.fg
            }
            Text {
                visible: root.text !== ""
                text: root.text
                font.family: Theme.fontFamily
                font.pixelSize: root.compact ? Theme.fontXs : Theme.fontSm
                font.weight: root.selected ? Font.DemiBold : Font.Normal
                color: root.fg
            }
        }
    }
}
