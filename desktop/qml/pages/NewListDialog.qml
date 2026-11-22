import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

ODialog {
    id: root
    property string color: Theme.listColors[0]
    // auto the icon follows the suggestion for the name
    property string picked: ""
    property string suggestedFor: ""
    property string suggested: ""
    property bool suggesting: false
    // the grid stays folded away until the preview tile is clicked
    property bool iconsOpen: false

    readonly property string trimmed: nameInput.text.trim()
    readonly property string autoIcon: trimmed !== "" && suggestedFor === trimmed ? suggested : ""
    readonly property string icon: picked || autoIcon || "list"

    signal created(string id)

    title: Tr.t("lists.newListLabel")
    preferredWidth: 440

    function openNew() {
        nameInput.text = ""
        color = Theme.listColors[0]
        picked = ""
        iconsOpen = false
        suggestedFor = ""
        suggested = ""
        suggesting = false
        open()
        nameInput.forceActiveFocus()
    }
    function create() {
        if (!trimmed) return
        // no icon while the preview is still out the server picks one after creating
        const id = Sync.createList(trimmed, color, picked || autoIcon)
        close()
        if (id) created(id)
    }
    function refreshSuggestion() {
        if (picked || !trimmed || suggestedFor === trimmed) {
            suggestTimer.stop()
            suggesting = false
            return
        }
        suggesting = true
        suggestTimer.restart()
    }

    onPickedChanged: refreshSuggestion()

    // typing pause before the name is sent for an icon preview
    Timer {
        id: suggestTimer
        interval: 350
        onTriggered: {
            const name = root.trimmed
            Api.call("POST", "/api/lists/suggest-icon", { name: name }, (ok, status, json) => {
                // a slower answer for an older name must not replace a newer one
                if (name !== root.trimmed) return
                root.suggested = ok && json.icon && Theme.listIcons.indexOf(json.icon) >= 0 ? json.icon : ""
                root.suggestedFor = name
                root.suggesting = false
            })
        }
    }

    component Label: Text {
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontXs
        font.capitalization: Font.AllUppercase
        font.letterSpacing: 0.6
        color: Theme.textFaint
    }

    RowLayout {
        Layout.fillWidth: true
        spacing: 12
        Rectangle {
            Layout.preferredWidth: 44
            Layout.preferredHeight: 44
            color: "transparent"
            border.width: 2
            border.color: root.color
            Icon {
                anchors.centerIn: parent
                name: root.icon
                size: 22
                color: root.color
            }
            Rectangle {
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                anchors.margins: -6
                width: 16
                height: 16
                radius: 8
                color: root.color
                Icon {
                    anchors.centerIn: parent
                    name: root.iconsOpen ? "chevron-up" : "chevron-down"
                    size: 12
                    color: "#ffffff"
                }
            }
            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                ToolTip.visible: containsMouse
                ToolTip.text: Tr.t("list.changeIcon")
                ToolTip.delay: 500
                hoverEnabled: true
                onClicked: root.iconsOpen = !root.iconsOpen
            }
            Icon {
                id: spinner
                visible: root.suggesting
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.margins: -6
                name: "loader"
                size: 13
                color: Theme.textFaint
                RotationAnimator on rotation { running: spinner.visible; loops: Animation.Infinite; from: 0; to: 360; duration: 900 }
            }
        }
        OInput {
            id: nameInput
            objectName: "newListName"
            Layout.fillWidth: true
            placeholderText: Tr.t("lists.namePlaceholder")
            maximumLength: 100
            onTextChanged: root.refreshSuggestion()
            onAccepted: root.create()
        }
    }

    Label {
        text: Tr.t("lists.iconLabel")
        Layout.topMargin: 8
        visible: root.iconsOpen
    }
    Grid {
        Layout.fillWidth: true
        visible: root.iconsOpen
        columns: Math.max(1, Math.floor((width + 4) / 36))
        spacing: 4
        Repeater {
            model: Theme.listIcons
            delegate: Rectangle {
                id: cell
                required property string modelData
                readonly property bool current: root.icon === modelData
                width: 32
                height: 32
                radius: 2
                color: current ? Theme.selected : cellMouse.containsMouse ? Theme.hover : "transparent"
                border.width: current ? 1 : 0
                border.color: Theme.accent
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
                    onClicked: {
                        // picking the chosen icon again hands it back to the names suggestion
                        root.picked = root.picked === cell.modelData ? "" : cell.modelData
                        root.iconsOpen = false
                    }
                }
            }
        }
    }

    Label { text: Tr.t("lists.colorLabel"); Layout.topMargin: 8 }
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

    footer: [
        OButton {
            primary: true
            text: Tr.t("common.create")
            enabled: root.trimmed !== ""
            onClicked: root.create()
        },
        OButton {
            primary: false
            text: Tr.t("common.cancel")
            onClicked: root.close()
        }
    ]
}
