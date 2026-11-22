import QtQuick
import QtQuick.Controls.Basic
import OrangTask

ScrollBar {
    id: root
    implicitWidth: 8
    implicitHeight: 8
    padding: 1
    minimumSize: 0.08
    policy: ScrollBar.AsNeeded

    contentItem: Rectangle {
        implicitWidth: 6
        implicitHeight: 6
        radius: 0
        color: root.pressed ? Theme.ink400 : Theme.scrollThumb
        opacity: root.policy === ScrollBar.AlwaysOn || (root.active && root.size < 1.0) ? 1 : 0
        Behavior on opacity { NumberAnimation { duration: 200 } }
    }
    background: Item {}
}
