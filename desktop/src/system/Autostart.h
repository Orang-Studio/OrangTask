#pragma once

#include <QObject>

// manages xdg autostart desktop entry
class Autostart : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool enabled READ enabled WRITE setEnabled NOTIFY enabledChanged)

public:
    explicit Autostart(QObject *parent = nullptr);

    bool enabled() const;
    void setEnabled(bool on);

signals:
    void enabledChanged();

private:
    static QString path();
};
