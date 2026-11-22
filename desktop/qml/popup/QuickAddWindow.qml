import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Window {
    id: win
    width: 560
    height: 96
    color: "transparent"
    title: Tr.t("desktop.tray.quickAdd")

    property string listId: ""
    readonly property var parsed: input.text.trim().length > 0 ? QuickAdd.preview(input.text) : ({})
    readonly property string targetList: (Store.listsRevision, listId !== "" && Store.listMap(listId).id) ? listId : Sync.defaultListId()

    function submit() {
        if (input.text.trim() === "")
            return
        const id = Views.addTask("list", targetList, input.text)
        if (id) {
            input.text = ""
            App.hideQuickAdd()
        }
    }

    onVisibleChanged: if (!visible) input.text = ""

    Connections {
        target: App
        function onQuickAddFocusRequested() {
            win.listId = AppSettings.value("quickAddList", "")
            input.forceActiveFocus()
        }
    }

    Rectangle {
        anchors.fill: parent
        color: Theme.surface
        radius: 6
        border.width: 1
        border.color: drop.containsDrag ? Theme.accent : (Theme.dark ? Theme.ink600 : Theme.gray200)

        DropArea {
            id: drop
            anchors.fill: parent
            onDropped: (d) => {
                if (App.captureDrop(d.hasText ? d.text : "", d.hasUrls ? d.urls : [], win.targetList)) {
                    d.acceptProposedAction()
                    App.hideQuickAdd()
                }
            }
        }

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 12
            spacing: 8

            RowLayout {
                Layout.fillWidth: true
                spacing: 8

                Logo { size: 22 }

                OInput {
                    id: input
                    objectName: "quickAddInput"
                    Layout.fillWidth: true
                    placeholderText: Tr.t("quickAdd.placeholder")
                    Keys.onReturnPressed: win.submit()
                    Keys.onEnterPressed: win.submit()
                    Keys.onEscapePressed: App.hideQuickAdd()
                }

                AbstractButton {
                    id: listButton
                    implicitHeight: Theme.controlHeight
                    implicitWidth: listRow.implicitWidth + 20
                    hoverEnabled: true
                    focusPolicy: Qt.NoFocus
                    readonly property var list: (Store.listsRevision, Store.listMap(win.targetList))
                    background: Rectangle {
                        radius: Theme.radiusInput
                        color: listButton.hovered ? Theme.secondaryHover : Theme.secondaryBg
                    }
                    contentItem: Row {
                        id: listRow
                        spacing: 6
                        leftPadding: 10
                        Icon {
                            anchors.verticalCenter: parent.verticalCenter
                            name: listButton.list.icon || "list"
                            color: listButton.list.color || Theme.textMuted
                            size: 15
                        }
                        Text {
                            anchors.verticalCenter: parent.verticalCenter
                            text: listButton.list.name || ""
                            width: Math.min(implicitWidth, 120)
                            elide: Text.ElideRight
                            color: Theme.secondaryText
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontSm
                            font.weight: Font.DemiBold
                        }
                        Icon { anchors.verticalCenter: parent.verticalCenter; name: "chevron-down"; size: 13; color: Theme.textMuted }
                    }
                    onClicked: listMenu.popup(listButton, 0, listButton.height + 4)

                    OMenu {
                        id: listMenu
                        Instantiator {
                            model: ListsModel { writableOnly: true }
                            delegate: OMenuItem {
                                required property var model
                                text: model.name
                                iconName: model.icon || "list"
                                checkable: true
                                checked: model.listId === win.targetList
                                onTriggered: {
                                    win.listId = model.listId
                                    AppSettings.setValue("quickAddList", model.listId)
                                    input.forceActiveFocus()
                                }
                            }
                            onObjectAdded: (i, o) => listMenu.insertItem(i, o)
                            onObjectRemoved: (i, o) => listMenu.removeItem(o)
                        }
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Layout.leftMargin: 30
                spacing: 12
                Text {
                    Layout.fillWidth: true
                    text: win.parsed.title ? win.parsed.title : Tr.t("desktop.quickAdd.hint")
                    elide: Text.ElideRight
                    color: win.parsed.title ? Theme.textMuted : Theme.textFaint
                    font.family: Theme.fontFamily
                    font.pixelSize: 11
                }
                Row {
                    spacing: 4
                    visible: !!win.parsed.dueLabel
                    Icon { name: "calendar"; size: 12; color: Theme.accent; anchors.verticalCenter: parent.verticalCenter }
                    Text {
                        text: win.parsed.dueLabel || ""
                        color: Theme.accent
                        font.family: Theme.fontFamily
                        font.pixelSize: 11
                        font.weight: Font.Bold
                    }
                }
                Row {
                    spacing: 4
                    visible: !!win.parsed.priority && win.parsed.priority !== "none"
                    PriorityDot { priority: win.parsed.priority || "none"; anchors.verticalCenter: parent.verticalCenter }
                    Text {
                        text: win.parsed.priority ? Tr.t("priority." + win.parsed.priority) : ""
                        color: Theme.textMuted
                        font.family: Theme.fontFamily
                        font.pixelSize: 11
                    }
                }
                Icon { visible: !!win.parsed.recurrence; name: "repeat"; size: 12; color: Theme.accent }
                Text {
                    text: "↵"
                    color: Theme.textFaint
                    font.pixelSize: 12
                }
            }
        }
    }
}
