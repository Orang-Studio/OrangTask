#pragma once

#include <QHash>
#include <QObject>
#include <QStringList>

// desktop notifications over freedesktop dbus
class Notifier : public QObject
{
    Q_OBJECT

public:
    explicit Notifier(QObject *parent = nullptr);

    void notify(const QString &title, const QString &body, const QString &taskId,
                const QStringList &actions = {}, bool urgent = false);

signals:
    void actionInvoked(const QString &taskId, const QString &action);

private slots:
    void onActionInvoked(uint id, const QString &action);
    void onClosed(uint id, uint reason);

private:
    QHash<uint, QString> m_tasks;
};
