#pragma once

#include <QDateTime>
#include <QHash>
#include <QObject>
#include <QSet>
#include <QTimer>

class AppController;
class Notifier;

// local reminders from the cached due dates so they fire offline too
class ReminderScheduler : public QObject
{
    Q_OBJECT

public:
    ReminderScheduler(AppController *app, Notifier *notifier);

private:
    void reschedule();
    void fire();
    void maybeSummary();
    void remind(const QString &id, const QJsonObject &task);
    void onAction(const QString &taskId, const QString &action);
    void persist();

    AppController *m_app;
    Notifier *m_notifier;
    QTimer m_timer;
    QTimer m_debounce;
    QSet<QString> m_notified;
    QHash<QString, QDateTime> m_snoozed;
};
