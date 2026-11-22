import QtQuick
import QtQuick.Controls.Basic
import OrangTask

TextField {
    id: root
    property bool compact: false
    property string leadingIcon: ""

    implicitHeight: compact ? Theme.controlHeightSm : Theme.controlHeight
    leftPadding: leadingIcon !== "" ? 36 : 12
    rightPadding: 12
    font.family: Theme.fontFamily
    font.pixelSize: compact ? Theme.fontSm : Theme.fontBase
    color: Theme.text
    placeholderTextColor: Theme.textFaint
    selectionColor: Theme.orange300
    selectedTextColor: Theme.ink900
    selectByMouse: true
    verticalAlignment: TextInput.AlignVCenter

    background: Rectangle {
        radius: Theme.radiusInput
        color: Theme.inputBg
        border.width: 1
        border.color: root.activeFocus ? Theme.accent : Theme.inputBorder
        Behavior on border.color { ColorAnimation { duration: Theme.hoverMs } }
        Icon {
            visible: root.leadingIcon !== ""
            name: root.leadingIcon
            size: 16
            color: Theme.textMuted
            x: 12
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}
