#include "ListModel.h"
#include "core/Store.h"
#include "core/SyncEngine.h"

using S = Store;

ListModel::ListModel(QObject *parent)
    : JsonListModel(parent)
{
    if (Store *store = Store::instance()) {
        connect(store, &Store::listsChanged, this, &ListModel::scheduleRebuild);
        connect(store, &Store::tasksChanged, this, &ListModel::scheduleRebuild);
    }
    if (SyncEngine *sync = SyncEngine::instance()) {
        connect(sync, &SyncEngine::idRemapped, this, [this](const QString &from, const QString &to) {
            renameRow(from, to, {IdRole, PendingRole});
        });
    }
    scheduleRebuild();
}

void ListModel::setWritableOnly(bool v)
{
    if (m_writableOnly == v)
        return;
    m_writableOnly = v;
    emit writableOnlyChanged();
    scheduleRebuild();
}

QHash<int, QByteArray> ListModel::roleNames() const
{
    return {
        {IdRole, "listId"},
        {NameRole, "name"},
        {ColorRole, "color"},
        {IconRole, "icon"},
        {RoleRole, "myRole"},
        {SharedRole, "shared"},
        {OpenCountRole, "openCount"},
        {PendingRole, "pending"},
    };
}

QVariant ListModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() >= m_rows.size())
        return {};
    const QJsonObject &l = m_rows.at(index.row());
    switch (role) {
    case IdRole: return m_ids.at(index.row());
    case NameRole: return S::str(l, "name");
    case ColorRole: return S::str(l, "color");
    case IconRole: return S::str(l, "icon");
    case RoleRole: {
        const QString r = S::str(l, "my_role");
        return r.isEmpty() ? QStringLiteral("owner") : r;
    }
    case SharedRole: return l.value(QStringLiteral("is_shared")).toBool();
    case OpenCountRole: return l.value(QStringLiteral("open_count")).toInt();
    case PendingRole: return m_ids.at(index.row()).startsWith(QLatin1String("tmp-"));
    }
    return {};
}

QVariantMap ListModel::get(int row) const
{
    if (row < 0 || row >= m_rows.size())
        return {};
    QVariantMap m;
    const QModelIndex idx = index(row);
    const auto roles = roleNames();
    for (auto it = roles.cbegin(); it != roles.cend(); ++it)
        m.insert(QString::fromLatin1(it.value()), data(idx, it.key()));
    return m;
}

void ListModel::move(int from, int to)
{
    if (from == to || from < 0 || to < 0 || from >= m_ids.size() || to >= m_ids.size())
        return;
    beginMoveRows({}, from, from, {}, to > from ? to + 1 : to);
    m_ids.move(from, to);
    m_rows.move(from, to);
    endMoveRows();
}

void ListModel::commitMove()
{
    for (int i = 0; i < m_ids.size(); ++i) {
        if (m_rows.at(i).value(QStringLiteral("position")).toDouble() != i) {
            SyncEngine::instance()->reorderLists(m_ids);
            return;
        }
    }
}

void ListModel::scheduleRebuild()
{
    if (m_rebuildQueued)
        return;
    m_rebuildQueued = true;
    QMetaObject::invokeMethod(this, &ListModel::rebuild, Qt::QueuedConnection);
}

void ListModel::rebuild()
{
    m_rebuildQueued = false;
    Store *store = Store::instance();
    if (!store)
        return;
    QList<QString> target;
    QHash<QString, QJsonObject> rows;
    for (const QVariant &v : store->listList()) {
        QJsonObject l = QJsonObject::fromVariantMap(v.toMap());
        if (m_writableOnly && S::str(l, "my_role") == QLatin1String("viewer"))
            continue;
        const QString id = S::str(l, "id");
        l.insert(QStringLiteral("open_count"), store->openCount(id));
        target.append(id);
        rows.insert(id, l);
    }
    apply(target, rows);
}
