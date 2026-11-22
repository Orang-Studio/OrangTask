#pragma once

#include "JsonListModel.h"

class ListModel : public JsonListModel
{
    Q_OBJECT
    // hide lists the user can only view quick add targets
    Q_PROPERTY(bool writableOnly READ writableOnly WRITE setWritableOnly NOTIFY writableOnlyChanged)

public:
    enum Role {
        IdRole = Qt::UserRole + 1,
        NameRole,
        ColorRole,
        IconRole,
        RoleRole,
        SharedRole,
        OpenCountRole,
        PendingRole,
    };

    explicit ListModel(QObject *parent = nullptr);

    bool writableOnly() const { return m_writableOnly; }
    void setWritableOnly(bool v);

    QVariant data(const QModelIndex &index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;

    Q_INVOKABLE QVariantMap get(int row) const;
    // drag reordering in the sidebar Like TaskModel move on screen while dragging commitMove on drop
    Q_INVOKABLE void move(int from, int to);
    Q_INVOKABLE void commitMove();

signals:
    void writableOnlyChanged();

private:
    void scheduleRebuild();
    void rebuild();

    bool m_writableOnly = false;
    bool m_rebuildQueued = false;
};
