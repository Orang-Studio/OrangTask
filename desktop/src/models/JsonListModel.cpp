#include "JsonListModel.h"

#include <QSet>

int JsonListModel::rowCount(const QModelIndex &parent) const
{
    return parent.isValid() ? 0 : m_ids.size();
}

void JsonListModel::renameRow(const QString &from, const QString &to, const QList<int> &roles)
{
    const int row = m_ids.indexOf(from);
    if (row < 0)
        return;
    // the realtime event can land before the POST reply and add the server id already
    const int dup = m_ids.indexOf(to);
    if (dup >= 0) {
        beginRemoveRows({}, dup, dup);
        m_ids.removeAt(dup);
        m_rows.removeAt(dup);
        endRemoveRows();
        emit countChanged();
        renameRow(from, to, roles);
        return;
    }
    m_ids[row] = to;
    m_rows[row].insert(QStringLiteral("id"), to);
    emit dataChanged(index(row), index(row), roles);
}

void JsonListModel::apply(const QList<QString> &target, const QHash<QString, QJsonObject> &rows, bool forceChanged)
{
    const QSet<QString> targetSet(target.cbegin(), target.cend());

    for (int i = m_ids.size() - 1; i >= 0; --i) {
        if (!targetSet.contains(m_ids.at(i))) {
            beginRemoveRows({}, i, i);
            m_ids.removeAt(i);
            m_rows.removeAt(i);
            endRemoveRows();
        }
    }

    const QSet<QString> current(m_ids.cbegin(), m_ids.cend());
    QList<QString> common;
    for (const QString &id : target)
        if (current.contains(id))
            common.append(id);
    for (int i = 0; i < common.size(); ++i) {
        if (m_ids.at(i) == common.at(i))
            continue;
        const int j = m_ids.indexOf(common.at(i), i + 1);
        beginMoveRows({}, j, j, {}, i);
        m_ids.move(j, i);
        m_rows.move(j, i);
        endMoveRows();
    }

    for (int i = 0; i < target.size(); ++i) {
        if (i < m_ids.size() && m_ids.at(i) == target.at(i))
            continue;
        beginInsertRows({}, i, i);
        m_ids.insert(i, target.at(i));
        m_rows.insert(i, rows.value(target.at(i)));
        endInsertRows();
    }

    for (int i = 0; i < m_ids.size(); ++i) {
        const QJsonObject fresh = rows.value(m_ids.at(i));
        if (forceChanged || fresh != m_rows.at(i)) {
            m_rows[i] = fresh;
            emit dataChanged(index(i), index(i));
        }
    }

    emit countChanged();
}

void JsonListModel::reset(const QList<QString> &target, const QHash<QString, QJsonObject> &rows)
{
    beginResetModel();
    m_ids = target;
    m_rows.clear();
    m_rows.reserve(target.size());
    for (const QString &id : target)
        m_rows.append(rows.value(id));
    endResetModel();
    emit countChanged();
}
