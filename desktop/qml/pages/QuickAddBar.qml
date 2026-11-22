import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Rectangle {
    id: root
    property string view: "today"
    property string listId: ""
    property string parentId: ""
    property string placeholder: Tr.t("quickAdd.placeholder")
    signal added(string taskId)

    readonly property var parsed: input.text.trim().length > 0 ? QuickAdd.preview(input.text) : ({})
    readonly property bool hasMeta: !!parsed.dueLabel || (!!parsed.priority && parsed.priority !== "none") || !!parsed.recurrence

    component MetaChip: Rectangle {
        id: chip
        property string iconName
        property string label
        property bool accent: false
        implicitWidth: chipRow.implicitWidth + 16
        implicitHeight: 24
        radius: 2
        color: accent ? Theme.tagBg : Theme.badgeBg
        Row {
            id: chipRow
            anchors.centerIn: parent
            spacing: 4
            Icon { name: chip.iconName; size: 11; color: chip.accent ? Theme.tagText : Theme.badgeText; anchors.verticalCenter: parent.verticalCenter }
            Text {
                text: chip.label
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontXs
                color: chip.accent ? Theme.tagText : Theme.badgeText
                anchors.verticalCenter: parent.verticalCenter
            }
        }
    }

    function focusInput() { input.forceActiveFocus() }

    function submit() {
        const id = Views.addTask(view, listId, input.text, parentId)
        if (id) {
            input.clear()
            added(id)
        }
    }

    implicitHeight: col.implicitHeight
    color: Theme.dark ? Theme.ink850 : "#ffffff"

    Rectangle { width: parent.width; height: 1; color: Theme.border }

    ColumnLayout {
        id: col
        anchors.left: parent.left
        anchors.right: parent.right
        spacing: 0

        Flow {
            visible: root.hasMeta
            Layout.fillWidth: true
            Layout.leftMargin: 16
            Layout.rightMargin: 16
            Layout.topMargin: 8
            spacing: 8

            MetaChip {
                visible: !!root.parsed.dueLabel
                iconName: "calendar"
                label: root.parsed.dueLabel || ""
                accent: true
            }
            MetaChip {
                visible: !!root.parsed.priority && root.parsed.priority !== "none"
                iconName: "flag"
                label: root.parsed.priority ? Tr.t("priority." + root.parsed.priority) : ""
            }
            MetaChip {
                visible: !!root.parsed.recurrence
                iconName: "repeat"
                label: Tr.t("quickAdd.recurring")
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.leftMargin: 16
            Layout.rightMargin: 16
            implicitHeight: 48
            spacing: 8

            Icon { name: "plus"; size: 20; color: Theme.accent }
            TextField {
                id: input
                Layout.fillWidth: true
                background: null
                leftPadding: 0
                placeholderText: root.placeholder
                placeholderTextColor: Theme.textFaint
                color: Theme.text
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontBase
                selectionColor: Theme.orange300
                selectedTextColor: Theme.ink900
                selectByMouse: true
                onAccepted: root.submit()
                Keys.onEscapePressed: {
                    if (text !== "") clear()
                    else focus = false
                }
            }
        }
    }
}
