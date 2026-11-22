import QtQuick
import QtQuick.Controls.Basic
import OrangTask

Menu {
    id: root
    padding: 4
    implicitWidth: 220
    delegate: OMenuItem {}

    background: Rectangle {
        implicitWidth: 220
        color: Theme.surfaceRaised
        border.width: 1
        border.color: Theme.border
        radius: 4
    }
    enter: Transition { NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 120 } }
    exit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 100 } }
}
