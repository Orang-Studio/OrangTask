import { describe, expect, it } from 'vitest'
import en from './en.json'
import lt from './lt.json'
// applyLanguage sets document documentElement lang these tests run without a DOM
globalThis.document ??= { documentElement: {} } as Document

const { applyLanguage, resolveLanguage, t } = await import('./index')

describe('i18n catalogs', () => {
  it('translates into Lithuanian, not the English fallback', () => {
    applyLanguage('lt')
    // regression the eager JSON glob yields module namespaces so an unwrapped catalog silently returned undefined for every key and fell back to English
    expect(t('settings.appearance')).toBe(lt['settings.appearance'])
    expect(t('settings.appearance')).not.toBe(en['settings.appearance'])
  })

  it('interpolates variables in the active catalog', () => {
    applyLanguage('lt')
    expect(t('about.version', { version: '1.2.3' })).toContain('1.2.3')
    expect(t('about.version', { version: '1.2.3' })).toBe(
      lt['about.version'].replace('{version}', '1.2.3'),
    )
  })

  it('switches back to English', () => {
    applyLanguage('lt')
    applyLanguage('en')
    expect(t('settings.appearance')).toBe(en['settings.appearance'])
  })

  it('has a Lithuanian translation for every English key', () => {
    expect(Object.keys(en).filter((k) => !(k in lt))).toEqual([])
  })

  it('resolves an explicit preference over the system language', () => {
    expect(resolveLanguage('lt')).toBe('lt')
    expect(resolveLanguage('en')).toBe('en')
  })
})
