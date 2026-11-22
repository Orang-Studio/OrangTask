#pragma once

#include <QHash>
#include <QJsonObject>
#include <QObject>
#include <QSet>
#include <QVariantMap>

class Database;

class Store : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString userId READ userId NOTIFY userIdChanged)
    Q_PROPERTY(int badgeCount READ badgeCount NOTIFY countsChanged)
    Q_PROPERTY(int todayCount READ todayCount NOTIFY countsChanged)
    Q_PROPERTY(int overdueCount READ overdueCount NOTIFY countsChanged)
    Q_PROPERTY(bool empty READ isEmpty NOTIFY listsChanged)
    // bumped on every change read one in a QML binding to re run it when that table changes Q_INVOKABLE lookups alone dont create dependencies
    Q_PROPERTY(int listsRevision READ listsRevision NOTIFY listsChanged)
    Q_PROPERTY(int tasksRevision READ tasksRevision NOTIFY tasksChanged)
    Q_PROPERTY(int tagsRevision READ tagsRevision NOTIFY tagsChanged)

public:
    enum Kind { Lists, Tasks, Tags, Scratchpads };

    Store(Database *db, QObject *parent = nullptr);
    static Store *instance();

    void load();
    void clear();
    void touch() { markDirty(Tasks); }

    QString userId() const { return m_userId; }
    void setUserId(const QString &id);

    const QHash<QString, QJsonObject> &lists() const { return m_lists; }
    const QHash<QString, QJsonObject> &tasks() const { return m_tasks; }
    const QHash<QString, QJsonObject> &tags() const { return m_tags; }
    const QHash<QString, QJsonObject> &scratchpads() const { return m_scratchpads; }
    bool isEmpty() const { return m_lists.isEmpty(); }
    int listsRevision() const { return m_rev[Lists]; }
    int tasksRevision() const { return m_rev[Tasks]; }
    int tagsRevision() const { return m_rev[Tags]; }

    QJsonObject task(const QString &id) const { return m_tasks.value(id); }
    bool table_has(Kind kind, const QString &id) const { return const_cast<Store *>(this)->table(kind).contains(id); }
    QJsonObject list(const QString &id) const { return m_lists.value(id); }
    QJsonObject scratchpad(const QString &id) const { return m_scratchpads.value(id); }

    // merges row over the cached one fields the event didnt carry tags subtask counts survive
    void upsert(Kind kind, const QJsonObject &row, bool merge = true);
    void upsertMany(Kind kind, const QList<QJsonObject> &rows, bool merge = true);
    void remove(Kind kind, const QString &id);
    void replaceAll(Kind kind, const QList<QJsonObject> &rows);
    // replaces the cached top level tasks of one list keeps subtasks and unsynced tmp rows
    void replaceListTasks(const QString &listId, const QList<QJsonObject> &rows, const QSet<QString> &keep);
    void replaceSubtasks(const QString &parentId, const QList<QJsonObject> &rows, const QSet<QString> &keep);
    void renameId(Kind kind, const QString &from, const QString &to);

    QList<QJsonObject> query(const QString &view, const QString &id = {}, bool includeDone = true) const;
    bool matches(const QString &view, const QString &id, const QJsonObject &t, bool includeDone) const;
    int openCount(const QString &listId) const;

    int todayCount() const;
    int overdueCount() const;
    int badgeCount() const { return todayCount() + overdueCount(); }

    Q_INVOKABLE QVariantMap taskMap(const QString &id) const;
    Q_INVOKABLE QVariantMap listMap(const QString &id) const;
    Q_INVOKABLE QVariantList tagList() const;
    Q_INVOKABLE QVariantList listList() const;
    Q_INVOKABLE int countFor(const QString &view, const QString &id = {}) const;
    Q_INVOKABLE QVariantList search(const QString &text, int limit = 20) const;

    static bool isDone(const QJsonObject &t);
    static QString str(const QJsonObject &o, const char *key);

signals:
    void userIdChanged();
    void listsChanged();
    void tasksChanged();
    void tagsChanged();
    void scratchpadsChanged();
    void countsChanged();

private:
    QHash<QString, QJsonObject> &table(Kind kind);
    static QString tableName(Kind kind);
    void markDirty(Kind kind);
    void emitDirty();

    Database *m_db;
    QString m_userId;
    QHash<QString, QJsonObject> m_lists, m_tasks, m_tags, m_scratchpads;
    QSet<Kind> m_dirty;
    bool m_emitQueued = false;
    int m_rev[4] = {};
};
