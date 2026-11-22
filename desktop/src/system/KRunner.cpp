#include "KRunner.h"
#include "Notifier.h"

#include "app/AppController.h"
#include "core/AuthManager.h"
#include "core/Format.h"
#include "core/I18n.h"
#include "core/QuickAddParser.h"
#include "core/Store.h"
#include "core/SyncEngine.h"

#include <QDBusMetaType>
#include <QJsonObject>
#include <QRegularExpression>

enum { Lowest = 0, Low = 30, Moderate = 50, High = 70, Highest = 100 };

static const QString AppIcon = QStringLiteral("lt.oranges.orangtask");
static const QString AddPrefix = QStringLiteral("add:");

QDBusArgument &operator<<(QDBusArgument &arg, const RemoteMatch &m)
{
    arg.beginStructure();
    arg << m.id << m.text << m.iconName << m.categoryRelevance << m.relevance << m.properties;
    arg.endStructure();
    return arg;
}

const QDBusArgument &operator>>(const QDBusArgument &arg, RemoteMatch &m)
{
    arg.beginStructure();
    arg >> m.id >> m.text >> m.iconName >> m.categoryRelevance >> m.relevance >> m.properties;
    arg.endStructure();
    return arg;
}

QDBusArgument &operator<<(QDBusArgument &arg, const RemoteAction &a)
{
    arg.beginStructure();
    arg << a.id << a.text << a.iconName;
    arg.endStructure();
    return arg;
}

const QDBusArgument &operator>>(const QDBusArgument &arg, RemoteAction &a)
{
    arg.beginStructure();
    arg >> a.id >> a.text >> a.iconName;
    arg.endStructure();
    return arg;
}

void KRunner::registerTypes()
{
    qDBusRegisterMetaType<RemoteMatch>();
    qDBusRegisterMetaType<RemoteMatches>();
    qDBusRegisterMetaType<RemoteAction>();
    qDBusRegisterMetaType<RemoteActions>();
}

KRunner::KRunner(AppController *app, Notifier *notifier)
    : QObject(app)
    , m_app(app)
    , m_notifier(notifier)
{
}

RemoteActions KRunner::Actions()
{
    I18n *i = m_app->i18n();
    return {
        {QStringLiteral("complete"), i->t(QStringLiteral("taskItem.markComplete")), QStringLiteral("checkmark")},
    };
}

RemoteMatches KRunner::Match(const QString &query)
{
    RemoteMatches out;
    if (m_app->auth()->state() != AuthManager::LoggedIn)
        return out;
    I18n *i = m_app->i18n();
    const QString q = query.trimmed();

    static const QRegularExpression addRe(QStringLiteral("^(?:t|task|todo)\\s*:\\s*(.+)$"),
                                          QRegularExpression::CaseInsensitiveOption);
    const auto add = addRe.match(q);
    if (add.hasMatch()) {
        const QString text = add.captured(1).trimmed();
        const QVariantMap p = QuickAddParser().preview(text);
        RemoteMatch m;
        m.id = AddPrefix + text;
        m.text = i->t(QStringLiteral("desktop.runner.add"), {{QStringLiteral("title"), p.value(QStringLiteral("title"))}});
        m.iconName = QStringLiteral("list-add");
        m.categoryRelevance = Highest;
        m.relevance = 1.0;
        // say where it goes without a list it lands in the last list opened
        QStringList sub{Store::str(m_app->store()->list(m_app->sync()->defaultListId()), "name")};
        for (const char *k : {"dueLabel", "recurrence"}) {
            const QString v = p.value(QLatin1String(k)).toString();
            if (!v.isEmpty())
                sub << v;
        }
        sub.removeAll(QString());
        m.properties.insert(QStringLiteral("subtext"), sub.join(QStringLiteral(" · ")));
        m.properties.insert(QStringLiteral("actions"), QStringList());
        out << m;
        return out;
    }

    if (q.size() < 3)
        return out;
    const QVariantList hits = m_app->store()->search(q, 8);
    int rank = 0;
    for (const QVariant &v : hits) {
        const QVariantMap t = v.toMap();
        const QString title = t.value(QStringLiteral("title")).toString();
        const bool done = t.value(QStringLiteral("status")).toString() == QLatin1String("done");
        RemoteMatch m;
        m.id = t.value(QStringLiteral("id")).toString();
        m.text = title;
        m.iconName = done ? QStringLiteral("checkbox") : AppIcon;
        const bool exact = title.compare(q, Qt::CaseInsensitive) == 0;
        m.categoryRelevance = exact ? Highest : title.startsWith(q, Qt::CaseInsensitive) ? High : Moderate;
        m.relevance = qMax(0.1, (exact ? 1.0 : 0.8) - rank++ * 0.05);
        QStringList sub;
        const QString list = t.value(QStringLiteral("list_name")).toString();
        if (!list.isEmpty())
            sub << list;
        const QString due = t.value(QStringLiteral("due_date")).toString();
        if (!due.isEmpty())
            sub << Format::dueLabel(due);
        m.properties.insert(QStringLiteral("subtext"), sub.join(QStringLiteral(" · ")));
        m.properties.insert(QStringLiteral("category"), QStringLiteral("OrangTask"));
        if (done)
            m.properties.insert(QStringLiteral("actions"), QStringList());
        out << m;
    }
    return out;
}

void KRunner::Run(const QString &matchId, const QString &actionId)
{
    if (matchId.startsWith(AddPrefix)) {
        const QString id = m_app->sync()->quickAdd(QString(), matchId.mid(AddPrefix.size()));
        const QJsonObject task = m_app->store()->task(id);
        if (!task.isEmpty()) {
            // krunner closes on Enter so confirm where the task went
            const QString list = Store::str(m_app->store()->list(Store::str(task, "list_id")), "name");
            m_notifier->notify(Store::str(task, "title"),
                               m_app->i18n()->t(QStringLiteral("desktop.runner.added"), {{QStringLiteral("list"), list}}),
                               QString());
        }
        return;
    }
    if (actionId == QLatin1String("complete"))
        m_app->sync()->setCompleted(matchId, true);
    else
        m_app->openTask(matchId);
}
