#pragma once

#include <QHash>
#include <QMutex>
#include <QQuickImageProvider>

// serves bundled lucide icons tinted by query color
class IconProvider : public QQuickImageProvider
{
public:
    IconProvider();

    QImage requestImage(const QString &id, QSize *size, const QSize &requestedSize) override;

    // shared with the tray which paints outside QML
    static QImage render(const QString &name, const QColor &color, const QSize &size);

private:
    static QByteArray svgSource(const QString &name);
};
