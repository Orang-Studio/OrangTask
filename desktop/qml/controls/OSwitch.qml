import QtQuick
import QtQuick.Controls.Basic
import OrangTask

Switch {
    id: root
    property string description: ""
    hoverEnabled: true
    spacing: 12
    padding: 0
    font.family: Theme.fontFamily
    font.pixelSize: Theme.fontSm

    indicator: Rectangle {
        implicitWidth: 40
        implicitHeight: 22
        x: root.width - width
        anchors.verticalCenter: parent.verticalCenter
        radius: height / 2
        color: root.checked ? Theme.accent : (Theme.dark ? Theme.ink500 : Theme.gray300)
        Behavior on color { ColorAnimation { duration: 150 } }
        Rectangle {
            width: 18
            height: 18
            radius: 9
            y: 2
            x: root.checked ? parent.width - width - 2 : 2
            color: "#ffffff"
            Behavior on x { NumberAnimation { duration: 150; easing.type: Easing.OutCubic } }
        }
    }

    contentItem: Column {
        rightPadding: root.indicator.width + root.spacing
        spacing: 2
        Text {
            width: parent.width - parent.rightPadding
            text: root.text
            font: root.font
            color: Theme.text
            wrapMode: Text.WordWrap
        }
        Text {
            width: parent.width - parent.rightPadding
            visible: root.description !== ""
            text: root.description
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontXs
            color: Theme.textMuted
            wrapMode: Text.WordWrap
        }
    }
}
