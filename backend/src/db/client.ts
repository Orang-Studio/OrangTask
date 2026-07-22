import postgres from 'postgres'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sql = postgres(process.env.DATABASE_URL || 'postgresql://orangtask:orangtask@localhost:5432/orangtask', {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
})

export async function runMigrations() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      ran_at TIMESTAMPTZ DEFAULT now()
    )
  `

  const migrationsDir = join(__dirname, 'migrations')
  const files = ['001_initial.sql', '002_refresh_tokens_pin.sql', '003_push_notifications.sql', '004_password_reset.sql', '005_oauth_accounts.sql', '006_api_keys.sql', '007_device_tokens.sql'].sort()

  for (const file of files) {
    const [existing] = await sql`SELECT id FROM schema_migrations WHERE filename = ${file}`
    if (existing) continue

    const filePath = join(migrationsDir, file)
    const migrationSql = readFileSync(filePath, 'utf8')

    await sql.unsafe(migrationSql)
    await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`
    console.log(`Ran migration: ${file}`)
  }
}

export default sql
