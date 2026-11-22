#include "SyncEngine.h"
#include "ApiClient.h"
#include "Database.h"
#include "Format.h"
#include "I18n.h"
#include "OfflineQueue.h"
#include "QuickAddParser.h"
#include "RealtimeClient.h"
#include "Store.h"

#include <QJsonArray>
#include <QRegularExpression>
#include <QUuid>
#include <memory>

using S = Store;

static SyncEngine *s_instance = nullptr;

SyncEngine *SyncEngine::instance()
{
    return s_instance;
}

SyncEngine::SyncEngine(ApiClient *api, Database *db, Store *store, RealtimeClient *rt, QObject *parent)
    : QObject(parent)
    , m_api(api)
    , m_db(db)
    , m_store(store)
    , m_queue(new OfflineQueue(api, db, this))
    , m_rt(rt)
{
    s_instance = this;
    m_pendingStale.setSingleShot(true);
    m_pendingStale.setInterval(10000);
    connect(&m_pendingStale, &QTimer::timeout, this, [this]() {
        m_pendingShown = true;
        emit pendingCountChanged();
    });
    connect(m_queue, &OfflineQueue::countChanged, this, [this]() {
        if (m_queue->count() == 0) {
            m_pendingStale.stop();
            m_pendingShown = false;
        } else if (!m_pendingShown && !m_pendingStale.isActive()) {
            m_pendingStale.start();
        }
        emit pendingCountChanged();
    });
    if (m_queue->count() > 0)
        m_pendingStale.start();
    connect(m_queue, &OfflineQueue::opSucceeded, this, [this](const Database::Op &op, const ApiResult &r) {
        handleSuccess(op.method, op.path, op.tempId, r);
    });
    connect(m_queue, &OfflineQueue::opFailed, this, [this](const Database::Op &op, const ApiResult &r) {
        handleFailure(op.method, op.path, r);
    });
    connect(m_api, &ApiClient::reachabilityChanged, this, [this](bool online) {
        if (m_online == online)
            return;
        m_online = online;
        emit onlineChanged();
        if (online && m_started && !m_rt->isConnected())
            m_rt->start();
    });

    connect(m_rt, &RealtimeClient::connectedChanged, this, [this](bool connected) {
        emit liveChanged();
        // catch up on whatever happened while the socket was down
        if (connected && m_started)
            refresh();
    });
    connect(m_rt, &RealtimeClient::event, this, &SyncEngine::onEvent);
    connect(m_rt, &RealtimeClient::unauthorized, this, [this]() {
        // any authenticated call refreshes the access token on 401
        m_api->get(QStringLiteral("/api/auth/me"), [this](const ApiResult &r) {
            if (r.ok() && m_started)
                m_rt->start();
        });
    });

    m_listRefreshTimer.setSingleShot(true);
    m_listRefreshTimer.setInterval(400);
    connect(&m_listRefreshTimer, &QTimer::timeout, this, [this]() {
        const QSet<QString> ids = std::exchange(m_listRefresh, {});
        for (const QString &listId : ids)
            fetchList(listId);
    });

    const QString last = m_db->kv(QStringLiteral("lastSynced"));
    if (!last.isEmpty())
        m_lastSynced = QDateTime::fromString(last, Qt::ISODate);
}

bool SyncEngine::live() const
{
    return m_rt->isConnected();
}

int SyncEngine::pendingCount() const
{
    return m_queue->count();
}

int SyncEngine::stalePendingCount() const
{
    return m_pendingShown ? m_queue->count() : 0;
}

QString SyncEngine::lastSynced() const
{
    return Format::toIso(m_lastSynced);
}

QString SyncEngine::newTempId()
{
    return QStringLiteral("tmp-") + QUuid::createUuid().toString(QUuid::WithoutBraces);
}

QJsonObject SyncEngine::toJson(const QVariantMap &fields)
{
    return QJsonObject::fromVariantMap(fields);
}

void SyncEngine::start()
{
    if (m_started)
        return;
    m_started = true;
    m_store->load();
    m_rt->start();
    refresh();
}

void SyncEngine::stop(bool wipe)
{
    m_started = false;
    m_rt->stop();
    for (auto &d : m_deferred)
        delete d.timer;
    m_deferred.clear();
    qDeleteAll(m_scratchTimers);
    m_scratchTimers.clear();
    m_scratchPatch.clear();
    if (wipe) {
        m_queue->clear();
        m_store->clear();
        m_lastSynced = {};
    }
    if (m_syncing) {
        m_syncing = false;
        emit syncingChanged();
    }
}

