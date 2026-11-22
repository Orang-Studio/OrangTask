#include "TaskModel.h"
#include "core/Format.h"
#include "core/Store.h"
#include "core/SyncEngine.h"

#include <QJsonArray>

#include <utility>

using S = Store;

TaskModel::TaskModel(QObject *parent)
    : JsonListModel(parent)
{
    if (Store *store = Store::instance()) {
        connect(store, &Store::tasksChanged, this, &TaskModel::scheduleRebuild);
        connect(store, &Store::listsChanged, this, &TaskModel::scheduleRebuild);
        connect(store, &Store::userIdChanged, this, &TaskModel::scheduleRebuild);
    }
    if (SyncEngine *sync = SyncEngine::instance()) {
        // keep the row and its delegate when a locally created task gets its server id instead of removing and re adding it
        connect(sync, &SyncEngine::idRemapped, this, [this](const QString &from, const QString &to) {
            if (m_targetId == from) {
                m_targetId = to;
                emit viewChanged();
            }
            renameRow(from, to, {IdRole, PendingRole});
            if (QTimer *t = m_held.take(from))
                m_held.insert(to, t);
        });
    }
    scheduleRebuild();
}

void TaskModel::setView(const QString &v)
{
    if (m_view == v)
        return;
    m_view = v;
    m_viewSwitched = true;
    releaseHolds();
    emit viewChanged();
    scheduleRebuild();
}

void TaskModel::setTargetId(const QString &id)
{
    if (m_targetId == id)
        return;
    m_targetId = id;
    m_viewSwitched = true;
    releaseHolds();
    emit viewChanged();
    scheduleRebuild();
}

void TaskModel::setIncludeDone(bool v)
{
    if (m_includeDone == v)
        return;
    m_includeDone = v;
    emit viewChanged();
    scheduleRebuild();
}

void TaskModel::setHoldMs(int ms)
{
    if (m_holdMs == ms)
        return;
    m_holdMs = ms;
    emit holdMsChanged();
}

int TaskModel::openCount() const
{
    int n = 0;
    for (const QJsonObject &r : m_rows)
        if (!S::isDone(r))
            ++n;
    return n;
}

QHash<int, QByteArray> TaskModel::roleNames() const
{
    return {
        {IdRole, "taskId"},
        {TitleRole, "title"},
        {NotesRole, "notes"},
        {StatusRole, "status"},
        {DoneRole, "done"},
        {PriorityRole, "priority"},
        {DueDateRole, "dueDate"},
        {DueLabelRole, "dueLabel"},
        {OverdueRole, "overdue"},
        {StartDateRole, "startDate"},
        {ListIdRole, "listId"},
        {ListNameRole, "listName"},
        {ListColorRole, "listColor"},
        {ListIconRole, "listIcon"},
        {ParentIdRole, "parentId"},
        {SubtaskCountRole, "subtaskCount"},
        {TagNamesRole, "tagNames"},
        {AssignedToRole, "assignedTo"},
        {AssigneeNameRole, "assigneeName"},
        {AssigneeAvatarRole, "assigneeAvatar"},
        {AssigneeCountRole, "assigneeCount"},
        {RecurrenceRole, "recurrenceRule"},
        {PendingRole, "pending"},
        {HeldRole, "held"},
    };
}

QVariant TaskModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() >= m_rows.size())
        return {};
    const QJsonObject &t = m_rows.at(index.row());
    switch (role) {
    case IdRole: return m_ids.at(index.row());
    case TitleRole: return S::str(t, "title");
    case NotesRole: return S::str(t, "notes");
    case StatusRole: return S::str(t, "status");
    case DoneRole: return S::isDone(t);
    case PriorityRole: {
        const QString p = S::str(t, "priority");
        return p.isEmpty() ? QStringLiteral("none") : p;
    }
    case DueDateRole: return S::str(t, "due_date");
    case DueLabelRole: return Format::dueLabel(S::str(t, "due_date"));
    case OverdueRole: return !S::isDone(t) && Format::isOverdue(S::str(t, "due_date"));
    case StartDateRole: return S::str(t, "start_date");
    case ListIdRole: return S::str(t, "list_id");
    case ListNameRole: return S::str(t, "list_name");
    case ListColorRole: return S::str(t, "list_color");
    case ListIconRole: return S::str(t, "list_icon");
    case ParentIdRole: return S::str(t, "parent_id");
    case SubtaskCountRole: {
        const QJsonValue v = t.value(QStringLiteral("subtask_count"));
        return v.isString() ? v.toString().toInt() : v.toInt();
    }
    case TagNamesRole: {
        QStringList names;
        for (const QJsonValue &v : t.value(QStringLiteral("tag_names")).toArray())
            if (v.isString())
                names.append(v.toString());
        return names;
    }
    case AssignedToRole: return S::str(t, "assigned_to");
    case AssigneeNameRole: return S::str(t, "assignee_name");
    case AssigneeAvatarRole: return S::str(t, "assignee_avatar");
    case AssigneeCountRole: {
        const qsizetype n = t.value(QStringLiteral("assignee_ids")).toArray().size();
        return int(n ? n : !S::str(t, "assigned_to").isEmpty());
    }
    case RecurrenceRole: return S::str(t, "recurrence_rule");
    case PendingRole: return m_ids.at(index.row()).startsWith(QLatin1String("tmp-"));
    case HeldRole: return m_held.contains(m_ids.at(index.row()));
    }
    return {};
}

