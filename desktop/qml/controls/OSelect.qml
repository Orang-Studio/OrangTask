import QtQuick
import QtQuick.Controls.Basic
import OrangTask

ComboBox {
    id: root
    textRole: "text"
    valueRole: "value"
    implicitHeight: 36
    font.family: Theme.fontFamily
    font.pixelSize: Theme.fontSm
    hoverEnabled: true

    function selectValue(v) { currentIndex = indexOfValue(v) }

    background: Rectangle {
        radius: 2
        color: Theme.inputBg
        border.width: 1
        border.color: root.activeFocus || root.popup.visible || root.hovered ? Theme.accent : Theme.inputBorder
    }
    contentItem: Text {
        leftPadding: 10
        rightPadding: root.indicator.width + 4
        text: root.displayText
        font: root.font
        color: root.enabled ? Theme.text : Theme.textFaint
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }
    indicator: Icon {
        x: root.width - width - 10
        anchors.verticalCenter: parent.verticalCenter
        name: "chevron-down"
        size: 14
        color: Theme.textMuted
    }
    delegate: ItemDelegate {
        id: opt
        required property var modelData
        required property int index
        width: ListView.view ? ListView.view.width : implicitWidth
        height: 32
        highlighted: root.highlightedIndex === index
        contentItem: Text {
            text: opt.modelData.text
            font: root.font
            color: root.currentIndex === opt.index ? Theme.accent : Theme.text
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }
        background: Rectangle { color: opt.highlighted ? Theme.hover : "transparent" }
    }
    popup: Popup {
        y: root.height + 2
        width: root.width
        implicitHeight: Math.min(contentItem.implicitHeight + 8, 280)
        padding: 4
        contentItem: ListView {
            clip: true
            implicitHeight: contentHeight
            model: root.popup.visible ? root.delegateModel : null
            currentIndex: root.highlightedIndex
            ScrollBar.vertical: OScrollBar {}
        }
        background: Rectangle {
            color: Theme.surfaceRaised
            border.width: 1
            border.color: Theme.border
            radius: 4
        }
    }
}
