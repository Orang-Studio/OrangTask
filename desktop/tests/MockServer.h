#pragma once

#include <QJsonDocument>
#include <QJsonObject>
#include <QTcpServer>
#include <QTcpSocket>
#include <functional>

// minimal local http server for testing api client
class MockServer : public QObject
{
public:
    struct Request
    {
        QByteArray method;
        QString path;
        QJsonObject body;
    };
    struct Reply
    {
        int status = 200;
        QJsonObject json;
    };

    std::function<Reply(const Request &)> handler = [](const Request &) { return Reply{}; };
    QList<Request> requests;

    MockServer()
    {
        m_server.listen(QHostAddress::LocalHost);
        connect(&m_server, &QTcpServer::newConnection, this, [this]() {
            while (QTcpSocket *s = m_server.nextPendingConnection()) {
                connect(s, &QTcpSocket::readyRead, this, [this, s]() { serve(s); });
                connect(s, &QTcpSocket::disconnected, s, &QObject::deleteLater);
            }
        });
    }

    QString baseUrl() const { return QStringLiteral("http://127.0.0.1:%1").arg(m_server.serverPort()); }
    QStringList calls() const
    {
        QStringList out;
        for (const Request &r : requests)
            out << QString::fromLatin1(r.method) + QLatin1Char(' ') + r.path;
        return out;
    }

private:
    void serve(QTcpSocket *s)
    {
        QByteArray &buf = m_buffers[s];
        buf += s->readAll();
        for (;;) {
            const int headerEnd = buf.indexOf("\r\n\r\n");
            if (headerEnd < 0)
                return;
            const QList<QByteArray> lines = buf.left(headerEnd).split('\n');
            int length = 0;
            for (const QByteArray &line : lines) {
                if (line.toLower().startsWith("content-length:"))
                    length = line.mid(15).trimmed().toInt();
            }
            if (buf.size() < headerEnd + 4 + length)
                return;
            const QList<QByteArray> start = lines.first().trimmed().split(' ');
            Request req{start.value(0), QString::fromLatin1(start.value(1)),
                        QJsonDocument::fromJson(buf.mid(headerEnd + 4, length)).object()};
            buf.remove(0, headerEnd + 4 + length);
            requests.append(req);

            const Reply reply = handler(req);
            const QByteArray body = QJsonDocument(reply.json).toJson(QJsonDocument::Compact);
            s->write("HTTP/1.1 " + QByteArray::number(reply.status) + " X\r\n"
                     "Content-Type: application/json\r\n"
                     "Content-Length: " + QByteArray::number(body.size()) + "\r\n\r\n" + body);
        }
    }

    QTcpServer m_server;
    QHash<QTcpSocket *, QByteArray> m_buffers;
};
