#pragma once

#include <QJsonObject>
#include <QList>
#include <QString>

// sqlite cache stores rows as json blobs so schema stays flexible
class Database
{
public:
    struct Op
    {
        qint64 seq = 0;
        QByteArray method;
        QString path;
        QJsonObject body;
        QString tempId;            // id the op creates locally (tmp-...), remapped on success
        qint64 createdAt = 0;
    };

    explicit Database(const QString &path = {});
    ~Database();

    bool isOpen() const { return m_open; }

    QList<QJsonObject> loadAll(const QString &table) const;
    void upsert(const QString &table, const QJsonObject &row);
    void upsertMany(const QString &table, const QList<QJsonObject> &rows);
    void remove(const QString &table, const QString &id);
    void replaceAll(const QString &table, const QList<QJsonObject> &rows);

    QList<Op> pendingOps() const;
    qint64 addOp(const Op &op);
    void removeOp(qint64 seq);
    void updateOp(const Op &op);

    QString kv(const QString &key) const;
    void setKv(const QString &key, const QString &value);

    void clear();

private:
    void migrate();

    QString m_conn;
    bool m_open = false;
};