void SyncEngine::flushDeferred()
{
    const QStringList ids = m_deferred.keys();
    for (const QString &id : ids) {
        DeferredDelete d = m_deferred.take(id);
        delete d.timer;
        enqueue("DELETE", QStringLiteral("/api/tasks/") + id);
    }
    for (const QString &id : m_scratchTimers.keys())
        flushScratchpad(id);
}

void SyncEngine::enqueue(const QByteArray &method, const QString &path, const QJsonObject &body,
                         const QString &tempId)
{
    m_queue->enqueue(method, path, body, tempId);
}

QSet<QString> SyncEngine::pendingTaskIds() const
{
    QSet<QString> out;
    if (m_queue->count() == 0)
        return out;
    for (auto it = m_store->tasks().cbegin(); it != m_store->tasks().cend(); ++it)
        if (m_queue->references(it.key()))
            out.insert(it.key());
    return out;
}

void SyncEngine::refresh()
{
    if (!m_started)
        return;
    if (m_syncing) {
        m_refreshAgain = true;
        return;
    }
    m_syncing = true;
    emit syncingChanged();

    // push local edits first so the fetch doesnt resurrect stale server state
    auto drained = std::make_shared<QMetaObject::Connection>();
    auto stalled = std::make_shared<QMetaObject::Connection>();
    *drained = connect(m_queue, &OfflineQueue::drained, this, [this, drained, stalled]() {
        disconnect(*drained);
        disconnect(*stalled);
        doRefresh();
    });
    *stalled = connect(m_queue, &OfflineQueue::stalled, this, [this, drained, stalled]() {
        disconnect(*drained);
        disconnect(*stalled);
        finishRefresh(false);
    });
    m_queue->flush();
}

void SyncEngine::doRefresh()
{
    if (!m_started)
        return;
    m_refreshOk = true;
    m_api->getAll(QStringLiteral("/api/lists"), QStringLiteral("lists"),
                  [this](bool ok, const QJsonArray &rows, const ApiResult &) {
        if (!m_started)
            return;
        if (!ok) {
            finishRefresh(false);
            return;
        }
        QList<QJsonObject> lists;
        QSet<QString> listIds;
        for (const QJsonValue &v : rows) {
            lists.append(v.toObject());
            listIds.insert(v.toObject().value(QStringLiteral("id")).toString());
        }
        m_store->replaceAll(Store::Lists, lists);

        // drop tasks of lists we lost access to
        QStringList orphans;
        for (auto it = m_store->tasks().cbegin(); it != m_store->tasks().cend(); ++it) {
            const QString listId = S::str(it.value(), "list_id");
            if (!listIds.contains(listId) && !listId.startsWith(QLatin1String("tmp-"))
                && !it.key().startsWith(QLatin1String("tmp-")))
                orphans.append(it.key());
        }
        for (const QString &id : orphans)
            m_store->remove(Store::Tasks, id);

        m_outstanding = 2 + int(listIds.size());
        auto done = [this](bool ok) {
            if (!ok)
                m_refreshOk = false;
            if (--m_outstanding == 0)
                finishRefresh(m_refreshOk);
        };

        m_api->getAll(QStringLiteral("/api/tags"), QStringLiteral("tags"),
                      [this, done](bool ok, const QJsonArray &rows, const ApiResult &) {
            if (ok && m_started) {
                QList<QJsonObject> tags;
                for (const QJsonValue &v : rows)
                    tags.append(v.toObject());
                m_store->replaceAll(Store::Tags, tags);
            }
            done(ok);
        });

        m_api->getAll(QStringLiteral("/api/scratchpads"), QStringLiteral("scratchpads"),
                      [this, done](bool ok, const QJsonArray &rows, const ApiResult &) {
            if (ok && m_started) {
                // keep notes that are mid edit
                QHash<QString, QJsonObject> local;
                for (const QString &id : m_scratchPatch.keys())
                    local.insert(id, m_store->scratchpad(id));
                QList<QJsonObject> pads;
                for (const QJsonValue &v : rows) {
                    const QString id = v.toObject().value(QStringLiteral("id")).toString();
                    if (!m_queue->references(id))
                        pads.append(v.toObject());
                    else
                        local.insert(id, m_store->scratchpad(id));
                }
                m_store->replaceAll(Store::Scratchpads, pads);
                for (const QJsonObject &o : std::as_const(local))
                    if (!o.isEmpty())
                        m_store->upsert(Store::Scratchpads, o, false);
            }
            done(ok);
        });

        for (const QString &listId : std::as_const(listIds))
            fetchList(listId, done);
    });
}

