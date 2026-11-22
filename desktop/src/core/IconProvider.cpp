#include "IconProvider.h"

#include <QColor>
#include <QFile>
#include <QPainter>
#include <QSvgRenderer>
#include <QUrlQuery>

IconProvider::IconProvider()
    : QQuickImageProvider(QQuickImageProvider::Image)
{
}

QByteArray IconProvider::svgSource(const QString &name)
{
    static QMutex mutex;
    static QHash<QString, QByteArray> cache;
    QMutexLocker lock(&mutex);
    auto it = cache.constFind(name);
    if (it != cache.constEnd())
        return *it;
    QFile f(QStringLiteral(":/qt/qml/OrangTask/assets/icons/lucide/%1.svg").arg(name));
    QByteArray data;
    if (f.open(QIODevice::ReadOnly))
        data = f.readAll();
    else if (name != QLatin1String("list"))
        data = svgSource(QStringLiteral("list"));      // unknown list icon keys fall back like the web
    cache.insert(name, data);
    return data;
}

QImage IconProvider::render(const QString &name, const QColor &color, const QSize &size)
{
    QByteArray svg = svgSource(name);
    svg.replace("currentColor", color.name(QColor::HexRgb).toLatin1());
    QImage img(size.isValid() ? size : QSize(24, 24), QImage::Format_ARGB32_Premultiplied);
    img.fill(Qt::transparent);
    QSvgRenderer renderer(svg);
    if (renderer.isValid()) {
        QPainter p(&img);
        p.setRenderHint(QPainter::Antialiasing);
        p.setOpacity(color.alphaF());
        renderer.render(&p);
    }
    return img;
}

QImage IconProvider::requestImage(const QString &id, QSize *size, const QSize &requestedSize)
{
    const int q = id.indexOf(QLatin1Char('?'));
    const QString name = q < 0 ? id : id.left(q);
    QColor color(QStringLiteral("#161616"));
    if (q >= 0) {
        const QUrlQuery query(id.mid(q + 1));
        const QColor c(query.queryItemValue(QStringLiteral("color"), QUrl::FullyDecoded));
        if (c.isValid())
            color = c;
    }
    const QSize want(requestedSize.width() > 0 ? requestedSize.width() : 24,
                     requestedSize.height() > 0 ? requestedSize.height() : 24);
    if (size)
        *size = want;
    return render(name, color, want);
}