QVariantMap TaskModel::get(int row) const
{
    if (row < 0 || row >= m_rows.size())
        return {};
    QVariantMap m = m_rows.at(row).toVariantMap();
    const QModelIndex idx = index(row);
    const auto roles = roleNames();
    for (auto it = roles.cbegin(); it != roles.cend(); ++it)
        m.insert(QString::fromLatin1(it.value()), data(idx, it.key()));
    return m;
}

void TaskModel::toggle(const QString &id)
{
    SyncEngine *sync = SyncEngine::instance();
    const QJsonObject task = Store::instance()->task(id);
    if (!sync || task.isEmpty())
        return;

    if (m_held.contains(id)) {
        // second click inside the hold window undo
        delete m_held.take(id);
        sync->setCompleted(id, false);
    } else if (!S::isDone(task)) {
        if (!m_includeDone && m_holdMs > 0) {
            auto *timer = new QTimer(this);
            timer->setSingleShot(true);
            timer->setInterval(m_holdMs);
            connect(timer, &QTimer::timeout, this, [this, timer]() {
                release(m_held.key(timer));
            });
            m_held.insert(id, timer);
            timer->start();
        }
        sync->setCompleted(id, true);
    } else {
        sync->setCompleted(id, false);
    }
    const int row = m_ids.indexOf(id);
    if (row >= 0)
        emit dataChanged(index(row), index(row), {HeldRole});
}

void TaskModel::release(const QString &id)
{
    if (QTimer *t = m_held.take(id))
        t->deleteLater();
    scheduleRebuild();
}

void TaskModel::releaseHolds()
{
    if (m_held.isEmpty())
        return;
    for (QTimer *t : std::as_const(m_held))
        t->deleteLater();
    m_held.clear();
    scheduleRebuild();
}

void TaskModel::move(int from, int to)
{
    if (from == to || from < 0 || to < 0 || from >= m_ids.size() || to >= m_ids.size())
        return;
    beginMoveRows({}, from, from, {}, to > from ? to + 1 : to);
    m_ids.move(from, to);
    m_rows.move(from, to);
    endMoveRows();
}

void TaskModel::commitMove()
{
    // positions are per list so only list and subtask views are reorderable
    if (m_view != QLatin1String("list") && m_view != QLatin1String("subtasks"))
        return;
    for (int i = 0; i < m_ids.size(); ++i) {
        if (m_rows.at(i).value(QStringLiteral("position")).toDouble() != i) {
            SyncEngine::instance()->reorder(m_ids);
            return;
        }
    }
}

QJsonObject TaskModel::withList(const QJsonObject &task) const
{
    QJsonObject out = task;
    const QJsonObject list = Store::instance()->list(S::str(task, "list_id"));
    if (!list.isEmpty()) {
        out.insert(QStringLiteral("list_name"), list.value(QStringLiteral("name")));
        out.insert(QStringLiteral("list_color"), list.value(QStringLiteral("color")));
        out.insert(QStringLiteral("list_icon"), list.value(QStringLiteral("icon")));
    }
    return out;
}

void TaskModel::scheduleRebuild()
{
    if (m_rebuildQueued)
        return;
    m_rebuildQueued = true;
    QMetaObject::invokeMethod(this, &TaskModel::rebuild, Qt::QueuedConnection);
}

void TaskModel::rebuild()
{
    m_rebuildQueued = false;
    Store *store = Store::instance();
    if (!store)
        return;

    const bool needsTarget = m_view == QLatin1String("list") || m_view == QLatin1String("subtasks");
    QList<QJsonObject> rows;
    if (!needsTarget || !m_targetId.isEmpty())
        rows = store->query(m_view, m_targetId, m_includeDone);

    QList<QString> target;
    QHash<QString, QJsonObject> next;
    for (const QJsonObject &r : rows) {
        const QString id = S::str(r, "id");
        target.append(id);
        next.insert(id, withList(r));
    }
    // held rows no longer match the view keep them where they were
    for (auto it = m_held.begin(); it != m_held.end();) {
        const QJsonObject t = store->task(it.key());
        if (t.isEmpty()) {
            it.value()->deleteLater();
            it = m_held.erase(it);
            continue;
        }
        if (!next.contains(it.key())) {
            const int old = m_ids.indexOf(it.key());
            target.insert(old < 0 ? target.size() : qMin(old, target.size()), it.key());
            next.insert(it.key(), withList(t));
        }
        ++it;
    }

    const QDate today = QDate::currentDate();
    const bool dayChanged = m_day != today;
    m_day = today;
    if (std::exchange(m_viewSwitched, false))
        reset(target, next);
    else
        apply(target, next, dayChanged);
}
