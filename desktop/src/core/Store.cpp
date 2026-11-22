#include "Store.h"
#include "Database.h"
#include "Format.h"

#include <QJsonArray>
#include <QTimer>
#include <algorithm>

static Store *s_instance = nullptr;

Store::Store(Database *db, QObject *parent)
    : QObject(parent)
    , m_db(db)
{
    s_instance = this;
}

Store *Store::instance()
{
    return s_instance;
}

QString Store::str(const QJsonObject &o, const char *key)
{
    const QJsonValue v = o.value(QLatin1String(key));
    return v.isString() ? v.toString() : QString();
}

bool Store::isDone(const QJsonObject &t)
{
    return str(t, "status") == QLatin1String("done");
}

QString Store::tableName(Kind kind)
{
    switch (kind) {
    case Lists: return QStringLiteral("lists");
    case Tasks: return QStringLiteral("tasks");
    case Tags: return QStringLiteral("tags");
    case Scratchpads: return QStringLiteral("scratchpads");
    }
    return {};
}

QHash<QString, QJsonObject> &Store::table(Kind kind)
{
    switch (kind) {
    case Lists: return m_lists;
    case Tasks: return m_tasks;
    case Tags: return m_tags;
    case Scratchpads: break;
    }
    return m_scratchpads;
}

void Store::load()
{
    for (Kind k : {Lists, Tasks, Tags, Scratchpads}) {
        auto &t = table(k);
        t.clear();
        for (const QJsonObject &row : m_db->loadAll(tableName(k)))
            t.insert(str(row, "id"), row);
        markDirty(k);
    }
    setUserId(m_db->kv(QStringLiteral("userId")));
}

void Store::clear()
{
    m_db->clear();
    for (Kind k : {Lists, Tasks, Tags, Scratchpads}) {
        table(k).clear();
        markDirty(k);
    }
    setUserId({});
}

void Store::setUserId(const QString &id)
{
    if (m_userId == id)
        return;
    m_userId = id;
    m_db->setKv(QStringLiteral("userId"), id);
    emit userIdChanged();
    markDirty(Tasks);
}

static QJsonObject mergeRow(const QJsonObject &base, const QJsonObject &incoming)
{
    QJsonObject out = base;
    for (auto it = incoming.begin(); it != incoming.end(); ++it)
        out.insert(it.key(), it.value());
    return out;
}

void Store::upsert(Kind kind, const QJsonObject &row, bool merge)
{
    upsertMany(kind, {row}, merge);
}

void Store::upsertMany(Kind kind, const QList<QJsonObject> &rows, bool merge)
{
    if (rows.isEmpty())
        return;
    auto &t = table(kind);
    QList<QJsonObject> written;
    written.reserve(rows.size());
    for (const QJsonObject &row : rows) {
        const QString id = str(row, "id");
        if (id.isEmpty())
            continue;
        QJsonObject next = merge && t.contains(id) ? mergeRow(t.value(id), row) : row;
        // task events dont carry these keep what the list fetch gave us
        if (kind == Tasks && t.contains(id)) {
            const QJsonObject &prev = t[id];
            for (const char *k : {"tag_names", "tag_ids", "subtask_count", "list_name"}) {
                if (!row.contains(QLatin1String(k)) && prev.contains(QLatin1String(k)))
                    next.insert(QLatin1String(k), prev.value(QLatin1String(k)));
            }
        }
        t.insert(id, next);
        written.append(next);
    }
    m_db->upsertMany(tableName(kind), written);
    markDirty(kind);
}

void Store::remove(Kind kind, const QString &id)
{
    auto &t = table(kind);
    if (!t.remove(id))
        return;
    m_db->remove(tableName(kind), id);
    if (kind == Tasks) {
        QStringList children;
        for (auto it = m_tasks.cbegin(); it != m_tasks.cend(); ++it)
            if (str(it.value(), "parent_id") == id)
                children.append(it.key());
        for (const QString &c : children)
            remove(Tasks, c);
    } else if (kind == Lists) {
        QStringList orphans;
        for (auto it = m_tasks.cbegin(); it != m_tasks.cend(); ++it)
            if (str(it.value(), "list_id") == id)
                orphans.append(it.key());
        for (const QString &o : orphans) {
            m_tasks.remove(o);
            m_db->remove(tableName(Tasks), o);
        }
        markDirty(Tasks);
    }
    markDirty(kind);
}

void Store::replaceAll(Kind kind, const QList<QJsonObject> &rows)
{
    auto &t = table(kind);
    QHash<QString, QJsonObject> next;
    for (const QJsonObject &row : rows) {
        const QString id = str(row, "id");
        // unsynced local rows survive until their create goes through
        next.insert(id, row);
    }
    for (auto it = t.cbegin(); it != t.cend(); ++it)
        if (it.key().startsWith(QLatin1String("tmp-")))
            next.insert(it.key(), it.value());
    t = next;
    m_db->replaceAll(tableName(kind), t.values());
    markDirty(kind);
}

