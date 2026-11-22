#pragma once

#include <QPoint>
#include <QRect>
#include <QString>

#include <optional>

class QWindow;

namespace WindowPlacer {

enum Kind { Popup, QuickAdd, Sticky };

bool layerShellAvailable();
bool usesLayerShell(Kind kind);

void prepare(QWindow *w, Kind kind);

// places floating window near pointer or chosen screen corner
void place(QWindow *w, Kind kind, const QString &corner, std::optional<QPoint> cursor = {});

QPoint stickyOffset(QWindow *w);
void setStickyOffset(QWindow *w, const QPoint &offset);

QString resolveCorner(const QString &corner, QWindow *w);

} // namespace WindowPlacer
