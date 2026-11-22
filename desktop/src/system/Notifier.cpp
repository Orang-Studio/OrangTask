#include "Notifier.h"

#include <QDBusConnection>
#include <QDBusMessage>
#include <QDBusPendingCallWatcher>
#include <QDBusPendingReply>

static const QString Service = QStringLiteral("org.freedesktop.Notifications");
static const QString Path = QStringLiteral("/org/freedesktop/Notifications");

Notifier::Notifier(QObject *parent)
    : QObject(parent)
{
    QDBusConnection bus = QDBusConnection::sessionBus();
    bus.connect(Service, Path, Service, QStringLiteral("ActionInvoked"), this, SLOT(onActionInvoked(uint, QString)));
    bus.connect(Service, Path, Service, QStringLiteral("NotificationClosed"), this, SLOT(onClosed(uint, uint)));
}

void Notifier::notify(const QString &title, const QString &body, const QString &taskId,
                      const QStringList &actions, bool urgent)
{
    QDBusMessage msg = QDBusMessage::createMethodCall(Service, Path, Service, QStringLiteral("Notify"));
    QVariantMap hints{
        {QStringLiteral("desktop-entry"), QStringLiteral("lt.oranges.orangtask")},
        {QStringLiteral("urgency"), QVariant::fromValue<uchar>(urgent ? 2 : 1)},
        {QStringLiteral("category"), QStringLiteral("x-orangtask.reminder")},
    };
    msg << QStringLiteral("OrangTask") << uint(0) << QStringLiteral("lt.oranges.orangtask") << title
        << body.toHtmlEscaped() << actions << hints << int(-1);

    auto *watcher = new QDBusPendingCallWatcher(QDBusConnection::sessionBus().asyncCall(msg), this);
    connect(watcher, &QDBusPendingCallWatcher::finished, this, [this, watcher, taskId]() {
        watcher->deleteLater();
        QDBusPendingReply<uint> reply = *watcher;
        if (reply.isError()) {
            qWarning() << "notification failed:" << reply.error().message();
            return;
        }
        m_tasks.insert(reply.value(), taskId);
    });
}

void Notifier::onActionInvoked(uint id, const QString &action)
{
    auto it = m_tasks.constFind(id);
    if (it == m_tasks.constEnd())
        return;
    emit actionInvoked(it.value(), action);
}

void Notifier::onClosed(uint id, uint)
{
    m_tasks.remove(id);
}
