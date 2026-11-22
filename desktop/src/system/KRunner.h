#pragma once

#include <QDBusArgument>
#include <QList>
#include <QObject>
#include <QVariantMap>

class AppController;
class Notifier;

struct RemoteMatch
{
    QString id;
    QString text;
    QString iconName;
    int categoryRelevance = 0;   // KRunner::QueryMatch::CategoryRelevance
    double relevance = 0;
    QVariantMap properties;
};
using RemoteMatches = QList<RemoteMatch>;

struct RemoteAction
{
    QString id;
    QString text;
    QString iconName;
};
using RemoteActions = QList<RemoteAction>;

Q_DECLARE_METATYPE(RemoteMatch)
Q_DECLARE_METATYPE(RemoteMatches)
Q_DECLARE_METATYPE(RemoteAction)
Q_DECLARE_METATYPE(RemoteActions)

QDBusArgument &operator<<(QDBusArgument &arg, const RemoteMatch &m);
const QDBusArgument &operator>>(const QDBusArgument &arg, RemoteMatch &m);
QDBusArgument &operator<<(QDBusArgument &arg, const RemoteAction &a);
const QDBusArgument &operator>>(const QDBusArgument &arg, RemoteAction &a);

// krunner dbus runner
class KRunner : public QObject
{
    Q_OBJECT
    Q_CLASSINFO("D-Bus Interface", "org.kde.krunner1")

public:
    KRunner(AppController *app, Notifier *notifier);
    static void registerTypes();

public slots:
    RemoteActions Actions();
    RemoteMatches Match(const QString &query);
    void Run(const QString &matchId, const QString &actionId);

private:
    AppController *m_app;
    Notifier *m_notifier;
};
