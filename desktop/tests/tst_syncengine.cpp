#include "MockServer.h"
#include "core/ApiClient.h"
#include "core/Database.h"
#include "core/I18n.h"
#include "core/RealtimeClient.h"
#include "core/Store.h"
#include "core/SyncEngine.h"
#include "core/TokenStore.h"

#include <QSignalSpy>
#include <QTemporaryDir>
#include <QTest>

// the engine is exercised without start no ws socket and no full refresh just optimistic edits flowing through the queue to a mock server
class TestSyncEngine : public QObject
{
    Q_OBJECT

    QTemporaryDir m_dir;
    int m_dbSeq = 0;

    struct Fixture
    {
        MockServer server;
        TokenStore tokens;
        ApiClient api;
        Database db;
        Store store;
        RealtimeClient rt;
        SyncEngine sync;

        explicit Fixture(const QString &dbPath)
            : api(server.baseUrl(), &tokens)
            , db(dbPath)
            , store(&db)
            , rt(server.baseUrl(), &tokens)
            , sync(&api, &db, &store, &rt)
        {
            store.upsert(Store::Lists, {{QStringLiteral("id"), QStringLiteral("l1")},
                                        {QStringLiteral("name"), QStringLiteral("Inbox")}}, false);
        }

        bool settle()
        {
            return QTest::qWaitFor([this]() { return sync.pendingCount() == 0; }, 5000);
        }
    };

    QString dbPath() { return m_dir.filePath(QStringLiteral("s%1.db").arg(++m_dbSeq)); }

private slots:
    void initTestCase()
    {
        I18n::instance()->setPreference(QStringLiteral("en"));
    }

    void createIsOptimisticThenRemapped()
    {
        Fixture f(dbPath());
        f.server.handler = [](const MockServer::Request &r) {
            QJsonObject task = r.body;
            task.insert(QStringLiteral("id"), QStringLiteral("t-real"));
            task.insert(QStringLiteral("status"), QStringLiteral("todo"));
            return MockServer::Reply{201, {{QStringLiteral("task"), task}}};
        };
        QSignalSpy remapped(&f.sync, &SyncEngine::idRemapped);

        const QString tmp = f.sync.createTask({{QStringLiteral("list_id"), QStringLiteral("l1")},
                                               {QStringLiteral("title"), QStringLiteral("  Write tests ")}});
        QVERIFY(tmp.startsWith(QLatin1String("tmp-")));
        QCOMPARE(f.store.task(tmp).value(QStringLiteral("title")).toString(), QStringLiteral("Write tests"));
        QCOMPARE(f.sync.pendingCount(), 1);

        QVERIFY(f.settle());
        QCOMPARE(remapped.count(), 1);
        QCOMPARE(remapped.first().at(1).toString(), QStringLiteral("t-real"));
        QVERIFY(f.store.task(tmp).isEmpty());
        QCOMPARE(f.store.task(QStringLiteral("t-real")).value(QStringLiteral("title")).toString(),
                 QStringLiteral("Write tests"));
    }

    void followUpEditsTargetTheRealId()
    {
        Fixture f(dbPath());
        f.server.handler = [](const MockServer::Request &r) {
            if (r.method == "POST" && r.path == QLatin1String("/api/tasks")) {
                QJsonObject task = r.body;
                task.insert(QStringLiteral("id"), QStringLiteral("t-9"));
                return MockServer::Reply{201, {{QStringLiteral("task"), task}}};
            }
            return MockServer::Reply{200, {}};
        };

        const QString tmp = f.sync.createTask({{QStringLiteral("list_id"), QStringLiteral("l1")},
                                               {QStringLiteral("title"), QStringLiteral("Quick one")}});
        f.sync.setCompleted(tmp, true);
        QCOMPARE(f.store.task(tmp).value(QStringLiteral("status")).toString(), QStringLiteral("done"));

        QVERIFY(f.settle());
        QCOMPARE(f.server.calls(), QStringList({"POST /api/tasks", "POST /api/tasks/t-9/complete"}));
        // the servers create response doesnt undo the queued completion
        QCOMPARE(f.store.task(QStringLiteral("t-9")).value(QStringLiteral("status")).toString(),
                 QStringLiteral("done"));
    }

    void quickAddParsesTheTitle()
    {
        Fixture f(dbPath());
        const QString tmp = f.sync.quickAdd(QStringLiteral("l1"), QStringLiteral("Pay rent tomorrow p1"));
        const QJsonObject row = f.store.task(tmp);
        QCOMPARE(row.value(QStringLiteral("title")).toString(), QStringLiteral("Pay rent"));
        QCOMPARE(row.value(QStringLiteral("priority")).toString(), QStringLiteral("high"));
        QVERIFY(!row.value(QStringLiteral("due_date")).toString().isEmpty());
        QVERIFY(f.settle());
        QCOMPARE(f.server.requests.first().body.value(QStringLiteral("title")).toString(), QStringLiteral("Pay rent"));
    }

    void rejectsEmptyTasks()
    {
        Fixture f(dbPath());
        QVERIFY(f.sync.createTask({{QStringLiteral("list_id"), QStringLiteral("l1")},
                                   {QStringLiteral("title"), QStringLiteral("   ")}}).isEmpty());
        QVERIFY(f.sync.createTask({{QStringLiteral("title"), QStringLiteral("no list")}}).isEmpty());
        QCOMPARE(f.sync.pendingCount(), 0);
    }

    void failureRaisesToast()
    {
        Fixture f(dbPath());
        f.store.upsert(Store::Tasks, {{QStringLiteral("id"), QStringLiteral("t-1")},
                                      {QStringLiteral("list_id"), QStringLiteral("l1")},
                                      {QStringLiteral("title"), QStringLiteral("x")},
                                      {QStringLiteral("status"), QStringLiteral("todo")}}, false);
        f.server.handler = [](const MockServer::Request &) {
            return MockServer::Reply{403, {{QStringLiteral("error"), QStringLiteral("nope")}}};
        };
        QSignalSpy toast(&f.sync, &SyncEngine::toast);
        f.sync.setCompleted(QStringLiteral("t-1"), true);
        QVERIFY(toast.wait(5000));
        QVERIFY(toast.first().at(0).toString().startsWith(QLatin1String("Couldn't save a change")));
    }
};

QTEST_GUILESS_MAIN(TestSyncEngine)
#include "tst_syncengine.moc"
