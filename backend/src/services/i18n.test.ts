import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { I18nStore } from './i18n.js'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('I18nStore', () => {
  test('loads JSON catalogs by platform and sorts languages by code', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'orangtask-i18n-'))
    tempDirs.push(root)
    const android = path.join(root, 'android')
    mkdirSync(android)
    writeFileSync(path.join(android, 'lt.json'), JSON.stringify({
      code: 'lt', endonym: 'Lietuvių', rev: 'def', strings: { hello: 'Labas' },
    }))
    writeFileSync(path.join(android, 'en.json'), JSON.stringify({
      code: 'en', endonym: 'English', rev: 'abc', strings: { hello: 'Hello' },
    }))
    writeFileSync(path.join(android, 'ignored.json.bak'), '{')

    const store = I18nStore.load(root)

    expect(store.languages('android').map(({ code }) => code)).toEqual(['en', 'lt'])
    expect(store.languages('web')).toEqual([])
    expect(store.catalog('android', 'lt')?.strings.hello).toBe('Labas')
  })

  test('skips invalid catalogs and tolerates a missing root', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'orangtask-i18n-'))
    tempDirs.push(root)
    const android = path.join(root, 'android')
    mkdirSync(android)
    writeFileSync(path.join(android, 'broken.json'), '{')

    expect(I18nStore.load(root).languages('android')).toEqual([])
    expect(I18nStore.load(path.join(root, 'missing')).languages('android')).toEqual([])
  })
})
