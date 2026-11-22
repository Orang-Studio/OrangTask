// generates lucide svg icons from lucide react
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const root = join(import.meta.dir, '..', '..')
const lucide = join(root, 'frontend', 'node_modules', 'lucide-react', 'dist', 'esm')
const out = join(import.meta.dir, '..', 'assets', 'icons', 'lucide')
mkdirSync(out, { recursive: true })

const ICONS: Record<string, string> = {
  hash: 'Hash', inbox: 'Inbox', briefcase: 'Briefcase', home: 'Home', star: 'Star',
  heart: 'Heart', cart: 'ShoppingCart', list: 'List', checks: 'ListChecks',
  calendar: 'Calendar', book: 'BookOpen', code: 'Code', music: 'Music',
  camera: 'Camera', coffee: 'Coffee', zap: 'Zap', flag: 'Flag', bell: 'Bell',
  bookmark: 'Bookmark', folder: 'Folder', file: 'FileText', tag: 'Tag',
  dollar: 'DollarSign', gift: 'Gift', plane: 'Plane', car: 'Car',
  dumbbell: 'Dumbbell', graduation: 'GraduationCap', lightbulb: 'Lightbulb',
  leaf: 'Leaf', sun: 'Sun', moon: 'Moon', cloud: 'Cloud', pizza: 'Pizza',
  game: 'Gamepad2', wrench: 'Wrench', palette: 'Palette', target: 'Target',
  trophy: 'Trophy', users: 'Users', phone: 'Phone', mail: 'Mail', map: 'MapPin',
  shield: 'Shield', smile: 'Smile', paw: 'PawPrint', rocket: 'Rocket',
  webhook: 'Webhook', github: 'Github',
  'alert-circle': 'AlertCircle', 'arrow-left': 'ArrowLeft', 'arrow-right': 'ArrowRight',
  'calendar-days': 'CalendarDays', check: 'Check', 'check-check': 'CheckCheck',
  'check-circle': 'CheckCircle2', 'chevron-down': 'ChevronDown', 'chevron-right': 'ChevronRight',
  'chevron-left': 'ChevronLeft', 'chevron-up': 'ChevronUp', copy: 'Copy', 'corner-down-left': 'CornerDownLeft',
  crown: 'Crown', 'external-link': 'ExternalLink', 'git-branch': 'GitBranch', 'key-round': 'KeyRound',
  layers: 'Layers', lock: 'Lock', minus: 'Minus', 'more-vertical': 'MoreVertical',
  'more-horizontal': 'MoreHorizontal', pencil: 'Pencil', plus: 'Plus', repeat: 'Repeat',
  'rotate-ccw': 'RotateCcw', search: 'Search', send: 'Send', settings: 'Settings',
  'trash': 'Trash2', 'user-check': 'UserCheck', 'user-circle': 'UserCircle2', 'user-plus': 'UserPlus',
  'wifi-off': 'WifiOff', x: 'X', 'log-out': 'LogOut', 'panel-left-close': 'PanelLeftClose',
  'panel-left-open': 'PanelLeftOpen', 'notebook-pen': 'NotebookPen', monitor: 'Monitor',
  'sticky-note': 'StickyNote', pin: 'Pin', 'pin-off': 'PinOff', clock: 'Clock', 'alarm-clock': 'AlarmClock',
  'refresh-cw': 'RefreshCw', 'grip-vertical': 'GripVertical', 'list-todo': 'ListTodo',
  'bell-ring': 'BellRing', eye: 'Eye', 'eye-off': 'EyeOff', 'circle': 'Circle', 'download': 'Download',
  keyboard: 'Keyboard', 'app-window': 'AppWindow', 'arrow-up-right': 'ArrowUpRight', 'loader': 'LoaderCircle',
}

const index = readFileSync(join(lucide, 'lucide-react.js'), 'utf8')
const fileFor = (name: string) => {
  const re = new RegExp(`default as ${name}[,\\s][^;]*from '\\./icons/([a-z0-9-]+)\\.js'`)
  const m = index.match(re)
  if (!m) throw new Error(`lucide icon not found: ${name}`)
  return m[1]
}

const attrs = (o: Record<string, string>) =>
  Object.entries(o).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')

for (const [key, name] of Object.entries(ICONS)) {
  const src = readFileSync(join(lucide, 'icons', `${fileFor(name)}.js`), 'utf8')
  const body = src
    .replace(/^import .*$/m, '')
    .replace(/export \{ (\w+) as default \};/, 'return $1;')
    .replace(/\/\/# sourceMappingURL.*$/m, '')
  const node: [string, Record<string, string>][] =
    new Function('createLucideIcon', body)((_: string, n: unknown) => n)
  const inner = node.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('')
  writeFileSync(
    join(out, `${key}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>\n`,
  )
}
console.log(`wrote ${Object.keys(ICONS).length} icons to ${out}`)
