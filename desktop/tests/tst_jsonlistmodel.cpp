#include "models/JsonListModel.h"

#include <QTest>

class Model : public JsonListModel
{
public:
    QVariant data(const QModelIndex &, int) const override { return {}; }
    using JsonListModel::apply;
    using JsonListModel::renameRow;
};

class TestJsonListModel : public QObject
{
    Q_OBJECT
private slots:
    // ws task created beats the POST reply the server id is already a row when the tmp row gets renamed to it
    void renameOntoExistingIdKeepsOneRow()
    {
        Model m;
        const auto row = [](const QString &id) { return QJsonObject{{QStringLiteral("id"), id}}; };
        m.apply({QStringLiteral("tmp-1"), QStringLiteral("real")},
                {{QStringLiteral("tmp-1"), row(QStringLiteral("tmp-1"))}, {QStringLiteral("real"), row(QStringLiteral("real"))}});
        m.renameRow(QStringLiteral("tmp-1"), QStringLiteral("real"), {});
        QCOMPARE(m.rowCount(), 1);
        m.apply({QStringLiteral("real")}, {{QStringLiteral("real"), row(QStringLiteral("real"))}});
        QCOMPARE(m.rowCount(), 1);
        QCOMPARE(m.idAt(0), QStringLiteral("real"));
    }
};

QTEST_GUILESS_MAIN(TestJsonListModel)
#include "tst_jsonlistmodel.moc"
