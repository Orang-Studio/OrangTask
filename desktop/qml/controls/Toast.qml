import QtQuick
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Rectangle {
    id: root
    property var undoFn: null
    property int timeout: 4000

    function show(text) {
        undoFn = null
        label.text = text
        open()
    }
    function showUndo(text, fn) {
        undoFn = fn
        label.text = text
        open()
    }
    function open() {
        timer.interval = undoFn ? 5000 : timeout
        timer.restart()
        state = "shown"
    }
    function dismiss() {
        timer.stop()
        undoFn = null
        state = ""
    }

    anchors.horizontalCenter: parent.horizontalCenter
    y: parent.height
    z: 1000
    width: Math.min(row.implicitWidth + 32, parent.width - 32)
    height: 48
    radius: 4
    color: Theme.dark ? Theme.ink700 : Theme.ink900
    border.width: Theme.dark ? 1 : 0
    border.color: Theme.ink500
    opacity: 0
    visible: opacity > 0

    states: State {
        name: "shown"
        PropertyChanges { target: root; y: root.parent.height - root.height - 20; opacity: 1 }
    }
    transitions: Transition {
        NumberAnimation { properties: "y,opacity"; duration: Theme.slideUp; easing.type: Easing.OutCubic }
    }

    Timer {
        id: timer
        onTriggered: root.dismiss()
    }

    RowLayout {
        id: row
        anchors.fill: parent
        anchors.leftMargin: 16
        anchors.rightMargin: 8
        spacing: 12
        Text {
            id: label
            Layout.fillWidth: true
            color: "#ffffff"
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontSm
            elide: Text.ElideRight
        }
        Text {
            visible: root.undoFn !== null
            text: Tr.t("undo.undo")
            color: Theme.orange400
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontSm
            font.weight: Font.Bold
            font.capitalization: Font.AllUppercase
            MouseArea {
                anchors.fill: parent
                anchors.margins: -8
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                    const fn = root.undoFn
                    root.dismiss()
                    if (fn) fn()
                }
            }
        }
        IconButton {
            iconName: "x"
            iconSize: 14
            iconColor: Theme.ink400
            hoverColor: "#ffffff"
            implicitWidth: 28
            implicitHeight: 28
            onClicked: root.dismiss()
        }
    }
}
