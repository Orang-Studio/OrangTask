const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
const platform = typeof navigator !== 'undefined' ? (navigator as any).platform || '' : ''

export const isMac = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(ua)

export const modKey = isMac ? '⌘' : 'Ctrl'
