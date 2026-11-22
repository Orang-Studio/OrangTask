pragma Singleton
import QtQuick
import OrangTask.Core

QtObject {
    readonly property var smart: ["today", "week", "overdue", "assigned", "all"]

    function icon(view, listId) {
        switch (view) {
        case "today": return "sun"
        case "week": return "calendar-days"
        case "overdue": return "alert-circle"
        case "assigned": return "user-check"
        case "all": return "layers"
        }
        Store.listsRevision
        const l = Store.listMap(listId || "")
        return l.icon || "list"
    }

    function title(view, listId) {
        I18n.revision
        switch (view) {
        case "today": return I18n.t("today.title")
        case "week": return I18n.t("upcoming.title")
        case "overdue": return I18n.t("overdue.title")
        case "assigned": return I18n.t("assigned.title")
        case "all": return I18n.t("allTasks.title")
        }
        Store.listsRevision
        return Store.listMap(listId || "").name || ""
    }

    function shortTitle(view, listId) {
        I18n.revision
        switch (view) {
        case "today": return I18n.t("sidebar.today")
        case "week": return I18n.t("sidebar.upcoming")
        case "overdue": return I18n.t("sidebar.overdue")
        case "assigned": return I18n.t("sidebar.assignedToMe")
        case "all": return I18n.t("sidebar.allTasks")
        }
        Store.listsRevision
        return Store.listMap(listId || "").name || ""
    }

    function emptyTitle(view) {
        I18n.revision
        const k = view === "week" ? "upcoming" : view === "all" ? "allTasks" : view
        return view === "list" ? I18n.t("list.emptyTitle") : I18n.t(k + ".emptyTitle")
    }

    function emptyDescription(view) {
        I18n.revision
        const k = view === "week" ? "upcoming" : view === "all" ? "allTasks" : view
        return view === "list" ? I18n.t("list.emptyDescription") : I18n.t(k + ".emptyDescription")
    }

    function canAdd(view, listId) {
        Store.listsRevision
        if (view !== "list")
            return Sync.defaultListId() !== ""
        return (Store.listMap(listId).my_role || "owner") !== "viewer"
    }

    function addTask(view, listId, text, parentId) {
        const p = QuickAdd.preview(text)
        if (!p.title)
            return ""
        let due = p.due || null
        if (!due && (view === "today" || view === "week")) {
            const d = new Date()
            d.setHours(23, 59, 0, 0)
            due = d.toISOString()
        }
        const fields = {
            list_id: view === "list" && listId ? listId : (Store.taskMap(parentId || "").list_id || Sync.defaultListId()),
            title: p.title,
            priority: p.priority || "none",
        }
        if (due) fields.due_date = due
        if (p.recurrence) fields.recurrence_rule = p.recurrence
        if (parentId) fields.parent_id = parentId
        if (!fields.list_id) {
            return ""
        }
        return Sync.createTask(fields)
    }
}
