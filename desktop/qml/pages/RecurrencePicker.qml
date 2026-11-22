import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import OrangTask
import OrangTask.Core

RowLayout {
    id: root
    property string rule: ""
    property var anchorDate: new Date()
    signal ruleEdited(string rrule)

    spacing: 8

    readonly property int maxInterval: 999
    readonly property int maxCount: 999
    readonly property var dayCodes: ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
    readonly property var frequencies: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]
    readonly property var locale: { I18n.revision; return Qt.locale(I18n.language) }

    function emptyRecurrence(freq) {
        return { freq: freq || "WEEKLY", interval: 1, byDay: [], monthlyMode: "dayOfMonth", monthDay: 1,
                 weekOrdinal: 1, monthWeekday: 1, count: null, until: null }
    }

    function toRrule(r) {
        let out = "FREQ=" + r.freq
        if (r.interval > 1) out += ";INTERVAL=" + r.interval
        if (r.freq === "WEEKLY") {
            if (r.byDay.length > 0) {
                const iso = (d) => (d + 6) % 7
                const days = r.byDay.slice().sort((a, b) => iso(a) - iso(b)).map((d) => dayCodes[d])
                out += ";BYDAY=" + days.join(",")
            }
        } else if (r.freq === "MONTHLY") {
            if (r.monthlyMode === "dayOfMonth") out += ";BYMONTHDAY=" + r.monthDay
            else out += ";BYDAY=" + r.weekOrdinal + dayCodes[r.monthWeekday]
        }
        if (r.count !== null) out += ";COUNT=" + r.count
        if (r.until !== null) out += ";UNTIL=" + r.until.replace(/-/g, "") + "T000000Z"
        return out
    }

    function parseInteger(raw, min, max) {
        if (!/^\d+$/.test(raw)) return null
        const v = Number(raw)
        return v >= min && v <= max ? v : null
    }

    // returns null for a blank malformed or richer than we support rule
    function parseRecurrence(text) {
        const body = (text || "").trim().replace(/^RRULE:/i, "").trim().toUpperCase()
        if (!body) return null
        const known = ["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYSETPOS", "COUNT", "UNTIL", "WKST"]
        const parts = {}
        for (const chunk of body.split(";")) {
            if (!chunk.trim()) continue
            const eq = chunk.indexOf("=")
            if (eq <= 0) return null
            const key = chunk.slice(0, eq)
            const value = chunk.slice(eq + 1)
            if (!value || known.indexOf(key) < 0) return null
            parts[key] = value
        }
        const freq = parts.FREQ
        if (frequencies.indexOf(freq) < 0) return null

        let interval = 1
        if (parts.INTERVAL !== undefined) {
            interval = parseInteger(parts.INTERVAL, 1, maxInterval)
            if (interval === null) return null
        }

        const entries = []
        for (const raw of (parts.BYDAY || "").split(",")) {
            const e = raw.trim()
            if (!e) continue
            const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(e)
            if (!m) return null
            const day = dayCodes.indexOf(m[2])
            if (day < 0) return null
            entries.push({ ordinal: m[1] ? Number(m[1]) : null, day: day })
        }

        let count = null
        if (parts.COUNT !== undefined) {
            count = parseInteger(parts.COUNT, 1, maxCount)
            if (count === null) return null
        }
        let until = null
        if (parts.UNTIL !== undefined) {
            const d = parts.UNTIL.split("T")[0]
            if (!/^\d{8}$/.test(d)) return null
            const iso = d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8)
            const probe = new Date(iso + "T00:00:00Z")
            if (isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== iso) return null
            until = iso
        }
        if (count !== null && until !== null) return null

        const r = emptyRecurrence(freq)
        r.interval = interval
        r.count = count
        r.until = until

        if (freq === "WEEKLY") {
            if (entries.some((e) => e.ordinal !== null)) return null
            if (parts.BYMONTHDAY !== undefined || parts.BYSETPOS !== undefined) return null
            r.byDay = entries.map((e) => e.day).filter((d, i, a) => a.indexOf(d) === i).sort((a, b) => a - b)
        } else if (freq === "MONTHLY") {
            let monthDay = null
            if (parts.BYMONTHDAY !== undefined) {
                monthDay = parseInteger(parts.BYMONTHDAY, 1, 31)
                if (monthDay === null) return null
            }
            let setPos = null
            if (parts.BYSETPOS !== undefined) {
                setPos = parts.BYSETPOS === "-1" ? -1 : parseInteger(parts.BYSETPOS, 1, 4)
                if (setPos === null) return null
            }
            if (monthDay !== null && entries.length === 0 && setPos === null) {
                r.monthDay = monthDay
            } else if (monthDay === null && entries.length === 1) {
                // either BYDAY 2TU or the equivalent BYDAY TU BYSETPOS 2
                const ordinal = entries[0].ordinal
                const effective = ordinal !== null ? ordinal : setPos
                if (effective === null) return null
                if (ordinal !== null && setPos !== null && ordinal !== setPos) return null
                if (!(effective >= 1 && effective <= 4) && effective !== -1) return null
                r.monthlyMode = "dayOfWeek"
                r.weekOrdinal = effective
                r.monthWeekday = entries[0].day
            } else if (!(monthDay === null && entries.length === 0 && setPos === null)) {
                return null
            }
        } else {
            if (entries.length > 0) return null
            if (parts.BYMONTHDAY !== undefined || parts.BYSETPOS !== undefined) return null
        }
        return r
    }

    function defaultRecurrence(freq, anchor, previous) {
        const base = Object.assign({}, previous || emptyRecurrence(freq))
        base.freq = freq
        if (freq === "WEEKLY") {
            base.byDay = base.byDay.length > 0 ? base.byDay.slice() : [anchor.getDay()]
        } else if (freq === "MONTHLY" && !(previous && previous.freq === "MONTHLY")) {
            base.monthlyMode = "dayOfMonth"
            base.monthDay = anchor.getDate()
            base.weekOrdinal = Math.min(Math.floor((anchor.getDate() - 1) / 7) + 1, 4)
            base.monthWeekday = anchor.getDay()
        }
        return base
    }

    function weekdayName(day, format) { return locale.dayName(day, format) }

    // honour the locales first day of the week QML Locale 0 Sunday too
    function weekdayOrder() {
        const first = locale.firstDayOfWeek
        const out = []
        for (let i = 0; i < 7; ++i) out.push((first + i) % 7)
        return out
    }

    function ordinalLabel(n) {
        const keys = { "1": "repeat.ordinalFirst", "2": "repeat.ordinalSecond", "3": "repeat.ordinalThird",
                       "4": "repeat.ordinalFourth", "-1": "repeat.ordinalLast" }
        return Tr.t(keys[String(n)] || keys["1"])
    }

    function unitKey(freq) {
        return { DAILY: "repeat.unitDays", WEEKLY: "repeat.unitWeeks", MONTHLY: "repeat.unitMonths",
                 YEARLY: "repeat.unitYears" }[freq]
    }

    function monthlyLabel(r) {
        if (r.monthlyMode === "dayOfMonth") return Tr.t("repeat.monthlyDayOption", { day: r.monthDay })
        return Tr.t("repeat.monthlyNth", { ordinal: ordinalLabel(r.weekOrdinal),
                                           weekday: weekdayName(r.monthWeekday, Locale.LongFormat) })
    }

    // every 2 weeks Mon Wed 5 occurrences
    function describe(text) {
        if (!text || !text.trim()) return Tr.t("repeat.never")
        const r = parseRecurrence(text)
        if (!r) return Tr.t("repeat.customRule")
        const parts = []
        if (r.interval === 1) {
            parts.push(Tr.t({ DAILY: "repeat.daily", WEEKLY: "repeat.weekly", MONTHLY: "repeat.monthly",
                              YEARLY: "repeat.yearly" }[r.freq]))
        } else {
            parts.push(Tr.t("repeat.summaryEvery", { interval: r.interval, unit: Tr.tc(unitKey(r.freq), r.interval) }))
        }
        if (r.freq === "WEEKLY" && r.byDay.length > 0) {
            const weekdays = [1, 2, 3, 4, 5]
            if (r.byDay.length === 5 && weekdays.every((d) => r.byDay.indexOf(d) >= 0))
                parts.push(Tr.t("repeat.weekdays"))
            else
                parts.push(weekdayOrder().filter((d) => r.byDay.indexOf(d) >= 0)
                           .map((d) => weekdayName(d, Locale.ShortFormat)).join(", "))
        } else if (r.freq === "MONTHLY") {
            parts.push(monthlyLabel(r))
        }
        if (r.count !== null) {
            parts.push(r.count + " " + Tr.tc("repeat.occurrences", r.count))
        } else if (r.until !== null) {
            const d = new Date(r.until + "T00:00:00")
            parts.push(Tr.t("repeat.summaryUntil", { date: d.toLocaleDateString(locale, "d MMM yyyy") }))
        }
        return parts.join(" · ")
    }

    readonly property bool isSet: rule.trim() !== ""

    AbstractButton {
        id: field
        Layout.fillWidth: true
        implicitHeight: 36
        hoverEnabled: true
        Accessible.name: Tr.t("repeat.edit")
        onClicked: dialog.open()
        background: Rectangle {
            radius: 2
            color: "transparent"
            border.width: 1
            border.color: field.hovered || field.activeFocus ? Theme.accent : Theme.inputBorder
        }
        contentItem: Text {
            leftPadding: 12
            rightPadding: 12
            text: { I18n.revision; return root.describe(root.rule) }
            elide: Text.ElideRight
            verticalAlignment: Text.AlignVCenter
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontSm
            color: root.isSet ? Theme.text : Theme.textFaint
        }
    }
    AbstractButton {
        id: clear
        visible: root.isSet
        implicitWidth: 36
        implicitHeight: 36
        hoverEnabled: true
        Accessible.name: Tr.t("repeat.remove")
        onClicked: root.ruleEdited("")
        background: Rectangle {
            radius: 2
            color: "transparent"
            border.width: 1
            border.color: clear.hovered ? Theme.accent : Theme.inputBorder
        }
        contentItem: Item {
            Icon { anchors.centerIn: parent; name: "x"; size: 16; color: clear.hovered ? Theme.text : Theme.textFaint }
        }
    }

    ODialog {
        id: dialog
        title: Tr.t("repeat.title")
        preferredWidth: 448

        property var draft: root.emptyRecurrence("WEEKLY")
        property bool wasCustom: false

        function update(changes) { draft = Object.assign({}, draft, changes) }

        onAboutToShow: {
            const parsed = root.parseRecurrence(root.rule)
            wasCustom = root.isSet && parsed === null
            draft = parsed || root.defaultRecurrence("WEEKLY", root.anchorDate, null)
        }

        component SectionLabel: Text {
            font.family: Theme.fontFamily
            font.pixelSize: Theme.fontXs
            font.weight: Font.Medium
            font.capitalization: Font.AllUppercase
            font.letterSpacing: 0.6
            color: Theme.textMuted
        }
        component StepButton: AbstractButton {
            id: step
            property string iconName
            implicitWidth: 36
            implicitHeight: 36
            hoverEnabled: true
            Accessible.name: text
            opacity: enabled ? 1 : 0.4
            background: Rectangle {
                radius: 2
                color: "transparent"
                border.width: 1
                border.color: step.hovered && step.enabled ? Theme.accent : Theme.inputBorder
            }
            contentItem: Item { Icon { anchors.centerIn: parent; name: step.iconName; size: 16; color: Theme.text } }
        }
        component EndRow: RowLayout {
            id: endRow
            property string mode
            property string label
            default property alias trailing: trailingSlot.data
            readonly property bool active: {
                const d = dialog.draft
                return mode === (d.count !== null ? "afterCount" : d.until !== null ? "onDate" : "never")
            }
            spacing: 12
            Layout.fillWidth: true
            AbstractButton {
                id: radio
                implicitWidth: radioRow.implicitWidth
                implicitHeight: 36
                hoverEnabled: true
                Accessible.role: Accessible.RadioButton
                Accessible.name: endRow.label
                Accessible.checked: endRow.active
                onClicked: {
                    if (endRow.mode === "never") dialog.update({ count: null, until: null })
                    else if (endRow.mode === "afterCount") dialog.update({ count: dialog.draft.count || 5, until: null })
                    else {
                        const d = new Date()
                        d.setMonth(d.getMonth() + 1)
                        dialog.update({ count: null, until: dialog.draft.until || untilPicker.iso(d) })
                    }
                }
                contentItem: RowLayout {
                    id: radioRow
                    spacing: 10
                    Rectangle {
                        implicitWidth: 16
                        implicitHeight: 16
                        radius: 8
                        border.width: endRow.active ? 5 : 1
                        border.color: endRow.active || radio.hovered ? Theme.accent : Theme.inputBorder
                        color: Theme.inputBg
                    }
                    Text {
                        text: endRow.label
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontSm
                        color: Theme.text
                    }
                }
                background: null
            }
            Item { Layout.fillWidth: true }
            RowLayout { id: trailingSlot; spacing: 8; enabled: endRow.active; opacity: enabled ? 1 : 0.4 }
        }

        ColumnLayout {
            width: parent.width
            spacing: 20

            Text {
                visible: dialog.wasCustom
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                padding: 8
                text: Tr.t("repeat.customRuleNotice")
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontXs
                color: Theme.dark ? "#fbbf24" : "#b45309"
                Rectangle { anchors.fill: parent; color: "transparent"; border.width: 1; border.color: "#fbbf24"; z: -1 }
            }

            GridLayout {
                Layout.fillWidth: true
                columns: 4
                columnSpacing: 4
                Repeater {
                    model: root.frequencies
                    delegate: ChoiceChip {
                        required property string modelData
                        Layout.fillWidth: true
                        text: Tr.t({ DAILY: "repeat.freqDay", WEEKLY: "repeat.freqWeek", MONTHLY: "repeat.freqMonth",
                                     YEARLY: "repeat.freqYear" }[modelData])
                        selected: dialog.draft.freq === modelData
                        onClicked: dialog.draft = root.defaultRecurrence(modelData, root.anchorDate, dialog.draft)
                    }
                }
            }

            ColumnLayout {
                spacing: 8
                SectionLabel { text: Tr.t("repeat.every") }
                RowLayout {
                    spacing: 8
                    StepButton {
                        iconName: "minus"
                        text: Tr.t("repeat.decreaseInterval")
                        enabled: dialog.draft.interval > 1
                        onClicked: dialog.update({ interval: dialog.draft.interval - 1 })
                    }
                    OInput {
                        compact: true
                        implicitWidth: 64
                        horizontalAlignment: TextInput.AlignHCenter
                        validator: IntValidator { bottom: 1; top: root.maxInterval }
                        text: dialog.draft.interval
                        Accessible.name: Tr.t("repeat.every")
                        onTextEdited: if (acceptableInput) dialog.update({ interval: Number(text) })
                    }
                    StepButton {
                        iconName: "plus"
                        text: Tr.t("repeat.increaseInterval")
                        enabled: dialog.draft.interval < root.maxInterval
                        onClicked: dialog.update({ interval: dialog.draft.interval + 1 })
                    }
                    Text {
                        text: Tr.tc(root.unitKey(dialog.draft.freq), dialog.draft.interval)
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontSm
                        color: Theme.textMuted
                    }
                }
            }

            ColumnLayout {
                visible: dialog.draft.freq === "WEEKLY"
                Layout.fillWidth: true
                spacing: 8
                SectionLabel { text: Tr.t("repeat.onDays") }
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 4
                    Repeater {
                        model: root.weekdayOrder()
                        delegate: ChoiceChip {
                            required property int modelData
                            Layout.fillWidth: true
                            text: root.weekdayName(modelData, Locale.NarrowFormat)
                            Accessible.name: root.weekdayName(modelData, Locale.LongFormat)
                            selected: dialog.draft.byDay.indexOf(modelData) >= 0
                            onClicked: {
                                const days = dialog.draft.byDay.slice()
                                const at = days.indexOf(modelData)
                                if (at >= 0) {
                                    // never leave the week empty
                                    if (days.length === 1) return
                                    days.splice(at, 1)
                                } else {
                                    days.push(modelData)
                                }
                                dialog.update({ byDay: days.sort((a, b) => a - b) })
                            }
                        }
                    }
                }
            }

            ColumnLayout {
                visible: dialog.draft.freq === "MONTHLY"
                Layout.fillWidth: true
                spacing: 8
                RowLayout {
                    spacing: 8
                    ChoiceChip {
                        text: Tr.t("repeat.monthlyDayOption", { day: dialog.draft.monthDay })
                        selected: dialog.draft.monthlyMode === "dayOfMonth"
                        onClicked: dialog.update({ monthlyMode: "dayOfMonth" })
                    }
                    ChoiceChip {
                        text: Tr.t("repeat.monthlyNth", { ordinal: root.ordinalLabel(dialog.draft.weekOrdinal),
                                                          weekday: root.weekdayName(dialog.draft.monthWeekday, Locale.LongFormat) })
                        selected: dialog.draft.monthlyMode === "dayOfWeek"
                        onClicked: dialog.update({ monthlyMode: "dayOfWeek" })
                    }
                }
                OSelect {
                    visible: dialog.draft.monthlyMode === "dayOfMonth"
                    Layout.preferredWidth: 140
                    Accessible.name: Tr.t("repeat.onDays")
                    model: {
                        I18n.revision
                        const out = []
                        for (let d = 1; d <= 31; ++d) out.push({ value: d, text: Tr.t("repeat.monthlyDayOption", { day: d }) })
                        return out
                    }
                    Component.onCompleted: selectValue(dialog.draft.monthDay)
                    Connections {
                        target: dialog
                        function onDraftChanged() { parent.selectValue(dialog.draft.monthDay) }
                    }
                    onActivated: dialog.update({ monthDay: currentValue })
                }
                RowLayout {
                    visible: dialog.draft.monthlyMode === "dayOfWeek"
                    spacing: 8
                    OSelect {
                        id: ordinalSelect
                        Layout.preferredWidth: 130
                        Accessible.name: Tr.t("repeat.onDays")
                        model: { I18n.revision; return [1, 2, 3, 4, -1].map((n) => ({ value: n, text: root.ordinalLabel(n) })) }
                        Component.onCompleted: selectValue(dialog.draft.weekOrdinal)
                        onActivated: dialog.update({ weekOrdinal: currentValue })
                    }
                    OSelect {
                        id: weekdaySelect
                        Layout.preferredWidth: 150
                        Accessible.name: Tr.t("repeat.onDays")
                        model: root.weekdayOrder().map((d) => ({ value: d, text: root.weekdayName(d, Locale.LongFormat) }))
                        Component.onCompleted: selectValue(dialog.draft.monthWeekday)
                        onActivated: dialog.update({ monthWeekday: currentValue })
                    }
                    Connections {
                        target: dialog
                        function onDraftChanged() {
                            ordinalSelect.selectValue(dialog.draft.weekOrdinal)
                            weekdaySelect.selectValue(dialog.draft.monthWeekday)
                        }
                    }
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 4
                SectionLabel { text: Tr.t("repeat.ends"); Layout.bottomMargin: 4 }
                EndRow { mode: "never"; label: Tr.t("repeat.endsNever") }
                EndRow {
                    mode: "onDate"
                    label: Tr.t("repeat.endsOnDate")
                    AbstractButton {
                        id: untilButton
                        implicitWidth: 150
                        implicitHeight: 36
                        hoverEnabled: true
                        Accessible.name: Tr.t("repeat.endsOnDate")
                        onClicked: untilPicker.open()
                        background: Rectangle {
                            radius: 2
                            color: Theme.inputBg
                            border.width: 1
                            border.color: untilButton.hovered ? Theme.accent : Theme.inputBorder
                        }
                        contentItem: RowLayout {
                            spacing: 8
                            Icon { name: "calendar"; size: 14; color: Theme.textMuted; Layout.leftMargin: 10 }
                            Text {
                                Layout.fillWidth: true
                                text: dialog.draft.until
                                      ? new Date(dialog.draft.until + "T00:00:00").toLocaleDateString(root.locale, "d MMM yyyy")
                                      : "—"
                                font.family: Theme.fontFamily
                                font.pixelSize: Theme.fontSm
                                color: Theme.text
                            }
                        }
                        DatePicker {
                            id: untilPicker
                            y: untilButton.height + 4
                            x: untilButton.width - width
                            value: dialog.draft.until || ""
                            onPicked: (date) => dialog.update({ count: null, until: date })
                        }
                    }
                }
                EndRow {
                    mode: "afterCount"
                    label: Tr.t("repeat.after")
                    OInput {
                        compact: true
                        implicitWidth: 64
                        horizontalAlignment: TextInput.AlignHCenter
                        validator: IntValidator { bottom: 1; top: root.maxCount }
                        text: dialog.draft.count !== null ? dialog.draft.count : 5
                        Accessible.name: Tr.t("repeat.after")
                        onTextEdited: if (acceptableInput) dialog.update({ count: Number(text), until: null })
                    }
                    Text {
                        text: Tr.tc("repeat.occurrences", dialog.draft.count !== null ? dialog.draft.count : 5)
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.fontSm
                        color: Theme.textMuted
                    }
                }
            }

            Text {
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                text: { I18n.revision; return root.describe(root.toRrule(dialog.draft)) }
                font.family: Theme.fontFamily
                font.pixelSize: Theme.fontSm
                font.weight: Font.Medium
                color: Theme.dark ? Theme.orange400 : Theme.orange600
            }
        }

        // the footer row lays out right to left primary action first
        footer: [
            OButton {
                text: Tr.t("common.save")
                onClicked: {
                    root.ruleEdited(root.toRrule(dialog.draft))
                    dialog.close()
                }
            },
            OButton {
                primary: false
                text: Tr.t("common.cancel")
                onClicked: dialog.close()
            }
        ]
    }
}
