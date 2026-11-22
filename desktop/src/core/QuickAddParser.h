#pragma once

#include <QDateTime>
#include <QObject>
#include <QVariantMap>

// parses priority recurrence and due date from quick add text
struct ParsedQuickAdd
{
    QString title;
    QDateTime dueAt;               // invalid when no date was found
    QString priority = QStringLiteral("none");
    QString recurrenceRule;
};

class QuickAddParser : public QObject
{
    Q_OBJECT

public:
    explicit QuickAddParser(QObject *parent = nullptr);

    static ParsedQuickAdd parse(const QString &input, const QDateTime &now = QDateTime::currentDateTime());

    Q_INVOKABLE QVariantMap preview(const QString &input) const;
};