void SyncEngine::finishRefresh(bool ok)
{
    if (ok) {
        m_lastSynced = QDateTime::currentDateTimeUtc();
        m_db->setKv(QStringLiteral("lastSynced"), m_lastSynced.toString(Qt::ISODate));
    }
    m_syncing = false;
    emit syncingChanged();
    if (ok)
        emit refreshed();
    if (m_refreshAgain) {
        m_refreshAgain = false;
        QTimer::singleShot(0, this, &SyncEngine::refresh);
    }
}

void SyncEngine::fetchList(const QString &listId, std::function<void(bool ok)> done)
{
    m_api->getAll(QStringLiteral("/api/tasks?listId=") + listId, QStringLiteral("tasks"),
                  [this, listId, done](bool ok, const QJsonArray &rows, const ApiResult &) {
        if (ok && m_started) {
            // rows with queued edits or a pending delete keep their local version
            const QSet<QString> keep = pendingTaskIds();
            QList<QJsonObject> fresh;
            for (const QJsonValue &v : rows) {
                const QString id = v.toObject().value(QStringLiteral("id")).toString();
                if (!m_deferred.contains(id) && !keep.contains(id))
                    fresh.append(v.toObject());
            }
            m_store->replaceListTasks(listId, fresh, keep);
        }
        if (done)
            done(ok);
    });
}

void SyncEngine::openList(const QString &listId)
{
    if (!m_started || listId.isEmpty() || listId.startsWith(QLatin1String("tmp-")) || m_loadingLists.contains(listId))
        return;
    m_loadingLists.insert(listId);
    emit loadingListsChanged();
    fetchList(listId, [this, listId](bool) {
        m_loadingLists.remove(listId);
        emit loadingListsChanged();
    });
}

// pATCH responses and task events are raw rows without the joined assignee name so refetch the list for it
void SyncEngine::refreshIfAssigneeUnnamed(const QJsonObject &task)
{
    if (!S::str(task, "assigned_to").isEmpty() && !task.contains(QStringLiteral("assignee_name")))
        refreshListSoon(S::str(task, "list_id"));
}

void SyncEngine::refreshListSoon(const QString &listId)
{
    if (listId.isEmpty() || listId.startsWith(QLatin1String("tmp-")))
        return;
    m_listRefresh.insert(listId);
    m_listRefreshTimer.start();
}

void SyncEngine::handleSuccess(const QByteArray &method, const QString &path, const QString &tempId,
                               const ApiResult &r)
{
    const QJsonObject obj = r.object();
    struct Route { const char *prefix; const char *key; Store::Kind kind; };
    static const Route routes[] = {
        {"/api/tasks", "task", Store::Tasks},
        {"/api/lists", "list", Store::Lists},
        {"/api/tags", "tag", Store::Tags},
        {"/api/scratchpads", "scratchpad", Store::Scratchpads},
    };
    for (const Route &route : routes) {
        if (!path.startsWith(QLatin1String(route.prefix)))
            continue;
        const QJsonObject row = obj.value(QLatin1String(route.key)).toObject();
        if (row.isEmpty())
            return;
        const QString id = row.value(QStringLiteral("id")).toString();
        if (method == "POST" && !tempId.isEmpty() && path == QLatin1String(route.prefix)) {
            m_queue->remapId(tempId, id);
            m_store->renameId(route.kind, tempId, id);
            if (m_scratchPatch.contains(tempId))
                m_scratchPatch.insert(id, m_scratchPatch.take(tempId));
            if (QTimer *t = m_scratchTimers.take(tempId))
                m_scratchTimers.insert(id, t);
            if (m_deferred.contains(tempId))
                m_deferred.insert(id, m_deferred.take(tempId));
            emit idRemapped(tempId, id);
        }
        // newer queued edits win over this response
        if (!m_queue->references(id) && !m_deferred.contains(id) && m_store->table_has(route.kind, id))
            m_store->upsert(route.kind, row, true);
        if (route.kind == Store::Tasks)
            refreshIfAssigneeUnnamed(row);
        return;
    }
}

void SyncEngine::handleFailure(const QByteArray &method, const QString &path, const ApiResult &r)
{
    Q_UNUSED(method)
    Q_UNUSED(path)
    emit toast(I18n::instance()->t(QStringLiteral("desktop.sync.failed"),
                                   {{QStringLiteral("error"), r.errorMessage()}}));
    QTimer::singleShot(500, this, &SyncEngine::refresh);
}

