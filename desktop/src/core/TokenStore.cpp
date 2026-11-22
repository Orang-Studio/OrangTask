#include "TokenStore.h"

#include <QDir>
#include <QEventLoop>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonObject>
#include <QStandardPaths>

#ifdef HAVE_KEYCHAIN
#include <qt6keychain/keychain.h>
#endif

static const QString kService = QStringLiteral("lt.oranges.orangtask");
static const QString kKey = QStringLiteral("session");

TokenStore::TokenStore(QObject *parent)
    : QObject(parent)
{
#ifndef HAVE_KEYCHAIN
    m_useKeychain = false;
#endif
    if (qEnvironmentVariableIsSet("ORANGTASK_NO_KEYRING"))
        m_useKeychain = false;
}

QString TokenStore::fallbackPath() const
{
    return QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation) + QStringLiteral("/session.json");
}

void TokenStore::load()
{
    QByteArray data;
#ifdef HAVE_KEYCHAIN
    if (m_useKeychain) {
        QKeychain::ReadPasswordJob job(kService);
        job.setAutoDelete(false);
        job.setKey(kKey);
        QEventLoop loop;
        connect(&job, &QKeychain::Job::finished, &loop, &QEventLoop::quit);
        job.start();
        loop.exec();
        if (job.error() == QKeychain::NoError) {
            data = job.binaryData();
        } else if (job.error() != QKeychain::EntryNotFound) {
            qWarning("orangtask: keyring unavailable (%s), using file storage", qPrintable(job.errorString()));
            m_useKeychain = false;
        }
    }
#endif
    if (data.isEmpty()) {
        QFile f(fallbackPath());
        if (f.open(QIODevice::ReadOnly))
            data = f.readAll();
    }
    const QJsonObject o = QJsonDocument::fromJson(data).object();
    m_access = o.value(QStringLiteral("access")).toString();
    m_refresh = o.value(QStringLiteral("refresh")).toString();
}

void TokenStore::setTokens(const QString &access, const QString &refresh)
{
    m_access = access;
    m_refresh = refresh;
    persist();
}

void TokenStore::setAccessToken(const QString &access)
{
    m_access = access;
    persist();
}

void TokenStore::clear()
{
    m_access.clear();
    m_refresh.clear();
#ifdef HAVE_KEYCHAIN
    if (m_useKeychain) {
        auto *job = new QKeychain::DeletePasswordJob(kService);
        job->setKey(kKey);
        job->start();
    }
#endif
    QFile::remove(fallbackPath());
}

void TokenStore::persist()
{
    const QByteArray data = QJsonDocument(QJsonObject{
        {QStringLiteral("access"), m_access},
        {QStringLiteral("refresh"), m_refresh},
    }).toJson(QJsonDocument::Compact);

#ifdef HAVE_KEYCHAIN
    if (m_useKeychain) {
        auto *job = new QKeychain::WritePasswordJob(kService);
        job->setKey(kKey);
        job->setBinaryData(data);
        connect(job, &QKeychain::Job::finished, this, [this, job, data]() {
            if (job->error() != QKeychain::NoError) {
                m_useKeychain = false;
                writeFallback(data);
            } else {
                QFile::remove(fallbackPath());
            }
        });
        job->start();
        return;
    }
#endif
    writeFallback(data);
}

void TokenStore::writeFallback(const QByteArray &data)
{
    QDir().mkpath(QFileInfo(fallbackPath()).absolutePath());
    QFile f(fallbackPath());
    if (f.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        f.setPermissions(QFileDevice::ReadOwner | QFileDevice::WriteOwner);
        f.write(data);
    }
}
