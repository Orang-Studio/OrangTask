import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

ODialog {
    id: root
    property string listId: ""
    property string listName: ""
    property bool isOwner: true
    property var members: []
    property string error: ""
    property bool busy: false
    property bool confirmLeave: false

    title: Tr.t("share.title", { listName: listName })
    preferredWidth: 460

    readonly property int ownerCount: root.members.filter(m => m.role === "owner").length
    readonly property bool canLeave: !root.isOwner || root.ownerCount > 1
    readonly property var roleModel: [
        { value: "owner", text: Tr.t("share.owner") },
        { value: "editor", text: Tr.t("share.editor") },
        { value: "viewer", text: Tr.t("share.viewer") }
    ]
    readonly property string base: "/api/lists/" + listId + "/members"

    onOpened: {
        error = ""
        confirmLeave = false
        emailInput.text = ""
        reload()
        inviteRole.selectValue("editor")
        if (isOwner) emailInput.forceActiveFocus()
    }

    function reload() {
        if (!listId) return
        Api.call("GET", base, null, (ok, status, json) => {
            if (ok) root.members = json.members || []
        })
    }
    function invite() {
        const email = emailInput.text.trim()
        if (!email || busy) return
        busy = true
        error = ""
        Api.call("POST", base, { email: email, role: inviteRole.currentValue }, (ok, status, json) => {
            root.busy = false
            if (ok) {
                emailInput.text = ""
                root.reload()
                Sync.refresh()
            } else {
                root.error = (json && json.error) || Tr.t("share.inviteFailed")
            }
        })
    }
    function setRole(userId, role) {
        Api.call("PATCH", base + "/" + userId, { role: role }, (ok) => root.reload())
    }
    function remove(userId) {
        Api.call("DELETE", base + "/" + userId, null, (ok) => {
            root.reload()
            Sync.refresh()
        })
    }
    function leave() {
        Api.call("DELETE", base + "/" + Auth.userId, null, (ok, status, json) => {
            if (ok) {
                root.close()
                App.showPage("today")
                Sync.refresh()
            } else {
                root.error = (json && json.error) || Tr.t("common.error")
            }
        })
    }

    component Label: Text {
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontXs
        font.capitalization: Font.AllUppercase
        font.letterSpacing: 0.6
        color: Theme.textFaint
    }

    ColumnLayout {
        visible: root.isOwner
        Layout.fillWidth: true
        spacing: 8
        Label { text: Tr.t("share.inviteByEmail") }
        OInput {
            id: emailInput
            Layout.fillWidth: true
            placeholderText: Tr.t("share.emailPlaceholder")
            inputMethodHints: Qt.ImhEmailCharactersOnly
            onAccepted: root.invite()
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            OSelect {
                id: inviteRole
                Layout.preferredWidth: 120
                model: root.roleModel
            }
            OButton {
                Layout.fillWidth: true
                primary: true
                iconName: "user-plus"
                enabled: !root.busy && emailInput.text.trim() !== ""
                text: root.busy ? Tr.t("share.inviting") : Tr.t("share.invite")
                onClicked: root.invite()
            }
        }
    }

    Text {
        visible: root.error !== ""
        Layout.fillWidth: true
        wrapMode: Text.Wrap
        text: root.error
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSm
        color: Theme.red500
    }

    Label { text: Tr.t("share.members"); Layout.topMargin: 4 }
    Text {
        visible: root.members.length <= 1
        Layout.fillWidth: true
        wrapMode: Text.Wrap
        text: Tr.t("share.noMembers")
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSm
        color: Theme.textFaint
    }
    Repeater {
        model: root.members
        delegate: RowLayout {
            id: memberRow
            required property var modelData
            Layout.fillWidth: true
            spacing: 12

            Avatar {
                name: memberRow.modelData.name || memberRow.modelData.email || ""
                url: memberRow.modelData.avatar_url || ""
                size: 32
            }
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 0
                Text {
                    Layout.fillWidth: true
                    text: memberRow.modelData.name || ""
                    elide: Text.ElideRight
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontSm
                    color: Theme.text
                }
                Text {
                    Layout.fillWidth: true
                    text: memberRow.modelData.email || ""
                    elide: Text.ElideRight
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontXs
                    color: Theme.textFaint
                }
            }
            Rectangle {
                visible: !root.isOwner || memberRow.modelData.id === Auth.userId
                implicitWidth: badgeRow.implicitWidth + 12
                implicitHeight: 20
                radius: 2
                color: memberRow.modelData.role === "owner" ? Theme.tagBg : Theme.badgeBg
                Row {
                    id: badgeRow
                    anchors.centerIn: parent
                    spacing: 4
                    Icon {
                        visible: memberRow.modelData.role === "owner"
                        name: "crown"
                        size: 12
                        color: Theme.tagText
                        anchors.verticalCenter: parent.verticalCenter
                    }
                    Text {
                        text: Tr.t("share." + memberRow.modelData.role)
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontXs
                        color: memberRow.modelData.role === "owner" ? Theme.tagText : Theme.badgeText
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
            }
            OSelect {
                visible: root.isOwner && memberRow.modelData.id !== Auth.userId
                Layout.preferredWidth: 110
                implicitHeight: 32
                model: root.roleModel
                Component.onCompleted: selectValue(memberRow.modelData.role)
                onActivated: root.setRole(memberRow.modelData.id, currentValue)
            }
            IconButton {
                visible: root.isOwner && memberRow.modelData.id !== Auth.userId
                iconName: "trash"
                iconSize: 15
                hoverColor: Theme.red500
                tip: Tr.t("share.removeMember", { name: memberRow.modelData.name || "" })
                onClicked: root.remove(memberRow.modelData.id)
            }
        }
    }

    Rectangle {
        visible: root.canLeave
        Layout.fillWidth: true
        Layout.topMargin: 4
        implicitHeight: 1
        color: Theme.border
    }
    Text {
        visible: root.canLeave && root.confirmLeave
        Layout.fillWidth: true
        wrapMode: Text.Wrap
        text: Tr.t("share.leaveConfirm", { listName: root.listName })
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSm
        color: Theme.text
    }
    OButton {
        visible: root.canLeave
        danger: true
        compact: true
        iconName: "log-out"
        text: root.confirmLeave ? Tr.t("common.confirm") : Tr.t("share.leaveList")
        onClicked: root.confirmLeave ? root.leave() : (root.confirmLeave = true)
    }
}
