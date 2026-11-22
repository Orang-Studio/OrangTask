#pragma once

#include <QDateTime>
#include <QObject>

class Format : public QObject
{
    Q_OBJECT

public:
    explicit Format(QObject *parent = nullptr);

    static QDateTime parse(const QString &iso);
    static QString toIso(const QDateTime &dt);

    Q_INVOKABLE static QString dueLabel(const QString &iso);
    Q_INVOKABLE static bool isOverdue(const QString &iso);
    Q_INVOKABLE static bool isToday(const QString &iso);
    Q_INVOKABLE static QString relative(const QString &iso);
    Q_INVOKABLE static QString toLocalInput(const QString &iso);
    Q_INVOKABLE static QString fromLocalInput(const QString &local);
    Q_INVOKABLE static QString timeLabel(const QString &iso);

    static int dayDiff(const QDateTime &dt, const QDateTime &now = QDateTime::currentDateTime());
};
