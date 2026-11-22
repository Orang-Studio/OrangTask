#include "Database.h"

#include <QDateTime>
#include <QDir>
#include <QJsonDocument>
#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>
#include <QStandardPaths>
#include <QUuid>
#include <QtDebug>

static const QStringList ENTITY_TABLES = {
    QStringLiteral("lists"), QStringLiteral("tasks"), QStringLiteral("tags"), QStringLiteral("scratchpads"),
};

static QByteArray toBlob(const QJsonObject &o)
{
    return QJsonDocument(o).toJson(QJsonDocument::Compact);
}

static QString idOf(const QJsonObject &o)
{
    const QJsonValue v = o.value(QStringLiteral("id"));
    return v.isString() ? v.toString() : QString::number(v.toVariant().toLongLong());
}

Database::Database(const QString &path)
    : m_conn(QStringLiteral("orangtask-") + QUuid::createUuid().toString(QUuid::WithoutBraces))
{
    QString file = path;
    if (file.isEmpty()) {
        const QString dir = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation);
        QDir().mkpath(dir);
        file = dir + QStringLiteral("/cache.db");
    }
    QSqlDatabase db = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), m_conn);
    db.setDatabaseName(file);
    m_open = db.open();
    if (!m_open) {
        qWarning() << "cache db:" << db.lastError().text();
        return;
    }
    QSqlQuery(db).exec(QStringLiteral("PRAGMA journal_mode=WAL"));
    QSqlQuery(db).exec(QStringLiteral("PRAGMA synchronous=NORMAL"));
    migrate();
}

Database::~Database()
{
    {
        QSqlDatabase db = QSqlDatabase::database(m_conn, false);
        if (db.isOpen())
            db.close();
    }
    QSqlDatabase::removeDatabase(m_conn);
}

void Database::migrate()
{
    QSqlDatabase db = QSqlDatabase::database(m_conn);
    QSqlQuery q(db);
    for (const QString &t : ENTITY_TABLES)
        q.exec(QStringLiteral("CREATE TABLE IF NOT EXISTS %1 (id TEXT PRIMARY KEY, json BLOB NOT NULL)").arg(t));
    q.exec(QStringLiteral(
        "CREATE TABLE IF NOT EXISTS pending_ops (seq INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT NOT NULL, "
        "path TEXT NOT NULL, body BLOB, temp_id TEXT, created_at INTEGER NOT NULL)"));
    q.exec(QStringLiteral("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)"));
}

QList<QJsonObject> Database::loadAll(const QString &table) const
{
    QList<QJsonObject> out;
    if (!m_open || !ENTITY_TABLES.contains(table))
        return out;
    QSqlQuery q(QSqlDatabase::database(m_conn));
    q.exec(QStringLiteral("SELECT json FROM %1").arg(table));
    while (q.next())
        out.append(QJsonDocument::fromJson(q.value(0).toByteArray()).object());
    return out;
}

void Database::upsert(const QString &table, const QJsonObject &row)
{
    upsertMany(table, {row});
}

void Database::upsertMany(const QString &table, const QList<QJsonObject> &rows)
{
    if (!m_open || !ENTITY_TABLES.contains(table) || rows.isEmpty())
        return;
    QSqlDatabase db = QSqlDatabase::database(m_conn);
    db.transaction();
    QSqlQuery q(db);
    q.prepare(QStringLiteral("INSERT OR REPLACE INTO %1 (id, json) VALUES (?, ?)").arg(table));
    for (const QJsonObject &row : rows) {
        q.addBindValue(idOf(row));
        q.addBindValue(toBlob(row));
        q.exec();
    }
    db.commit();
}

void Database::remove(const QString &table, const QString &id)
{
    if (!m_open || !ENTITY_TABLES.contains(table))
        return;
    QSqlQuery q(QSqlDatabase::database(m_conn));
    q.prepare(QStringLiteral("DELETE FROM %1 WHERE id = ?").arg(table));
    q.addBindValue(id);
    q.exec();
}

