#pragma once

#include <QDateTime>
#include <QHash>
#include <QJsonObject>
#include <QObject>
#include <QSet>
#include <QTimer>

#include <functional>
#include <QVariantMap>

class ApiClient;
class Database;
class OfflineQueue;
class RealtimeClient;
class Store;
struct ApiResult;

class SyncEngine : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool online READ online NOTIFY onlineChanged)
    Q_PROPERTY(bool live READ live NOTIFY liveChanged)
    Q_PROPERTY(bool syncing READ syncing NOTIFY syncingChanged)
    Q_PROPERTY(int pendingCount READ pendingCount NOTIFY pendingCountChanged)
    Q_PROPERTY(QStringList loadingLists READ loadingLists NOTIFY loadingListsChanged)
    // pendingCount for the UI 0 until changes go unconfirmed for 10s so a normal round trip never flashes syncing
    Q_PROPERTY(int stalePendingCount READ stalePendingCount NOTIFY pendingCountChanged)
    Q_PROPERTY(QString lastSynced READ lastSynced NOTIFY syncingChanged)

public:
    SyncEngine(ApiClient *api, Database *db, Store *store, RealtimeClient *rt, QObject *parent = nullptr);
    static SyncEngine *instance();

    bool online() const { return m_online; }
    bool live() const;
    bool syncing() const { return m_syncing; }
    int pendingCount() const;
    int stalePendingCount() const;
    QString lastSynced() const;

    void start();
    void stop(bool wipe);
    void flushDeferred();

    Q_INVOKABLE void refresh();
    // updates the cache and so the screen with whatever changed
    Q_INVOKABLE void openList(const QString &listId);
    QStringList loadingLists() const { return QStringList(m_loadingLists.cbegin(), m_loadingLists.cend()); }

    Q_INVOKABLE QString createTask(const QVariantMap &fields);
    Q_INVOKABLE QString quickAdd(const QString &listId, const QString &text, const QString &parentId = {});
    Q_INVOKABLE void updateTask(const QString &id, const QVariantMap &fields);
    Q_INVOKABLE void setCompleted(const QString &id, bool done);
    Q_INVOKABLE void toggleCompleted(const QString &id);
    Q_INVOKABLE void deleteTask(const QString &id);         // undoable for 5s
    Q_INVOKABLE void undoDelete(const QString &id);
    Q_INVOKABLE void loadSubtasks(const QString &parentId);
    Q_INVOKABLE void reorder(const QStringList &ids);

    Q_INVOKABLE QString createTag(const QString &name, const QString &color = {});
    Q_INVOKABLE void deleteTag(const QString &id);
    // name covers tags of other list members which are not in the local store
    Q_INVOKABLE void addTag(const QString &taskId, const QString &tagId, const QString &name = {});
    Q_INVOKABLE void removeTag(const QString &taskId, const QString &tagId);

    Q_INVOKABLE QString createList(const QString &name, const QString &color = {}, const QString &icon = {});
    Q_INVOKABLE void updateList(const QString &id, const QVariantMap &fields);
    Q_INVOKABLE void deleteList(const QString &id);
    Q_INVOKABLE void reorderLists(const QStringList &ids);   // the sidebar order, per user

    Q_INVOKABLE QString createScratchpad(const QString &title = {}, const QString &content = {});
    Q_INVOKABLE void updateScratchpad(const QString &id, const QVariantMap &fields);
    Q_INVOKABLE void deleteScratchpad(const QString &id);

    Q_INVOKABLE QString defaultListId() const;

signals:
    void onlineChanged();
    void liveChanged();
    void syncingChanged();
    void pendingCountChanged();
    void refreshed();
    void loadingListsChanged();
    void toast(const QString &message);
    void idRemapped(const QString &from, const QString &to);
    void taskDeleted(const QString &id, const QString &title);
    void notification(const QJsonObject &row);

private:
    void doRefresh();
    void finishRefresh(bool ok);
    void fetchList(const QString &listId, std::function<void(bool ok)> done = {});
    void onEvent(const QString &type, const QJsonValue &data);
    void handleSuccess(const QByteArray &method, const QString &path, const QString &tempId, const ApiResult &r);
    void handleFailure(const QByteArray &method, const QString &path, const ApiResult &r);
    void enqueue(const QByteArray &method, const QString &path, const QJsonObject &body = {},
                 const QString &tempId = {});
    void refreshIfAssigneeUnnamed(const QJsonObject &task);
    void refreshListSoon(const QString &listId);
    void flushScratchpad(const QString &id);
    QSet<QString> pendingTaskIds() const;
    static QString newTempId();
    static QJsonObject toJson(const QVariantMap &fields);

    ApiClient *m_api;
    Database *m_db;
    Store *m_store;
    OfflineQueue *m_queue;
    RealtimeClient *m_rt;
    bool m_started = false;
    bool m_online = true;
    bool m_syncing = false;
    bool m_refreshAgain = false;
    int m_outstanding = 0;
    bool m_refreshOk = true;
    QDateTime m_lastSynced;

    struct DeferredDelete
    {
        QJsonObject snapshot;
        QList<QJsonObject> children;
        QTimer *timer = nullptr;
    };
    QHash<QString, DeferredDelete> m_deferred;
    QHash<QString, QJsonObject> m_scratchPatch;
    QHash<QString, QTimer *> m_scratchTimers;
    QSet<QString> m_listRefresh;
    QTimer m_listRefreshTimer;
    QSet<QString> m_loadingLists;
    QTimer m_pendingStale;
    bool m_pendingShown = false;
};
