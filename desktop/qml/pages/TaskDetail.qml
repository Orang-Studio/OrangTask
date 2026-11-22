import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

Rectangle {
    id: root
    property string taskId: ""
    signal closeRequested()
    signal deleteRequested(string taskId)

    readonly property int minWidth: 320
    property var task: ({})
    property var members: []
    // tags other members already use in this shared list
    property var listTags: []
    readonly property bool done: task.status === "done"
    readonly property string listId: task.list_id || ""
    readonly property var locale: { I18n.revision; return Qt.locale(I18n.language) }

    implicitWidth: Math.max(minWidth, AppSettings.detailWidth)
    color: Theme.surface

    function reload() {
        if (!taskId) {
            task = ({})
            return
        }
        const t = Store.taskMap(taskId)
        // the task vanished deleted here or elsewhere close the panel
        if (!t.id) {
            closeRequested()
            return
        }
        task = t
    }

    function loadMembers() {
        members = []
        listTags = []
        const list = listId
        if (!list) return
        Api.call("GET", "/api/lists/" + list + "/members", null, (ok, status, json) => {
            if (ok && list === root.listId) root.members = json.members || []
        })
        if (!Store.listMap(list).is_shared) return
        Api.call("GET", "/api/tags?limit=200&listId=" + list, null, (ok, status, json) => {
            if (ok && list === root.listId) root.listTags = json.tags || []
        })
    }

    function save(fields) { Sync.updateTask(taskId, fields) }

    // due date stored as ISO edited as a local yyyy MM dd date plus an optional HH mm time midnight means no time as in the web app
    readonly property string dueLocal: Format.toLocalInput(task.due_date || "")
    readonly property string dueDate: dueLocal.slice(0, 10)
    readonly property string dueTime: dueLocal.length > 11 && dueLocal.slice(11) !== "00:00" ? dueLocal.slice(11) : ""

    function setDue(date, time) {
        if (!date) {
            save({ due_date: "" })
            return
        }
        save({ due_date: Format.fromLocalInput(time ? date + "T" + time : date) })
    }
    function dueInDays(n) {
        const d = new Date()
        d.setDate(d.getDate() + n)
        setDue(datePicker.iso(d), dueTime)
    }

    onTaskIdChanged: {
        reload()
        if (taskId) Sync.loadSubtasks(taskId)
    }
    onListIdChanged: loadMembers()

    Connections {
        target: Store
        function onTasksChanged() { root.reload() }
    }

    Rectangle { width: 1; height: parent.height; color: Theme.border }

    MouseArea {
        id: resizer
        width: 6
        height: parent.height
        x: -3
        z: 10
        hoverEnabled: true
        cursorShape: Qt.SizeHorCursor
        Accessible.name: Tr.t("taskDetail.resizePanel")
        property real startX: 0
        property int startWidth: 0
        onPressed: (e) => {
            startX = mapToGlobal(e.x, 0).x
            startWidth = root.width
        }
        onPositionChanged: (e) => {
            if (!pressed) return
            const maxWidth = root.parent ? root.parent.width * 0.6 : 800
            const w = startWidth + (startX - mapToGlobal(e.x, 0).x)
            AppSettings.detailWidth = Math.round(Math.max(root.minWidth, Math.min(maxWidth, w)))
        }
        Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            width: 2
            height: parent.height
            color: Theme.accent
            opacity: resizer.containsMouse || resizer.pressed ? 1 : 0
            Behavior on opacity { NumberAnimation { duration: Theme.hoverMs } }
        }
    }

    component SectionRow: RowLayout {
        property string iconName
        default property alias fields: slot.data
        Layout.fillWidth: true
        spacing: 12
        Icon {
            name: parent.iconName
            size: 18
            color: Theme.textMuted
            Layout.alignment: Qt.AlignTop
            Layout.topMargin: 9
        }
        ColumnLayout {
            id: slot
            Layout.fillWidth: true
            spacing: 8
        }
    }
    component SectionTitle: Text {
        font.family: Theme.fontFamily
        font.pixelSize: Theme.fontXs
        font.weight: Font.DemiBold
        font.capitalization: Font.AllUppercase
        font.letterSpacing: 0.6
        color: Theme.textMuted
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.leftMargin: 1
        spacing: 0
        visible: !!root.task.id

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 56
            Layout.leftMargin: 16
            Layout.rightMargin: 8
            spacing: 8

            AbstractButton {
                id: completeButton
                implicitHeight: 32
                implicitWidth: completeRow.implicitWidth + 24
                hoverEnabled: true
                Accessible.name: root.done ? Tr.t("taskDetail.completed") : Tr.t("taskDetail.complete")
                Accessible.checkable: true
                Accessible.checked: root.done
                onClicked: Sync.toggleCompleted(root.taskId)
                background: Rectangle {
                    radius: 2
                    color: root.done ? (completeButton.hovered ? Theme.accentHover : Theme.accent)
                                     : completeButton.hovered ? Theme.hover : "transparent"
                    border.width: root.done ? 0 : 1
                    border.color: completeButton.hovered ? Theme.accent : Theme.inputBorder
                    Behavior on color { ColorAnimation { duration: Theme.hoverMs } }
                }
                contentItem: RowLayout {
                    id: completeRow
                    spacing: 6
                    Item { Layout.fillWidth: true }
                    Icon { name: "check"; size: 15; color: root.done ? "#ffffff" : Theme.textMuted }
                    Text {
                        text: root.done ? Tr.t("taskDetail.completed") : Tr.t("taskDetail.complete")
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontSm
                        font.weight: Font.DemiBold
                        color: root.done ? "#ffffff" : Theme.text
                    }
                    Item { Layout.fillWidth: true }
                }
            }
            Item { Layout.fillWidth: true }
            IconButton {
                iconName: "x"
                tip: Tr.t("common.close")
                onClicked: root.closeRequested()
            }
        }
        Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Theme.border }

        Flickable {
            id: flick
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            contentHeight: body.implicitHeight + 32
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: OScrollBar {}

            ColumnLayout {
                id: body
                x: 16
                y: 16
                width: flick.width - 32
                spacing: 20

                TextArea {
                    id: titleEdit
                    Layout.fillWidth: true
                    padding: 0
                    background: null
                    wrapMode: TextEdit.Wrap
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.fontXl
                    font.weight: Font.DemiBold
                    font.strikeout: root.done
                    color: root.done ? Theme.textFaint : Theme.text
                    placeholderText: Tr.t("taskDetail.taskTitlePlaceholder")
                    placeholderTextColor: Theme.textFaint
                    selectionColor: Theme.orange300
                    selectedTextColor: Theme.ink900
                    selectByMouse: true
                    Accessible.name: Tr.t("taskDetail.taskTitlePlaceholder")
                    Binding on text {
                        when: !titleEdit.activeFocus
                        value: root.task.title || ""
                        restoreMode: Binding.RestoreNone
                    }
                    function commit() {
                        const v = text.replace(/\s*\n\s*/g, " ").trim()
                        if (v && v !== root.task.title) root.save({ title: v })
                        else text = root.task.title || ""
                    }
                    Keys.onReturnPressed: focus = false
                    Keys.onEnterPressed: focus = false
                    Keys.onEscapePressed: {
                        text = root.task.title || ""
                        focus = false
                    }
                    onActiveFocusChanged: if (!activeFocus) commit()
                }

                SectionRow {
                    iconName: "calendar"
                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 8
                        AbstractButton {
                            id: dateButton
                            Layout.fillWidth: true
                            implicitHeight: 36
                            hoverEnabled: true
                            Accessible.name: Tr.t("desktop.task.dueDate")
                            onClicked: datePicker.open()
                            background: Rectangle {
                                radius: 2
                                color: Theme.inputBg
                                border.width: 1
                                border.color: dateButton.hovered || datePicker.visible ? Theme.accent : Theme.inputBorder
                            }
                            contentItem: Text {
                                leftPadding: 12
                                rightPadding: 12
                                verticalAlignment: Text.AlignVCenter
                                elide: Text.ElideRight
                                font.family: Theme.fontFamily
                                font.pixelSize: Theme.fontSm
                                color: root.dueDate ? (Format.isOverdue(root.task.due_date || "") && !root.done ? Theme.red500 : Theme.text)
                                                    : Theme.textFaint
                                text: root.dueDate
                                      ? new Date(root.dueDate + "T00:00:00").toLocaleDateString(root.locale, "ddd, d MMM yyyy")
                                      : Tr.t("desktop.task.noDueDate")
                            }
                            DatePicker {
                                id: datePicker
                                y: dateButton.height + 4
                                value: root.dueDate
                                onPicked: (date) => root.setDue(date, root.dueTime)
                            }
                        }
                        OInput {
                            id: timeInput
                            visible: root.dueDate !== ""
                            compact: true
                            implicitWidth: 76
                            horizontalAlignment: TextInput.AlignHCenter
                            placeholderText: "--:--"
                            inputMethodHints: Qt.ImhTime
                            validator: RegularExpressionValidator { regularExpression: /^([01]?\d|2[0-3])?(:[0-5]?\d?)?$/ }
                            Accessible.name: Tr.t("desktop.task.dueTime")
                            Binding on text {
                                when: !timeInput.activeFocus
                                value: root.dueTime
                                restoreMode: Binding.RestoreNone
                            }
                            function commit() {
                                const m = /^(\d{1,2}):?(\d{2})?$/.exec(text.trim())
                                let time = ""
                                if (m) {
                                    const pad = (n) => (n < 10 ? "0" : "") + n
                                    time = pad(Number(m[1])) + ":" + pad(Number(m[2] || 0))
                                }
                                if (time !== root.dueTime) root.setDue(root.dueDate, time)
                                text = time
                            }
                            onAccepted: focus = false
                            onActiveFocusChanged: if (!activeFocus) commit()
                        }
                        IconButton {
                            visible: root.dueDate !== ""
                            iconName: "x"
                            iconSize: 16
                            tip: Tr.t("desktop.task.clearDueDate")
                            onClicked: root.setDue("", "")
                        }
                    }
                    Flow {
                        Layout.fillWidth: true
                        spacing: 6
                        ChoiceChip {
                            compact: true
                            text: Tr.t("date.today")
                            onClicked: root.dueInDays(0)
                        }
                        ChoiceChip {
                            compact: true
                            text: Tr.t("date.tomorrow")
                            onClicked: root.dueInDays(1)
                        }
                        ChoiceChip {
                            compact: true
                            text: Tr.t("desktop.task.nextWeek")
                            onClicked: root.dueInDays(7)
                        }
                    }
                }

                SectionRow {
                    iconName: "repeat"
                    RecurrencePicker {
                        Layout.fillWidth: true
                        rule: root.task.recurrence_rule || ""
                        anchorDate: root.dueDate ? new Date(root.dueDate + "T00:00:00") : new Date()
                        onRuleEdited: (rrule) => root.save({ recurrence_rule: rrule })
                    }
                }

                SectionRow {
                    iconName: "flag"
                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 4
                        Repeater {
                            model: ["none", "low", "medium", "high"]
                            delegate: ChoiceChip {
                                required property string modelData
                                Layout.fillWidth: true
                                compact: true
                                text: Tr.t("priority." + modelData)
                                iconName: modelData === "none" ? "" : "flag"
                                tint: modelData === "none" ? Theme.textMuted : Theme.priorityColor(modelData)
                                selected: (root.task.priority || "none") === modelData
                                onClicked: root.save({ priority: modelData })
                            }
                        }
                    }
                }

                SectionRow {
                    iconName: "user-circle"
                    visible: root.members.length > 1
                    Flow {
                        Layout.fillWidth: true
                        spacing: 6
                        readonly property var ids: root.task.assignee_ids || (root.task.assigned_to ? [root.task.assigned_to] : [])
                        readonly property bool everyone: root.members.length > 0 && root.members.every(m => ids.includes(m.id))
                        // member order keeps the first pick assigned_to stable
                        function assign(next) {
                            const ordered = root.members.map(m => m.id).filter(id => next.includes(id))
                            root.save({ assignee_ids: ordered, assigned_to: ordered.length ? ordered[0] : "" })
                        }
                        ChoiceChip {
                            compact: true
                            text: Tr.t("taskDetail.everyone")
                            iconName: "users"
                            selected: parent.everyone
                            onClicked: parent.assign(parent.everyone ? [] : root.members.map(m => m.id))
                        }
                        Repeater {
                            model: root.members
                            ChoiceChip {
                                required property var modelData
                                compact: true
                                text: modelData.name || modelData.email
                                selected: parent.ids.includes(modelData.id)
                                onClicked: parent.assign(selected ? parent.ids.filter(id => id !== modelData.id)
                                                                  : parent.ids.concat([modelData.id]))
                            }
                        }
                    }
                }

                SectionRow {
                    iconName: "tag"
                    Flow {
                        id: tagFlow
                        Layout.fillWidth: true
                        spacing: 6

                        readonly property var allTags: {
                            Store.tagsRevision; root.task
                            const own = Store.tagList()
                            const ids = own.map((t) => t.id)
                            return own.concat(root.listTags.filter((t) => ids.indexOf(t.id) < 0))
                        }
                        readonly property var attachedIds: root.task.tag_ids || []

                        Repeater {
                            model: tagFlow.allTags.filter((t) => tagFlow.attachedIds.indexOf(t.id) >= 0)
                            delegate: Rectangle {
                                id: tagChip
                                required property var modelData
                                implicitWidth: tagRow.implicitWidth + 16
                                implicitHeight: 28
                                radius: 2
                                color: Theme.tagBg
                                RowLayout {
                                    id: tagRow
                                    anchors.centerIn: parent
                                    spacing: 4
                                    Rectangle {
                                        visible: !!tagChip.modelData.color
                                        implicitWidth: 8
                                        implicitHeight: 8
                                        radius: 4
                                        color: tagChip.modelData.color || "transparent"
                                    }
                                    Text {
                                        text: tagChip.modelData.name
                                        font.family: Theme.fontFamily
                                        font.pixelSize: Theme.fontXs
                                        font.weight: Font.Medium
                                        color: Theme.tagText
                                    }
                                    AbstractButton {
                                        id: untag
                                        implicitWidth: 16
                                        implicitHeight: 16
                                        hoverEnabled: true
                                        Accessible.name: Tr.t("common.remove")
                                        onClicked: Sync.removeTag(root.taskId, tagChip.modelData.id)
                                        background: null
                                        contentItem: Item {
                                            Icon { anchors.centerIn: parent; name: "x"; size: 12; color: untag.hovered ? Theme.red500 : Theme.tagText }
                                        }
                                    }
                                }
                            }
                        }

                        AbstractButton {
                            id: addTag
                            implicitHeight: 28
                            implicitWidth: addTagRow.implicitWidth + 16
                            hoverEnabled: true
                            Accessible.name: Tr.t("taskDetail.tag")
                            onClicked: tagPopup.open()
                            background: Rectangle {
                                radius: 2
                                color: "transparent"
                                border.width: 1
                                border.color: addTag.hovered || tagPopup.visible ? Theme.accent : Theme.inputBorder
                            }
                            contentItem: RowLayout {
                                id: addTagRow
                                spacing: 4
                                Icon { name: "plus"; size: 12; color: addTag.hovered ? Theme.accent : Theme.textMuted; Layout.leftMargin: 8 }
                                Text {
                                    text: Tr.t("taskDetail.tag")
                                    font.family: Theme.fontFamily
                                    font.pixelSize: Theme.fontXs
                                    font.weight: Font.Medium
                                    color: addTag.hovered ? Theme.accent : Theme.textMuted
                                }
                            }

                            Popup {
                                id: tagPopup
                                y: addTag.height + 4
                                width: 220
                                padding: 4
                                onOpened: newTag.forceActiveFocus()
                                onClosed: newTag.text = ""
                                background: Rectangle {
                                    color: Theme.surfaceRaised
                                    border.width: 1
                                    border.color: Theme.border
                                    radius: 4
                                }
                                contentItem: ColumnLayout {
                                    spacing: 2
                                    Repeater {
                                        model: tagFlow.allTags.filter((t) => tagFlow.attachedIds.indexOf(t.id) < 0)
                                        delegate: ItemDelegate {
                                            id: tagOption
                                            required property var modelData
                                            Layout.fillWidth: true
                                            implicitHeight: 32
                                            hoverEnabled: true
                                            onClicked: {
                                                Sync.addTag(root.taskId, modelData.id, modelData.name)
                                                tagPopup.close()
                                            }
                                            background: Rectangle { color: tagOption.hovered ? Theme.hover : "transparent" }
                                            contentItem: RowLayout {
                                                spacing: 8
                                                Rectangle {
                                                    implicitWidth: 8
                                                    implicitHeight: 8
                                                    radius: 4
                                                    color: tagOption.modelData.color || Theme.textFaint
                                                }
                                                Text {
                                                    Layout.fillWidth: true
                                                    text: tagOption.modelData.name
                                                    elide: Text.ElideRight
                                                    font.family: Theme.fontFamily
                                                    font.pixelSize: Theme.fontSm
                                                    color: Theme.text
                                                }
                                            }
                                        }
                                    }
                                    OInput {
                                        id: newTag
                                        Layout.fillWidth: true
                                        compact: true
                                        placeholderText: Tr.t("taskDetail.newTagPlaceholder")
                                        onAccepted: {
                                            const name = text.trim()
                                            if (!name) return
                                            const existing = tagFlow.allTags.find((t) => t.name.toLowerCase() === name.toLowerCase())
                                            const id = existing ? existing.id : Sync.createTag(name, "")
                                            if (id) Sync.addTag(root.taskId, id, existing ? existing.name : name)
                                            tagPopup.close()
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    SectionTitle { text: Tr.t("taskDetail.notes") }
                    OTextArea {
                        id: notesEdit
                        Layout.fillWidth: true
                        Layout.minimumHeight: 110
                        placeholderText: Tr.t("taskDetail.notesPlaceholder")
                        Accessible.name: Tr.t("taskDetail.notes")
                        Binding on text {
                            when: !notesEdit.activeFocus
                            value: root.task.notes || ""
                            restoreMode: Binding.RestoreNone
                        }
                        Keys.onEscapePressed: focus = false
                        onActiveFocusChanged: {
                            if (!activeFocus && text !== (root.task.notes || ""))
                                root.save({ notes: text })
                        }
                    }
                    Text {
                        id: notesLink
                        readonly property string url: {
                            const m = /https:\/\/[^\s<>"')\]]+/.exec(root.task.notes || "")
                            return m ? m[0] : ""
                        }
                        visible: url !== ""
                        Layout.fillWidth: true
                        elide: Text.ElideRight
                        text: url
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontXs
                        font.underline: linkMouse.containsMouse
                        color: Theme.accent
                        MouseArea {
                            id: linkMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: Qt.openUrlExternally(notesLink.url)
                        }
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 4
                    visible: !root.task.parent_id
                    SectionTitle {
                        text: Tr.t("taskDetail.subtasks") + (subtasks.count > 0 ? "  " + (subtasks.count - subtasks.openCount) + "/" + subtasks.count : "")
                        Layout.bottomMargin: 4
                    }

                    TaskModel {
                        id: subtasks
                        view: "subtasks"
                        targetId: root.taskId
                        includeDone: true
                    }

                    Repeater {
                        id: subRepeater
                        model: subtasks
                        delegate: Rectangle {
                            id: sub
                            required property int index
                            required property string taskId
                            required property string title
                            required property bool done
                            Layout.fillWidth: true
                            implicitHeight: Math.max(36, subTitle.implicitHeight + 16)
                            color: subReorder.grabbed ? Theme.surface : subHover.hovered ? Theme.hover : "transparent"
                            border.width: subReorder.grabbed ? 1 : 0
                            border.color: Theme.accent
                            z: subReorder.grabbed ? 10 : 0
                            transform: Translate { y: subReorder.offset }
                            HoverHandler { id: subHover }
                            HoldToReorder {
                                id: subReorder
                                index: sub.index
                                view: subRepeater
                                model: subtasks
                                flickable: flick
                                spacing: 4
                                ignore: [subCheck, subDelete]
                                onGrabbedRow: {
                                    subTitle.deselect()
                                    subTitle.focus = false
                                }
                            }
                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: 4
                                anchors.rightMargin: 2
                                spacing: 10
                                OCheckbox {
                                    id: subCheck
                                    size: 20
                                    checked: sub.done
                                    Accessible.name: sub.title
                                    onToggled: Sync.toggleCompleted(sub.taskId)
                                }
                                TextEdit {
                                    id: subTitle
                                    Layout.fillWidth: true
                                    wrapMode: TextEdit.Wrap
                                    font.family: Theme.fontFamily
                                    font.pixelSize: Theme.fontSm
                                    font.strikeout: sub.done
                                    color: sub.done ? Theme.textFaint : Theme.text
                                    selectionColor: Theme.orange300
                                    selectedTextColor: Theme.ink900
                                    selectByMouse: !subReorder.grabbed
                                    Accessible.name: Tr.t("taskDetail.subtaskTitleLabel")
                                    Binding on text {
                                        when: !subTitle.activeFocus
                                        value: sub.title
                                        restoreMode: Binding.RestoreNone
                                    }
                                    onEditingFinished: {
                                        const v = text.trim()
                                        if (v && v !== sub.title) Sync.updateTask(sub.taskId, { title: v })
                                        else text = sub.title
                                    }
                                    Keys.onEscapePressed: {
                                        text = sub.title
                                        focus = false
                                    }
                                    // enter saves like the old single line field instead of adding a newline
                                    Keys.onReturnPressed: focus = false
                                    Keys.onEnterPressed: focus = false
                                }
                                IconButton {
                                    id: subDelete
                                    iconName: "trash"
                                    iconSize: 14
                                    implicitWidth: 28
                                    implicitHeight: 28
                                    hoverColor: Theme.red500
                                    tip: Tr.t("common.delete")
                                    opacity: subHover.hovered || hovered ? 1 : 0
                                    onClicked: root.deleteRequested(sub.taskId)
                                }
                            }
                        }
                    }

                    OInput {
                        id: newSubtask
                        Layout.fillWidth: true
                        compact: true
                        leadingIcon: "plus"
                        placeholderText: Tr.t("taskDetail.addSubtaskPlaceholder")
                        onAccepted: {
                            const text = newSubtask.text.trim()
                            if (!text || !root.listId) return
                            Sync.quickAdd(root.listId, text, root.taskId)
                            newSubtask.clear()
                        }
                        Keys.onEscapePressed: {
                            clear()
                            focus = false
                        }
                    }
                }
            }
        }

        Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Theme.border }
        RowLayout {
            Layout.fillWidth: true
            Layout.margins: 16
            Text {
                Layout.fillWidth: true
                text: root.task.created_at ? Tr.t("desktop.task.created", { time: Format.relative(root.task.created_at) }) : ""
                elide: Text.ElideRight
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontXs
                color: Theme.textFaint
            }
            OButton {
                danger: true
                compact: true
                iconName: "trash"
                text: Tr.t("common.deleteTask")
                onClicked: root.deleteRequested(root.taskId)
            }
        }
    }
}
