// detect the platform so shortcut hints show the right modifier: ⌘ on macOS/iOS, Ctrl everywhere else
const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
const platform = typeof navigator !== 'undefined' ? (navigator as any).platform || '' : ''

export const isMac = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(ua)

// the command-palette modifier label, e.g. "⌘" or "Ctrl"
export const modKey = isMac ? '⌘' : 'Ctrl'