void SyncEngine::onEvent(const QString &type, const QJsonValue &data)
{
    if (!m_started)
        return;
    const QJsonObject o = data.toObject();
    const QString id = o.value(QStringLiteral("id")).toString();

    if (type == QLatin1String("task.created") || type == QLatin1String("task.updated")) {
        if (id.isEmpty() || m_deferred.contains(id) || m_queue->references(id))
            return;
        if (o.size() == 1) {
            // tag change the event only names the task
            refreshListSoon(S::str(m_store->task(id), "list_id"));
            return;
        }
        const bool isNew = !m_store->tasks().contains(id);
        m_store->upsert(Store::Tasks, o, true);
        refreshIfAssigneeUnnamed(o);
        const QString parentId = S::str(o, "parent_id");
        if (isNew && !parentId.isEmpty() && m_store->tasks().contains(parentId)) {
            QJsonObject p = m_store->task(parentId);
            p.insert(QStringLiteral("subtask_count"), p.value(QStringLiteral("subtask_count")).toVariant().toInt() + 1);
            m_store->upsert(Store::Tasks, p, false);
        }
    } else if (type == QLatin1String("task.deleted")) {
        m_store->remove(Store::Tasks, id);
    } else if (type == QLatin1String("list.updated")) {
        if (m_queue->references(id))
            return;
        const bool isNew = !m_store->lists().contains(id);
        m_store->upsert(Store::Lists, o, true);
        if (isNew)
            refreshListSoon(id);
    } else if (type == QLatin1String("list.deleted")) {
        m_store->remove(Store::Lists, id);
    } else if (type == QLatin1String("scratchpad.created") || type == QLatin1String("scratchpad.updated")) {
        if (m_queue->references(id) || m_scratchPatch.contains(id))
            return;
        m_store->upsert(Store::Scratchpads, o, true);
    } else if (type == QLatin1String("scratchpad.deleted")) {
        m_store->remove(Store::Scratchpads, id);
    } else if (type == QLatin1String("notification.new")) {
        emit notification(o);
    }
}

QString SyncEngine::defaultListId() const
{
    const QString last = m_db->kv(QStringLiteral("lastListId"));
    if (!last.isEmpty() && m_store->lists().contains(last))
        return last;
    const QVariantList lists = m_store->listList();
    for (const QVariant &l : lists) {
        const QVariantMap m = l.toMap();
        if (m.value(QStringLiteral("my_role")).toString() != QLatin1String("viewer"))
            return m.value(QStringLiteral("id")).toString();
    }
    return {};
}

QString SyncEngine::createTask(const QVariantMap &fields)
{
    QJsonObject body = toJson(fields);
    const QString listId = body.value(QStringLiteral("list_id")).toString();
    const QString title = body.value(QStringLiteral("title")).toString().trimmed();
    if (listId.isEmpty() || title.isEmpty())
        return {};
    body.insert(QStringLiteral("title"), title);
    for (auto it = body.begin(); it != body.end();) {
        if (it.value().isString() && it.value().toString().isEmpty() && it.key() != QLatin1String("title"))
            it = body.erase(it);
        else
            ++it;
    }

    const QString parentId = body.value(QStringLiteral("parent_id")).toString();
    double maxPos = -1;
    for (const QJsonObject &t : m_store->tasks()) {
        if (S::str(t, "list_id") == listId && S::str(t, "parent_id") == parentId)
            maxPos = qMax(maxPos, t.value(QStringLiteral("position")).toVariant().toDouble());
    }

    const QString tmp = newTempId();
    const QString now = Format::toIso(QDateTime::currentDateTimeUtc());
    QJsonObject row = body;
    row.insert(QStringLiteral("id"), tmp);
    row.insert(QStringLiteral("status"), QStringLiteral("todo"));
    if (!row.contains(QStringLiteral("priority")))
        row.insert(QStringLiteral("priority"), QStringLiteral("none"));
    row.insert(QStringLiteral("position"), maxPos + 1);
    row.insert(QStringLiteral("created_by"), m_store->userId());
    row.insert(QStringLiteral("created_at"), now);
    row.insert(QStringLiteral("updated_at"), now);
    row.insert(QStringLiteral("tag_names"), QJsonArray());
    row.insert(QStringLiteral("tag_ids"), QJsonArray());
    row.insert(QStringLiteral("subtask_count"), 0);
    m_store->upsert(Store::Tasks, row, false);

    if (!parentId.isEmpty() && m_store->tasks().contains(parentId)) {
        QJsonObject p = m_store->task(parentId);
        p.insert(QStringLiteral("subtask_count"), p.value(QStringLiteral("subtask_count")).toVariant().toInt() + 1);
        m_store->upsert(Store::Tasks, p, false);
    }

    m_db->setKv(QStringLiteral("lastListId"), listId);
    enqueue("POST", QStringLiteral("/api/tasks"), body, tmp);
    return tmp;
}

