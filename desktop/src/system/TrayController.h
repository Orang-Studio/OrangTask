#pragma once

#include <QMenu>
#include <QObject>
#include <QSystemTrayIcon>

class AppController;

class TrayController : public QObject
{
    Q_OBJECT

public:
    explicit TrayController(AppController *app);

    static QIcon badgeIcon(int count, bool overdue);

private:
    void update();
    void retranslate();

    AppController *m_app;
    QSystemTrayIcon m_tray;
    QMenu m_menu;
    QAction *m_open = nullptr;
    QAction *m_quickAdd = nullptr;
    QAction *m_sticky = nullptr;
    QAction *m_sync = nullptr;
    QAction *m_quit = nullptr;
};
