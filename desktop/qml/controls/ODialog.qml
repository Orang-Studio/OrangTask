import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Templates as T
import QtQuick.Layouts
import OrangTask

Popup {
    id: root
    property string title: ""
    property int preferredWidth: 440
    default property alias body: content.data
    property alias footer: footerRow.data

    parent: T.Overlay.overlay
    anchors.centerIn: parent
    width: Math.min(preferredWidth, (parent ? parent.width : preferredWidth) - 32)
    height: Math.min(implicitHeight, (parent ? parent.height : implicitHeight) - 32)
    modal: true
    focus: true
    padding: 0
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    T.Overlay.modal: Rectangle { color: Theme.scrim }

    enter: Transition {
        ParallelAnimation {
            NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Theme.slideUp }
            NumberAnimation { property: "y"; from: root.y + 12; to: root.y; duration: Theme.slideUp; easing.type: Easing.OutCubic }
        }
    }
    exit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 120 } }

    background: Rectangle {
        color: Theme.surface
        border.width: 1
        border.color: Theme.border
        radius: 4
    }

    contentItem: ColumnLayout {
        spacing: 0
        RowLayout {
            Layout.fillWidth: true
            Layout.leftMargin: 20
            Layout.rightMargin: 12
            Layout.topMargin: 14
            Layout.bottomMargin: 6
            visible: root.title !== ""
            Text {
                Layout.fillWidth: true
                text: root.title
                color: Theme.text
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontLg
                font.weight: Font.Bold
                elide: Text.ElideRight
            }
            IconButton {
                iconName: "x"
                tip: Tr.t("common.close")
                onClicked: root.close()
            }
        }
        Flickable {
            id: flick
            Layout.fillWidth: true
            Layout.fillHeight: true
            // extra room at the bottom when there is no footer row below the content
            readonly property int bottomPad: footerRow.visible ? 8 : 24
            Layout.preferredHeight: content.implicitHeight + bottomPad
            contentHeight: content.implicitHeight + bottomPad
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: OScrollBar {}
            ColumnLayout {
                id: content
                x: 20
                y: 4
                width: flick.width - 40
                spacing: 12
            }
        }
        RowLayout {
            id: footerRow
            Layout.fillWidth: true
            Layout.margins: 16
            Layout.topMargin: 8
            spacing: 8
            layoutDirection: Qt.RightToLeft
            visible: children.length > 0
        }
    }
}
