import QtQuick

// an Item rather than a bare Image as with Icon Images implicit size follows its 2x sourceSize and is read only and Layouts size by implicit size
Item {
    id: root
    property int size: 32
    implicitWidth: size
    implicitHeight: size

    Image {
        anchors.fill: parent
        source: "qrc:/qt/qml/OrangTask/assets/logo.svg"
        sourceSize: Qt.size(root.size * 2, root.size * 2)
        fillMode: Image.PreserveAspectFit
        smooth: true
    }
}
