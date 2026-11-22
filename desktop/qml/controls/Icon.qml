import QtQuick
import OrangTask

Item {
    id: root
    property string name: "list"
    property color color: Theme.text
    property int size: 18

    implicitWidth: size
    implicitHeight: size

    Image {
        anchors.fill: parent
        source: Theme.icon(root.name, root.color)
        sourceSize: Qt.size(root.size * 2, root.size * 2)
        fillMode: Image.PreserveAspectFit
        smooth: true
        mipmap: true
        asynchronous: false
    }
}
