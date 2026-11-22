#pragma once

#include "ApiClient.h"
#include "Database.h"

#include <QObject>
#include <QTimer>

class OfflineQueue : public QObject
{
    Q_OBJECT

public:
    OfflineQueue(ApiClient *api, Database *db, QObject *parent = nullptr);

    void enqueue(const QByteArray &method, const QString &path, const QJsonObject &body = {},
                 const QString &tempId = {});
    int count() const { return int(m_ops.size()); }
    bool isFlushing() const { return m_flushing; }
    bool references(const QString &id) const;

    // rewrites tmp ids in the ops still waiting path segments and body values
    void remapId(const QString &from, const QString &to);
    void clear();

public slots:
    void flush();

signals:
    void countChanged();
    void drained();
    void opSucceeded(const Database::Op &op, const ApiResult &result);
    void opFailed(const Database::Op &op, const ApiResult &result);
    void stalled(const ApiResult &result);

private:
    void sendNext();
    void scheduleRetry();

    ApiClient *m_api;
    Database *m_db;
    QList<Database::Op> m_ops;
    bool m_flushing = false;
    int m_backoff = 0;
    QTimer m_retry;
    quint64 m_generation = 0;
};
