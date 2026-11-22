import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Window {
    id: win
    width: 300
    height: 320
    minimumWidth: 220
    minimumHeight: 160
    color: "transparent"
    title: Tr.t("desktop.tray.sticky")

    ScratchpadModel { id: pads }

    readonly property string padId: {
        pads.count
        const want = AppSettings.stickyScratchpadId
        for (let i = 0; i < pads.count; ++i)
            if (pads.get(i).padId === want)
                return want
        return pads.count > 0 ? pads.get(0).padId : ""
    }
    property string loadedId: ""
    property bool dirty: false
    // set while load fills the fields so that isnt mistaken for an edit
    property bool loading: false

    function load() {
        if (padId === "") {
            title_.text = ""
            body.text = ""
            loadedId = ""
            return
        }
        for (let i = 0; i < pads.count; ++i) {
            const p = pads.get(i)
            if (p.padId !== padId) continue
            loading = true
            // only called while nothing unsaved is typed so a focused field can take the remote text too keep the caret where it was
            if (title_.text !== (p.title || "")) title_.text = p.title || ""
            if (body.text !== (p.content || "")) {
                const cursor = body.cursorPosition
                body.text = p.content || ""
                body.cursorPosition = Math.min(cursor, body.text.length)
            }
            loading = false
            loadedId = padId
            return
        }
    }
    function flush() {
        saveTimer.stop()
        if (!dirty || loadedId === "") return
        dirty = false
        Sync.updateScratchpad(loadedId, { title: title_.text, content: body.text })
    }

    onPadIdChanged: { flush(); load() }
    onVisibleChanged: if (!visible) flush()
    Component.onCompleted: load()
    Connections {
        target: Store
        function onScratchpadsChanged() { if (!win.dirty) win.load() }
    }

    Timer { id: saveTimer; interval: 700; onTriggered: win.flush() }

    Rectangle {
        anchors.fill: parent
        radius: 6
        color: Theme.dark ? Theme.ink800 : Theme.orange50
        border.width: 1
        border.color: Theme.dark ? Theme.ink600 : Theme.orange200
        clip: true

        ColumnLayout {
            anchors.fill: parent
            spacing: 0

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 34
                color: Theme.dark ? Theme.ink750 : Theme.orange100
                radius: 6
                Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 6; color: parent.color }

                MouseArea {
                    id: dragArea
                    anchors.fill: parent
                    cursorShape: pressed ? Qt.ClosedHandCursor : Qt.OpenHandCursor
                    property point last
                    onPressed: (m) => {
                        if (App.layerShell) last = mapToGlobal(m.x, m.y)
                        else App.startSystemMove(win)
                    }
                    onPositionChanged: (m) => {
                        if (!App.layerShell || !pressed) return
                        const p = mapToGlobal(m.x, m.y)
                        App.moveSticky(p.x - last.x, p.y - last.y)
                        last = p
                    }
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 10
                    anchors.rightMargin: 4
                    spacing: 4
                    Icon { name: "sticky-note"; size: 15; color: Theme.accent }
                    TextField {
                        id: title_
                        // only as wide as its text so the bar around it drags
                        Layout.fillWidth: true
                        Layout.maximumWidth: implicitWidth + 4
                        placeholderText: Tr.t("scratchpads.untitled")
                        placeholderTextColor: Theme.textFaint
                        color: Theme.text
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontSm
                        font.weight: Font.Bold
                        background: null
                        leftPadding: 2
                        enabled: win.loadedId !== ""
                        selectByMouse: true
                        onTextEdited: { win.dirty = true; saveTimer.restart() }
                        Keys.onReturnPressed: body.forceActiveFocus()
                    }
                    Item { Layout.fillWidth: true } // empty: clicks fall through to dragArea
                    IconButton {
                        iconName: "chevron-down"
                        iconSize: 14
                        tip: Tr.t("scratchpads.title")
                        onClicked: padMenu.popup(this, 0, height)
                        OMenu {
                            id: padMenu
                            Instantiator {
                                model: pads
                                delegate: OMenuItem {
                                    required property var model
                                    text: model.title || Tr.t("scratchpads.untitled")
                                    checkable: true
                                    checked: model.padId === win.padId
                                    onTriggered: AppSettings.stickyScratchpadId = model.padId
                                }
                                onObjectAdded: (i, o) => padMenu.insertItem(i, o)
                                onObjectRemoved: (i, o) => padMenu.removeItem(o)
                            }
                            MenuSeparator {}
                            OMenuItem {
                                text: Tr.t("scratchpads.newNote")
                                iconName: "plus"
                                onTriggered: {
                                    const id = Sync.createScratchpad()
                                    if (id) AppSettings.stickyScratchpadId = id
                                }
                            }
                            OMenuItem {
                                text: Tr.t("desktop.sticky.openAll")
                                iconName: "app-window"
                                onTriggered: App.showPage("scratchpads")
                            }
                        }
                    }
                    IconButton {
                        iconName: "x"
                        iconSize: 14
                        tip: Tr.t("common.close")
                        onClicked: { win.flush(); App.setStickyShown(false) }
                    }
                }
            }

            ScrollView {
                Layout.fillWidth: true
                Layout.fillHeight: true
                visible: win.loadedId !== ""
                ScrollBar.vertical: OScrollBar {}
                TextArea {
                    id: body
                    wrapMode: TextEdit.Wrap
                    textFormat: TextEdit.PlainText
                    placeholderText: Tr.t("scratchpads.contentPlaceholder")
                    placeholderTextColor: Theme.textFaint
                    color: Theme.text
                    selectionColor: Theme.orange300
                    selectedTextColor: Theme.ink900
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontSm
                    selectByMouse: true
                    background: null
                    padding: 12
                    onTextChanged: if (activeFocus && !win.loading) { win.dirty = true; saveTimer.restart() }
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                visible: win.loadedId === ""
                spacing: 12
                Item { Layout.fillHeight: true }
                Text {
                    Layout.fillWidth: true
                    Layout.leftMargin: 16
                    Layout.rightMargin: 16
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: Tr.t("scratchpads.emptyDescription")
                    color: Theme.textMuted
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontSm
                }
                OButton {
                    Layout.alignment: Qt.AlignHCenter
                    compact: true
                    primary: true
                    iconName: "plus"
                    text: Tr.t("scratchpads.newNote")
                    onClicked: {
                        const id = Sync.createScratchpad()
                        if (id) AppSettings.stickyScratchpadId = id
                    }
                }
                Item { Layout.fillHeight: true }
            }
        }

        // resize grip compositors resize layer shell surfaces themselves none
        MouseArea {
            visible: !App.layerShell
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            width: 16
            height: 16
            cursorShape: Qt.SizeFDiagCursor
            onPressed: win.startSystemResize(Qt.RightEdge | Qt.BottomEdge)
            Icon {
                anchors.centerIn: parent
                name: "grip-vertical"
                size: 12
                rotation: -45
                color: Theme.textFaint
            }
        }
    }
}
