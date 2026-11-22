import QtQuick
import OrangTask

Item {
    id: root
    property bool checked: false
    property int size: 24
    property bool hovered: mouse.containsMouse
    property bool interactive: true
    signal toggled()

    implicitWidth: size
    implicitHeight: size

    Rectangle {
        id: ring
        anchors.fill: parent
        radius: width / 2
        border.width: 2
        border.color: root.checked ? Theme.accent : (root.hovered ? Theme.accent : (Theme.dark ? Theme.ink400 : Theme.gray400))
        color: root.checked ? Theme.accent : "transparent"
        Behavior on color { ColorAnimation { duration: 150 } }
        Behavior on border.color { ColorAnimation { duration: 150 } }

        Icon {
            anchors.centerIn: parent
            name: "check"
            size: Math.round(root.size * 0.6)
            color: "#ffffff"
            visible: root.checked
        }
    }

    SequentialAnimation {
        id: pop
        NumberAnimation { target: ring; property: "scale"; to: 0.8; duration: 0 }
        NumberAnimation { target: ring; property: "scale"; to: 1.15; duration: Theme.scaleCheck / 2; easing.type: Easing.OutQuad }
        NumberAnimation { target: ring; property: "scale"; to: 1.0; duration: Theme.scaleCheck / 2; easing.type: Easing.OutQuad }
    }
    onCheckedChanged: if (checked) pop.restart()

    MouseArea {
        id: mouse
        anchors.fill: parent
        anchors.margins: -6
        enabled: root.interactive
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.toggled()
    }
}
