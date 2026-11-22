#include "RealtimeClient.h"
#include "TokenStore.h"

#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkRequest>
#include <QRandomGenerator>

RealtimeClient::RealtimeClient(const QString &baseUrl, TokenStore *tokens, QObject *parent)
    : QObject(parent)
    , m_baseUrl(baseUrl)
    , m_tokens(tokens)
{
    m_ping.setInterval(25000);
    connect(&m_ping, &QTimer::timeout, this, [this]() {
        m_ws.sendTextMessage(QStringLiteral("{\"type\":\"ping\"}"));
    });
    m_reconnect.setSingleShot(true);
    connect(&m_reconnect, &QTimer::timeout, this, &RealtimeClient::open);

    connect(&m_ws, &QWebSocket::disconnected, this, &RealtimeClient::onDisconnected);
    connect(&m_ws, &QWebSocket::textMessageReceived, this, [this](const QString &text) {
        const QJsonObject msg = QJsonDocument::fromJson(text.toUtf8()).object();
        const QString type = msg.value(QStringLiteral("type")).toString();
        if (type == QLatin1String("pong"))
            return;
        if (type == QLatin1String("connected")) {
            m_attempt = 0;
            setConnected(true);
            m_ping.start();
            return;
        }
        emit event(type, msg.value(QStringLiteral("data")));
    });
}

void RealtimeClient::start()
{
    m_wanted = true;
    m_attempt = 0;
    m_reconnect.stop();
    if (m_ws.state() != QAbstractSocket::UnconnectedState)
        m_ws.abort();
    open();
}

void RealtimeClient::stop()
{
    m_wanted = false;
    m_reconnect.stop();
    m_ping.stop();
    m_ws.close();
    setConnected(false);
}

void RealtimeClient::open()
{
    if (!m_wanted || m_tokens->accessToken().isEmpty())
        return;
    QString url = m_baseUrl;
    if (url.startsWith(QLatin1String("https://")))
        url.replace(0, 5, QStringLiteral("wss"));
    else if (url.startsWith(QLatin1String("http://")))
        url.replace(0, 4, QStringLiteral("ws"));
    QNetworkRequest req(QUrl(url + QStringLiteral("/ws")));
    req.setRawHeader("Authorization", "Bearer " + m_tokens->accessToken().toUtf8());
    req.setRawHeader("X-Platform", "desktop");
    m_ws.open(req);
}

void RealtimeClient::onDisconnected()
{
    m_ping.stop();
    setConnected(false);
    if (!m_wanted)
        return;
    if (m_ws.closeCode() == QWebSocketProtocol::CloseCodePolicyViolated) {
        emit unauthorized();
        return;
    }
    static const int steps[] = {1000, 2000, 5000, 10000, 30000, 60000};
    const int base = steps[qMin(m_attempt, int(std::size(steps)) - 1)];
    ++m_attempt;
    m_reconnect.start(base + int(QRandomGenerator::global()->bounded(base / 4 + 1)));
}

void RealtimeClient::setConnected(bool c)
{
    if (m_connected == c)
        return;
    m_connected = c;
    emit connectedChanged(c);
}
