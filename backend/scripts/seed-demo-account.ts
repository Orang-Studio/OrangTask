import { randomBytes, scryptSync } from 'crypto'
import sql from '../src/db/client.js'

const EMAIL = (process.env.DEMO_ACCOUNT_EMAIL || '').toLowerCase().trim()
const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || ''
const NAME = process.env.DEMO_ACCOUNT_NAME || 'Demo Reviewer'

if (!EMAIL || !PASSWORD) {
  console.error('DEMO_ACCOUNT_EMAIL and DEMO_ACCOUNT_PASSWORD are required')
  process.exit(1)
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date(Date.now() + dayOffset * DAY)
  d.setHours(hour, minute, 0, 0)
  return d
}

async function main() {
  const [user] = await sql`
    INSERT INTO users (email, password_hash, name, email_verified_at, pin_hash)
    VALUES (${EMAIL}, ${hashPassword(PASSWORD)}, ${NAME}, now(), NULL)
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      name = EXCLUDED.name,
      email_verified_at = now(),
      pin_hash = NULL,
      updated_at = now()
    RETURNING id, email
  `
  const uid = user.id

  // the 2FA exemption is deliberately NOT granted here login_2fa_exemptions is manual edit only so this script can report on it but never create it
  const [exempt] = await sql`SELECT 1 FROM login_2fa_exemptions WHERE email = ${EMAIL}`

  // wipe prior review residue Lists cascade to tasks task_tags and github_items
  await sql`DELETE FROM lists WHERE owner_id = ${uid}`
  await sql`DELETE FROM list_members WHERE user_id = ${uid}`
  await sql`DELETE FROM scratchpads WHERE user_id = ${uid}`
  await sql`DELETE FROM tags WHERE owner_id = ${uid}`
  await sql`DELETE FROM notifications WHERE user_id = ${uid}`
  await sql`DELETE FROM github_connections WHERE user_id = ${uid}`
  await sql`DELETE FROM github_items WHERE user_id = ${uid}`
  await sql`DELETE FROM api_keys WHERE user_id = ${uid}`
  await sql`DELETE FROM webhooks WHERE user_id = ${uid}`
  await sql`DELETE FROM push_subscriptions WHERE user_id = ${uid}`
  await sql`DELETE FROM device_tokens WHERE user_id = ${uid}`
  await sql`DELETE FROM oauth_accounts WHERE user_id = ${uid}`

  const tagRows = [
    { name: 'work', color: '#f97316' },
    { name: 'home', color: '#22c55e' },
    { name: 'urgent', color: '#ef4444' },
  ]
  const tags: Record<string, string> = {}
  for (const t of tagRows) {
    const [row] = await sql`
      INSERT INTO tags (owner_id, name, color) VALUES (${uid}, ${t.name}, ${t.color})
      RETURNING id, name
    `
    tags[row.name] = row.id
  }

  const listRows = [
    { name: 'Today', color: '#f97316', icon: 'sun', position: 0 },
    { name: 'Work', color: '#3b82f6', icon: 'briefcase', position: 1 },
    { name: 'Personal', color: '#22c55e', icon: 'home', position: 2 },
  ]
  const lists: Record<string, string> = {}
  for (const l of listRows) {
    const [row] = await sql`
      INSERT INTO lists (owner_id, name, color, icon, position)
      VALUES (${uid}, ${l.name}, ${l.color}, ${l.icon}, ${l.position})
      RETURNING id, name
    `
    lists[row.name] = row.id
  }

  type Seed = {
    list: string
    title: string
    notes?: string | null
    priority?: string
    status?: string
    due?: Date | null
    start?: Date | null
    rrule?: string | null
    tags?: string[]
    subtasks?: { title: string; status?: string }[]
  }

  // spread across overdue today this week so Today Week and Overdue smart views are all non empty the moment a reviewer opens the app
  const seeds: Seed[] = [
    {
      list: 'Today', title: 'Review pull request #42', priority: 'high', due: at(0, 11),
      notes: 'Check the migration and the new rate limit before approving.', tags: ['work', 'urgent'],
      subtasks: [
        { title: 'Read the diff', status: 'done' },
        { title: 'Run the test suite' },
        { title: 'Leave review comments' },
      ],
    },
    { list: 'Today', title: 'Stand-up notes', priority: 'medium', due: at(0, 9), status: 'doing', tags: ['work'] },
    { list: 'Today', title: 'Water the plants', priority: 'low', due: at(0, 18), tags: ['home'] },
    { list: 'Today', title: 'Reply to support email', priority: 'medium', due: at(-1, 15), tags: ['work', 'urgent'] },
    { list: 'Today', title: 'Book dentist appointment', priority: 'none', due: at(-3, 12), tags: ['home'] },
    { list: 'Today', title: 'Morning walk', priority: 'low', due: at(0, 7), rrule: 'FREQ=DAILY;INTERVAL=1' },

    {
      list: 'Work', title: 'Ship the v1.2 release', priority: 'high', due: at(3, 17),
      notes: 'Tag the release, publish the changelog, notify the beta channel.', tags: ['work'],
      subtasks: [
        { title: 'Freeze the branch', status: 'done' },
        { title: 'Write the changelog' },
        { title: 'Publish to the store' },
      ],
    },
    { list: 'Work', title: 'Quarterly planning doc', priority: 'medium', due: at(5, 12), start: at(1, 9), tags: ['work'] },
    { list: 'Work', title: 'Weekly team sync', priority: 'medium', due: at(2, 10), rrule: 'FREQ=WEEKLY;BYDAY=TU' },
    { list: 'Work', title: 'Update onboarding docs', priority: 'low', due: at(6, 16) },
    { list: 'Work', title: 'Archive Q3 tickets', priority: 'none', status: 'done', due: at(-2, 14) },

    { list: 'Personal', title: 'Grocery run', priority: 'medium', due: at(1, 19), tags: ['home'],
      subtasks: [{ title: 'Oranges' }, { title: 'Coffee' }, { title: 'Bread', status: 'done' }] },
    { list: 'Personal', title: 'Pay electricity bill', priority: 'high', due: at(4, 12), rrule: 'FREQ=MONTHLY;BYMONTHDAY=15', tags: ['home', 'urgent'] },
    { list: 'Personal', title: 'Finish reading "The Pragmatic Programmer"', priority: 'low', due: at(12, 20) },
    { list: 'Personal', title: 'Call mum', priority: 'medium', due: at(2, 18), tags: ['home'] },
    { list: 'Personal', title: 'Renew gym membership', priority: 'none', status: 'done', due: at(-5, 10) },
  ]

  let position = 0
  for (const s of seeds) {
    const status = s.status || 'todo'
    const [task] = await sql`
      INSERT INTO tasks (list_id, created_by, assigned_to, title, notes, priority, status, due_date, start_date, completed_at, position, recurrence_rule)
      VALUES (
        ${lists[s.list]}, ${uid}, ${uid}, ${s.title}, ${s.notes ?? null},
        ${s.priority || 'none'}, ${status}, ${s.due ?? null}, ${s.start ?? null},
        ${status === 'done' ? new Date(Date.now() - 2 * HOUR) : null}, ${position++}, ${s.rrule ?? null}
      )
      RETURNING id
    `
    for (const name of s.tags || []) {
      await sql`INSERT INTO task_tags (task_id, tag_id) VALUES (${task.id}, ${tags[name]}) ON CONFLICT DO NOTHING`
    }
    let subPosition = 0
    for (const sub of s.subtasks || []) {
      const subStatus = sub.status || 'todo'
      await sql`
        INSERT INTO tasks (list_id, parent_id, created_by, assigned_to, title, priority, status, completed_at, position)
        VALUES (
          ${lists[s.list]}, ${task.id}, ${uid}, ${uid}, ${sub.title}, 'none', ${subStatus},
          ${subStatus === 'done' ? new Date(Date.now() - 3 * HOUR) : null}, ${subPosition++}
        )
      `
    }
  }

  const scratchpads = [
    {
      title: 'Welcome',
      content: [
        'Welcome to OrangTask.',
        '',
        'This is a demo account with sample data. Everything here resets automatically,',
        'so feel free to create, edit, complete and delete anything you like.',
        '',
        'Try: the Today / Week / Overdue smart views, swipe to complete a task,',
        'open a task for subtasks and notes, or create a new list from the sidebar.',
      ].join('\n'),
      position: 0,
    },
    {
      title: 'Meeting notes',
      content: [
        '# Sync — product',
        '',
        '- Ship v1.2 by Friday',
        '- Push notifications behind a flag for now',
        '- Revisit the Lithuanian copy on the settings screen',
      ].join('\n'),
      position: 1,
    },
    {
      title: 'Ideas',
      content: [
        'Recurring task templates',
        'Widget for the home screen',
        'Shared lists with a read-only role',
      ].join('\n'),
      position: 2,
    },
  ]
  for (const s of scratchpads) {
    await sql`
      INSERT INTO scratchpads (user_id, title, content, position)
      VALUES (${uid}, ${s.title}, ${s.content}, ${s.position})
    `
  }

  const [{ count: taskCount }] = await sql`
    SELECT count(*)::int AS count FROM tasks WHERE list_id IN (SELECT id FROM lists WHERE owner_id = ${uid})
  `
  console.log(`Demo account ready: ${user.email}`)
  console.log(`  user id     ${uid}`)
  console.log(`  lists       ${listRows.length}`)
  console.log(`  tasks       ${taskCount} (incl. subtasks)`)
  console.log(`  scratchpads ${scratchpads.length}`)
  console.log(`  PIN cleared, email pre-verified`)
  if (exempt) {
    console.log(`  2FA exempt  yes`)
  } else {
    console.log('')
    console.log('  WARNING: no 2FA exemption for this address. Login will demand an')
    console.log('  emailed code and a reviewer will not get past it. Grant it by hand:')
    console.log('')
    console.log('    BEGIN;')
    console.log("    SET LOCAL orangtask.manual_db_edit = 'on';")
    console.log(`    INSERT INTO login_2fa_exemptions (email, note)`)
    console.log(`    VALUES ('${EMAIL}', 'Google Play review account');`)
    console.log('    COMMIT;')
    console.log('')
  }
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e)
    await sql.end()
    process.exit(1)
  })
