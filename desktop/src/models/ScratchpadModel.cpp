#include "ScratchpadModel.h"
#include "core/Store.h"
#include "core/SyncEngine.h"

#include <algorithm>

using S = Store;

ScratchpadModel::ScratchpadModel(QObject *parent)
    : JsonListModel(parent)
{
    if (Store *store = Store::instance())
        connect(store, &Store::scratchpadsChanged, this, &ScratchpadModel::scheduleRebuild);
    if (SyncEngine *sync = SyncEngine::instance()) {
        connect(sync, &SyncEngine::idRemapped, this, [this](const QString &from, const QString &to) {
            renameRow(from, to, {IdRole, PendingRole});
        });
    }
    scheduleRebuild();
}

QHash<int, QByteArray> ScratchpadModel::roleNames() const
{
    return {
        {IdRole, "padId"},
        {TitleRole, "title"},
        {ContentRole, "content"},
        {UpdatedAtRole, "updatedAt"},
        {PendingRole, "pending"},
    };
}

QVariant ScratchpadModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() >= m_rows.size())
        return {};
    const QJsonObject &p = m_rows.at(index.row());
    switch (role) {
    case IdRole: return m_ids.at(index.row());
    case TitleRole: return S::str(p, "title");
    case ContentRole: return S::str(p, "content");
    case UpdatedAtRole: return S::str(p, "updated_at");
    case PendingRole: return m_ids.at(index.row()).startsWith(QLatin1String("tmp-"));
    }
    return {};
}

QVariantMap ScratchpadModel::get(int row) const
{
    if (row < 0 || row >= m_rows.size())
        return {};
    // keyed like the delegate roles so QML reads the same names either way
    const QModelIndex idx = index(row);
    QVariantMap out;
    const auto roles = roleNames();
    for (auto it = roles.cbegin(); it != roles.cend(); ++it)
        out.insert(QString::fromUtf8(it.value()), data(idx, it.key()));
    return out;
}

void ScratchpadModel::scheduleRebuild()
{
    if (m_rebuildQueued)
        return;
    m_rebuildQueued = true;
    QMetaObject::invokeMethod(this, &ScratchpadModel::rebuild, Qt::QueuedConnection);
}

void ScratchpadModel::rebuild()
{
    m_rebuildQueued = false;
    Store *store = Store::instance();
    if (!store)
        return;
    // same order as the server position then creation so a pad doesnt jump around while it is being typed into
    QList<QJsonObject> pads = store->scratchpads().values();
    std::sort(pads.begin(), pads.end(), [](const QJsonObject &a, const QJsonObject &b) {
        const double pa = a.value(QStringLiteral("position")).toDouble();
        const double pb = b.value(QStringLiteral("position")).toDouble();
        if (pa != pb)
            return pa < pb;
        return S::str(a, "created_at") < S::str(b, "created_at");
    });
    QList<QString> target;
    QHash<QString, QJsonObject> rows;
    for (const QJsonObject &p : pads) {
        target.append(S::str(p, "id"));
        rows.insert(S::str(p, "id"), p);
    }
    apply(target, rows);
}
