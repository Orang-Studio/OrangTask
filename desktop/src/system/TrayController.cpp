#include "TrayController.h"

#include "app/AppController.h"
#include "core/AuthManager.h"
#include "core/I18n.h"
#include "core/Settings.h"
#include "core/Store.h"
#include "core/SyncEngine.h"

#include <QFont>
#include <QPainter>
#include <QPainterPath>
#include <QSvgRenderer>

TrayController::TrayController(AppController *app)
    : QObject(app)
    , m_app(app)
{
    m_open = m_menu.addAction(QString(), app, &AppController::showMain);
    m_quickAdd = m_menu.addAction(QString(), app, &AppController::showQuickAdd);
    m_sticky = m_menu.addAction(QString(), app, [app](bool on) { app->setStickyShown(on); });
    m_sticky->setCheckable(true);
    m_menu.addSeparator();
    m_sync = m_menu.addAction(QString(), app->sync(), &SyncEngine::refresh);
    m_menu.addSeparator();
    m_quit = m_menu.addAction(QString(), app, &AppController::quit);
    connect(&m_menu, &QMenu::aboutToShow, this, [this]() {
        m_sticky->setChecked(m_app->stickyVisible());
        const bool in = m_app->auth()->state() == AuthManager::LoggedIn;
        m_quickAdd->setEnabled(in);
        m_sticky->setEnabled(in);
        m_sync->setEnabled(in);
    });
    m_tray.setContextMenu(&m_menu);

    connect(&m_tray, &QSystemTrayIcon::activated, this, [this](QSystemTrayIcon::ActivationReason reason) {
        switch (reason) {
        case QSystemTrayIcon::Trigger:
            m_app->togglePopup();
            break;
        case QSystemTrayIcon::MiddleClick:
            if (m_app->auth()->state() == AuthManager::LoggedIn)
                m_app->showQuickAdd();
            else
                m_app->showMain();
            break;
        case QSystemTrayIcon::DoubleClick:
            m_app->showMain();
            break;
        default:
            break;
        }
    });

    connect(app->store(), &Store::countsChanged, this, &TrayController::update);
    connect(app->settings(), &Settings::badgeEnabledChanged, this, &TrayController::update);
    connect(app->auth(), &AuthManager::stateChanged, this, &TrayController::update);
    connect(app->i18n(), &I18n::languageChanged, this, &TrayController::retranslate);
    retranslate();
    m_tray.show();
}

void TrayController::retranslate()
{
    I18n *i = m_app->i18n();
    m_open->setText(i->t(QStringLiteral("desktop.tray.open")));
    m_quickAdd->setText(i->t(QStringLiteral("desktop.tray.quickAdd")));
    m_sticky->setText(i->t(QStringLiteral("desktop.tray.sticky")));
    m_sync->setText(i->t(QStringLiteral("desktop.tray.syncNow")));
    m_quit->setText(i->t(QStringLiteral("desktop.tray.quit")));
    update();
}

void TrayController::update()
{
    Store *s = m_app->store();
    const bool in = m_app->auth()->state() == AuthManager::LoggedIn;
    const int today = in ? s->todayCount() : 0;
    const int overdue = in ? s->overdueCount() : 0;
    const bool badge = m_app->settings()->badgeEnabled();
    m_tray.setIcon(badgeIcon(badge ? today + overdue : 0, overdue > 0));

    I18n *i = m_app->i18n();
    QString tip = QStringLiteral("OrangTask");
    if (in) {
        tip += QLatin1Char('\n') + i->tc(QStringLiteral("desktop.tray.dueToday"), today);
        if (overdue > 0)
            tip += QLatin1Char('\n') + i->tc(QStringLiteral("desktop.tray.overdue"), overdue);
    }
    m_tray.setToolTip(tip);
}

QIcon TrayController::badgeIcon(int count, bool overdue)
{
    static QSvgRenderer logo(QStringLiteral(":/qt/qml/OrangTask/assets/logo.svg"));
    QIcon icon;
    for (int size : {16, 22, 24, 32, 48, 64}) {
        QPixmap pm(size, size);
        pm.fill(Qt::transparent);
        QPainter p(&pm);
        p.setRenderHint(QPainter::Antialiasing);
        logo.render(&p, QRectF(0, 0, size, size));
        if (count > 0) {
            const QString text = count > 99 ? QStringLiteral("99") : QString::number(count);
            const qreal h = size * 0.56;
            const qreal w = text.size() > 1 ? h * 1.3 : h;
            const QRectF r(size - w, size - h, w, h);
            QPainterPath path;
            path.addRoundedRect(r, h / 2, h / 2);
            p.fillPath(path, overdue ? QColor(0xef, 0x44, 0x44) : QColor(0x0f, 0x0f, 0x0f));
            p.setPen(QPen(Qt::white, qMax(1.0, size / 32.0)));
            p.drawPath(path);
            QFont f(QStringLiteral("DM Sans"));
            f.setBold(true);
            f.setPixelSize(qRound(h * 0.72));
            p.setFont(f);
            p.drawText(r, Qt::AlignCenter, text);
        }
        p.end();
        icon.addPixmap(pm);
    }
    return icon;
}
