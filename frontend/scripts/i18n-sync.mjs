#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoDir = path.resolve(frontendDir, '..')
const webLocaleDir = path.join(frontendDir, 'src/lib/i18n')
const androidResourceDir = path.join(repoDir, 'android/app/src/main/res')
const baseUrl = (process.env.WEBLATE_URL ?? 'https://oranges.lt/translate').replace(/\/$/, '')
const locales = (process.env.WEBLATE_LOCALES ?? 'lt')
  .split(',')
  .map((locale) => locale.trim().toLowerCase())
  .filter(Boolean)

function checkJsonCatalogues() {
  const english = JSON.parse(readFileSync(path.join(webLocaleDir, 'en.json'), 'utf8'))
  const englishKeys = new Set(Object.keys(english))
  const files = readdirSync(webLocaleDir).filter((file) => file.endsWith('.json'))

  for (const file of files) {
    const locale = JSON.parse(readFileSync(path.join(webLocaleDir, file), 'utf8'))
    if (locale === null || Array.isArray(locale) || typeof locale !== 'object') {
      throw new Error(`${file}: expected a flat JSON object`)
    }
    const stale = Object.keys(locale).filter((key) => !englishKeys.has(key))
    if (stale.length > 0) {
      throw new Error(`${file}: stale keys: ${stale.join(', ')}`)
    }
  }

  const resourceDirs = readdirSync(androidResourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('values-'))
  for (const directory of resourceDirs) {
    const file = path.join(androidResourceDir, directory.name, 'strings.xml')
    if (!existsSync(file)) continue
    const xml = readFileSync(file, 'utf8')
    if (!/<resources[\s>]/.test(xml) || !/<\/resources>/.test(xml)) {
      throw new Error(`${directory.name}/strings.xml: invalid resources wrapper`)
    }
  }

  console.log(`i18n check passed: ${files.length} web catalogues`)
}

async function download(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`)
  }
  return response.text()
}

async function pull() {
  for (const locale of locales) {
    if (locale === 'en') continue

    const webUrl = `${baseUrl}/download/orangtask/web-client/${locale}/`
    const webJson = JSON.parse(await download(webUrl))
    const webPath = path.join(webLocaleDir, `${locale}.json`)
    writeFileSync(webPath, `${JSON.stringify(webJson, null, 2)}\n`)
    console.log(`${webUrl} -> ${path.relative(repoDir, webPath)}`)

    const androidUrl = `${baseUrl}/download/orangtask/android-app/${locale}/`
    const androidXml = await download(androidUrl)
    const androidDir = path.join(androidResourceDir, `values-${locale}`)
    mkdirSync(androidDir, { recursive: true })
    const androidPath = path.join(androidDir, 'strings.xml')
    writeFileSync(androidPath, androidXml)
    console.log(`${androidUrl} -> ${path.relative(repoDir, androidPath)}`)
  }
}

try {
  if (process.argv.includes('--check')) checkJsonCatalogues()
  else await pull()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
