#include "WindowPlacer.h"
#include "KWin.h"

#include <QCursor>
#include <QGuiApplication>
#include <QScreen>
#include <QWindow>

#ifdef HAVE_LAYERSHELL
#include <LayerShellQt/Window>
#endif

namespace WindowPlacer {

static constexpr int Gap = 8;

static bool isWayland()
{
    return QGuiApplication::platformName().startsWith(QLatin1String("wayland"));
}

bool layerShellAvailable()
{
#ifdef HAVE_LAYERSHELL
    return isWayland();
#else
    return false;
#endif
}

bool usesLayerShell(Kind kind)
{
    return layerShellAvailable() && (kind != Sticky || !KWin::available());
}

static QScreen *screenFor(QWindow *w, std::optional<QPoint> cursor = {})
{
    if (cursor) {
        if (QScreen *s = QGuiApplication::screenAt(*cursor))
            return s;
    }
    return w->screen() ? w->screen() : QGuiApplication::primaryScreen();
}

QString resolveCorner(const QString &corner, QWindow *w)
{
    if (corner != QLatin1String("auto") && !corner.isEmpty())
        return corner;
    // the panel is wherever the available area is smaller than the screen
    QScreen *s = screenFor(w);
    if (!s)
        return QStringLiteral("bottom-right");
    const QRect full = s->geometry();
    const QRect avail = s->availableGeometry();
    const bool top = avail.top() > full.top();
    const bool left = avail.left() > full.left() && avail.width() < full.width();
    return QStringLiteral("%1-%2").arg(top ? QStringLiteral("top") : QStringLiteral("bottom"),
                                        left ? QStringLiteral("left") : QStringLiteral("right"));
}

void prepare(QWindow *w, Kind kind)
{
#ifdef HAVE_LAYERSHELL
    if (usesLayerShell(kind)) {
        auto *ls = LayerShellQt::Window::get(w);
        ls->setLayer(kind == Sticky ? LayerShellQt::Window::LayerTop : LayerShellQt::Window::LayerOverlay);
        // on demand not Exclusive so clicking elsewhere deactivates the popup
        ls->setKeyboardInteractivity(LayerShellQt::Window::KeyboardInteractivityOnDemand);
        ls->setExclusiveZone(0);
        ls->setScope(kind == Popup      ? QStringLiteral("orangtask-popup")
                     : kind == Sticky   ? QStringLiteral("orangtask-sticky")
                                        : QStringLiteral("orangtask-quickadd"));
        return;
    }
#endif
    Qt::WindowFlags flags = Qt::FramelessWindowHint | Qt::WindowStaysOnTopHint;
    flags |= kind == Sticky ? Qt::Tool : (Qt::Tool | Qt::NoDropShadowWindowHint);
    w->setFlags(w->flags() | flags);
}

// just above the pointer horizontally centred pushed inside the work area
static QPoint around(const QPoint &at, const QSize &size, const QRect &avail)
{
    return QPoint(qBound(avail.left() + Gap, at.x() - size.width() / 2, avail.right() - size.width() - Gap),
                  qBound(avail.top() + Gap, at.y() - size.height() - Gap, avail.bottom() - size.height() - Gap));
}

void place(QWindow *w, Kind kind, const QString &cornerSetting, std::optional<QPoint> cursor)
{
    if (!cursor && !isWayland())
        cursor = QCursor::pos();
    QScreen *screen = screenFor(w, cursor);
    if (screen && w->screen() != screen)
        w->setScreen(screen);
    const QString corner = resolveCorner(cornerSetting, w);
    const bool top = corner.startsWith(QLatin1String("top"));
    const bool left = corner.endsWith(QLatin1String("left"));
    const bool atCursor = kind == Popup && cursor && screen
        && (cornerSetting.isEmpty() || cornerSetting == QLatin1String("auto"));

#ifdef HAVE_LAYERSHELL
    if (usesLayerShell(kind)) {
        auto *ls = LayerShellQt::Window::get(w);
        using A = LayerShellQt::Window;
        // the layer surface takes its output from here not QWindow screen on the first show the platform window already exists by then
        if (screen)
            ls->setScreen(screen);
        if (atCursor) {
            // margins from the outputs own corner zone 1 ignores panels
            const QPoint p = around(*cursor, w->size(), screen->availableGeometry()) - screen->geometry().topLeft();
            ls->setAnchors(A::Anchors(A::AnchorTop | A::AnchorLeft));
            ls->setExclusiveZone(-1);
            ls->setMargins(QMargins(p.x(), p.y(), 0, 0));
        } else if (kind == Popup) {
            ls->setExclusiveZone(0);
            A::Anchors anchors;
            anchors |= top ? A::AnchorTop : A::AnchorBottom;
            anchors |= left ? A::AnchorLeft : A::AnchorRight;
            ls->setAnchors(anchors);
            ls->setMargins(QMargins(Gap, Gap, Gap, Gap));
        } else if (kind == QuickAdd) {
            ls->setAnchors(A::Anchors(A::AnchorTop));
            const int h = screen ? screen->geometry().height() : 1000;
            ls->setMargins(QMargins(0, h / 5, 0, 0));
        } else {
            ls->setAnchors(A::Anchors(A::AnchorTop | A::AnchorRight));
        }
        return;
    }
#endif
    if (!screen || isWayland())
        return;

    const QRect avail = screen->availableGeometry();
    const QSize size = w->size();
    QPoint pos;
    if (kind == QuickAdd) {
        pos = QPoint(avail.center().x() - size.width() / 2, avail.top() + avail.height() / 5);
    } else if (kind == Sticky) {
        return;
    } else if (atCursor) {
        pos = around(*cursor, size, avail);
    } else {
        pos.setX(left ? avail.left() + Gap : avail.right() - size.width() - Gap);
        pos.setY(top ? avail.top() + Gap : avail.bottom() - size.height() - Gap);
    }
    pos.setX(qBound(avail.left() + Gap, pos.x(), avail.right() - size.width() - Gap));
    pos.setY(qBound(avail.top() + Gap, pos.y(), avail.bottom() - size.height() - Gap));
    w->setPosition(pos);
}

QPoint stickyOffset(QWindow *w)
{
#ifdef HAVE_LAYERSHELL
    if (usesLayerShell(Sticky)) {
        const QMargins m = LayerShellQt::Window::get(w)->margins();
        return QPoint(m.right(), m.top());
    }
#endif
    QScreen *s = w->screen() ? w->screen() : QGuiApplication::primaryScreen();
    const QRect g = s->availableGeometry();
    return QPoint(g.right() - w->geometry().right(), w->y() - g.top());
}

void setStickyOffset(QWindow *w, const QPoint &offset)
{
    QScreen *s = w->screen() ? w->screen() : QGuiApplication::primaryScreen();
    const QRect g = s ? s->availableGeometry() : QRect(0, 0, 1920, 1080);
    const int x = qBound(0, offset.x(), qMax(0, g.width() - w->width()));
    const int y = qBound(0, offset.y(), qMax(0, g.height() - w->height()));
#ifdef HAVE_LAYERSHELL
    if (usesLayerShell(Sticky)) {
        LayerShellQt::Window::get(w)->setMargins(QMargins(0, y, x, 0));
        return;
    }
#endif
    w->setPosition(g.right() - x - w->width() + 1, g.top() + y);
}

} // namespace WindowPlacer
