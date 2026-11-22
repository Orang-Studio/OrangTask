#include "core/I18n.h"

#include <QTest>

class TestI18n : public QObject
{
    Q_OBJECT

private slots:
    void pluralCategories_data()
    {
        QTest::addColumn<QString>("lang");
        QTest::addColumn<int>("n");
        QTest::addColumn<QString>("category");
        QTest::newRow("en 0") << "en" << 0 << "other";
        QTest::newRow("en 1") << "en" << 1 << "one";
        QTest::newRow("en 2") << "en" << 2 << "other";
        QTest::newRow("lt 1") << "lt" << 1 << "one";
        QTest::newRow("lt 21") << "lt" << 21 << "one";
        QTest::newRow("lt 11") << "lt" << 11 << "other";
        QTest::newRow("lt 2") << "lt" << 2 << "few";
        QTest::newRow("lt 9") << "lt" << 9 << "few";
        QTest::newRow("lt 12") << "lt" << 12 << "other";
        QTest::newRow("lt 22") << "lt" << 22 << "few";
        QTest::newRow("lt 10") << "lt" << 10 << "other";
        QTest::newRow("lt 0") << "lt" << 0 << "other";
        QTest::newRow("lt 111") << "lt" << 111 << "other";
    }
    void pluralCategories()
    {
        QFETCH(QString, lang);
        QFETCH(int, n);
        QTEST(I18n::pluralCategory(lang, n), "category");
    }

    void englishPlurals()
    {
        I18n i;
        i.setPreference(QStringLiteral("en"));
        QCOMPARE(i.language(), QStringLiteral("en"));
        QCOMPARE(i.tc(QStringLiteral("desktop.time.minutesAgo"), 1), QStringLiteral("1 minute ago"));
        QCOMPARE(i.tc(QStringLiteral("desktop.time.minutesAgo"), 5), QStringLiteral("5 minutes ago"));
        // english has no few form so it falls back to other
        QCOMPARE(i.tc(QStringLiteral("desktop.time.minutesAgo"), 3), QStringLiteral("3 minutes ago"));
    }

    void lithuanianUsesFew()
    {
        I18n i;
        i.setPreference(QStringLiteral("lt"));
        QCOMPARE(i.tc(QStringLiteral("desktop.time.minutesAgo"), 1), QStringLiteral("prieš 1 minutę"));
        QCOMPARE(i.tc(QStringLiteral("desktop.time.minutesAgo"), 3), QStringLiteral("prieš 3 minutes"));
        QCOMPARE(i.tc(QStringLiteral("desktop.time.minutesAgo"), 10), QStringLiteral("prieš 10 minučių"));
        QCOMPARE(i.tc(QStringLiteral("desktop.time.minutesAgo"), 21), QStringLiteral("prieš 21 minutę"));
    }

    void desktopKeysOverlayWebCatalog()
    {
        I18n i;
        i.setPreference(QStringLiteral("en"));
        QVERIFY(i.t(QStringLiteral("common.settings")) != QStringLiteral("common.settings"));
        QVERIFY(i.t(QStringLiteral("desktop.shortcuts.quit")) != QStringLiteral("desktop.shortcuts.quit"));
        QCOMPARE(i.t(QStringLiteral("no.such.key")), QStringLiteral("no.such.key"));
    }

    void interpolation()
    {
        I18n i;
        i.setPreference(QStringLiteral("en"));
        const QString s = i.t(QStringLiteral("desktop.sync.failed"), {{QStringLiteral("error"), QStringLiteral("boom")}});
        QVERIFY(s.contains(QStringLiteral("boom")));
        QVERIFY(!s.contains(QStringLiteral("{error}")));
    }

    void catalogsHaveSameDesktopKeys()
    {
        // every desktop key exists in both languages lt may add _few forms
        I18n i;
        for (const QString &lang : {QStringLiteral("en"), QStringLiteral("lt")}) {
            i.setPreference(lang);
            for (const char *key : {"desktop.tray.dueToday_other", "desktop.settings.corner.auto",
                                    "desktop.settings.theme.system", "desktop.quickAdd.hint"})
                QVERIFY2(i.t(QLatin1String(key)) != QLatin1String(key), key);
        }
    }
};

QTEST_GUILESS_MAIN(TestI18n)
#include "tst_i18n.moc"
