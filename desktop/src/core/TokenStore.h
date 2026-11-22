#pragma once

#include <QObject>

class TokenStore : public QObject
{
    Q_OBJECT

public:
    explicit TokenStore(QObject *parent = nullptr);

    void load();                                     // blocking, call once at startup
    QString accessToken() const { return m_access; }
    QString refreshToken() const { return m_refresh; }
    bool hasSession() const { return !m_refresh.isEmpty(); }

    void setTokens(const QString &access, const QString &refresh);
    void setAccessToken(const QString &access);
    void clear();

private:
    void persist();
    QString fallbackPath() const;
    void writeFallback(const QByteArray &data);

    QString m_access;
    QString m_refresh;
    bool m_useKeychain = true;
};