void Database::replaceAll(const QString &table, const QList<QJsonObject> &rows)
{
    if (!m_open || !ENTITY_TABLES.contains(table))
        return;
    QSqlDatabase db = QSqlDatabase::database(m_conn);
    db.transaction();
    QSqlQuery(db).exec(QStringLiteral("DELETE FROM %1").arg(table));
    QSqlQuery q(db);
    q.prepare(QStringLiteral("INSERT OR REPLACE INTO %1 (id, json) VALUES (?, ?)").arg(table));
    for (const QJsonObject &row : rows) {
        q.addBindValue(idOf(row));
        q.addBindValue(toBlob(row));
        q.exec();
    }
    db.commit();
}

QList<Database::Op> Database::pendingOps() const
{
    QList<Op> out;
    if (!m_open)
        return out;
    QSqlQuery q(QSqlDatabase::database(m_conn));
    q.exec(QStringLiteral("SELECT seq, method, path, body, temp_id, created_at FROM pending_ops ORDER BY seq"));
    while (q.next()) {
        Op op;
        op.seq = q.value(0).toLongLong();
        op.method = q.value(1).toString().toLatin1();
        op.path = q.value(2).toString();
        op.body = QJsonDocument::fromJson(q.value(3).toByteArray()).object();
        op.tempId = q.value(4).toString();
        op.createdAt = q.value(5).toLongLong();
        out.append(op);
    }
    return out;
}

qint64 Database::addOp(const Op &op)
{
    if (!m_open)
        return 0;
    QSqlQuery q(QSqlDatabase::database(m_conn));
    q.prepare(QStringLiteral(
        "INSERT INTO pending_ops (method, path, body, temp_id, created_at) VALUES (?, ?, ?, ?, ?)"));
    q.addBindValue(QString::fromLatin1(op.method));
    q.addBindValue(op.path);
    q.addBindValue(toBlob(op.body));
    q.addBindValue(op.tempId);
    q.addBindValue(op.createdAt ? op.createdAt : QDateTime::currentMSecsSinceEpoch());
    if (!q.exec())
        return 0;
    return q.lastInsertId().toLongLong();
}

void Database::removeOp(qint64 seq)
{
    if (!m_open)
        return;
    QSqlQuery q(QSqlDatabase::database(m_conn));
    q.prepare(QStringLiteral("DELETE FROM pending_ops WHERE seq = ?"));
    q.addBindValue(seq);
    q.exec();
}

void Database::updateOp(const Op &op)
{
    if (!m_open)
        return;
    QSqlQuery q(QSqlDatabase::database(m_conn));
    q.prepare(QStringLiteral("UPDATE pending_ops SET path = ?, body = ?, temp_id = ? WHERE seq = ?"));
    q.addBindValue(op.path);
    q.addBindValue(toBlob(op.body));
    q.addBindValue(op.tempId);
    q.addBindValue(op.seq);
    q.exec();
}

QString Database::kv(const QString &key) const
{
    if (!m_open)
        return {};
    QSqlQuery q(QSqlDatabase::database(m_conn));
    q.prepare(QStringLiteral("SELECT value FROM kv WHERE key = ?"));
    q.addBindValue(key);
    q.exec();
    return q.next() ? q.value(0).toString() : QString();
}

void Database::setKv(const QString &key, const QString &value)
{
    if (!m_open)
        return;
    QSqlQuery q(QSqlDatabase::database(m_conn));
    q.prepare(QStringLiteral("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)"));
    q.addBindValue(key);
    q.addBindValue(value);
    q.exec();
}

void Database::clear()
{
    if (!m_open)
        return;
    QSqlDatabase db = QSqlDatabase::database(m_conn);
    db.transaction();
    QSqlQuery q(db);
    for (const QString &t : ENTITY_TABLES)
        q.exec(QStringLiteral("DELETE FROM %1").arg(t));
    q.exec(QStringLiteral("DELETE FROM pending_ops"));
    q.exec(QStringLiteral("DELETE FROM kv"));
    db.commit();
}
