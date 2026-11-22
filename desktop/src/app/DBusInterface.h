#pragma once

#include <QObject>
#include <QStringList>

class AppController;

// lt oranges orangtask App at app a second orangtask process forwards its arguments here and global shortcuts can call it with qdbus
class DBusInterface : public QObject
{
    Q_OBJECT
    Q_CLASSINFO("D-Bus Interface", "lt.oranges.orangtask.App")

public:
    explicit DBusInterface(AppController *app);

public slots:
    void Activate(const QStringList &args);
    void ShowWindow();
    void TogglePopup();
    void QuickAdd();
    void ToggleSticky();
    void OpenTask(const QString &id);
    void KWinReply(const QString &tag, const QString &value);

private:
    AppController *m_app;
};
