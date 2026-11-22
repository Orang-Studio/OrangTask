#pragma once

#include "JsonListModel.h"

class ScratchpadModel : public JsonListModel
{
    Q_OBJECT

public:
    enum Role {
        IdRole = Qt::UserRole + 1,
        TitleRole,
        ContentRole,
        UpdatedAtRole,
        PendingRole,
    };

    explicit ScratchpadModel(QObject *parent = nullptr);

    QVariant data(const QModelIndex &index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;

    Q_INVOKABLE QVariantMap get(int row) const;

private:
    void scheduleRebuild();
    void rebuild();

    bool m_rebuildQueued = false;
};
