import QtQuick
import OrangTask

Column {
    id: root
    property string title: ""
    property string description: ""
    property int mascotSize: 120
    spacing: 10
    width: Math.min(parent ? parent.width - 48 : 320, 360)

    Image {
        id: mascot
        anchors.horizontalCenter: parent.horizontalCenter
        width: root.mascotSize
        height: root.mascotSize
        source: "qrc:/qt/qml/OrangTask/assets/mascot.svg"
        sourceSize: Qt.size(root.mascotSize * 2, root.mascotSize * 2)
        fillMode: Image.PreserveAspectFit
        visible: root.mascotSize > 0
        SequentialAnimation on y {
            loops: Animation.Infinite
            running: mascot.visible
            NumberAnimation { from: 0; to: -6; duration: 1500; easing.type: Easing.InOutSine }
            NumberAnimation { from: -6; to: 0; duration: 1500; easing.type: Easing.InOutSine }
        }
    }
    Text {
        width: parent.width
        horizontalAlignment: Text.AlignHCenter
        text: root.title
        color: Theme.text
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontLg
        font.weight: Font.Bold
        wrapMode: Text.WordWrap
    }
    Text {
        width: parent.width
        horizontalAlignment: Text.AlignHCenter
        text: root.description
        visible: text !== ""
        color: Theme.textMuted
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontSm
        wrapMode: Text.WordWrap
    }
}
