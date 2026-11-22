#pragma once

#include "JsonListModel.h"

#include <QDate>
#include <QTimer>

class TaskModel : public JsonListModel
{
    Q_OBJECT
    Q_PROPERTY(QString view READ view WRITE setView NOTIFY viewChanged)
    Q_PROPERTY(QString targetId READ targetId WRITE setTargetId NOTIFY viewChanged)
    Q_PROPERTY(bool includeDone READ includeDone WRITE setIncludeDone NOTIFY viewChanged)
    Q_PROPERTY(int holdMs READ holdMs WRITE setHoldMs NOTIFY holdMsChanged)
    Q_PROPERTY(int openCount READ openCount NOTIFY countChanged)

public:
    enum Role {
        IdRole = Qt::UserRole + 1,
        TitleRole,
        NotesRole,
        StatusRole,
        DoneRole,
        PriorityRole,
        DueDateRole,
        DueLabelRole,
        OverdueRole,
        StartDateRole,
        ListIdRole,
        ListNameRole,
        ListColorRole,
        ListIconRole,
        ParentIdRole,
        SubtaskCountRole,
        TagNamesRole,
        AssignedToRole,
        AssigneeNameRole,
        AssigneeAvatarRole,
        AssigneeCountRole,
        RecurrenceRole,
        PendingRole,
        HeldRole,
    };

    explicit TaskModel(QObject *parent = nullptr);

    QString view() const { return m_view; }
    void setView(const QString &v);
    QString targetId() const { return m_targetId; }
    void setTargetId(const QString &id);
    bool includeDone() const { return m_includeDone; }
    void setIncludeDone(bool v);
    int holdMs() const { return m_holdMs; }
    void setHoldMs(int ms);
    int openCount() const;

    QVariant data(const QModelIndex &index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;

    Q_INVOKABLE QVariantMap get(int row) const;
    Q_INVOKABLE void toggle(const QString &id);
    // drag reordering move only moves the row on screen so dragging stays cheap commitMove persists the order once on drop
    Q_INVOKABLE void move(int from, int to);
    Q_INVOKABLE void commitMove();
    Q_INVOKABLE void releaseHolds();

signals:
    void viewChanged();
    void holdMsChanged();

private:
    void scheduleRebuild();
    void rebuild();
    void release(const QString &id);
    QJsonObject withList(const QJsonObject &task) const;

    QString m_view = QStringLiteral("today");
    QString m_targetId;
    bool m_includeDone = false;
    int m_holdMs = 1500;
    QHash<QString, QTimer *> m_held;
    bool m_rebuildQueued = false;
    bool m_viewSwitched = false;
    QDate m_day;
};
