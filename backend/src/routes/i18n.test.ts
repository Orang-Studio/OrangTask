import { describe, expect, test } from 'bun:test'
import app from './i18n.js'

describe('i18n routes', () => {
  test('lists Android languages in code order', async () => {
    const response = await app.request('/languages')
    const languages = await response.json() as Array<{ code: string; endonym: string; rev: string }>

    expect(response.status).toBe(200)
    expect(languages.map(({ code }) => code)).toEqual(['en', 'lt'])
    expect(languages.every(({ endonym, rev }) => endonym.length > 0 && rev.length === 40)).toBe(true)
  })

  test('returns a catalog, honors its revision, and rejects unknown languages', async () => {
    const response = await app.request('/catalog?platform=android&lang=lt')
    const catalog = await response.json() as { rev: string; strings: Record<string, string> }

    expect(response.status).toBe(200)
    expect(catalog.strings.add_task).toBe('Pridėti užduotį')

    const cached = await app.request(`/catalog?lang=lt&rev=${catalog.rev}`)
    expect(cached.status).toBe(304)
    expect(await cached.text()).toBe('')

    expect((await app.request('/catalog?lang=unknown')).status).toBe(404)
  })

  test('returns an empty list for an unknown platform', async () => {
    const response = await app.request('/languages?platform=web')
    expect(await response.json()).toEqual([])
  })
})
