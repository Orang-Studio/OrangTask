import QtQuick
import QtQuick.Controls.Basic
import OrangTask

Button {
    id: root
    property bool primary: true
    property bool danger: false
    property bool compact: false
    property string iconName: ""
    property url iconSource: ""     // untinted image, e.g. a brand logo

    implicitHeight: compact ? Theme.controlHeightSm : Theme.controlHeight
    implicitWidth: Math.max(implicitHeight, contentItem.implicitWidth + leftPadding + rightPadding)
    leftPadding: compact ? 14 : 20
    rightPadding: leftPadding
    hoverEnabled: true
    focusPolicy: Qt.StrongFocus
    opacity: enabled ? 1 : 0.5

    readonly property color fg: primary || danger ? "#ffffff" : Theme.secondaryText

    font.family: Theme.fontFamily
    font.pixelSize: compact ? Theme.fontXs : Theme.fontSm
    font.weight: Font.Bold
    font.capitalization: Font.AllUppercase
    font.letterSpacing: 0.6

    contentItem: Row {
        spacing: 8
        anchors.centerIn: parent
        Icon {
            visible: root.iconName !== ""
            name: root.iconName
            color: root.fg
            size: root.compact ? 14 : 16
            anchors.verticalCenter: parent.verticalCenter
        }
        Image {
            visible: root.iconSource != ""
            source: root.iconSource
            width: root.compact ? 14 : 16
            height: width
            sourceSize: Qt.size(width * 2, height * 2)
            anchors.verticalCenter: parent.verticalCenter
        }
        Text {
            text: root.text
            font: root.font
            color: root.fg
            visible: text !== ""
            anchors.verticalCenter: parent.verticalCenter
        }
    }

    background: Rectangle {
        radius: 0
        color: root.danger ? (root.hovered ? Theme.red600 : Theme.red500)
             : root.primary ? (root.hovered || root.down ? Theme.accentHover : Theme.accent)
             : (root.hovered || root.down ? Theme.secondaryHover : Theme.secondaryBg)
        border.width: root.primary || root.danger ? 0 : 1
        border.color: Theme.border
        Behavior on color { ColorAnimation { duration: Theme.hoverMs } }
        Rectangle {
            anchors.fill: parent
            anchors.margins: -3
            color: "transparent"
            border.width: 2
            border.color: Theme.accent
            visible: root.visualFocus
            opacity: 0.6
        }
    }
}
