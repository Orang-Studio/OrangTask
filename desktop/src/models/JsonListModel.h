#pragma once

#include <QAbstractListModel>
#include <QHash>
#include <QJsonObject>

// base for the Store backed models holds rows as JSON objects keyed by id and moves from one snapshot to the next with row level remove move insert change signals so QML delegates survive updates and transitions run
class JsonListModel : public QAbstractListModel
{
    Q_OBJECT
    Q_PROPERTY(int count READ rowCount NOTIFY countChanged)

public:
    using QAbstractListModel::QAbstractListModel;

    int rowCount(const QModelIndex &parent = {}) const override;

    Q_INVOKABLE int indexOf(const QString &id) const { return m_ids.indexOf(id); }
    Q_INVOKABLE QString idAt(int row) const { return m_ids.value(row); }

signals:
    void countChanged();

protected:
    void apply(const QList<QString> &target, const QHash<QString, QJsonObject> &rows, bool forceChanged = false);
    // swaps in a new snapshot wholesale for a different view where per row transitions would read as the old rows being completed
    void reset(const QList<QString> &target, const QHash<QString, QJsonObject> &rows);
    void renameRow(const QString &from, const QString &to, const QList<int> &roles);

    QList<QString> m_ids;
    QList<QJsonObject> m_rows;
};
