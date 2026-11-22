import QtQuick
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

ODialog {
    id: root
    title: Tr.t("shortcuts.title")
    preferredWidth: 440

    readonly property var rows: [
        { keys: ["Ctrl", "K"], label: Tr.t("shortcuts.commandPalette") },
        { keys: ["/"], label: Tr.t("shortcuts.focusSearch") },
        { keys: ["N"], label: Tr.t("shortcuts.newTask") },
        { keys: ["Enter"], label: Tr.t("shortcuts.openTask") },
        { keys: ["Space"], label: Tr.t("shortcuts.toggleComplete") },
        { keys: ["P"], label: Tr.t("shortcuts.cyclePriority") },
        { keys: ["D"], label: Tr.t("shortcuts.setDueDate") },
        { keys: ["Del"], label: Tr.t("shortcuts.deleteTask") },
        { keys: ["Esc"], label: Tr.t("shortcuts.closeDeselect") },
        { keys: ["Ctrl", "R"], label: Tr.t("desktop.shortcuts.sync") },
        { keys: ["Ctrl", ","], label: Tr.t("common.settings") },
        { keys: ["Ctrl", "W"], label: Tr.t("desktop.shortcuts.hide") },
        { keys: ["Ctrl", "Q"], label: Tr.t("desktop.shortcuts.quit") },
        { keys: ["?"], label: Tr.t("shortcuts.showHelp") }
    ]

    Repeater {
        model: root.rows
        delegate: RowLayout {
            id: shortcutRow
            required property var modelData
            Layout.fillWidth: true
            spacing: 4
            Text {
                Layout.fillWidth: true
                text: shortcutRow.modelData.label
                elide: Text.ElideRight
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontSm
                color: Theme.text
            }
            Repeater {
                model: shortcutRow.modelData.keys
                delegate: Rectangle {
                    required property string modelData
                    implicitWidth: Math.max(24, keyText.implicitWidth + 12)
                    implicitHeight: 24
                    radius: 2
                    color: Theme.badgeBg
                    border.width: 1
                    border.color: Theme.border
                    Text {
                        id: keyText
                        anchors.centerIn: parent
                        text: parent.modelData
                        font.family: "monospace"
                        font.pixelSize: Theme.fontXs
                        color: Theme.badgeText
                    }
                }
            }
        }
    }

    footer: [
        OButton {
            primary: false
            text: Tr.t("common.close")
            onClicked: root.close()
        }
    ]
}
