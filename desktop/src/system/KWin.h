#pragma once

#include <QString>

// runs JavaScript inside KWin Plasma Wayland
namespace KWin {

bool available();

bool run(const QString &name, const QString &source, bool keep = false);
void unload(const QString &name);

QString reply(const QString &tag, const QString &valueExpr);

} // namespace KWin