QString SyncEngine::quickAdd(const QString &listId, const QString &text, const QString &parentId)
{
    const ParsedQuickAdd p = QuickAddParser::parse(text);
    if (p.title.isEmpty())
        return {};
    QString list = listId;
    if (list.isEmpty() && !parentId.isEmpty())
        list = S::str(m_store->task(parentId), "list_id");
    if (list.isEmpty())
        list = defaultListId();
    if (list.isEmpty()) {
        emit toast(tr_("desktop.tasks.noList"));
        return {};
    }
    QVariantMap fields{
        {QStringLiteral("list_id"), list},
        {QStringLiteral("title"), p.title},
        {QStringLiteral("priority"), p.priority},
    };
    if (p.dueAt.isValid())
        fields.insert(QStringLiteral("due_date"), Format::toIso(p.dueAt));
    if (!p.recurrenceRule.isEmpty())
        fields.insert(QStringLiteral("recurrence_rule"), p.recurrenceRule);
    if (!parentId.isEmpty())
        fields.insert(QStringLiteral("parent_id"), parentId);
    return createTask(fields);
}

void SyncEngine::updateTask(const QString &id, const QVariantMap &fields)
{
    if (!m_store->tasks().contains(id) || fields.isEmpty())
        return;
    static const QStringList allowed = {
        QStringLiteral("title"), QStringLiteral("notes"), QStringLiteral("priority"), QStringLiteral("status"),
        QStringLiteral("due_date"), QStringLiteral("start_date"), QStringLiteral("assigned_to"),
        QStringLiteral("assignee_ids"), QStringLiteral("position"), QStringLiteral("parent_id"), QStringLiteral("recurrence_rule"),
    };
    QJsonObject body;
    for (auto it = fields.cbegin(); it != fields.cend(); ++it) {
        if (!allowed.contains(it.key()))
            continue;
        const QVariant &v = it.value();
        const bool clears = (v.isNull() || (v.typeId() == QMetaType::QString && v.toString().isEmpty()))
            && it.key() != QLatin1String("title");
        body.insert(it.key(), clears ? QJsonValue(QJsonValue::Null) : QJsonValue::fromVariant(v));
    }
    if (body.isEmpty())
        return;
    QJsonObject row = m_store->task(id);
    for (auto it = body.begin(); it != body.end(); ++it)
        row.insert(it.key(), it.value());
    if (body.contains(QStringLiteral("assigned_to")) && body.value(QStringLiteral("assigned_to")).isNull()) {
        row.insert(QStringLiteral("assignee_name"), QJsonValue::Null);
        row.insert(QStringLiteral("assignee_avatar"), QJsonValue::Null);
    }
    row.insert(QStringLiteral("updated_at"), Format::toIso(QDateTime::currentDateTimeUtc()));
    m_store->upsert(Store::Tasks, row, false);
    enqueue("PATCH", QStringLiteral("/api/tasks/") + id, body);
}

void SyncEngine::setCompleted(const QString &id, bool done)
{
    QJsonObject row = m_store->task(id);
    if (row.isEmpty() || S::isDone(row) == done)
        return;
    row.insert(QStringLiteral("status"), done ? QStringLiteral("done") : QStringLiteral("todo"));
    row.insert(QStringLiteral("completed_at"),
               done ? QJsonValue(Format::toIso(QDateTime::currentDateTimeUtc())) : QJsonValue(QJsonValue::Null));
    m_store->upsert(Store::Tasks, row, false);
    enqueue("POST", QStringLiteral("/api/tasks/%1/%2").arg(id, done ? QStringLiteral("complete")
                                                                   : QStringLiteral("uncomplete")));
}

void SyncEngine::toggleCompleted(const QString &id)
{
    setCompleted(id, !S::isDone(m_store->task(id)));
}

