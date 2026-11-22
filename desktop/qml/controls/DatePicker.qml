import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Popup {
    id: root
    property string value: ""
    signal picked(string date)

    readonly property var loc: { I18n.revision; return Qt.locale(I18n.language) }
    property int month: new Date().getMonth()
    property int year: new Date().getFullYear()

    function iso(d) {
        const pad = (n) => (n < 10 ? "0" : "") + n
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    }
    function shift(delta) {
        let m = month + delta
        year += Math.floor(m / 12)
        month = ((m % 12) + 12) % 12
    }

    onAboutToShow: {
        const d = value ? new Date(value + "T00:00:00") : new Date()
        month = d.getMonth()
        year = d.getFullYear()
    }

    padding: 12
    focus: true
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
    background: Rectangle {
        color: Theme.surfaceRaised
        border.width: 1
        border.color: Theme.border
        radius: 4
    }

    contentItem: ColumnLayout {
        spacing: 8
        RowLayout {
            Layout.fillWidth: true
            IconButton { iconName: "chevron-left"; iconSize: 16; onClicked: root.shift(-1) }
            Text {
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
                text: root.loc.standaloneMonthName(root.month, Locale.LongFormat) + " " + root.year
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontSm
                font.weight: Font.DemiBold
                font.capitalization: Font.Capitalize
                color: Theme.text
            }
            IconButton { iconName: "chevron-right"; iconSize: 16; onClicked: root.shift(1) }
        }
        DayOfWeekRow {
            Layout.fillWidth: true
            locale: root.loc
            delegate: Text {
                required property string shortName
                text: shortName
                horizontalAlignment: Text.AlignHCenter
                font.family: Theme.fontFamily
                font.pixelSize: 11
                font.weight: Font.DemiBold
                font.capitalization: Font.AllUppercase
                color: Theme.textFaint
            }
        }
        MonthGrid {
            id: grid
            Layout.fillWidth: true
            month: root.month
            year: root.year
            locale: root.loc
            spacing: 2
            delegate: AbstractButton {
                id: day
                required property var model
                readonly property string dayIso: root.iso(model.date)
                readonly property bool chosen: dayIso === root.value
                implicitWidth: 34
                implicitHeight: 32
                hoverEnabled: true
                opacity: model.month === grid.month ? 1 : 0.35
                onClicked: {
                    root.picked(dayIso)
                    root.close()
                }
                background: Rectangle {
                    radius: 2
                    color: day.chosen ? Theme.accent : day.hovered ? Theme.hover : "transparent"
                    border.width: day.model.today && !day.chosen ? 1 : 0
                    border.color: Theme.accent
                }
                contentItem: Text {
                    text: day.model.day
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontSm
                    font.weight: day.chosen || day.model.today ? Font.DemiBold : Font.Normal
                    color: day.chosen ? "#ffffff" : Theme.text
                }
            }
        }
    }
}
