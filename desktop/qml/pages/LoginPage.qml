import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Rectangle {
    id: root
    color: Theme.dark ? Theme.ink900 : Theme.gray50

    property string mode: "magic"
    property bool guestWarningOpen: false
    readonly property string step: Auth.step
    readonly property bool needsCaptcha: mode === "register" || Auth.captchaRequired

    function setMode(m) {
        mode = m
        guestWarningOpen = false
        Auth.clearError()
    }
    function submit() {
        if (Auth.busy) return
        if (mode === "magic") {
            Auth.requestMagicLink(emailInput.text)
        } else if (mode === "register") {
            if (passwordInput.text.length < 8) { Auth.clearError(); errorOverride = Tr.t("login.passwordMin"); return }
            Auth.registerAccount(nameInput.text, emailInput.text, passwordInput.text)
        } else {
            Auth.login(emailInput.text, passwordInput.text)
        }
    }
    // client side validation messages shown like server errors
    property string errorOverride: ""
    readonly property string errorText: errorOverride || Auth.error
    Connections {
        target: Auth
        function onErrorChanged() { root.errorOverride = "" }
        function onStepChanged() { root.errorOverride = "" }
    }
    onModeChanged: errorOverride = ""

    component FieldLabel: Text {
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontXs
        font.capitalization: Font.AllUppercase
        font.letterSpacing: 0.6
        color: Theme.textFaint
    }
    component LinkButton: AbstractButton {
        id: linkButton
        property color baseColor: Theme.textMuted
        Layout.alignment: Qt.AlignHCenter
        hoverEnabled: true
        padding: 2
        contentItem: Text {
            text: linkButton.text
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontSm
            color: linkButton.hovered ? Theme.accent : linkButton.baseColor
        }
        background: null
        HoverHandler { cursorShape: Qt.PointingHandCursor }
    }
    component CodeInput: OInput {
        Layout.fillWidth: true
        horizontalAlignment: TextInput.AlignHCenter
        font.letterSpacing: 6
        maximumLength: 6
        inputMethodHints: Qt.ImhDigitsOnly
        validator: RegularExpressionValidator { regularExpression: /\d{0,6}/ }
        placeholderText: "000000"
    }

    Flickable {
        anchors.fill: parent
        contentHeight: Math.max(height, column.implicitHeight + 64)
        boundsBehavior: Flickable.StopAtBounds
        clip: true

        ColumnLayout {
            id: column
            width: Math.min(384, parent.width - 32)
            anchors.horizontalCenter: parent.horizontalCenter
            y: Math.max(32, (parent.height - implicitHeight) / 2)
            spacing: 0

            Logo { Layout.alignment: Qt.AlignHCenter; size: 56 }
            Text {
                Layout.alignment: Qt.AlignHCenter
                Layout.topMargin: 16
                text: "OrangTask"
                font.family: Theme.fontFamily
                font.pixelSize: Theme.font2xl
                font.weight: Font.Bold
                font.capitalization: Font.AllUppercase
                font.letterSpacing: 2
                color: Theme.text
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                Layout.topMargin: 4
                Layout.bottomMargin: 32
                text: Tr.t("login.tagline")
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontSm
                color: Theme.textMuted
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: card.implicitHeight + 48
                color: Theme.surface
                border.width: 1
                border.color: Theme.dark ? Theme.ink600 : Theme.gray200

                ColumnLayout {
                    id: card
                    x: 24
                    y: 24
                    width: parent.width - 48
                    spacing: 12

                    Rectangle {
                        visible: root.errorText !== ""
                        Layout.fillWidth: true
                        implicitHeight: errorLabel.implicitHeight + 16
                        color: Theme.overdueBg
                        Text {
                            id: errorLabel
                            x: 12
                            width: parent.width - 24
                            anchors.verticalCenter: parent.verticalCenter
                            text: root.errorText
                            wrapMode: Text.Wrap
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontSm
                            color: Theme.overdueText
                        }
                    }

                    ColumnLayout {
                        visible: root.step === "magic-sent"
                        Layout.fillWidth: true
                        spacing: 12
                        Rectangle {
                            Layout.alignment: Qt.AlignHCenter
                            Layout.topMargin: 8
                            implicitWidth: 48
                            implicitHeight: 48
                            color: Theme.accent
                            Icon { anchors.centerIn: parent; name: "check"; size: 24; color: "#ffffff" }
                        }
                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            text: Tr.t("login.checkYourEmail")
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontBase
                            font.weight: Font.Bold
                            color: Theme.text
                        }
                        Text {
                            Layout.fillWidth: true
                            horizontalAlignment: Text.AlignHCenter
                            wrapMode: Text.Wrap
                            text: Tr.t("login.sentLinkTo", { email: Auth.pendingEmail })
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontSm
                            color: Theme.textMuted
                        }
                        // the link normally hands back to the app on its own pasting covers mail read on another device
                        FieldLabel { Layout.topMargin: 8; text: Tr.t("desktop.auth.pasteLink") }
                        OInput {
                            id: linkInput
                            Layout.fillWidth: true
                            placeholderText: "https://…/auth/magic?token=…"
                            onAccepted: if (text.trim()) Auth.verifyMagicLink(text)
                        }
                        OButton {
                            Layout.fillWidth: true
                            enabled: linkInput.text.trim() !== "" && !Auth.busy
                            text: Auth.busy ? Tr.t("login.verifying") : Tr.t("desktop.auth.signInWithLink")
                            onClicked: Auth.verifyMagicLink(linkInput.text)
                        }
                        LinkButton {
                            text: Tr.t("login.useDifferentEmail")
                            baseColor: Theme.accent
                            onClicked: { linkInput.text = ""; Auth.backToCredentials() }
                        }
                    }

                    ColumnLayout {
                        visible: root.step === "twofa"
                        Layout.fillWidth: true
                        spacing: 12
                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            text: Tr.t("login.checkYourEmail")
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontBase
                            font.weight: Font.Bold
                            color: Theme.text
                        }
                        Text {
                            Layout.fillWidth: true
                            horizontalAlignment: Text.AlignHCenter
                            wrapMode: Text.Wrap
                            text: Tr.t("login.sentCodeTo", { email: Auth.pendingEmail })
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.fontSm
                            color: Theme.textMuted
                        }
                        CodeInput {
                            id: codeInput
                            onAccepted: if (text.length === 6) Auth.verifyTwoFactor(text)
                        }
                        OButton {
                            Layout.fillWidth: true
                            iconName: "lock"
                            enabled: codeInput.text.length === 6 && !Auth.busy
                            text: Auth.busy ? Tr.t("login.verifying") : Tr.t("login.verifyAndSignIn")
                            onClicked: Auth.verifyTwoFactor(codeInput.text)
                        }
                        RowLayout {
                            Layout.alignment: Qt.AlignHCenter
                            spacing: 16
                            LinkButton { text: Tr.t("login.resendCode"); onClicked: Auth.resendTwoFactor() }
                            LinkButton {
                                text: Tr.t("login.backToSignIn")
                                onClicked: { codeInput.text = ""; Auth.backToCredentials() }
                            }
                        }
                    }

                    ColumnLayout {
                        visible: root.step === "credentials"
                        Layout.fillWidth: true
                        spacing: 12

                        FieldLabel { visible: root.mode === "register"; text: Tr.t("common.name") }
                        OInput {
                            id: nameInput
                            visible: root.mode === "register"
                            Layout.fillWidth: true
                            placeholderText: Tr.t("login.namePlaceholder")
                            KeyNavigation.tab: emailInput
                        }
                        FieldLabel { text: Tr.t("common.email") }
                        OInput {
                            id: emailInput
                            Layout.fillWidth: true
                            placeholderText: Tr.t("login.emailPlaceholder")
                            inputMethodHints: Qt.ImhEmailCharactersOnly | Qt.ImhNoAutoUppercase
                            focus: true
                            text: Auth.pendingEmail
                            KeyNavigation.tab: passwordInput.visible ? passwordInput : null
                            onAccepted: root.mode === "magic" ? root.submit() : passwordInput.forceActiveFocus()
                        }
                        FieldLabel { visible: root.mode !== "magic"; text: Tr.t("common.password") }
                        OInput {
                            id: passwordInput
                            visible: root.mode !== "magic"
                            Layout.fillWidth: true
                            echoMode: TextInput.Password
                            placeholderText: root.mode === "register" ? Tr.t("login.passwordHint") : "••••••••"
                            onAccepted: root.submit()
                        }

                        // captcha solves in the browser and returns a token
                        OButton {
                            visible: root.needsCaptcha && root.mode !== "magic"
                            Layout.fillWidth: true
                            primary: false
                            iconName: Auth.hasCaptchaToken ? "check" : "shield"
                            enabled: !Auth.hasCaptchaToken
                            text: Auth.hasCaptchaToken ? Tr.t("desktop.auth.captchaDone") : Tr.t("desktop.auth.captcha")
                            onClicked: Auth.openCaptcha()
                        }

                        OButton {
                            Layout.fillWidth: true
                            iconName: root.mode === "magic" ? "mail" : "lock"
                            enabled: !Auth.busy
                            text: Auth.busy ? (root.mode === "magic" ? Tr.t("login.sending") : Tr.t("login.waiting"))
                                : root.mode === "magic" ? Tr.t("login.sendMagicLink")
                                : root.mode === "register" ? Tr.t("login.createAccount")
                                : Tr.t("login.signIn")
                            onClicked: root.submit()
                        }

                        OButton {
                            visible: root.mode === "register" && !root.guestWarningOpen
                            Layout.fillWidth: true
                            primary: false
                            iconName: "user-circle"
                            enabled: !Auth.busy
                            text: Tr.t("login.useAsGuest")
                            onClicked: { Auth.clearError(); root.guestWarningOpen = true }
                        }

                        Rectangle {
                            visible: root.mode === "register" && root.guestWarningOpen
                            Layout.fillWidth: true
                            implicitHeight: guestWarnCol.implicitHeight + 24
                            radius: Theme.radius
                            color: Theme.dark ? "#2c2112" : "#fffbeb"
                            border.width: 1
                            border.color: Theme.dark ? "#92400e" : "#fcd34d"

                            ColumnLayout {
                                id: guestWarnCol
                                anchors.fill: parent
                                anchors.margins: 12
                                spacing: 10

                                RowLayout {
                                    Layout.fillWidth: true
                                    spacing: 8
                                    Icon {
                                        name: "alert-circle"
                                        size: 16
                                        color: Theme.dark ? "#fbbf24" : "#b45309"
                                        Layout.alignment: Qt.AlignTop
                                    }
                                    ColumnLayout {
                                        Layout.fillWidth: true
                                        spacing: 4
                                        Text {
                                            Layout.fillWidth: true
                                            text: Tr.t("login.guestWarningTitle")
                                            font.family: Theme.fontFamily
                                            font.pixelSize: Theme.fontSm
                                            font.weight: Font.DemiBold
                                            color: Theme.dark ? "#fcd34d" : "#92400e"
                                            wrapMode: Text.WordWrap
                                        }
                                        Text {
                                            Layout.fillWidth: true
                                            text: Tr.t("login.guestWarningBody")
                                            font.family: Theme.fontFamily
                                            font.pixelSize: Theme.fontXs
                                            color: Theme.dark ? "#fde68a" : "#92400e"
                                            wrapMode: Text.WordWrap
                                        }
                                    }
                                }

                                RowLayout {
                                    Layout.fillWidth: true
                                    spacing: 8
                                    OButton {
                                        Layout.fillWidth: true
                                        primary: false
                                        enabled: !Auth.busy
                                        text: Tr.t("common.cancel")
                                        onClicked: root.guestWarningOpen = false
                                    }
                                    OButton {
                                        Layout.fillWidth: true
                                        primary: true
                                        enabled: !Auth.busy
                                        text: Auth.busy ? Tr.t("login.waiting") : Tr.t("login.guestContinue")
                                        onClicked: Auth.continueAsGuest()
                                    }
                                }
                            }
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.topMargin: 8
                            Layout.bottomMargin: 8
                            spacing: 12
                            Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Theme.dark ? Theme.ink600 : Theme.gray200 }
                            Text {
                                text: Tr.t("login.or")
                                font.family: Theme.fontFamily
                                font.pixelSize: Theme.fontXs
                                font.capitalization: Font.AllUppercase
                                color: Theme.textFaint
                            }
                            Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Theme.dark ? Theme.ink600 : Theme.gray200 }
                        }
                        OButton {
                            Layout.fillWidth: true
                            primary: false
                            iconName: "github"
                            text: Tr.t("login.continueWithGithub")
                            onClicked: Auth.oauth("github")
                        }
                        OButton {
                            Layout.fillWidth: true
                            primary: false
                            text: Tr.t("login.continueWithGoogle")
                            iconSource: "qrc:/qt/qml/OrangTask/assets/google.svg"
                            onClicked: Auth.oauth("google")
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            Layout.topMargin: 8
                            spacing: 6
                            LinkButton {
                                visible: root.mode === "magic"
                                text: Tr.t("login.usePasswordInstead")
                                onClicked: root.setMode("password")
                            }
                            RowLayout {
                                visible: root.mode === "password"
                                Layout.alignment: Qt.AlignHCenter
                                spacing: 16
                                LinkButton { text: Tr.t("login.magicLink"); onClicked: root.setMode("magic") }
                                LinkButton {
                                    text: Tr.t("login.createAccount") + "  →"
                                    baseColor: Theme.accent
                                    onClicked: root.setMode("register")
                                }
                            }
                            LinkButton {
                                visible: root.mode === "password"
                                text: Tr.t("login.forgotPassword")
                                baseColor: Theme.textFaint
                                onClicked: Auth.forgotPassword()
                            }
                            LinkButton {
                                visible: root.mode === "register"
                                text: Tr.t("login.haveAccountSignIn")
                                onClicked: root.setMode("password")
                            }
                        }
                    }
                }
            }

            Text {
                Layout.alignment: Qt.AlignHCenter
                Layout.topMargin: 20
                text: Tr.t("login.freeOpenSource")
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontXs
                color: Theme.textFaint
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                Layout.topMargin: 4
                text: AppSettings.serverUrl.replace(/^https?:\/\//, "")
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontXs
                color: Theme.textFaint
            }
        }
    }
}
