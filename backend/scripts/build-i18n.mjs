#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoDir = path.resolve(backendDir, '..')
const resourceDir = path.join(repoDir, 'android/app/src/main/res')
const outputDir = path.join(backendDir, 'i18n/android')

function canonicalPart(part, index) {
  if (index === 0) return part.toLowerCase()
  if (/^[A-Za-z]{4}$/.test(part)) return part[0].toUpperCase() + part.slice(1).toLowerCase()
  if (/^(?:[A-Za-z]{2}|\d{3})$/.test(part)) return part.toUpperCase()
  return part.toLowerCase()
}

export function codeFromResourceDirectory(directory) {
  if (directory === 'values') return 'en'
  if (!directory.startsWith('values-')) return null

  const qualifier = directory.slice('values-'.length)
  let parts
  if (qualifier.startsWith('b+')) {
    parts = qualifier.slice(2).split('+')
  } else {
    const qualifiers = qualifier.split('-')
    if (!/^[A-Za-z]{2,3}$/.test(qualifiers[0] ?? '')) return null
    parts = [qualifiers[0]]
    if (/^r(?:[A-Za-z]{2}|\d{3})$/.test(qualifiers[1] ?? '')) {
      parts.push(qualifiers[1].slice(1))
    } else if (/^[A-Za-z]{4}$/.test(qualifiers[1] ?? '')) {
      parts.push(qualifiers[1])
    }
  }

  if (parts.length === 0 || parts.some((part) => part.length === 0)) return null
  const tag = parts.map(canonicalPart).join('-')
  try {
    return Intl.getCanonicalLocales(tag)[0]
  } catch {
    return null
  }
}

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function decodeAndroidEscapes(value) {
  return value.replace(/\\(u[0-9a-fA-F]{4}|n|r|t|'|"|\\)/g, (match, escape) => {
    if (escape.startsWith('u')) return String.fromCharCode(Number.parseInt(escape.slice(1), 16))
    if (escape === 'n') return '\n'
    if (escape === 'r') return '\r'
    if (escape === 't') return '\t'
    if (escape === "'") return "'"
    if (escape === '"') return '"'
    if (escape === '\\') return '\\'
    return match
  })
}

export function parseStringsXml(xml, source = 'strings.xml') {
  if (/&(?:apos|quot);/.test(xml)) {
    throw new Error(`${source}: use Android escapes \\' and \\" instead of &apos; or &quot;`)
  }

  const strings = {}
  const stringPattern = /<string\b([^>]*)>([\s\S]*?)<\/string>/g
  for (const match of xml.matchAll(stringPattern)) {
    const attributes = match[1]
    if (/\btranslatable\s*=\s*(["'])false\1/.test(attributes)) continue
    const name = attributes.match(/\bname\s*=\s*(["'])(.*?)\1/)?.[2]
    if (!name) throw new Error(`${source}: <string> is missing a name attribute`)
    strings[name] = decodeAndroidEscapes(decodeXml(match[2].trim()))
  }
  return Object.fromEntries(Object.entries(strings).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
}

function endonym(code) {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
    const characters = [...name]
    return (characters.shift()?.toLocaleUpperCase(code) ?? '') + characters.join('')
  } catch {
    return code
  }
}

function revision(strings) {
  return createHash('sha1').update(JSON.stringify(Object.entries(strings))).digest('hex')
}

function build() {
  mkdirSync(outputDir, { recursive: true })
  const directories = readdirSync(resourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ directory: entry.name, code: codeFromResourceDirectory(entry.name) }))
    .filter(({ directory, code }) => code !== null && existsSync(path.join(resourceDir, directory, 'strings.xml')))
    .sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0)

  for (const { directory, code } of directories) {
    const source = path.join(resourceDir, directory, 'strings.xml')
    const strings = parseStringsXml(readFileSync(source, 'utf8'), path.relative(repoDir, source))
    const catalog = { code, endonym: endonym(code), rev: revision(strings), strings }
    const destination = path.join(outputDir, `${code}.json`)
    writeFileSync(destination, `${JSON.stringify(catalog, null, 2)}\n`)
    console.log(`${path.relative(repoDir, source)} -> ${path.relative(repoDir, destination)} (${Object.keys(strings).length} strings)`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build()
