#include "MockServer.h"
#include "core/ApiClient.h"
#include "core/Database.h"
#include "core/OfflineQueue.h"
#include "core/TokenStore.h"

#include <QJsonArray>
#include <QSignalSpy>
#include <QTemporaryDir>
#include <QTest>

class TestOfflineQueue : public QObject
{
    Q_OBJECT

    QTemporaryDir m_dir;
    int m_dbSeq = 0;
    QString dbPath() { return m_dir.filePath(QStringLiteral("q%1.db").arg(++m_dbSeq)); }

private slots:
    void sendsInOrderAndDrains()
    {
        MockServer server;
        TokenStore tokens;
        ApiClient api(server.baseUrl(), &tokens);
        Database db(dbPath());
        OfflineQueue q(&api, &db);
        QSignalSpy drained(&q, &OfflineQueue::drained);
        QSignalSpy ok(&q, &OfflineQueue::opSucceeded);

        q.enqueue("POST", QStringLiteral("/api/tasks"), {{QStringLiteral("title"), QStringLiteral("a")}});
        q.enqueue("PATCH", QStringLiteral("/api/tasks/1"), {{QStringLiteral("title"), QStringLiteral("b")}});
        q.enqueue("DELETE", QStringLiteral("/api/tasks/2"));
        QCOMPARE(q.count(), 3);

        QVERIFY(drained.wait(5000));
        QCOMPARE(server.calls(), QStringList({"POST /api/tasks", "PATCH /api/tasks/1", "DELETE /api/tasks/2"}));
        QCOMPARE(server.requests.at(1).body.value(QStringLiteral("title")).toString(), QStringLiteral("b"));
        QCOMPARE(ok.count(), 3);
        QCOMPARE(q.count(), 0);
        QVERIFY(db.pendingOps().isEmpty());
    }

    void persistsAcrossRestarts()
    {
        const QString path = dbPath();
        {
            TokenStore tokens;
            ApiClient api(QStringLiteral("http://127.0.0.1:9"), &tokens);
            Database db(path);
            OfflineQueue q(&api, &db);
            q.enqueue("POST", QStringLiteral("/api/lists"), {{QStringLiteral("name"), QStringLiteral("Home")}});
        }
        MockServer server;
        TokenStore tokens;
        ApiClient api(server.baseUrl(), &tokens);
        Database db(path);
        OfflineQueue q(&api, &db);
        QCOMPARE(q.count(), 1);
        QSignalSpy drained(&q, &OfflineQueue::drained);
        q.flush();
        QVERIFY(drained.wait(5000));
        QCOMPARE(server.calls(), QStringList({"POST /api/lists"}));
        QCOMPARE(server.requests.first().body.value(QStringLiteral("name")).toString(), QStringLiteral("Home"));
    }

    void transientFailureStallsAndRetries()
    {
        MockServer server;
        int attempts = 0;
        server.handler = [&attempts](const MockServer::Request &) {
            return MockServer::Reply{++attempts == 1 ? 503 : 200, {}};
        };
        TokenStore tokens;
        ApiClient api(server.baseUrl(), &tokens);
        Database db(dbPath());
        OfflineQueue q(&api, &db);
        QSignalSpy stalled(&q, &OfflineQueue::stalled);
        QSignalSpy drained(&q, &OfflineQueue::drained);

        q.enqueue("POST", QStringLiteral("/api/tasks/1/complete"));
        QVERIFY(stalled.wait(5000));
        QCOMPARE(q.count(), 1); // kept for the retry
        QVERIFY(drained.wait(5000)); // first backoff step is 2s
        QCOMPARE(attempts, 2);
        QCOMPARE(q.count(), 0);
    }

    void permanentFailureDropsOp()
    {
        MockServer server;
        server.handler = [](const MockServer::Request &r) {
            return MockServer::Reply{r.path.endsWith(QLatin1String("bad")) ? 400 : 200, {}};
        };
        TokenStore tokens;
        ApiClient api(server.baseUrl(), &tokens);
        Database db(dbPath());
        OfflineQueue q(&api, &db);
        QSignalSpy failed(&q, &OfflineQueue::opFailed);
        QSignalSpy drained(&q, &OfflineQueue::drained);

        q.enqueue("PATCH", QStringLiteral("/api/tasks/bad"));
        q.enqueue("PATCH", QStringLiteral("/api/tasks/good"));
        QVERIFY(drained.wait(5000));
        QCOMPARE(failed.count(), 1);
        QCOMPARE(server.calls().size(), 2); // the queue moved on
    }

    void deleteOf404IsSuccess()
    {
        MockServer server;
        server.handler = [](const MockServer::Request &) { return MockServer::Reply{404, {}}; };
        TokenStore tokens;
        ApiClient api(server.baseUrl(), &tokens);
        Database db(dbPath());
        OfflineQueue q(&api, &db);
        QSignalSpy ok(&q, &OfflineQueue::opSucceeded);
        QSignalSpy failed(&q, &OfflineQueue::opFailed);
        QSignalSpy drained(&q, &OfflineQueue::drained);

        q.enqueue("DELETE", QStringLiteral("/api/tasks/gone"));
        QVERIFY(drained.wait(5000));
        QCOMPARE(ok.count(), 1);
        QCOMPARE(failed.count(), 0);
    }

    void remapsTempIds()
    {
        TokenStore tokens;
        ApiClient api(QStringLiteral("http://127.0.0.1:9"), &tokens);
        Database db(dbPath());
        OfflineQueue q(&api, &db);
        q.enqueue("PATCH", QStringLiteral("/api/tasks/tmp-1"), {{QStringLiteral("title"), QStringLiteral("x")}});
        q.enqueue("POST", QStringLiteral("/api/tasks"),
                  {{QStringLiteral("parent_id"), QStringLiteral("tmp-1")},
                   {QStringLiteral("tag_ids"), QJsonArray({QStringLiteral("tmp-1"), QStringLiteral("g")})}});
        QVERIFY(q.references(QStringLiteral("tmp-1")));

        q.remapId(QStringLiteral("tmp-1"), QStringLiteral("real"));
        QVERIFY(!q.references(QStringLiteral("tmp-1")));
        QVERIFY(q.references(QStringLiteral("real")));

        const QList<Database::Op> ops = db.pendingOps();
        QCOMPARE(ops.size(), 2);
        QCOMPARE(ops.at(0).path, QStringLiteral("/api/tasks/real"));
        QCOMPARE(ops.at(1).body.value(QStringLiteral("parent_id")).toString(), QStringLiteral("real"));
        QCOMPARE(ops.at(1).body.value(QStringLiteral("tag_ids")).toArray().first().toString(), QStringLiteral("real"));
        q.clear();
    }

    void clearDropsEverything()
    {
        TokenStore tokens;
        ApiClient api(QStringLiteral("http://127.0.0.1:9"), &tokens);
        Database db(dbPath());
        OfflineQueue q(&api, &db);
        q.enqueue("POST", QStringLiteral("/api/tags"));
        q.clear();
        QCOMPARE(q.count(), 0);
        QVERIFY(db.pendingOps().isEmpty());
    }
};

QTEST_GUILESS_MAIN(TestOfflineQueue)
#include "tst_offlinequeue.moc"
