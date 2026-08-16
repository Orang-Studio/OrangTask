import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const DEFAULT_I18N_PLATFORM = 'android'

export interface I18nCatalog {
  code: string
  endonym: string
  rev: string
  strings: Record<string, string>
}

function isCatalog(value: unknown): value is I18nCatalog {
  if (value === null || typeof value !== 'object') return false
  const catalog = value as Partial<I18nCatalog>
  return typeof catalog.code === 'string' && catalog.code.length > 0 &&
    typeof catalog.endonym === 'string' &&
    typeof catalog.rev === 'string' && catalog.rev.length > 0 &&
    catalog.strings !== null && typeof catalog.strings === 'object' &&
    !Array.isArray(catalog.strings) &&
    Object.values(catalog.strings).every((entry) => typeof entry === 'string')
}

export class I18nStore {
  private constructor(
    private readonly platforms: Map<string, Map<string, I18nCatalog>>,
  ) {}

  static load(rootDir: string): I18nStore {
    const platforms = new Map<string, Map<string, I18nCatalog>>()
    let platformEntries

    try {
      platformEntries = readdirSync(rootDir, { withFileTypes: true })
    } catch (error) {
      console.warn(`i18n directory missing; serving no remote catalogs: ${rootDir}`, error)
      return new I18nStore(platforms)
    }

    for (const platformEntry of platformEntries) {
      if (!platformEntry.isDirectory()) continue

      const platform = platformEntry.name
      const platformDir = path.join(rootDir, platform)
      const catalogs = new Map<string, I18nCatalog>()
      let files

      try {
        files = readdirSync(platformDir, { withFileTypes: true })
      } catch (error) {
        console.warn(`could not read i18n platform directory: ${platformDir}`, error)
        platforms.set(platform, catalogs)
        continue
      }

      for (const file of files) {
        if (!file.isFile() || path.extname(file.name) !== '.json') continue

        const filePath = path.join(platformDir, file.name)
        try {
          const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
          if (!isCatalog(parsed)) throw new Error('catalog has an invalid shape')
          catalogs.set(parsed.code, parsed)
          console.info(`loaded i18n catalog: platform=${platform} code=${parsed.code} rev=${parsed.rev}`)
        } catch (error) {
          console.warn(`skipping invalid i18n catalog: ${filePath}`, error)
        }
      }

      platforms.set(platform, catalogs)
    }

    return new I18nStore(platforms)
  }

  languages(platform: string): I18nCatalog[] {
    return [...(this.platforms.get(platform)?.values() ?? [])]
      .sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
  }

  catalog(platform: string, code: string): I18nCatalog | undefined {
    return this.platforms.get(platform)?.get(code)
  }
}

const i18nDir = process.env.I18N_DIR ?? path.resolve(import.meta.dir, '../../i18n')

export const i18nStore = I18nStore.load(i18nDir)