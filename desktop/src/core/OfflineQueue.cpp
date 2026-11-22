#include "OfflineQueue.h"

#include <QDateTime>
#include <QJsonArray>

OfflineQueue::OfflineQueue(ApiClient *api, Database *db, QObject *parent)
    : QObject(parent)
    , m_api(api)
    , m_db(db)
{
    m_ops = m_db->pendingOps();
    m_retry.setSingleShot(true);
    connect(&m_retry, &QTimer::timeout, this, &OfflineQueue::flush);
    // coming back online is the best moment to retry
    connect(m_api, &ApiClient::reachabilityChanged, this, [this](bool online) {
        if (online && !m_ops.isEmpty() && !m_flushing) {
            m_backoff = 0;
            QTimer::singleShot(0, this, &OfflineQueue::flush);
        }
    });
}

void OfflineQueue::enqueue(const QByteArray &method, const QString &path, const QJsonObject &body,
                           const QString &tempId)
{
    Database::Op op;
    op.method = method;
    op.path = path;
    op.body = body;
    op.tempId = tempId;
    op.createdAt = QDateTime::currentMSecsSinceEpoch();
    op.seq = m_db->addOp(op);
    m_ops.append(op);
    emit countChanged();
    if (!m_flushing && !m_retry.isActive())
        QTimer::singleShot(0, this, &OfflineQueue::flush);
}

bool OfflineQueue::references(const QString &id) const
{
    for (const Database::Op &op : m_ops) {
        if (op.tempId == id || op.path.contains(id))
            return true;
    }
    return false;
}

static QJsonValue remapValue(const QJsonValue &v, const QString &from, const QString &to)
{
    if (v.isString())
        return v.toString() == from ? QJsonValue(to) : v;
    if (v.isArray()) {
        QJsonArray a = v.toArray();
        for (int i = 0; i < a.size(); ++i)
            a.replace(i, remapValue(a.at(i), from, to));
        return a;
    }
    if (v.isObject()) {
        QJsonObject o = v.toObject();
        for (auto it = o.begin(); it != o.end(); ++it)
            it.value() = remapValue(it.value(), from, to);
        return o;
    }
    return v;
}

void OfflineQueue::remapId(const QString &from, const QString &to)
{
    for (Database::Op &op : m_ops) {
        bool changed = false;
        if (op.path.contains(from)) {
            op.path.replace(from, to);
            changed = true;
        }
        const QJsonObject body = remapValue(op.body, from, to).toObject();
        if (body != op.body) {
            op.body = body;
            changed = true;
        }
        if (changed)
            m_db->updateOp(op);
    }
}

void OfflineQueue::clear()
{
    ++m_generation;
    for (const Database::Op &op : std::as_const(m_ops))
        m_db->removeOp(op.seq);
    m_ops.clear();
    m_flushing = false;
    m_retry.stop();
    emit countChanged();
}

void OfflineQueue::flush()
{
    if (m_flushing)
        return;
    if (m_ops.isEmpty()) {
        emit drained();
        return;
    }
    m_flushing = true;
    sendNext();
}

void OfflineQueue::sendNext()
{
    if (m_ops.isEmpty()) {
        m_flushing = false;
        m_backoff = 0;
        emit drained();
        return;
    }
    const Database::Op op = m_ops.first();
    const quint64 gen = m_generation;
    const QJsonValue body = op.method == "GET" || op.method == "DELETE" ? QJsonValue() : QJsonValue(op.body);
    m_api->request(op.method, op.path, body, [this, op, gen](const ApiResult &r) {
        if (gen != m_generation)
            return; // cleared (logout) while in flight
        if (r.transient()) {
            m_flushing = false;
            emit stalled(r);
            scheduleRetry();
            return;
        }
        if (!m_ops.isEmpty() && m_ops.first().seq == op.seq)
            m_ops.removeFirst();
        m_db->removeOp(op.seq);
        m_backoff = 0;
        emit countChanged();
        // 404 on delete means someone else got there first thats success
        if (r.ok() || (r.status == 404 && op.method == "DELETE"))
            emit opSucceeded(op, r);
        else
            emit opFailed(op, r);
        sendNext();
    });
}

void OfflineQueue::scheduleRetry()
{
    static const int steps[] = {2000, 5000, 10000, 30000, 60000};
    const int delay = steps[qMin(m_backoff, int(std::size(steps)) - 1)];
    ++m_backoff;
    m_retry.start(delay);
}