void Store::replaceListTasks(const QString &listId, const QList<QJsonObject> &rows, const QSet<QString> &keep)
{
    QSet<QString> incoming;
    for (const QJsonObject &r : rows)
        incoming.insert(str(r, "id"));
    QStringList stale;
    for (auto it = m_tasks.cbegin(); it != m_tasks.cend(); ++it) {
        const QJsonObject &t = it.value();
        if (str(t, "list_id") == listId && str(t, "parent_id").isEmpty() && !incoming.contains(it.key())
            && !it.key().startsWith(QLatin1String("tmp-")) && !keep.contains(it.key()))
            stale.append(it.key());
    }
    for (const QString &id : stale)
        remove(Tasks, id);
    upsertMany(Tasks, rows, true);
}

void Store::replaceSubtasks(const QString &parentId, const QList<QJsonObject> &rows, const QSet<QString> &keep)
{
    QSet<QString> incoming;
    for (const QJsonObject &r : rows)
        incoming.insert(str(r, "id"));
    QStringList stale;
    for (auto it = m_tasks.cbegin(); it != m_tasks.cend(); ++it) {
        if (str(it.value(), "parent_id") == parentId && !incoming.contains(it.key())
            && !it.key().startsWith(QLatin1String("tmp-")) && !keep.contains(it.key()))
            stale.append(it.key());
    }
    for (const QString &id : stale)
        remove(Tasks, id);
    upsertMany(Tasks, rows, true);
    if (m_tasks.contains(parentId)) {
        QJsonObject p = m_tasks.value(parentId);
        int n = 0;
        for (const QJsonObject &t : std::as_const(m_tasks))
            if (str(t, "parent_id") == parentId)
                ++n;
        p.insert(QStringLiteral("subtask_count"), n);
        upsert(Tasks, p, false);
    }
}

void Store::renameId(Kind kind, const QString &from, const QString &to)
{
    auto &t = table(kind);
    if (t.contains(from)) {
        QJsonObject row = t.take(from);
        m_db->remove(tableName(kind), from);
        row.insert(QStringLiteral("id"), to);
        t.insert(to, row);
        m_db->upsert(tableName(kind), row);
    }
    const char *refKey = kind == Lists ? "list_id" : kind == Tasks ? "parent_id" : nullptr;
    if (refKey) {
        QList<QJsonObject> changed;
        for (auto it = m_tasks.begin(); it != m_tasks.end(); ++it) {
            if (str(it.value(), refKey) == from) {
                it.value().insert(QLatin1String(refKey), to);
                changed.append(it.value());
            }
        }
        m_db->upsertMany(tableName(Tasks), changed);
        markDirty(Tasks);
    }
    if (kind == Tags) {
        QList<QJsonObject> changed;
        for (auto it = m_tasks.begin(); it != m_tasks.end(); ++it) {
            QJsonArray ids = it.value().value(QStringLiteral("tag_ids")).toArray();
            bool hit = false;
            for (int i = 0; i < ids.size(); ++i) {
                if (ids.at(i).toString() == from) {
                    ids.replace(i, to);
                    hit = true;
                }
            }
            if (hit) {
                it.value().insert(QStringLiteral("tag_ids"), ids);
                changed.append(it.value());
            }
        }
        m_db->upsertMany(tableName(Tasks), changed);
        markDirty(Tasks);
    }
    markDirty(kind);
}

bool Store::matches(const QString &view, const QString &id, const QJsonObject &t, bool includeDone) const
{
    const bool done = isDone(t);
    const bool topLevel = str(t, "parent_id").isEmpty();
    if (view == QLatin1String("subtasks"))
        return str(t, "parent_id") == id && (includeDone || !done);
    if (view == QLatin1String("list"))
        return topLevel && str(t, "list_id") == id && (includeDone || !done);
    if (view == QLatin1String("all"))
        return topLevel && (includeDone || !done);
    if (done)
        return false;
    if (view == QLatin1String("assigned"))
        return !m_userId.isEmpty()
            && (t.value(QStringLiteral("assignee_ids")).toArray().contains(m_userId) || str(t, "assigned_to") == m_userId);
    if (!topLevel)
        return false;

    const QDate today = QDate::currentDate();
    const QDateTime due = Format::parse(str(t, "due_date"));
    if (view == QLatin1String("today")) {
        const QDateTime start = Format::parse(str(t, "start_date"));
        return (due.isValid() && due.date() == today) || (start.isValid() && start.date() == today);
    }
    if (view == QLatin1String("week"))
        return due.isValid() && due.date() >= today && due <= QDateTime(today.addDays(7), QTime(0, 0));
    if (view == QLatin1String("overdue"))
        return due.isValid() && due.date() < today;
    return false;
}

