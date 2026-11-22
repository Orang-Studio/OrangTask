import QtQuick
import QtQuick.Controls.Basic
import OrangTask

TextArea {
    id: root
    padding: 12
    font.family: Theme.fontFamily
    font.pixelSize: Theme.fontSm
    color: Theme.text
    placeholderTextColor: Theme.textFaint
    selectionColor: Theme.orange300
    selectedTextColor: Theme.ink900
    selectByMouse: true
    wrapMode: TextEdit.Wrap

    background: Rectangle {
        radius: Theme.radiusInput
        color: Theme.inputBg
        border.width: 1
        border.color: root.activeFocus ? Theme.accent : Theme.inputBorder
    }
}
