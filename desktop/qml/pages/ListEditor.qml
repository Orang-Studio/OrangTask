import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

ODialog {
    id: root
    property string listId: ""
    property string color: Theme.listColors[0]
    property string iconName: "hash"

    title: Tr.t("common.edit")
    preferredWidth: 420

    function openFor(id) {
        const l = Store.listMap(id)
        if (!l.id) return
        listId = id
        nameInput.text = l.name || ""
        color = l.color || Theme.listColors[0]
        iconName = l.icon || "hash"
        open()
        nameInput.forceActiveFocus()
        nameInput.selectAll()
    }
    function save() {
        const name = nameInput.text.trim()
        if (!name) return
        Sync.updateList(listId, { name: name, color: color, icon: iconName })
        close()
    }

    component Label: Text {
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontXs
        font.capitalization: Font.AllUppercase
        font.letterSpacing: 0.6
        color: Theme.textFaint
    }

    Label { text: Tr.t("common.name") }
    OInput {
        id: nameInput
        Layout.fillWidth: true
        placeholderText: Tr.t("sidebar.listNamePlaceholder")
        onAccepted: root.save()
    }

    Label { text: Tr.t("list.changeColor"); Layout.topMargin: 4 }
    Flow {
        Layout.fillWidth: true
        spacing: 8
        Repeater {
            model: Theme.listColors
            delegate: Rectangle {
                required property string modelData
                width: 28
                height: 28
                radius: 14
                color: modelData
                border.width: root.color === modelData ? 2 : 0
                border.color: Theme.text
                Icon {
                    anchors.centerIn: parent
                    visible: root.color === parent.modelData
                    name: "check"
                    size: 14
                    color: "#ffffff"
                }
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.color = parent.modelData
                }
            }
        }
    }

    Label { text: Tr.t("list.changeIcon"); Layout.topMargin: 4 }
    Grid {
        Layout.fillWidth: true
        columns: Math.max(1, Math.floor((width + 4) / 36))
        spacing: 4
        Repeater {
            model: Theme.listIcons
            delegate: Rectangle {
                id: cell
                required property string modelData
                readonly property bool current: root.iconName === modelData
                width: 32
                height: 32
                radius: 2
                color: current ? Theme.selected : cellMouse.containsMouse ? Theme.hover : "transparent"
                border.width: current ? 1 : 0
                border.color: root.color
                Icon {
                    anchors.centerIn: parent
                    name: cell.modelData
                    size: 16
                    color: cell.current ? root.color : Theme.textMuted
                }
                MouseArea {
                    id: cellMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.iconName = cell.modelData
                }
            }
        }
    }

    footer: [
        OButton {
            primary: true
            text: Tr.t("common.save")
            enabled: nameInput.text.trim() !== ""
            onClicked: root.save()
        },
        OButton {
            primary: false
            text: Tr.t("common.cancel")
            onClicked: root.close()
        }
    ]
}
