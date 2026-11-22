#include "ReminderScheduler.h"

#include "Notifier.h"
#include "app/AppController.h"
#include "core/AuthManager.h"
#include "core/Format.h"
#include "core/I18n.h"
#include "core/Settings.h"
#include "core/Store.h"
#include "core/SyncEngine.h"

#include <QJsonObject>

// how late a reminder may still fire eg when the app starts after the due time
static constexpr qint64 GraceSecs = 10 * 60;
// wake up at least this often so suspend resume and clock changes are caught
static constexpr int MaxWaitMs = 5 * 60 * 1000;

static const QString NotifiedKey = QStringLiteral("reminders/notified");
static const QString SummaryKey = QStringLiteral("reminders/lastSummary");

ReminderScheduler::ReminderScheduler(AppController *app, Notifier *notifier)
    : QObject(app)
    , m_app(app)
    , m_notifier(notifier)
{
    const QStringList saved = app->settings()->value(NotifiedKey).toStringList();
    m_notified = QSet<QString>(saved.begin(), saved.end());

    m_timer.setSingleShot(true);
    connect(&m_timer, &QTimer::timeout, this, &ReminderScheduler::fire);
    m_debounce.setSingleShot(true);
    m_debounce.setInterval(500);
    connect(&m_debounce, &QTimer::timeout, this, &ReminderScheduler::reschedule);

    Store *store = app->store();
    connect(store, &Store::tasksChanged, &m_debounce, qOverload<>(&QTimer::start));
    connect(app->settings(), &Settings::remindersEnabledChanged, &m_debounce, qOverload<>(&QTimer::start));
    connect(app->sync(), &SyncEngine::refreshed, this, &ReminderScheduler::maybeSummary);
    connect(app->sync(), &SyncEngine::idRemapped, this, [this](const QString &from, const QString &to) {
        if (m_snoozed.contains(from))
            m_snoozed.insert(to, m_snoozed.take(from));
    });
    connect(notifier, &Notifier::actionInvoked, this, &ReminderScheduler::onAction);

    connect(app->sync(), &SyncEngine::notification, this, [this](const QJsonObject &row) {
        // due soon reminders are produced locally they work offline
        if (!m_app->settings()->remindersEnabled() || row.value(QStringLiteral("type")).toString() == QLatin1String("task_due_soon"))
            return;
        const QString taskId = row.value(QStringLiteral("metadata")).toObject().value(QStringLiteral("task_id")).toString();
        m_notifier->notify(row.value(QStringLiteral("title")).toString(), row.value(QStringLiteral("body")).toString(),
                           taskId, {QStringLiteral("default"), m_app->i18n()->t(QStringLiteral("desktop.reminders.open"))});
    });
}

void ReminderScheduler::reschedule()
{
    m_timer.stop();
    if (!m_app->settings()->remindersEnabled() || m_app->auth()->state() != AuthManager::LoggedIn)
        return;

    const QDateTime now = QDateTime::currentDateTime();
    QDateTime next;
    QSet<QString> live;
    const auto &tasks = m_app->store()->tasks();
    for (auto it = tasks.cbegin(); it != tasks.cend(); ++it) {
        const QJsonObject &t = it.value();
        if (Store::isDone(t) || it.key().startsWith(QLatin1String("tmp-")))
            continue;
        const QString due = Store::str(t, "due_date");
        QDateTime at = m_snoozed.value(it.key());
        QString key = it.key() + QLatin1Char('|') + (at.isValid() ? QStringLiteral("snooze:") + at.toString(Qt::ISODate) : due);
        if (!at.isValid()) {
            if (due.isEmpty())
                continue;
            at = Format::parse(due);
            if (!at.isValid())
                continue;
        }
        live.insert(key);
        if (m_notified.contains(key))
            continue;
        const qint64 secs = at.secsTo(now);
        if (secs >= 0) {
            if (secs <= GraceSecs) {
                remind(it.key(), t);
            }
            // older than the grace window stale never notify it
            m_notified.insert(key);
            continue;
        }
        if (!next.isValid() || at < next)
            next = at;
    }
    // forget keys whose task or due date is gone so the set doesnt grow forever
    m_notified.intersect(live);
    persist();

    if (next.isValid())
        m_timer.start(int(qBound<qint64>(0, now.msecsTo(next) + 500, qint64(MaxWaitMs))));
    else
        m_timer.start(MaxWaitMs);
}

void ReminderScheduler::fire()
{
    maybeSummary();
    reschedule();
}

void ReminderScheduler::remind(const QString &id, const QJsonObject &task)
{
    m_snoozed.remove(id);
    I18n *i = m_app->i18n();
    const QString due = Store::str(task, "due_date");
    QString body = due.isEmpty() ? QString() : Format::dueLabel(due);
    const QString list = Store::str(m_app->store()->list(Store::str(task, "list_id")), "name");
    if (!list.isEmpty())
        body = body.isEmpty() ? list : body + QStringLiteral(" · ") + list;
    m_notifier->notify(Store::str(task, "title"), body, id,
                       {
                           QStringLiteral("default"), i->t(QStringLiteral("desktop.reminders.open")),
                           QStringLiteral("complete"), i->t(QStringLiteral("desktop.reminders.complete")),
                           QStringLiteral("snooze10"), i->t(QStringLiteral("desktop.reminders.snooze10")),
                           QStringLiteral("snooze60"), i->t(QStringLiteral("desktop.reminders.snooze60")),
                       },
                       Store::str(task, "priority") == QLatin1String("high"));
}

void ReminderScheduler::onAction(const QString &taskId, const QString &action)
{
    if (action == QLatin1String("complete")) {
        m_app->sync()->setCompleted(taskId, true);
    } else if (action == QLatin1String("snooze10") || action == QLatin1String("snooze60")) {
        const int mins = action == QLatin1String("snooze10") ? 10 : 60;
        m_snoozed.insert(taskId, QDateTime::currentDateTime().addSecs(mins * 60));
        reschedule();
    } else if (taskId.isEmpty()) {
        m_app->showMain();
    } else {
        m_app->openTask(taskId);
    }
}

void ReminderScheduler::maybeSummary()
{
    Settings *s = m_app->settings();
    if (!s->remindersEnabled() || !s->morningSummary() || m_app->auth()->state() != AuthManager::LoggedIn)
        return;
    const QDateTime now = QDateTime::currentDateTime();
    const QString today = now.date().toString(Qt::ISODate);
    if (now.time().hour() < s->morningSummaryHour() || s->value(SummaryKey).toString() == today)
        return;
    s->setValue(SummaryKey, today);

    Store *store = m_app->store();
    const int due = store->todayCount();
    const int overdue = store->overdueCount();
    if (due + overdue == 0)
        return;
    I18n *i = m_app->i18n();
    QString body = i->tc(QStringLiteral("desktop.tray.dueToday"), due);
    if (overdue > 0)
        body += QLatin1Char('\n') + i->tc(QStringLiteral("desktop.tray.overdue"), overdue);
    m_notifier->notify(i->t(QStringLiteral("desktop.reminders.summaryTitle")), body, QString(),
                       {QStringLiteral("default"), i->t(QStringLiteral("desktop.reminders.open"))});
}

void ReminderScheduler::persist()
{
    const QStringList saved = m_app->settings()->value(NotifiedKey).toStringList();
    if (QSet<QString>(saved.cbegin(), saved.cend()) != m_notified)
        m_app->settings()->setValue(NotifiedKey, QStringList(m_notified.cbegin(), m_notified.cend()));
}