void SyncEngine::deleteTask(const QString &id)
{
    const QJsonObject row = m_store->task(id);
    if (row.isEmpty() || m_deferred.contains(id))
        return;
    DeferredDelete d;
    d.snapshot = row;
    for (const QJsonObject &t : m_store->tasks())
        if (S::str(t, "parent_id") == id)
            d.children.append(t);
    d.timer = new QTimer(this);
    d.timer->setSingleShot(true);
    connect(d.timer, &QTimer::timeout, this, [this, id]() {
        auto it = m_deferred.find(id);
        if (it == m_deferred.end())
            return;
        it->timer->deleteLater();
        m_deferred.erase(it);
        enqueue("DELETE", QStringLiteral("/api/tasks/") + id);
    });
    d.timer->start(5000);
    m_deferred.insert(id, d);
    m_store->remove(Store::Tasks, id);

    const QString parentId = S::str(row, "parent_id");
    if (!parentId.isEmpty() && m_store->tasks().contains(parentId)) {
        QJsonObject p = m_store->task(parentId);
        p.insert(QStringLiteral("subtask_count"),
                 qMax(0, p.value(QStringLiteral("subtask_count")).toVariant().toInt() - 1));
        m_store->upsert(Store::Tasks, p, false);
    }
    emit taskDeleted(id, S::str(row, "title"));
}

void SyncEngine::undoDelete(const QString &id)
{
    auto it = m_deferred.find(id);
    if (it == m_deferred.end())
        return;
    delete it->timer;
    const DeferredDelete d = *it;
    m_deferred.erase(it);
    m_store->upsert(Store::Tasks, d.snapshot, false);
    m_store->upsertMany(Store::Tasks, d.children, false);
    const QString parentId = S::str(d.snapshot, "parent_id");
    if (!parentId.isEmpty() && m_store->tasks().contains(parentId)) {
        QJsonObject p = m_store->task(parentId);
        p.insert(QStringLiteral("subtask_count"), p.value(QStringLiteral("subtask_count")).toVariant().toInt() + 1);
        m_store->upsert(Store::Tasks, p, false);
    }
}

void SyncEngine::loadSubtasks(const QString &parentId)
{
    const QJsonObject parent = m_store->task(parentId);
    if (parent.isEmpty() || parentId.startsWith(QLatin1String("tmp-")))
        return;
    const QString listId = S::str(parent, "list_id");
    m_api->getAll(QStringLiteral("/api/tasks?listId=%1&parentId=%2").arg(listId, parentId), QStringLiteral("tasks"),
                  [this, parentId](bool ok, const QJsonArray &rows, const ApiResult &) {
        if (!ok || !m_started)
            return;
        const QSet<QString> keep = pendingTaskIds();
        QList<QJsonObject> fresh;
        for (const QJsonValue &v : rows) {
            const QString id = v.toObject().value(QStringLiteral("id")).toString();
            if (!keep.contains(id) && !m_deferred.contains(id))
                fresh.append(v.toObject());
        }
        m_store->replaceSubtasks(parentId, fresh, keep);
    });
}

void SyncEngine::reorder(const QStringList &ids)
{
    QJsonArray items;
    QList<QJsonObject> rows;
    for (int i = 0; i < ids.size(); ++i) {
        QJsonObject row = m_store->task(ids.at(i));
        if (row.isEmpty())
            continue;
        row.insert(QStringLiteral("position"), i);
        rows.append(row);
        items.append(QJsonObject{{QStringLiteral("id"), ids.at(i)}, {QStringLiteral("position"), i}});
    }
    if (rows.isEmpty())
        return;
    m_store->upsertMany(Store::Tasks, rows, false);
    enqueue("PATCH", QStringLiteral("/api/tasks/reorder"), QJsonObject{{QStringLiteral("items"), items}});
}

QString SyncEngine::createTag(const QString &name, const QString &color)
{
    const QString n = name.trimmed();
    if (n.isEmpty())
        return {};
    for (const QJsonObject &t : m_store->tags())
        if (S::str(t, "name").compare(n, Qt::CaseInsensitive) == 0)
            return S::str(t, "id");
    const QString tmp = newTempId();
    QJsonObject body{{QStringLiteral("name"), n}};
    if (!color.isEmpty())
        body.insert(QStringLiteral("color"), color);
    QJsonObject row = body;
    row.insert(QStringLiteral("id"), tmp);
    row.insert(QStringLiteral("owner_id"), m_store->userId());
    m_store->upsert(Store::Tags, row, false);
    enqueue("POST", QStringLiteral("/api/tags"), body, tmp);
    return tmp;
}

