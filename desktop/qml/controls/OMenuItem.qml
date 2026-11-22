import QtQuick
import QtQuick.Controls.Basic
import OrangTask

MenuItem {
    id: root
    property string iconName: ""
    property bool danger: false
    implicitHeight: 34
    hoverEnabled: true
    leftPadding: 10
    rightPadding: 10
    font.family: Theme.fontFamily
    font.pixelSize: Theme.fontSm

    readonly property color fg: danger ? Theme.red500 : Theme.text

    contentItem: Row {
        spacing: 10
        Icon {
            visible: root.iconName !== ""
            name: root.iconName
            size: 16
            color: root.danger ? Theme.red500 : Theme.textMuted
            anchors.verticalCenter: parent.verticalCenter
        }
        Text {
            text: root.text
            font: root.font
            color: root.enabled ? root.fg : Theme.textFaint
            anchors.verticalCenter: parent.verticalCenter
        }
    }
    indicator: Icon {
        visible: root.checkable && root.checked
        name: "check"
        size: 14
        color: Theme.accent
        x: root.width - width - 10
        anchors.verticalCenter: parent.verticalCenter
    }
    arrow: Icon {
        visible: root.subMenu
        name: "chevron-right"
        size: 14
        color: Theme.textMuted
        x: root.width - width - 8
        anchors.verticalCenter: parent.verticalCenter
    }
    background: Rectangle {
        radius: 2
        color: root.highlighted ? Theme.hover : "transparent"
    }
}
