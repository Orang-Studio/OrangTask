import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Rectangle {
    id: root
    property string page: "tasks"
    property string view: "today"
    property string listId: ""
    readonly property bool collapsed: AppSettings.sidebarCollapsed
    signal navigate(string page, string view, string listId)

    implicitWidth: collapsed ? 64 : 240
    color: Theme.sidebar
    Behavior on implicitWidth { NumberAnimation { duration: 150; easing.type: Easing.OutCubic } }

    ListsModel { id: lists }

    // shared lists exist Assigned to me is worth showing
    readonly property bool hasShared: {
        Store.listsRevision
        for (let i = 0; i < lists.count; ++i)
            if (lists.get(i).shared) return true
        return false
    }

    Rectangle {
        anchors.right: parent.right
        width: 1
        height: parent.height
        color: Theme.border
    }

    component NavItem: AbstractButton {
        id: item
        property string iconName: "list"
        property color iconTint: active ? (Theme.dark ? Theme.orange400 : Theme.orange600) : Theme.textMuted
        property bool active: false
        property int badge: 0
        property bool badgeDanger: false
        property bool lifted: false
        hoverEnabled: true
        focusPolicy: Qt.TabFocus
        implicitHeight: 40
        width: parent ? parent.width : 0
        // margins go in padding a contentItems size belongs to the Control and anchoring it as well leaves the layout sized for the wrong width
        leftPadding: root.collapsed ? 0 : 16
        rightPadding: root.collapsed ? 0 : 12
        Accessible.name: text

        ToolTip.visible: root.collapsed && hovered
        ToolTip.delay: 300
        ToolTip.text: text

        background: Rectangle {
            color: item.lifted ? Theme.surface : item.active ? Theme.selected : item.hovered ? Theme.hover : "transparent"
            border.width: item.lifted ? 1 : 0
            border.color: Theme.accent
            Behavior on color { ColorAnimation { duration: Theme.hoverMs } }
            Rectangle {
                visible: item.active
                width: 2
                height: parent.height
                color: Theme.accent
            }
        }
        contentItem: RowLayout {
            spacing: 12
            Item { Layout.fillWidth: root.collapsed; visible: root.collapsed }
            Icon {
                name: item.iconName
                size: 17
                color: item.iconTint
                Layout.alignment: Qt.AlignVCenter
                Rectangle {
                    // collapsed the count shrinks to a dot on the icon
                    visible: root.collapsed && item.badge > 0
                    width: 7; height: 7; radius: 4
                    color: item.badgeDanger ? Theme.red500 : Theme.accent
                    anchors.right: parent.right
                    anchors.top: parent.top
                    anchors.margins: -2
                }
            }
            Text {
                visible: !root.collapsed
                Layout.fillWidth: true
                text: item.text
                elide: Text.ElideRight
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontSm
                font.weight: Font.Medium
                color: item.active ? (Theme.dark ? Theme.orange400 : Theme.orange600) : Theme.text
            }
            // collapsed to zero width rather than hidden a RowLayout child that turns visible after the first layout pass is not repositioned
            Rectangle {
                readonly property bool shown: !root.collapsed && item.badge > 0
                opacity: shown ? 1 : 0
                implicitWidth: shown ? Math.max(20, badgeText.implicitWidth + 10) : 0
                implicitHeight: 20
                radius: 2
                color: item.badgeDanger ? Theme.overdueBg : Theme.badgeBg
                Text {
                    id: badgeText
                    anchors.centerIn: parent
                    text: item.badge > 99 ? "99+" : item.badge
                    font.family: Theme.fontFamily
                    font.pixelSize: 11
                    font.weight: Font.DemiBold
                    color: item.badgeDanger ? Theme.overdueText : Theme.badgeText
                }
            }
            Item { Layout.fillWidth: root.collapsed; visible: root.collapsed }
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.rightMargin: 1
        spacing: 0

        Item {
            Layout.fillWidth: true
            implicitHeight: 56
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: root.collapsed ? 0 : 16
                anchors.rightMargin: root.collapsed ? 0 : 8
                spacing: 10
                Item { Layout.fillWidth: true; visible: root.collapsed }
                Logo {
                    size: 28
                    visible: !root.collapsed
                }
                Text {
                    visible: !root.collapsed
                    Layout.fillWidth: true
                    text: "OrangTask"
                    font.family: Theme.fontFamily
                    font.pixelSize: 15
                    font.weight: Font.Bold
                    font.capitalization: Font.AllUppercase
                    font.letterSpacing: 1.2
                    color: Theme.text
                }
                IconButton {
                    iconName: root.collapsed ? "panel-left-open" : "panel-left-close"
                    tip: root.collapsed ? Tr.t("sidebar.expandSidebar") : Tr.t("sidebar.collapseSidebar")
                    onClicked: AppSettings.sidebarCollapsed = !AppSettings.sidebarCollapsed
                }
                Item { Layout.fillWidth: true; visible: root.collapsed }
            }
            Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
        }

        Flickable {
            id: flick
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            contentHeight: nav.implicitHeight
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: OScrollBar {}

            Column {
                id: nav
                width: flick.width
                topPadding: 8
                bottomPadding: 8

                Repeater {
                    model: ["today", "week", "overdue", "assigned", "all"]
                    delegate: NavItem {
                        required property string modelData
                        visible: modelData !== "assigned" || root.hasShared
                        height: visible ? implicitHeight : 0
                        text: Views.shortTitle(modelData)
                        iconName: Views.icon(modelData)
                        active: root.page === "tasks" && root.view === modelData
                        badge: {
                            Store.badgeCount
                            return modelData === "today" ? Store.todayCount
                                 : modelData === "overdue" ? Store.overdueCount : 0
                        }
                        badgeDanger: modelData === "overdue"
                        onClicked: root.navigate("tasks", modelData, "")
                    }
                }

                NavItem {
                    text: Tr.t("scratchpads.title")
                    iconName: "notebook-pen"
                    active: root.page === "scratchpads"
                    onClicked: root.navigate("scratchpads", "", "")
                }

                Item {
                    width: parent.width
                    height: root.collapsed ? 17 : 44
                    Rectangle {
                        visible: root.collapsed
                        anchors.centerIn: parent
                        width: 24; height: 1
                        color: Theme.border
                    }
                    RowLayout {
                        visible: !root.collapsed
                        anchors.fill: parent
                        anchors.leftMargin: 16
                        anchors.rightMargin: 8
                        anchors.topMargin: 12
                        Text {
                            Layout.fillWidth: true
                            text: Tr.t("sidebar.lists")
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontXs
                            font.weight: Font.DemiBold
                            font.capitalization: Font.AllUppercase
                            font.letterSpacing: 0.8
                            color: Theme.gray400
                        }
                        IconButton {
                            iconName: "plus"
                            iconSize: 15
                            implicitWidth: 26
                            implicitHeight: 26
                            tip: Tr.t("sidebar.newList")
                            onClicked: newListDialog.openNew()
                        }
                    }
                }

                Repeater {
                    id: listRepeater
                    model: lists
                    delegate: NavItem {
                        id: listItem
                        required property var model
                        required property int index
                        text: model.name
                        iconName: model.icon || "hash"
                        iconTint: model.color || Theme.textMuted
                        active: root.page === "tasks" && root.view === "list" && root.listId === model.listId
                        badge: model.openCount
                        opacity: model.pending ? 0.6 : 1
                        onClicked: if (!reorder.reordering) root.navigate("tasks", "list", model.listId)

                        z: reorder.grabbed ? 10 : 0
                        transform: Translate { y: reorder.offset }
                        lifted: reorder.grabbed
                        HoldToReorder {
                            id: reorder
                            index: listItem.index
                            view: listRepeater
                            model: lists
                            flickable: flick
                        }
                    }
                }
            }
        }

        Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Theme.border }
        Item {
            Layout.fillWidth: true
            implicitHeight: root.collapsed ? footerCol.implicitHeight + 16 : 56

            Column {
                id: footerCol
                visible: root.collapsed
                anchors.centerIn: parent
                spacing: 4
                IconButton {
                    iconName: "settings"
                    tip: Tr.t("common.settings")
                    active: root.page === "settings"
                    onClicked: root.navigate("settings", "", "")
                }
                IconButton {
                    iconName: "log-out"
                    tip: Tr.t("sidebar.logOut")
                    hoverColor: Theme.red500
                    onClicked: Auth.logout()
                }
            }

            RowLayout {
                visible: !root.collapsed
                anchors.fill: parent
                anchors.leftMargin: 12
                anchors.rightMargin: 8
                spacing: 4
                AbstractButton {
                    id: account
                    Layout.fillWidth: true
                    implicitHeight: 40
                    hoverEnabled: true
                    Accessible.name: Tr.t("sidebar.account")
                    onClicked: root.navigate("settings", "", "")
                    background: Rectangle { color: account.hovered ? Theme.hover : "transparent" }
                    contentItem: RowLayout {
                        spacing: 10
                        Avatar {
                            size: 28
                            name: Auth.user.name || Auth.user.email || ""
                            url: Auth.user.avatar_url || ""
                            Layout.leftMargin: 4
                        }
                        Text {
                            Layout.fillWidth: true
                            text: Auth.user.name || Auth.user.email || ""
                            elide: Text.ElideRight
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontSm
                            font.weight: Font.Medium
                            color: Theme.text
                        }
                    }
                }
                IconButton {
                    iconName: "settings"
                    tip: Tr.t("common.settings")
                    active: root.page === "settings"
                    onClicked: root.navigate("settings", "", "")
                }
                IconButton {
                    iconName: "log-out"
                    tip: Tr.t("sidebar.logOut")
                    hoverColor: Theme.red500
                    onClicked: Auth.logout()
                }
            }
        }
    }

    NewListDialog {
        id: newListDialog
        objectName: "newListDialog"
        onCreated: (id) => root.navigate("tasks", "list", id)
    }
}
