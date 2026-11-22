#pragma once

#include <QJsonValue>
#include <QObject>
#include <QTimer>
#include <QWebSocket>

class TokenStore;

// websocket live updates with 25s ping and backoff reconnect
class RealtimeClient : public QObject
{
    Q_OBJECT

public:
    RealtimeClient(const QString &baseUrl, TokenStore *tokens, QObject *parent = nullptr);

    void start();
    void stop();
    bool isConnected() const { return m_connected; }

signals:
    void connectedChanged(bool connected);
    void event(const QString &type, const QJsonValue &data);
    void unauthorized();

private:
    void open();
    void onDisconnected();
    void setConnected(bool c);

    QString m_baseUrl;
    TokenStore *m_tokens;
    QWebSocket m_ws;
    QTimer m_ping;
    QTimer m_reconnect;
    bool m_wanted = false;
    bool m_connected = false;
    int m_attempt = 0;
};
