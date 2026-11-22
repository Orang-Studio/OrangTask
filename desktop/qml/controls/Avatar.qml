import QtQuick
import QtQuick.Effects
import OrangTask

Rectangle {
    id: root
    property string name: ""
    property string url: ""
    property int size: 28

    width: size
    height: size
    radius: size / 2
    color: Theme.accent
    clip: true

    Text {
        anchors.centerIn: parent
        visible: img.status !== Image.Ready
        text: {
            const parts = root.name.trim().split(/\s+/).filter(p => p.length)
            if (!parts.length) return "?"
            return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
        }
        color: "#ffffff"
        font.family: Theme.fontFamily
        font.pixelSize: Math.round(root.size * 0.4)
        font.weight: Font.Bold
    }
    Image {
        id: img
        anchors.fill: parent
        source: root.url
        visible: status === Image.Ready
        fillMode: Image.PreserveAspectCrop
        sourceSize: Qt.size(root.size * 2, root.size * 2)
        asynchronous: true
        layer.enabled: true
        layer.effect: MultiEffect {
            maskEnabled: true
            maskSource: mask
            maskThresholdMin: 0.5
            maskSpreadAtMin: 1.0
        }
    }
    // rectangle clip ignores radius so the image is masked to a circle instead
    Rectangle {
        id: mask
        anchors.fill: parent
        radius: width / 2
        visible: false
        layer.enabled: true
    }
}
