#include "DBusInterface.h"

#include "AppController.h"

DBusInterface::DBusInterface(AppController *app)
    : QObject(app)
    , m_app(app)
{
}

void DBusInterface::Activate(const QStringList &args)
{
    m_app->handleArgs(args);
}

void DBusInterface::ShowWindow()
{
    m_app->showMain();
}

void DBusInterface::TogglePopup()
{
    m_app->togglePopup();
}

void DBusInterface::QuickAdd()
{
    m_app->showQuickAdd();
}

void DBusInterface::ToggleSticky()
{
    m_app->toggleSticky();
}

void DBusInterface::OpenTask(const QString &id)
{
    m_app->openTask(id);
}

void DBusInterface::KWinReply(const QString &tag, const QString &value)
{
    m_app->kwinReply(tag, value);
}
