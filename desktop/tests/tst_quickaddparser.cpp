#include "core/QuickAddParser.h"

#include <QTest>

static const QDateTime NOW(QDate(2026, 9, 23), QTime(10, 0));

class TestQuickAddParser : public QObject
{
    Q_OBJECT

private slots:
    void plainTitle()
    {
        const auto p = QuickAddParser::parse(QStringLiteral("Buy milk"), NOW);
        QCOMPARE(p.title, QStringLiteral("Buy milk"));
        QVERIFY(!p.dueAt.isValid());
        QCOMPARE(p.priority, QStringLiteral("none"));
        QVERIFY(p.recurrenceRule.isEmpty());
    }

    void priority_data()
    {
        QTest::addColumn<QString>("input");
        QTest::addColumn<QString>("priority");
        QTest::addColumn<QString>("title");
        QTest::newRow("!high") << "report !high" << "high" << "report";
        QTest::newRow("p2") << "p2 call mom" << "medium" << "call mom";
        QTest::newRow("urgent") << "Urgent fix login" << "high" << "fix login";
        QTest::newRow("low priority") << "tidy desk low priority" << "low" << "tidy desk";
        QTest::newRow("not a word boundary") << "ship v2p1 build" << "none" << "ship v2p1 build";
    }
    void priority()
    {
        QFETCH(QString, input);
        const auto p = QuickAddParser::parse(input, NOW);
        QTEST(p.priority, "priority");
        QTEST(p.title, "title");
    }

    void dates_data()
    {
        QTest::addColumn<QString>("input");
        QTest::addColumn<QDateTime>("due");
        QTest::addColumn<QString>("title");
        QTest::newRow("today") << "pay rent today" << QDateTime(QDate(2026, 9, 23), QTime(23, 59)) << "pay rent";
        QTest::newRow("tomorrow 5pm") << "gym tomorrow 5pm" << QDateTime(QDate(2026, 9, 24), QTime(17, 0)) << "gym";
        QTest::newRow("tonight") << "movie tonight" << QDateTime(QDate(2026, 9, 23), QTime(20, 0)) << "movie";
        QTest::newRow("friday 3pm") << "report friday 3pm" << QDateTime(QDate(2026, 9, 25), QTime(15, 0)) << "report";
        QTest::newRow("same weekday is today") << "standup wed" << QDateTime(QDate(2026, 9, 23), QTime(23, 59)) << "standup";
        QTest::newRow("next wed") << "standup next wed" << QDateTime(QDate(2026, 9, 30), QTime(23, 59)) << "standup";
        QTest::newRow("on monday at 9:30") << "dentist on monday at 9:30" << QDateTime(QDate(2026, 9, 28), QTime(9, 30)) << "dentist";
        QTest::newRow("oct 3") << "party oct 3" << QDateTime(QDate(2026, 10, 3), QTime(23, 59)) << "party";
        QTest::newRow("3rd october") << "party 3rd october" << QDateTime(QDate(2026, 10, 3), QTime(23, 59)) << "party";
        QTest::newRow("past date rolls to next year") << "taxes jan 5" << QDateTime(QDate(2027, 1, 5), QTime(23, 59)) << "taxes";
        QTest::newRow("explicit year") << "renew mar 1, 2028" << QDateTime(QDate(2028, 3, 1), QTime(23, 59)) << "renew";
        QTest::newRow("in 3 days") << "follow up in 3 days" << QDateTime(QDate(2026, 9, 26), QTime(23, 59)) << "follow up";
        QTest::newRow("in 2 hours") << "call back in 2 hours" << QDateTime(QDate(2026, 9, 23), QTime(12, 0)) << "call back";
        QTest::newRow("standalone later time is today") << "lunch at noon" << QDateTime(QDate(2026, 9, 23), QTime(12, 0)) << "lunch";
        QTest::newRow("standalone earlier time is tomorrow") << "run 7am" << QDateTime(QDate(2026, 9, 24), QTime(7, 0)) << "run";
        QTest::newRow("12am is midnight") << "backup tomorrow 12am" << QDateTime(QDate(2026, 9, 24), QTime(0, 0)) << "backup";
    }
    void dates()
    {
        QFETCH(QString, input);
        const auto p = QuickAddParser::parse(input, NOW);
        QTEST(p.dueAt, "due");
        QTEST(p.title, "title");
    }

    void recurrence_data()
    {
        QTest::addColumn<QString>("input");
        QTest::addColumn<QString>("rule");
        QTest::addColumn<QString>("title");
        QTest::newRow("daily") << "water plants daily" << "FREQ=DAILY" << "water plants";
        QTest::newRow("every monday") << "review every monday" << "FREQ=WEEKLY;BYDAY=MO" << "review";
        QTest::newRow("weekdays") << "standup weekdays" << "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" << "standup";
    }
    void recurrence()
    {
        QFETCH(QString, input);
        const auto p = QuickAddParser::parse(input, NOW);
        QTEST(p.recurrenceRule, "rule");
        QTEST(p.title, "title");
    }

    void everything()
    {
        const auto p = QuickAddParser::parse(QStringLiteral("Send invoice by fri 9am p1"), NOW);
        QCOMPARE(p.title, QStringLiteral("Send invoice"));
        QCOMPARE(p.priority, QStringLiteral("high"));
        QCOMPARE(p.dueAt, QDateTime(QDate(2026, 9, 25), QTime(9, 0)));
    }
};

QTEST_GUILESS_MAIN(TestQuickAddParser)
#include "tst_quickaddparser.moc"