static double num(const QJsonObject &o, const char *key)
{
    const QJsonValue v = o.value(QLatin1String(key));
    return v.isString() ? v.toString().toDouble() : v.toDouble();
}

QList<QJsonObject> Store::query(const QString &view, const QString &id, bool includeDone) const
{
    QList<QJsonObject> out;
    for (const QJsonObject &t : m_tasks)
        if (matches(view, id, t, includeDone))
            out.append(t);

    const bool byDue = view == QLatin1String("week") || view == QLatin1String("overdue")
        || view == QLatin1String("assigned");
    const bool createdDesc = view == QLatin1String("all");
    std::stable_sort(out.begin(), out.end(), [&](const QJsonObject &a, const QJsonObject &b) {
        if (byDue) {
            const QString da = str(a, "due_date"), db = str(b, "due_date");
            if (da.isEmpty() != db.isEmpty())
                return db.isEmpty(); // NULLS LAST
            if (da != db)
                return Format::parse(da) < Format::parse(db);
        }
        const double pa = num(a, "position"), pb = num(b, "position");
        if (pa != pb)
            return pa < pb;
        const QString ca = str(a, "created_at"), cb = str(b, "created_at");
        if (ca != cb)
            return createdDesc ? ca > cb : ca < cb;
        return str(a, "id") < str(b, "id");
    });
    return out;
}

int Store::countFor(const QString &view, const QString &id) const
{
    int n = 0;
    for (const QJsonObject &t : m_tasks)
        if (matches(view, id, t, false))
            ++n;
    return n;
}

int Store::openCount(const QString &listId) const
{
    return countFor(QStringLiteral("list"), listId);
}

int Store::todayCount() const
{
    return countFor(QStringLiteral("today"));
}

int Store::overdueCount() const
{
    return countFor(QStringLiteral("overdue"));
}

QVariantMap Store::taskMap(const QString &id) const
{
    return m_tasks.value(id).toVariantMap();
}

QVariantMap Store::listMap(const QString &id) const
{
    return m_lists.value(id).toVariantMap();
}

QVariantList Store::tagList() const
{
    QList<QJsonObject> rows = m_tags.values();
    std::sort(rows.begin(), rows.end(), [](const QJsonObject &a, const QJsonObject &b) {
        return str(a, "name").compare(str(b, "name"), Qt::CaseInsensitive) < 0;
    });
    QVariantList out;
    for (const QJsonObject &r : rows)
        out.append(r.toVariantMap());
    return out;
}

QVariantList Store::listList() const
{
    QList<QJsonObject> rows = m_lists.values();
    std::sort(rows.begin(), rows.end(), [](const QJsonObject &a, const QJsonObject &b) {
        const double pa = num(a, "position"), pb = num(b, "position");
        if (pa != pb)
            return pa < pb;
        return str(a, "created_at") < str(b, "created_at");
    });
    QVariantList out;
    for (const QJsonObject &r : rows)
        out.append(r.toVariantMap());
    return out;
}

QVariantList Store::search(const QString &text, int limit) const
{
    const QString needle = text.trimmed();
    QVariantList out;
    if (needle.isEmpty())
        return out;
    QList<QJsonObject> hits;
    for (const QJsonObject &t : m_tasks) {
        if (str(t, "title").contains(needle, Qt::CaseInsensitive)
            || str(t, "notes").contains(needle, Qt::CaseInsensitive))
            hits.append(t);
    }
    std::stable_sort(hits.begin(), hits.end(), [&](const QJsonObject &a, const QJsonObject &b) {
        const bool da = isDone(a), db = isDone(b);
        if (da != db)
            return !da;
        const bool ta = str(a, "title").contains(needle, Qt::CaseInsensitive);
        const bool tb = str(b, "title").contains(needle, Qt::CaseInsensitive);
        if (ta != tb)
            return ta;
        return str(a, "updated_at") > str(b, "updated_at");
    });
    for (const QJsonObject &t : hits.mid(0, limit)) {
        QVariantMap m = t.toVariantMap();
        m.insert(QStringLiteral("list_name"), str(m_lists.value(str(t, "list_id")), "name"));
        out.append(m);
    }
    return out;
}

void Store::markDirty(Kind kind)
{
    m_dirty.insert(kind);
    if (m_emitQueued)
        return;
    m_emitQueued = true;
    QTimer::singleShot(0, this, &Store::emitDirty);
}

void Store::emitDirty()
{
    m_emitQueued = false;
    const QSet<Kind> dirty = std::exchange(m_dirty, {});
    for (Kind k : dirty)
        ++m_rev[k];
    if (dirty.contains(Lists))
        emit listsChanged();
    if (dirty.contains(Tags))
        emit tagsChanged();
    if (dirty.contains(Scratchpads))
        emit scratchpadsChanged();
    if (dirty.contains(Tasks)) {
        emit tasksChanged();
        emit countsChanged();
    }
}
