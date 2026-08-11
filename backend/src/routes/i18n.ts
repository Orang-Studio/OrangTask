import { Hono } from 'hono'
import type { AppEnv } from '../types.js'
import { DEFAULT_I18N_PLATFORM, i18nStore } from '../services/i18n.js'

const app = new Hono<AppEnv>()

app.get('/languages', (c) => {
  const platform = c.req.query('platform') ?? DEFAULT_I18N_PLATFORM
  const languages = i18nStore.languages(platform).map(({ code, endonym, rev }) => ({
    code,
    endonym,
    rev,
  }))
  return c.json(languages)
})

app.get('/catalog', (c) => {
  const platform = c.req.query('platform') ?? DEFAULT_I18N_PLATFORM
  const code = c.req.query('lang') ?? ''
  const catalog = i18nStore.catalog(platform, code)

  if (!catalog) return c.json({ error: `no catalog for ${code}` }, 404)
  if (c.req.query('rev') === catalog.rev) return c.body(null, 304)

  return c.json(catalog)
})

export default app
