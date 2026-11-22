import QtQuick
import QtQuick.Controls.Basic
import OrangTask

AbstractButton {
    id: root
    property string iconName: "x"
    property int iconSize: 18
    property color iconColor: Theme.textMuted
    property color hoverColor: Theme.text
    property string tip: ""
    property bool active: false

    implicitWidth: 32
    implicitHeight: 32
    hoverEnabled: true
    focusPolicy: Qt.TabFocus
    Accessible.name: tip

    contentItem: Item {
        Icon {
            anchors.centerIn: parent
            name: root.iconName
            size: root.iconSize
            color: root.active ? Theme.accent : root.hovered ? root.hoverColor : root.iconColor
        }
    }
    background: Rectangle {
        radius: 4
        color: root.down ? Theme.secondaryHover : root.hovered || root.active ? Theme.hover : "transparent"
        border.width: root.visualFocus ? 1 : 0
        border.color: Theme.accent
    }

    ToolTip.visible: tip !== "" && hovered
    ToolTip.delay: 600
    ToolTip.text: tip
}
