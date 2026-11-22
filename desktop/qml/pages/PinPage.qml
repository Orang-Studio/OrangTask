import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Rectangle {
    id: root
    color: Theme.dark ? Theme.ink900 : Theme.gray50

    property bool recovering: false

    function unlock() {
        if (pinInput.text.length >= 4 && !Auth.busy) Auth.verifyPin(pinInput.text)
    }
    function startRecovery() {
        Auth.clearError()
        Auth.forgotPin()
        recovering = true
        Qt.callLater(() => codeInput.forceActiveFocus())
    }
    Connections {
        target: Auth
        // a wrong PIN clears the field for the next attempt
        function onErrorChanged() { if (Auth.error && !root.recovering) pinInput.text = "" }
    }
    Component.onCompleted: pinInput.forceActiveFocus()

    component LinkButton: AbstractButton {
        id: linkButton
        Layout.alignment: Qt.AlignHCenter
        hoverEnabled: true
        padding: 2
        opacity: enabled ? 1 : 0.5
        contentItem: Text {
            text: linkButton.text
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontSm
            color: linkButton.hovered ? Theme.accent : Theme.textFaint
        }
        background: null
        HoverHandler { cursorShape: Qt.PointingHandCursor }
    }
    component BigInput: TextField {
        id: bigInput
        Layout.fillWidth: true
        implicitHeight: 64
        horizontalAlignment: TextInput.AlignHCenter
        font.family: Theme.fontFamily
        font.pixelSize: 30
        font.weight: Font.Bold
        font.letterSpacing: 14
        color: Theme.text
        maximumLength: 6
        inputMethodHints: Qt.ImhDigitsOnly
        validator: RegularExpressionValidator { regularExpression: /\d{0,6}/ }
        selectByMouse: true
        background: Rectangle {
            color: Theme.dark ? Theme.ink750 : "#ffffff"
            border.width: 2
            border.color: Auth.error ? Theme.red500
                        : bigInput.activeFocus ? Theme.accent
                        : (Theme.dark ? Theme.ink500 : Theme.gray300)
            Behavior on border.color { ColorAnimation { duration: Theme.hoverMs } }
        }
    }

    ColumnLayout {
        width: Math.min(384, parent.width - 32)
        anchors.centerIn: parent
        spacing: 0

        Logo { Layout.alignment: Qt.AlignHCenter; size: 56 }
        Text {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 16
            text: root.recovering ? Tr.t("pin.resetTitle") : Tr.t("pin.enterPin")
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontXl
            font.weight: Font.Bold
            font.capitalization: Font.AllUppercase
            font.letterSpacing: 1.5
            color: Theme.text
        }
        Text {
            Layout.fillWidth: true
            Layout.topMargin: 4
            Layout.bottomMargin: 32
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            text: root.recovering ? Tr.t("pin.resetCodeSent") : Tr.t("pin.unlockHint")
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontSm
            color: Theme.textMuted
        }

        BigInput {
            id: pinInput
            visible: !root.recovering
            echoMode: TextInput.Password
            passwordCharacter: "●"
            onAccepted: root.unlock()
            // auto submit on the sixth digit like the web page
            onTextEdited: {
                if (Auth.error) Auth.clearError()
                if (text.length === 6) root.unlock()
            }
        }

        BigInput {
            id: codeInput
            visible: root.recovering
            placeholderText: "000000"
            placeholderTextColor: Theme.textFaint
            onAccepted: if (text.length === 6) Auth.resetPin(text)
            onTextEdited: if (Auth.error) Auth.clearError()
        }

        Text {
            visible: Auth.error !== ""
            Layout.fillWidth: true
            Layout.topMargin: 16
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            text: Auth.error
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontSm
            color: Theme.red500
        }

        OButton {
            Layout.fillWidth: true
            Layout.topMargin: 24
            enabled: !Auth.busy && (root.recovering ? codeInput.text.length === 6 : pinInput.text.length >= 4)
            text: Auth.busy ? Tr.t("pin.waiting")
                : root.recovering ? Tr.t("pin.removePinContinue")
                : Tr.t("common.unlock")
            onClicked: root.recovering ? Auth.resetPin(codeInput.text) : root.unlock()
        }

        LinkButton {
            Layout.topMargin: 20
            visible: !root.recovering
            text: Tr.t("pin.forgotPin")
            onClicked: root.startRecovery()
        }
        LinkButton {
            Layout.topMargin: 16
            visible: root.recovering
            text: Tr.t("login.resendCode")
            onClicked: Auth.forgotPin()
        }
        LinkButton {
            Layout.topMargin: 8
            visible: root.recovering
            text: Tr.t("pin.backToEntry")
            onClicked: {
                root.recovering = false
                codeInput.text = ""
                Auth.clearError()
                pinInput.forceActiveFocus()
            }
        }
        LinkButton {
            Layout.topMargin: 8
            text: Tr.t("pin.signOutInstead")
            onClicked: Auth.logout()
        }
    }
}
