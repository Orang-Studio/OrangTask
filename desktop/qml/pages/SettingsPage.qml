import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Item {
    id: root
    property string section: "profile"

    readonly property var sections: [
        { id: "profile", icon: "user-circle", label: Tr.t("settings.profile") },
        { id: "appearance", icon: "palette", label: Tr.t("settings.appearance") },
        { id: "desktop", icon: "monitor", label: Tr.t("desktop.settings.title") },
        { id: "notifications", icon: "bell", label: Tr.t("notifications.title") },
        { id: "more", icon: "external-link", label: Tr.t("desktop.settings.more") }
    ]

    component SectionTitle: Text {
        Layout.fillWidth: true
        Layout.bottomMargin: 4
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontLg
        font.weight: Font.Bold
        color: Theme.text
    }
    component FieldLabel: Text {
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontXs
        font.capitalization: Font.AllUppercase
        font.letterSpacing: 0.6
        color: Theme.textFaint
    }
    component Hint: Text {
        Layout.fillWidth: true
        wrapMode: Text.Wrap
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSm
        color: Theme.textMuted
    }
    component Divider: Rectangle {
        Layout.fillWidth: true
        Layout.topMargin: 8
        Layout.bottomMargin: 8
        implicitHeight: 1
        color: Theme.border
    }

    RowLayout {
        anchors.fill: parent
        spacing: 0

        ColumnLayout {
            Layout.fillHeight: true
            // explicit a layout otherwise inherits fillWidth from its children
            Layout.fillWidth: false
            Layout.preferredWidth: 208
            spacing: 0

            RowLayout {
                Layout.fillWidth: true
                Layout.preferredHeight: 56
                Layout.leftMargin: 16
                Text {
                    text: Tr.t("settings.title")
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontLg
                    font.weight: Font.Bold
                    font.capitalization: Font.AllUppercase
                    font.letterSpacing: 0.8
                    color: Theme.text
                }
            }
            Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Theme.border }

            ColumnLayout {
                Layout.fillWidth: true
                Layout.margins: 8
                spacing: 4
                Repeater {
                    model: root.sections
                    delegate: AbstractButton {
                        id: navItem
                        required property var modelData
                        readonly property bool current: root.section === modelData.id
                        Layout.fillWidth: true
                        implicitHeight: 40
                        leftPadding: 12
                        hoverEnabled: true
                        onClicked: root.section = modelData.id
                        background: Rectangle {
                            color: navItem.current ? (Theme.dark ? Theme.ink750 : Theme.orange50)
                                 : navItem.hovered ? Theme.hover : "transparent"
                        }
                        contentItem: RowLayout {
                            spacing: 8
                            Icon {
                                name: navItem.modelData.icon
                                size: 16
                                color: navItem.current ? Theme.accent : Theme.textMuted
                            }
                            Text {
                                Layout.fillWidth: true
                                text: navItem.modelData.label
                                elide: Text.ElideRight
                                font.family: Theme.fontFamily
                                font.pixelSize: Theme.fontSm
                                font.weight: Font.Medium
                                color: navItem.current ? Theme.accent : Theme.textMuted
                            }
                        }
                    }
                }
            }
            Item { Layout.fillHeight: true }
        }
        Rectangle { Layout.fillHeight: true; implicitWidth: 1; color: Theme.border }

        ScrollView {
            id: scroller
            Layout.fillWidth: true
            Layout.preferredWidth: 0    // its implicit width follows its width: don't feed it back to the layout
            Layout.fillHeight: true
            contentWidth: availableWidth
            ScrollBar.vertical: OScrollBar {}

            Item {
                width: scroller.availableWidth
                implicitHeight: body.implicitHeight + 48

                ColumnLayout {
                    id: body
                    x: 24
                    y: 24
                    width: Math.min(480, parent.width - 48)
                    spacing: 12

                    Loader {
                        Layout.fillWidth: true
                        sourceComponent: ({
                            profile: profileSection,
                            appearance: appearanceSection,
                            desktop: desktopSection,
                            notifications: notificationsSection,
                            more: moreSection
                        })[root.section]
                    }
                }
            }
        }
    }

    Component {
        id: profileSection
        ColumnLayout {
            id: profile
            spacing: 12
            property bool saved: false
            property bool hasPin: false
            property bool showPinForm: false

            Component.onCompleted: Api.call("GET", "/api/user/pin/status", null, (ok, status, json) => {
                if (ok) profile.hasPin = !!json.has_pin
            })
            function save() {
                Api.call("PATCH", "/api/user", { name: nameInput.text.trim(), avatar_url: avatarInput.text.trim() },
                         (ok, status, json) => {
                    if (!ok) { App.toast(Tr.t("common.error")); return }
                    Auth.refreshMe()
                    profile.saved = true
                    savedTimer.restart()
                })
            }
            function setPin() {
                if (!/^\d{4,6}$/.test(pinInput.text)) return
                Api.call("POST", "/api/user/pin", { pin: pinInput.text }, (ok) => {
                    if (!ok) { App.toast(Tr.t("common.error")); return }
                    profile.hasPin = true
                    profile.showPinForm = false
                    pinInput.text = ""
                })
            }
            function removePin() {
                Api.call("DELETE", "/api/user/pin", null, (ok) => { if (ok) profile.hasPin = false })
            }
            Timer { id: savedTimer; interval: 2000; onTriggered: profile.saved = false }

            SectionTitle { text: Tr.t("settings.profile") }
            RowLayout {
                spacing: 16
                Avatar {
                    name: nameInput.text || Auth.user.email || ""
                    url: avatarInput.text
                    size: 64
                }
                Text {
                    Layout.fillWidth: true
                    text: Auth.user.email || ""
                    elide: Text.ElideRight
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontSm
                    color: Theme.textMuted
                }
            }
            FieldLabel { text: Tr.t("common.name") }
            OInput { id: nameInput; Layout.fillWidth: true; text: Auth.user.name || "" }
            FieldLabel { text: Tr.t("settings.avatarUrl") }
            OInput { id: avatarInput; Layout.fillWidth: true; text: Auth.user.avatar_url || ""; placeholderText: "https://..." }
            OButton {
                iconName: profile.saved ? "check" : ""
                text: profile.saved ? Tr.t("common.saved") : Tr.t("settings.saveProfile")
                enabled: Sync.online
                onClicked: profile.save()
            }

            Divider {}
            RowLayout {
                spacing: 8
                Icon { name: "lock"; size: 16; color: Theme.textFaint }
                Text {
                    text: Tr.t("settings.appPin")
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontSm
                    font.weight: Font.Medium
                    color: Theme.text
                }
                Rectangle {
                    visible: profile.hasPin
                    implicitWidth: enabledText.implicitWidth + 12
                    implicitHeight: 20
                    radius: 2
                    color: Theme.dark ? "#052e16" : "#dcfce7"
                    Text {
                        id: enabledText
                        anchors.centerIn: parent
                        text: Tr.t("common.enabled")
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontXs
                        color: Theme.dark ? "#4ade80" : "#15803d"
                    }
                }
            }
            Hint { text: Tr.t("settings.pinDescription") }
            OButton {
                visible: profile.hasPin
                primary: false
                compact: true
                text: Tr.t("settings.removePin")
                onClicked: profile.removePin()
            }
            RowLayout {
                visible: !profile.hasPin && profile.showPinForm
                spacing: 8
                OInput {
                    id: pinInput
                    Layout.preferredWidth: 140
                    echoMode: TextInput.Password
                    inputMethodHints: Qt.ImhDigitsOnly
                    maximumLength: 6
                    validator: RegularExpressionValidator { regularExpression: /\d{0,6}/ }
                    placeholderText: Tr.t("settings.pinPlaceholder")
                    onAccepted: profile.setPin()
                }
                OButton {
                    text: Tr.t("settings.setPin")
                    enabled: pinInput.text.length >= 4
                    onClicked: profile.setPin()
                }
            }
            OButton {
                visible: !profile.hasPin && !profile.showPinForm
                primary: false
                compact: true
                text: Tr.t("settings.setUpPin")
                onClicked: {
                    profile.showPinForm = true
                    pinInput.forceActiveFocus()
                }
            }

            Divider {}
            OButton {
                primary: false
                compact: true
                iconName: "log-out"
                text: Tr.t("settings.signOut")
                onClicked: Auth.logout()
            }
        }
    }

    Component {
        id: appearanceSection
        ColumnLayout {
            spacing: 12
            SectionTitle { text: Tr.t("settings.appearance") }
            FieldLabel { text: Tr.t("settings.theme") }
            RowLayout {
                Layout.fillWidth: true
                spacing: 8
                Repeater {
                    model: [
                        { mode: "light", icon: "sun" },
                        { mode: "dark", icon: "moon" },
                        { mode: "system", icon: "monitor" }
                    ]
                    delegate: AbstractButton {
                        id: themeButton
                        required property var modelData
                        readonly property bool current: AppSettings.theme === modelData.mode
                        // equal preferred widths so fillWidth splits the row evenly instead of by label length
                        Layout.fillWidth: true
                        Layout.preferredWidth: 1
                        implicitHeight: 80
                        hoverEnabled: true
                        onClicked: AppSettings.theme = modelData.mode
                        background: Rectangle {
                            color: themeButton.current ? (Theme.dark ? Theme.ink750 : Theme.orange50) : "transparent"
                            border.width: 1
                            border.color: themeButton.current ? Theme.accent
                                        : (Theme.dark ? Theme.ink600 : Theme.gray300)
                        }
                        // the control sizes contentItem itself so center inside it
                        contentItem: Item {
                            Column {
                                anchors.centerIn: parent
                                spacing: 8
                                Icon {
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    name: themeButton.modelData.icon
                                    size: 20
                                    color: Theme.text
                                }
                                Text {
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    text: Tr.t("desktop.settings.theme." + themeButton.modelData.mode)
                                    font.family: Theme.fontFamily
                                    font.pixelSize: Theme.fontSm
                                    color: Theme.text
                                }
                            }
                        }
                    }
                }
            }

            FieldLabel { text: Tr.t("language.title"); Layout.topMargin: 8 }
            Hint { text: Tr.t("language.description") }
            OSelect {
                Layout.fillWidth: true
                model: [
                    { value: "system", text: Tr.t("language.system") },
                    { value: "en", text: Tr.t("language.en") },
                    { value: "lt", text: Tr.t("language.lt") }
                ]
                Component.onCompleted: selectValue(AppSettings.language)
                onActivated: AppSettings.language = currentValue
            }

            Divider {}
            FieldLabel { text: Tr.t("about.title") }
            Hint { text: Tr.t("about.version", { version: App.version }) }
        }
    }

    Component {
        id: desktopSection
        ColumnLayout {
            spacing: 14
            SectionTitle { text: Tr.t("desktop.settings.title") }

            FieldLabel { text: Tr.t("desktop.settings.tray") }
            RowLayout {
                Layout.fillWidth: true
                spacing: 12
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 4
                    Hint { text: Tr.t("desktop.settings.popupCorner") }
                    OSelect {
                        Layout.fillWidth: true
                        model: ["auto", "top-left", "top-right", "bottom-left", "bottom-right"]
                            .map(c => ({ value: c, text: Tr.t("desktop.settings.corner." + c) }))
                        Component.onCompleted: selectValue(AppSettings.popupCorner)
                        onActivated: AppSettings.popupCorner = currentValue
                    }
                }
            }
            OSwitch {
                Layout.fillWidth: true
                text: Tr.t("desktop.settings.badge")
                description: Tr.t("desktop.settings.badgeHint")
                checked: AppSettings.badgeEnabled
                onToggled: AppSettings.badgeEnabled = checked
            }

            Divider {}
            FieldLabel { text: Tr.t("desktop.settings.window") }
            OSwitch {
                Layout.fillWidth: true
                text: Tr.t("desktop.settings.autostart")
                checked: Autostart.enabled
                onToggled: Autostart.enabled = checked
            }
            OSwitch {
                Layout.fillWidth: true
                text: Tr.t("desktop.settings.startInTray")
                description: Tr.t("desktop.settings.startInTrayHint")
                checked: AppSettings.startInTray
                onToggled: AppSettings.startInTray = checked
            }
            OSwitch {
                Layout.fillWidth: true
                text: Tr.t("desktop.settings.closeToTray")
                description: Tr.t("desktop.settings.closeToTrayHint")
                checked: AppSettings.closeToTray
                onToggled: AppSettings.closeToTray = checked
            }
            OSwitch {
                Layout.fillWidth: true
                text: Tr.t("desktop.settings.sticky")
                description: Tr.t("desktop.settings.stickyHint")
                checked: App.stickyVisible
                onToggled: App.setStickyShown(checked)
            }

            Divider {}
            FieldLabel { text: Tr.t("desktop.settings.reminders") }
            OSwitch {
                Layout.fillWidth: true
                text: Tr.t("desktop.settings.remindersEnabled")
                description: Tr.t("desktop.settings.remindersHint")
                checked: AppSettings.remindersEnabled
                onToggled: AppSettings.remindersEnabled = checked
            }
            OSwitch {
                Layout.fillWidth: true
                enabled: AppSettings.remindersEnabled
                text: Tr.t("desktop.settings.morningSummary")
                description: Tr.t("desktop.settings.morningSummaryHint")
                checked: AppSettings.morningSummary
                onToggled: AppSettings.morningSummary = checked
            }
            RowLayout {
                visible: AppSettings.remindersEnabled && AppSettings.morningSummary
                spacing: 12
                Hint { Layout.fillWidth: false; text: Tr.t("desktop.settings.summaryAt") }
                OSelect {
                    Layout.preferredWidth: 110
                    model: Array.from({ length: 24 }, (_, h) => ({ value: h, text: (h < 10 ? "0" : "") + h + ":00" }))
                    Component.onCompleted: selectValue(AppSettings.morningSummaryHour)
                    onActivated: AppSettings.morningSummaryHour = currentValue
                }
            }
        }
    }

    Component {
        id: notificationsSection
        ColumnLayout {
            id: notif
            spacing: 14
            property var prefs: null
            readonly property var types: [
                { key: "task_due_soon", label: Tr.t("settings.notifTaskDueSoon"), desc: Tr.t("settings.notifTaskDueSoonDesc") },
                { key: "task_assigned", label: Tr.t("settings.notifTaskAssigned"), desc: Tr.t("settings.notifTaskAssignedDesc") },
                { key: "list_shared", label: Tr.t("settings.notifListShared"), desc: Tr.t("settings.notifListSharedDesc") },
                { key: "task_completed_by", label: Tr.t("settings.notifTaskCompleted"), desc: Tr.t("settings.notifTaskCompletedDesc") }
            ]
            Component.onCompleted: Api.call("GET", "/api/user/notification-prefs", null, (ok, status, json) => {
                if (ok) notif.prefs = json.prefs || {}
            })
            function setEmail(key, value) {
                const next = Object.assign({}, prefs)
                next[key] = Object.assign({}, next[key] || {}, { email: value })
                prefs = next
                Api.call("PUT", "/api/user/notification-prefs", { prefs: next }, () => {})
            }

            SectionTitle { text: Tr.t("notifications.title") }
            Hint { text: Tr.t("desktop.settings.emailPrefsHint") }
            Text {
                visible: notif.prefs === null
                text: Sync.online ? Tr.t("common.loading") : Tr.t("layout.offline")
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontSm
                color: Theme.textFaint
            }
            Repeater {
                model: notif.prefs ? notif.types : []
                delegate: OSwitch {
                    required property var modelData
                    Layout.fillWidth: true
                    text: modelData.label
                    description: modelData.desc
                    checked: !!(notif.prefs[modelData.key] && notif.prefs[modelData.key].email)
                    onToggled: notif.setEmail(modelData.key, checked)
                }
            }
        }
    }

    Component {
        id: moreSection
        ColumnLayout {
            spacing: 12
            SectionTitle { text: Tr.t("desktop.settings.more") }
            Hint { text: Tr.t("desktop.settings.moreHint") }
            Repeater {
                model: [
                    { icon: "webhook", label: Tr.t("settings.webhooksAndIntegrations") },
                    { icon: "key-round", label: Tr.t("settings.apiKeys") },
                    { icon: "github", label: Tr.t("github.title") },
                    { icon: "download", label: Tr.t("settings.data") },
                    { icon: "shield", label: Tr.t("settings.legal") }
                ]
                delegate: AbstractButton {
                    id: link
                    required property var modelData
                    Layout.fillWidth: true
                    implicitHeight: 44
                    leftPadding: 14
                    rightPadding: 14
                    hoverEnabled: true
                    onClicked: App.openInBrowser("/settings")
                    background: Rectangle {
                        color: link.hovered ? Theme.hover : "transparent"
                        border.width: 1
                        border.color: Theme.border
                    }
                    contentItem: RowLayout {
                        spacing: 10
                        Icon { name: link.modelData.icon; size: 16; color: Theme.textMuted }
                        Text {
                            Layout.fillWidth: true
                            text: link.modelData.label
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontSm
                            color: Theme.text
                        }
                        Icon { name: "arrow-up-right"; size: 14; color: Theme.textFaint }
                    }
                }
            }
            Divider {}
            FieldLabel { text: Tr.t("desktop.settings.server") }
            Hint { text: AppSettings.serverUrl }
        }
    }
}