void SyncEngine::deleteTag(const QString &id)
{
    const QString name = S::str(m_store->tags().value(id), "name");
    m_store->remove(Store::Tags, id);
    QList<QJsonObject> changed;
    for (QJsonObject t : m_store->tasks()) {
        QJsonArray ids = t.value(QStringLiteral("tag_ids")).toArray();
        QJsonArray names = t.value(QStringLiteral("tag_names")).toArray();
        const int before = int(ids.size());
        for (int i = int(ids.size()) - 1; i >= 0; --i) {
            if (ids.at(i).toString() == id) {
                ids.removeAt(i);
                if (i < names.size())
                    names.removeAt(i);
            }
        }
        if (ids.size() != before) {
            t.insert(QStringLiteral("tag_ids"), ids);
            t.insert(QStringLiteral("tag_names"), names);
            changed.append(t);
        }
    }
    m_store->upsertMany(Store::Tasks, changed, false);
    Q_UNUSED(name)
    enqueue("DELETE", QStringLiteral("/api/tags/") + id);
}

void SyncEngine::addTag(const QString &taskId, const QString &tagId, const QString &name)
{
    QJsonObject t = m_store->task(taskId);
    const QJsonObject tag = m_store->tags().value(tagId);
    const QString tagName = tag.isEmpty() ? name : S::str(tag, "name");
    if (t.isEmpty() || tagName.isEmpty())
        return;
    QJsonArray ids = t.value(QStringLiteral("tag_ids")).toArray();
    for (const QJsonValue &v : std::as_const(ids))
        if (v.toString() == tagId)
            return;
    QJsonArray names = t.value(QStringLiteral("tag_names")).toArray();
    ids.append(tagId);
    names.append(tagName);
    t.insert(QStringLiteral("tag_ids"), ids);
    t.insert(QStringLiteral("tag_names"), names);
    m_store->upsert(Store::Tasks, t, false);
    enqueue("POST", QStringLiteral("/api/tasks/%1/tags/%2").arg(taskId, tagId));
}

void SyncEngine::removeTag(const QString &taskId, const QString &tagId)
{
    QJsonObject t = m_store->task(taskId);
    if (t.isEmpty())
        return;
    QJsonArray ids = t.value(QStringLiteral("tag_ids")).toArray();
    QJsonArray names = t.value(QStringLiteral("tag_names")).toArray();
    for (int i = int(ids.size()) - 1; i >= 0; --i) {
        if (ids.at(i).toString() == tagId) {
            ids.removeAt(i);
            if (i < names.size())
                names.removeAt(i);
        }
    }
    t.insert(QStringLiteral("tag_ids"), ids);
    t.insert(QStringLiteral("tag_names"), names);
    m_store->upsert(Store::Tasks, t, false);
    enqueue("DELETE", QStringLiteral("/api/tasks/%1/tags/%2").arg(taskId, tagId));
}

QString SyncEngine::createList(const QString &name, const QString &color, const QString &icon)
{
    const QString n = name.trimmed();
    if (n.isEmpty())
        return {};
    QJsonObject body{{QStringLiteral("name"), n}};
    if (!color.isEmpty())
        body.insert(QStringLiteral("color"), color);
    if (!icon.isEmpty())
        body.insert(QStringLiteral("icon"), icon);
    double maxPos = -1;
    for (const QJsonObject &l : m_store->lists())
        maxPos = qMax(maxPos, l.value(QStringLiteral("position")).toVariant().toDouble());
    const QString tmp = newTempId();
    QJsonObject row = body;
    row.insert(QStringLiteral("id"), tmp);
    row.insert(QStringLiteral("owner_id"), m_store->userId());
    row.insert(QStringLiteral("position"), maxPos + 1);
    row.insert(QStringLiteral("my_role"), QStringLiteral("owner"));
    row.insert(QStringLiteral("is_shared"), false);
    row.insert(QStringLiteral("created_at"), Format::toIso(QDateTime::currentDateTimeUtc()));
    m_store->upsert(Store::Lists, row, false);
    enqueue("POST", QStringLiteral("/api/lists"), body, tmp);
    return tmp;
}

void SyncEngine::updateList(const QString &id, const QVariantMap &fields)
{
    QJsonObject row = m_store->list(id);
    if (row.isEmpty())
        return;
    QJsonObject body;
    for (const char *k : {"name", "color", "icon", "position"}) {
        if (fields.contains(QLatin1String(k)))
            body.insert(QLatin1String(k), QJsonValue::fromVariant(fields.value(QLatin1String(k))));
    }
    if (body.isEmpty())
        return;
    for (auto it = body.begin(); it != body.end(); ++it)
        row.insert(it.key(), it.value());
    m_store->upsert(Store::Lists, row, false);
    enqueue("PATCH", QStringLiteral("/api/lists/") + id, body);
}

