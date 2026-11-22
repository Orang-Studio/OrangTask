import QtQuick
import OrangTask

Rectangle {
    property string priority: "none"
    property int size: 8
    visible: priority !== "none" && priority !== ""
    width: size
    height: size
    radius: size / 2
    color: Theme.priorityColor(priority)
}
