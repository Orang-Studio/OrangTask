import { type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import en from './en.json'

export type Catalog = typeof en
export type MessageKey = keyof Catalog

export type Language = 'en' | 'lt'
export type LanguagePref = 'system' | Language

const files = import.meta.glob<Record<string, unknown>>('./*.json', { eager: true })

const CATALOGS = Object.fromEntries(
  Object.entries(files).map(([path, cat]) => [
    path.replace('./', '').replace('.json', ''),
    cat as Catalog,
  ]),
) as Partial<Record<Language, Catalog>>

export const LANGUAGES = Object.keys(CATALOGS) as Language[]

let current: Language = 'en'
let catalog: Catalog = en

export function resolveLanguage(pref: LanguagePref): Language {
  if (pref !== 'system') return CATALOGS[pref] ? pref : 'en'
  const langs = navigator.languages ?? [navigator.language ?? 'en']
  for (const raw of langs) {
    const code = raw.split('-')[0].toLowerCase() as Language
    if (CATALOGS[code]) return code
  }
  return 'en'
}

export function applyLanguage(lang: Language) {
  current = lang
  catalog = CATALOGS[lang] ?? en
  document.documentElement.lang = lang
}

interface LangState {
  pref: LanguagePref
  setPref: (p: LanguagePref) => void
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      pref: 'system',
      setPref: (pref) => set({ pref }),
    }),
    { name: 'orangtask-lang' },
  ),
)

export function getEndonym(lang: Language): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(lang) ?? lang
  } catch {
    return lang
  }
}

export function setLanguage(pref: LanguagePref) {
  useLangStore.getState().setPref(pref)
  applyLanguage(resolveLanguage(pref))
}

export function initLanguage() {
  applyLanguage(resolveLanguage(useLangStore.getState().pref))
  window.addEventListener('languagechange', () => {
    const pref = useLangStore.getState().pref
    if (pref === 'system') applyLanguage(resolveLanguage(pref))
  })
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let str = catalog[key] ?? en[key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
    }
  }
  return str
}

const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const

export function tCount(
  key: string,
  count: number,
  vars?: Record<string, string | number>,
): string {
  const category = new Intl.PluralRules(current).select(count)
  let str = ''
  for (const cat of PLURAL_CATEGORIES) {
    const candidate = catalog[`${key}_${cat}` as MessageKey] ?? en[`${key}_${cat}` as MessageKey]
    if (candidate !== undefined) {
      str = candidate
      if (cat === category) break
    }
  }
  if (!str) str = key
  const values = { count, ...vars }
  for (const [name, value] of Object.entries(values)) {
    str = str.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
  }
  return str
}

export function tNodes(
  key: MessageKey,
  slots: Record<string, ReactNode>,
  vars?: Record<string, string | number>,
): ReactNode {
  const parts = t(key, vars).split(/\{(\w+)\}/)
  return parts.map((part, i) => {
    if (i % 2 === 1) return slots[part] ?? `{${part}}`
    return part
  })
}

export function useI18n() {
  const pref = useLangStore((s) => s.pref)
  const lang = resolveLanguage(pref)
  return { t, tCount, tNodes, lang, pref, setLanguage }
}
