#include "I18n.h"

#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLocale>
#include <QRegularExpression>

static I18n *s_instance = nullptr;

static QHash<QString, QString> readCatalog(const QString &path)
{
    QHash<QString, QString> out;
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly))
        return out;
    const QJsonObject obj = QJsonDocument::fromJson(f.readAll()).object();
    for (auto it = obj.begin(); it != obj.end(); ++it) {
        if (it.value().isString())
            out.insert(it.key(), it.value().toString());
    }
    return out;
}

I18n::I18n(QObject *parent)
    : QObject(parent)
{
    s_instance = this;
    for (const QString &lang : {QStringLiteral("en"), QStringLiteral("lt")})
        load(lang);
    setPreference(QStringLiteral("system"));
}

I18n *I18n::instance()
{
    if (!s_instance)
        s_instance = new I18n();
    return s_instance;
}

void I18n::load(const QString &lang)
{
    QHash<QString, QString> cat = readCatalog(QStringLiteral(":/i18n/%1.json").arg(lang));
    const QHash<QString, QString> desktop = readCatalog(QStringLiteral(":/i18n/desktop/%1.json").arg(lang));
    for (auto it = desktop.begin(); it != desktop.end(); ++it)
        cat.insert(it.key(), it.value());
    if (!cat.isEmpty())
        m_catalogs.insert(lang, cat);
}

QStringList I18n::languages() const
{
    QStringList langs = m_catalogs.keys();
    langs.sort();
    return langs;
}

void I18n::setPreference(const QString &pref)
{
    QString lang = QStringLiteral("en");
    if (pref != QLatin1String("system")) {
        lang = m_catalogs.contains(pref) ? pref : QStringLiteral("en");
    } else {
        for (const QString &ui : QLocale::system().uiLanguages()) {
            const QString code = ui.section(QLatin1Char('-'), 0, 0).section(QLatin1Char('_'), 0, 0).toLower();
            if (m_catalogs.contains(code)) {
                lang = code;
                break;
            }
        }
    }
    if (pref == m_pref && lang == m_lang && m_revision > 0)
        return;
    m_pref = pref;
    m_lang = lang;
    QLocale::setDefault(QLocale(lang == QLatin1String("lt") ? QStringLiteral("lt_LT") : QStringLiteral("en_US")));
    ++m_revision;
    emit languageChanged();
}

QString I18n::lookup(const QString &key) const
{
    const auto cur = m_catalogs.constFind(m_lang);
    if (cur != m_catalogs.constEnd()) {
        const auto it = cur->constFind(key);
        if (it != cur->constEnd() && !it->isEmpty())
            return *it;
    }
    const auto en = m_catalogs.constFind(QStringLiteral("en"));
    if (en != m_catalogs.constEnd()) {
        const auto it = en->constFind(key);
        if (it != en->constEnd())
            return *it;
    }
    return QString();
}

QString I18n::interpolate(QString str, const QVariantMap &vars)
{
    for (auto it = vars.begin(); it != vars.end(); ++it)
        str.replace(QLatin1Char('{') + it.key() + QLatin1Char('}'), it.value().toString());
    return str;
}

QString I18n::t(const QString &key, const QVariantMap &vars) const
{
    const QString s = lookup(key);
    return interpolate(s.isNull() ? key : s, vars);
}

// cLDR cardinal rules for integers for the languages we ship
QString I18n::pluralCategory(const QString &lang, int n)
{
    const int abs = n < 0 ? -n : n;
    if (lang == QLatin1String("lt")) {
        const int m10 = abs % 10, m100 = abs % 100;
        if (m10 == 1 && !(m100 >= 11 && m100 <= 19))
            return QStringLiteral("one");
        if (m10 >= 2 && m10 <= 9 && !(m100 >= 11 && m100 <= 19))
            return QStringLiteral("few");
        return QStringLiteral("other");
    }
    return abs == 1 ? QStringLiteral("one") : QStringLiteral("other");
}

QString I18n::tc(const QString &key, int count, const QVariantMap &vars) const
{
    static const char *cats[] = {"zero", "one", "two", "few", "many", "other"};
    const QString category = pluralCategory(m_lang, count);
    QString str;
    for (const char *cat : cats) {
        const QString candidate = lookup(key + QLatin1Char('_') + QLatin1String(cat));
        if (!candidate.isNull()) {
            str = candidate;
            if (category == QLatin1String(cat))
                break;
        }
    }
    if (str.isEmpty())
        str = key;
    QVariantMap all = vars;
    all.insert(QStringLiteral("count"), count);
    return interpolate(str, all);
}

QString I18n::endonym(const QString &lang) const
{
    QString name = QLocale(lang).nativeLanguageName();
    if (name.isEmpty())
        return lang;
    name[0] = name[0].toUpper();
    return name;
}
