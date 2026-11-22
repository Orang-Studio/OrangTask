import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Item {
    id: root
    property string selectedId: ""
    property bool confirmDelete: false
    property bool remapping: false
    property int rev: 0     // bumped on any model change, the model is not a JS array
    property string baseTitle: ""
    property string baseContent: ""
    readonly property var current: {
        rev
        const i = indexOf(selectedId)
        return i >= 0 ? pads.get(i) : null
    }

    function indexOf(id) {
        for (let i = 0; i < pads.count; i++)
            if (pads.get(i).padId === id) return i
        return -1
    }

    ScratchpadModel { id: pads }

    function select(id) {
        flush()
        selectedId = id
        confirmDelete = false
    }
    function newNote() {
        flush()
        const id = Sync.createScratchpad("", "")
        if (id) {
            selectedId = id
            Qt.callLater(() => titleInput.forceActiveFocus())
        }
    }
    function flush() {
        saveTimer.stop()
        if (!current) return
        const fields = {}
        if (titleInput.text !== (current.title || "")) fields.title = titleInput.text
        if (contentArea.text !== (current.content || "")) fields.content = contentArea.text
        if (Object.keys(fields).length) Sync.updateScratchpad(current.padId, fields)
    }
    function pinAsSticky() {
        flush()
        AppSettings.stickyScratchpadId = selectedId
        App.setStickyShown(true)
    }

    // load the editor when the selection changes not on every store update so typing is never overwritten by our own echo
    onSelectedIdChanged: loadEditor()
    function loadEditor() {
        if (remapping) return
        // looked up afresh this handler can run before current re evaluates
        const i = indexOf(selectedId)
        const pad = i >= 0 ? pads.get(i) : null
        titleInput.text = baseTitle = pad ? (pad.title || "") : ""
        contentArea.text = baseContent = pad ? (pad.content || "") : ""
    }
    // a change from elsewhere realtime replaces the editor only when nothing has been typed since it was loaded typing always wins
    function syncEditor() {
        if (remapping) return
        const i = indexOf(selectedId)
        if (i < 0) return
        const pad = pads.get(i)
        const t = pad.title || "", c = pad.content || ""
        if (titleInput.text === t && contentArea.text === c) {
            baseTitle = t; baseContent = c
        } else if (titleInput.text === baseTitle && contentArea.text === baseContent) {
            const cursor = contentArea.cursorPosition
            titleInput.text = baseTitle = t
            contentArea.text = baseContent = c
            contentArea.cursorPosition = Math.min(cursor, c.length)
        }
    }
    onVisibleChanged: if (!visible) flush()
    Connections {
        target: pads
        function onModelReset() { root.modelTouched() }
        function onRowsInserted() { root.modelTouched() }
        function onRowsRemoved() { root.modelTouched() }
        function onDataChanged() { root.rev++; root.syncEditor() }
    }
    Connections {
        target: Sync
        // same note under its server id keep whatever is being typed
        function onIdRemapped(from, to) {
            if (root.selectedId !== from) return
            root.remapping = true
            root.selectedId = to
            root.remapping = false
        }
    }
    function modelTouched() {
        rev++
        // a just created note appears after a queued rebuild only fall back to the first note when the selection really is gone
        if (selectedId && indexOf(selectedId) < 0 && !selectedId.startsWith("tmp-"))
            selectedId = pads.count > 0 ? pads.get(0).padId : ""
        else if (!selectedId && pads.count > 0)
            selectedId = pads.get(0).padId
    }
    Timer {
        id: saveTimer
        interval: 800
        onTriggered: root.flush()
    }

    RowLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillHeight: true
            Layout.preferredWidth: 280
            color: Theme.dark ? Theme.ink850 : "#ffffff"
            Rectangle { anchors.right: parent.right; width: 1; height: parent.height; color: Theme.border }

            ColumnLayout {
                anchors.fill: parent
                anchors.rightMargin: 1
                spacing: 0

                RowLayout {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 56
                    Layout.leftMargin: 20
                    Layout.rightMargin: 12
                    Text {
                        Layout.fillWidth: true
                        text: Tr.t("scratchpads.title")
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontLg
                        font.weight: Font.Bold
                        font.capitalization: Font.AllUppercase
                        font.letterSpacing: 0.8
                        color: Theme.text
                    }
                    IconButton {
                        iconName: "plus"
                        tip: Tr.t("scratchpads.newNote")
                        onClicked: root.newNote()
                    }
                }
                Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Theme.border }

                ListView {
                    id: padList
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    boundsBehavior: Flickable.StopAtBounds
                    model: pads
                    ScrollBar.vertical: OScrollBar {}

                    delegate: AbstractButton {
                        id: padRow
                        required property string padId
                        required property string title
                        required property string content
                        required property string updatedAt
                        readonly property bool current: padId === root.selectedId
                        width: padList.width
                        implicitHeight: 64
                        leftPadding: 20
                        rightPadding: 16
                        hoverEnabled: true
                        onClicked: root.select(padId)

                        background: Rectangle {
                            color: padRow.current ? Theme.selected : padRow.hovered ? Theme.hover : "transparent"
                            Rectangle {
                                visible: padRow.current
                                width: 3
                                height: parent.height
                                color: Theme.accent
                            }
                        }
                        contentItem: ColumnLayout {
                            spacing: 2
                            Item { Layout.fillHeight: true }
                            RowLayout {
                                Layout.fillWidth: true
                                spacing: 6
                                Text {
                                    Layout.fillWidth: true
                                    text: padRow.title || Tr.t("scratchpads.untitled")
                                    elide: Text.ElideRight
                                    font.family: Theme.fontFamily
                                    font.pixelSize: Theme.fontSm
                                    font.weight: Font.Medium
                                    color: padRow.title ? Theme.text : Theme.textFaint
                                }
                                Icon {
                                    visible: AppSettings.stickyScratchpadId === padRow.padId && App.stickyVisible
                                    name: "sticky-note"
                                    size: 13
                                    color: Theme.accent
                                }
                            }
                            Text {
                                Layout.fillWidth: true
                                text: padRow.content.replace(/\s+/g, " ").trim() || Tr.t("scratchpads.emptyNote")
                                elide: Text.ElideRight
                                font.family: Theme.fontFamily
                                font.pixelSize: Theme.fontXs
                                color: Theme.textFaint
                            }
                            Item { Layout.fillHeight: true }
                        }
                    }
                }
            }
        }

        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

            EmptyState {
                anchors.centerIn: parent
                visible: !root.current
                title: Tr.t("scratchpads.emptyTitle")
                description: Tr.t("scratchpads.emptyDescription")
            }
            OButton {
                visible: !root.current
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.top: parent.verticalCenter
                anchors.topMargin: 130
                iconName: "plus"
                text: Tr.t("scratchpads.newNote")
                onClicked: root.newNote()
            }

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 24
                visible: !!root.current
                spacing: 12

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 4
                    TextField {
                        id: titleInput
                        Layout.fillWidth: true
                        background: null
                        leftPadding: 0
                        placeholderText: Tr.t("scratchpads.titlePlaceholder")
                        placeholderTextColor: Theme.textFaint
                        color: Theme.text
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.font2xl
                        font.weight: Font.Bold
                        selectionColor: Theme.orange300
                        selectedTextColor: Theme.ink900
                        selectByMouse: true
                        onTextEdited: saveTimer.restart()
                        Keys.onReturnPressed: contentArea.forceActiveFocus()
                    }
                    Text {
                        visible: root.current && root.current.pending
                        text: Tr.t("common.saving")
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontXs
                        color: Theme.textFaint
                    }
                    IconButton {
                        iconName: "sticky-note"
                        active: AppSettings.stickyScratchpadId === root.selectedId && App.stickyVisible
                        tip: Tr.t("desktop.scratchpads.pinSticky")
                        onClicked: root.pinAsSticky()
                    }
                    IconButton {
                        iconName: "trash"
                        hoverColor: Theme.red500
                        tip: Tr.t("scratchpads.deleteNote")
                        onClicked: root.confirmDelete = true
                    }
                }

                Rectangle {
                    visible: root.confirmDelete
                    Layout.fillWidth: true
                    implicitHeight: 52
                    color: Theme.overdueBg
                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 16
                        anchors.rightMargin: 8
                        spacing: 8
                        Text {
                            Layout.fillWidth: true
                            elide: Text.ElideRight
                            text: Tr.t("scratchpads.deleteConfirm", {
                                name: (root.current && root.current.title) || Tr.t("scratchpads.untitled") })
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontSm
                            color: Theme.overdueText
                        }
                        OButton {
                            danger: true
                            compact: true
                            text: Tr.t("common.delete")
                            onClicked: {
                                saveTimer.stop()
                                Sync.deleteScratchpad(root.selectedId)
                                root.confirmDelete = false
                            }
                        }
                        OButton {
                            primary: false
                            compact: true
                            text: Tr.t("common.cancel")
                            onClicked: root.confirmDelete = false
                        }
                    }
                }

                ScrollView {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    ScrollBar.vertical: OScrollBar {}
                    OTextArea {
                        id: contentArea
                        placeholderText: Tr.t("scratchpads.contentPlaceholder")
                        font.pixelSize: Theme.fontBase
                        onTextChanged: if (activeFocus) saveTimer.restart()
                    }
                }
                Text {
                    Layout.fillWidth: true
                    wrapMode: Text.Wrap
                    text: Tr.t("scratchpads.formattingHint")
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontXs
                    color: Theme.textFaint
                }
            }
        }
    }
}