void SyncEngine::reorderLists(const QStringList &ids)
{
    QJsonArray items;
    QList<QJsonObject> rows;
    for (int i = 0; i < ids.size(); ++i) {
        QJsonObject row = m_store->list(ids.at(i));
        if (row.isEmpty())
            continue;
        row.insert(QStringLiteral("position"), i);
        rows.append(row);
        items.append(QJsonObject{{QStringLiteral("id"), ids.at(i)}, {QStringLiteral("position"), i}});
    }
    if (rows.isEmpty())
        return;
    m_store->upsertMany(Store::Lists, rows, false);
    // one call for owned and shared lists alike a per list PATCH is owner only
    enqueue("PATCH", QStringLiteral("/api/lists/reorder"), QJsonObject{{QStringLiteral("items"), items}});
}

void SyncEngine::deleteList(const QString &id)
{
    const QJsonObject row = m_store->list(id);
    if (row.isEmpty())
        return;
    const bool owner = S::str(row, "my_role").isEmpty() || S::str(row, "my_role") == QLatin1String("owner")
        || S::str(row, "owner_id") == m_store->userId();
    m_store->remove(Store::Lists, id);
    if (m_db->kv(QStringLiteral("lastListId")) == id)
        m_db->setKv(QStringLiteral("lastListId"), {});
    // non owners delete by leaving
    if (owner)
        enqueue("DELETE", QStringLiteral("/api/lists/") + id);
    else
        enqueue("DELETE", QStringLiteral("/api/lists/%1/members/%2").arg(id, m_store->userId()));
}

QString SyncEngine::createScratchpad(const QString &title, const QString &content)
{
    const QString tmp = newTempId();
    const QString now = Format::toIso(QDateTime::currentDateTimeUtc());
    QJsonObject body{{QStringLiteral("title"), title}, {QStringLiteral("content"), content}};
    QJsonObject row = body;
    row.insert(QStringLiteral("id"), tmp);
    row.insert(QStringLiteral("user_id"), m_store->userId());
    double maxPos = -1;
    for (const QJsonObject &p : m_store->scratchpads())
        maxPos = qMax(maxPos, p.value(QStringLiteral("position")).toVariant().toDouble());
    row.insert(QStringLiteral("position"), maxPos + 1);
    row.insert(QStringLiteral("created_at"), now);
    row.insert(QStringLiteral("updated_at"), now);
    m_store->upsert(Store::Scratchpads, row, false);
    enqueue("POST", QStringLiteral("/api/scratchpads"), body, tmp);
    return tmp;
}

void SyncEngine::updateScratchpad(const QString &id, const QVariantMap &fields)
{
    QJsonObject row = m_store->scratchpad(id);
    if (row.isEmpty())
        return;
    QJsonObject &patch = m_scratchPatch[id];
    for (const char *k : {"title", "content"}) {
        if (fields.contains(QLatin1String(k))) {
            const QString v = fields.value(QLatin1String(k)).toString();
            patch.insert(QLatin1String(k), v);
            row.insert(QLatin1String(k), v);
        }
    }
    row.insert(QStringLiteral("updated_at"), Format::toIso(QDateTime::currentDateTimeUtc()));
    m_store->upsert(Store::Scratchpads, row, false);

    QTimer *&t = m_scratchTimers[id];
    if (!t) {
        t = new QTimer(this);
        t->setSingleShot(true);
        t->setInterval(700);
        connect(t, &QTimer::timeout, this, [this, t]() {
            // the id may have been remapped since the timer was created
            const QString key = m_scratchTimers.key(t);
            if (!key.isEmpty())
                flushScratchpad(key);
        });
    }
    t->start();
}

void SyncEngine::flushScratchpad(const QString &id)
{
    if (QTimer *t = m_scratchTimers.take(id))
        t->deleteLater();
    const QJsonObject patch = m_scratchPatch.take(id);
    if (!patch.isEmpty() && m_store->scratchpads().contains(id))
        enqueue("PATCH", QStringLiteral("/api/scratchpads/") + id, patch);
}

void SyncEngine::deleteScratchpad(const QString &id)
{
    if (QTimer *t = m_scratchTimers.take(id))
        t->deleteLater();
    m_scratchPatch.remove(id);
    m_store->remove(Store::Scratchpads, id);
    enqueue("DELETE", QStringLiteral("/api/scratchpads/") + id);
}
