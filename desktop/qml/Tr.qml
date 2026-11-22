pragma Singleton
import QtQuick
import OrangTask.Core

QtObject {
    function t(key, vars) {
        I18n.revision
        return I18n.t(key, vars || {})
    }
    function tc(key, count, vars) {
        I18n.revision
        return I18n.tc(key, count, vars || {})
    }
}
