import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

ApplicationWindow {
    id: win
    width: 1120
    height: 740
    minimumWidth: 720
    minimumHeight: 480
    title: "OrangTask"
    color: Theme.bg
    font.family: Theme.fontFamily
    font.pixelSize: Theme.fontBase

    property string page: "tasks"
    property string view: "today"
    property string listId: ""
    readonly property bool loggedIn: Auth.state === AuthState.LoggedIn

    function navigate(p, v, l) {
        page = p || "tasks"
        if (page === "tasks") {
            view = v || "today"
            listId = view === "list" ? (l || "") : ""
            AppSettings.setValue("lastView", view === "list" ? "list:" + listId : view)
        }
    }
    function route(name) {
        if (Views.smart.indexOf(name) >= 0) navigate("tasks", name, "")
        else if (name.startsWith("list:")) navigate("tasks", "list", name.slice(5))
        else navigate(name)
    }
    function openTask(id) {
        const t = Store.taskMap(id)
        if (!t.id) return
        // a subtask opens through its parent like the web deep link
        const target = t.parent_id ? Store.taskMap(t.parent_id) : t
        const tid = target.id || id
        if (!(page === "tasks" && (view !== "list" || listId === target.list_id)))
            navigate("tasks", "list", target.list_id)
        Qt.callLater(() => taskPage.openTask(tid))
    }
    function focusQuickAdd() {
        if (page !== "tasks" || !taskPage.canAdd) navigate("tasks", "today", "")
        Qt.callLater(() => taskPage.focusQuickAdd())
    }

    Component.onCompleted: route(String(AppSettings.value("lastView", "today")))

    onClosing: (close) => {
        if (AppSettings.closeToTray) {
            close.accepted = false
            hide()
        } else {
            App.quit()
        }
    }

    Connections {
        target: App
        function onTaskOpenRequested(id) { win.openTask(id) }
        function onPageRequested(p) { win.route(p) }
        function onQuickAddFocusRequested() { win.focusQuickAdd() }
        function onToast(message) { toast.show(message) }
    }
    Connections {
        target: Sync
        // a list opened while still being created follows its new server id
        function onIdRemapped(from, to) {
            if (win.listId === from) win.navigate("tasks", "list", to)
        }
    }
    Connections {
        target: Auth
        function onLoggedOut() {
            palette.close()
            win.navigate("tasks", "today", "")
        }
    }

    Item {
        anchors.fill: parent
        visible: Auth.state === AuthState.Unknown
        Logo { anchors.centerIn: parent; size: 56 }
    }
    Loader {
        anchors.fill: parent
        active: Auth.state === AuthState.LoggedOut
        visible: active
        sourceComponent: LoginPage {}
    }
    Loader {
        anchors.fill: parent
        active: Auth.state === AuthState.NeedsPin
        visible: active
        sourceComponent: PinPage {}
    }

    RowLayout {
        anchors.fill: parent
        visible: win.loggedIn
        spacing: 0

        Sidebar {
            Layout.fillHeight: true
            Layout.preferredWidth: implicitWidth
            page: win.page
            view: win.view
            listId: win.listId
            onNavigate: (p, v, l) => win.navigate(p, v, l)
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 56
                color: Theme.dark ? Theme.ink850 : "#ffffff"
                Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 16
                    anchors.rightMargin: 16
                    spacing: 8
                    Item { Layout.fillWidth: true }
                    AbstractButton {
                        id: searchButton
                        implicitHeight: 36
                        implicitWidth: searchRow.implicitWidth + 24
                        hoverEnabled: true
                        onClicked: palette.open()
                        background: Rectangle {
                            color: "transparent"
                            border.width: 1
                            border.color: searchButton.hovered ? Theme.accent : Theme.borderStrong
                            Behavior on border.color { ColorAnimation { duration: Theme.hoverMs } }
                        }
                        contentItem: Item {
                            RowLayout {
                                id: searchRow
                                anchors.centerIn: parent
                                spacing: 8
                                Text {
                                    text: Tr.t("common.search")
                                    font.family: Theme.fontFamily
                                    font.pixelSize: Theme.fontSm
                                    color: Theme.textFaint
                                }
                                Rectangle {
                                    implicitWidth: kbd.implicitWidth + 12
                                    implicitHeight: 20
                                    radius: 2
                                    color: Theme.badgeBg
                                    Text {
                                        id: kbd
                                        anchors.centerIn: parent
                                        text: "Ctrl+K"
                                        font.family: Theme.fontFamily
                                        font.pixelSize: Theme.fontXs
                                        color: Theme.badgeText
                                    }
                                }
                            }
                        }
                    }
                    Item {
                        implicitWidth: bell.implicitWidth
                        implicitHeight: bell.implicitHeight
                        IconButton {
                            id: bell
                            iconName: "bell"
                            iconSize: 20
                            tip: Tr.t("notifBell.notifications")
                            active: win.page === "notifications"
                            onClicked: win.navigate("notifications")
                        }
                        Rectangle {
                            visible: notificationsPage.unread > 0
                            anchors.top: parent.top
                            anchors.right: parent.right
                            anchors.topMargin: -2
                            anchors.rightMargin: -2
                            width: Math.max(18, unreadText.implicitWidth + 8)
                            height: 18
                            radius: 9
                            color: Theme.accent
                            Text {
                                id: unreadText
                                anchors.centerIn: parent
                                text: notificationsPage.unread > 9 ? "9+" : notificationsPage.unread
                                font.family: Theme.fontFamily
                                font.pixelSize: 10
                                font.weight: Font.Bold
                                color: "#ffffff"
                            }
                        }
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                visible: !Sync.online || Sync.stalePendingCount > 0
                implicitHeight: 28
                color: Theme.accent
                Row {
                    anchors.centerIn: parent
                    spacing: 8
                    Icon { name: "wifi-off"; size: 13; color: "#ffffff"; anchors.verticalCenter: parent.verticalCenter }
                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: !Sync.online ? Tr.t("layout.offline") : Tr.tc("layout.syncing", Sync.stalePendingCount)
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontXs
                        font.weight: Font.Medium
                        color: "#ffffff"
                    }
                }
            }

            StackLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                currentIndex: ["tasks", "scratchpads", "settings", "notifications"].indexOf(win.page)

                TaskListPage {
                    id: taskPage
                    view: win.view
                    listId: win.listId
                    onTaskDeleted: (id, title) => toast.showUndo(Tr.t("undo.deleted", { title: title }),
                                                                () => Sync.undoDelete(id))
                }
                ScratchpadsPage {}
                SettingsPage { objectName: "settingsPage" }
                NotificationsPage {
                    id: notificationsPage
                    active: win.loggedIn
                    onOpenList: (id) => win.navigate("tasks", "list", id)
                }
            }
        }
    }

    DropArea {
        id: drop
        anchors.fill: parent
        enabled: win.loggedIn
        keys: ["text/plain", "text/uri-list", "text/x-moz-url"]
        onDropped: (e) => {
            const target = win.page === "tasks" && win.view === "list" ? win.listId : ""
            const id = App.captureDrop(e.hasText ? e.text : "", e.hasUrls ? e.urls : [], target)
            if (id) {
                e.acceptProposedAction()
                win.openTask(id)
            }
        }
        Rectangle {
            anchors.fill: parent
            anchors.margins: 12
            visible: drop.containsDrag
            color: Qt.rgba(Theme.orange500.r, Theme.orange500.g, Theme.orange500.b, 0.08)
            border.width: 2
            border.color: Theme.accent
            radius: 4
            Column {
                anchors.centerIn: parent
                spacing: 10
                Icon { name: "plus"; size: 32; color: Theme.accent; anchors.horizontalCenter: parent.horizontalCenter }
                Text {
                    text: Tr.t("desktop.drop.hint")
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontBase
                    font.weight: Font.DemiBold
                    color: Theme.accent
                }
            }
        }
    }

    CommandPalette {
        id: palette
        onNavigate: (p, v, l) => win.navigate(p, v, l)
        onTaskChosen: (id) => win.openTask(id)
    }
    ShortcutsDialog { id: shortcuts }

    Toast { id: toast }

    // text fields take plain keys first so these only fire while not typing
    Shortcut { sequence: "Ctrl+K"; enabled: win.loggedIn; onActivated: palette.opened ? palette.close() : palette.open() }
    Shortcut { sequence: "/"; enabled: win.loggedIn && !palette.opened; onActivated: palette.open() }
    Shortcut { sequence: "N"; enabled: win.loggedIn && !palette.opened; onActivated: win.focusQuickAdd() }
    Shortcut { sequence: "?"; enabled: win.loggedIn; onActivated: shortcuts.open() }
    Shortcut { sequence: "Ctrl+,"; enabled: win.loggedIn; onActivated: win.navigate("settings") }
    Shortcut { sequence: "Ctrl+R"; enabled: win.loggedIn; onActivated: Sync.refresh() }
    Shortcut { sequences: [StandardKey.Close]; onActivated: win.close() }
    Shortcut { sequences: [StandardKey.Quit]; onActivated: App.quit() }
}
