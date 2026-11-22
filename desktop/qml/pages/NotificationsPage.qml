import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Item {
    id: root
    property bool active: false
    property var items: []
    readonly property int unread: items.filter(n => !n.read).length
    signal openList(string listId)

    function reload() {
        if (!active) return
        Api.call("GET", "/api/notifications", null, (ok, status, json) => {
            if (ok) root.items = json.notifications || []
        })
    }
    function markRead(n) {
        if (n.read) return
        items = items.map(x => x.id === n.id ? Object.assign({}, x, { read: true }) : x)
        Api.call("PATCH", "/api/notifications/" + n.id + "/read", null, () => {})
    }
    function markAllRead() {
        items = items.map(x => Object.assign({}, x, { read: true }))
        Api.call("POST", "/api/notifications/read-all", null, () => {})
    }

    onActiveChanged: active ? reload() : (items = [])
    onVisibleChanged: if (visible) reload()
    Timer {
        interval: 60000
        repeat: true
        running: root.active && Sync.online
        onTriggered: root.reload()
    }
    Connections {
        target: Sync
        function onOnlineChanged() { if (Sync.online) root.reload() }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: 56
            color: "transparent"
            Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 24
                anchors.rightMargin: 16
                spacing: 10
                Text {
                    text: Tr.t("notifications.title")
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontLg
                    font.weight: Font.Bold
                    font.capitalization: Font.AllUppercase
                    font.letterSpacing: 0.8
                    color: Theme.text
                }
                Text {
                    visible: root.unread > 0
                    text: Tr.t("notifications.newCount", { count: root.unread })
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontSm
                    color: Theme.accent
                }
                Item { Layout.fillWidth: true }
                OButton {
                    visible: root.unread > 0
                    compact: true
                    primary: false
                    iconName: "check-check"
                    text: Tr.t("notifications.markAllRead")
                    onClicked: root.markAllRead()
                }
            }
        }

        ListView {
            id: listView
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            model: root.items
            ScrollBar.vertical: OScrollBar {}

            delegate: AbstractButton {
                id: row
                required property var modelData
                width: listView.width
                implicitHeight: col.implicitHeight + 24
                hoverEnabled: true
                onClicked: {
                    root.markRead(modelData)
                    const listId = modelData.metadata && modelData.metadata.list_id
                    if (listId) root.openList(listId)
                }
                background: Rectangle {
                    color: row.hovered ? Theme.hover
                         : !row.modelData.read ? (Theme.dark ? Theme.ink850 : Qt.rgba(1, 0.97, 0.93, 1))
                         : "transparent"
                    Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
                }
                contentItem: Item {
                    Rectangle {
                        x: 24
                        y: 20
                        width: 8
                        height: 8
                        radius: 4
                        color: row.modelData.read ? "transparent" : Theme.accent
                    }
                    ColumnLayout {
                        id: col
                        x: 44
                        y: 12
                        width: parent.width - 44 - 24
                        spacing: 2
                        Text {
                            Layout.fillWidth: true
                            text: row.modelData.title || ""
                            wrapMode: Text.Wrap
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontSm
                            font.weight: Font.Medium
                            color: Theme.text
                        }
                        Text {
                            visible: !!row.modelData.body
                            Layout.fillWidth: true
                            text: row.modelData.body || ""
                            wrapMode: Text.Wrap
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontSm
                            color: Theme.textMuted
                        }
                        Text {
                            Layout.topMargin: 2
                            text: Format.relative(row.modelData.created_at || "")
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontXs
                            color: Theme.textFaint
                        }
                    }
                }
            }

            EmptyState {
                anchors.centerIn: parent
                visible: listView.count === 0
                title: Tr.t("notifications.emptyTitle")
                description: Tr.t("notifications.emptyDescription")
            }
        }
    }
}
