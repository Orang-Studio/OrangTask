#pragma once

#include <QHash>
#include <QObject>
#include <QVariantMap>

// runtime catalog lookup mirroring frontend src lib i18n flat keys name placeholders and _one _few _many _other plural suffixes
class I18n : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString language READ language NOTIFY languageChanged)
    Q_PROPERTY(QString preference READ preference WRITE setPreference NOTIFY languageChanged)
    Q_PROPERTY(QStringList languages READ languages CONSTANT)
    Q_PROPERTY(int revision READ revision NOTIFY languageChanged)

public:
    explicit I18n(QObject *parent = nullptr);

    static I18n *instance();

    QString language() const { return m_lang; }
    QString preference() const { return m_pref; }
    void setPreference(const QString &pref);
    QStringList languages() const;
    int revision() const { return m_revision; }

    Q_INVOKABLE QString t(const QString &key, const QVariantMap &vars = {}) const;
    Q_INVOKABLE QString tc(const QString &key, int count, const QVariantMap &vars = {}) const;
    Q_INVOKABLE QString endonym(const QString &lang) const;

    static QString pluralCategory(const QString &lang, int n);

signals:
    void languageChanged();

private:
    QString lookup(const QString &key) const;
    static QString interpolate(QString str, const QVariantMap &vars);
    void load(const QString &lang);

    QHash<QString, QHash<QString, QString>> m_catalogs;
    QString m_lang = QStringLiteral("en");
    QString m_pref = QStringLiteral("system");
    int m_revision = 0;
};

inline QString tr_(const char *key, const QVariantMap &vars = {})
{
    return I18n::instance()->t(QString::fromLatin1(key), vars);
}
