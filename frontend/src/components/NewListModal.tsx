import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Loader2, X } from 'lucide-react'
import { api } from '../lib/api'
import { useCreateList } from '../hooks/useLists'
import { useHaptics } from '../hooks/useHaptics'
import { DEFAULT_LIST_ICON, LIST_COLORS, LIST_ICONS, LIST_ICON_KEYS } from '../lib/listIcons'
import { t, type MessageKey } from '../lib/i18n'

const SUGGEST_DEBOUNCE_MS = 350

export function NewListModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const createList = useCreateList()
  const haptics = useHaptics()

  const [name, setName] = useState('')
  const [color, setColor] = useState(LIST_COLORS[0])
  // null auto the icon follows Jevs suggestion for the name
  const [picked, setPicked] = useState<string | null>(null)
  // the grid stays folded away until the preview tile is clicked
  const [iconsOpen, setIconsOpen] = useState(false)
  const [suggested, setSuggested] = useState<{ name: string; icon: string | null } | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const latest = useRef('')

  useEffect(() => {
    if (!open) return
    setName('')
    setColor(LIST_COLORS[0])
    setPicked(null)
    setIconsOpen(false)
    setSuggested(null)
  }, [open])

  const trimmed = name.trim()
  useEffect(() => {
    latest.current = trimmed
    if (!open || picked || !trimmed) {
      setSuggesting(false)
      return
    }
    if (suggested?.name === trimmed) return
    setSuggesting(true)
    const timer = setTimeout(() => {
      api.post<{ icon: string | null }>('/lists/suggest-icon', { name: trimmed })
        .then((d) => d.icon, () => null)
        .then((icon) => {
          // a slower answer for an older name must not replace a newer one
          if (latest.current !== trimmed) return
          setSuggested({ name: trimmed, icon: icon && LIST_ICONS[icon] ? icon : null })
          setSuggesting(false)
        })
    }, SUGGEST_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [trimmed, open, picked, suggested?.name])

  const autoIcon = trimmed && suggested?.name === trimmed ? suggested.icon : null
  const icon = picked ?? autoIcon ?? DEFAULT_LIST_ICON
  const PreviewIcon = LIST_ICONS[icon]

  const submit = async () => {
    if (!trimmed || createList.isPending) return
    haptics.success()
    // no icon while the preview is still out the server picks one after creating
    const list = await createList.mutateAsync({ name: trimmed, color, icon: picked ?? autoIcon ?? undefined })
    onClose()
    if (list?.id) onCreated?.(list.id)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md bg-white dark:bg-ink-850 border border-gray-200 dark:border-ink-600 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-ink-700">
              <h2 className="font-bold uppercase tracking-wide">{t('lists.newListLabel' as MessageKey)}</h2>
              <button onClick={onClose} aria-label={t('common.close')} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setIconsOpen(!iconsOpen) }}
                  className="relative flex items-center justify-center w-12 h-12 flex-shrink-0 border-2"
                  style={{ borderColor: color, color }}
                  aria-label={t('list.changeIcon' as MessageKey)}
                  aria-expanded={iconsOpen}
                  title={t('list.changeIcon' as MessageKey)}
                >
                  <PreviewIcon size={24} />
                  {suggesting && (
                    <Loader2 size={14} className="absolute -top-2 -right-2 animate-spin text-gray-400 bg-white dark:bg-ink-850 rounded-full" />
                  )}
                  <span className="absolute -bottom-2 -right-2 flex items-center justify-center w-4 h-4 rounded-full text-white" style={{ backgroundColor: color }}>
                    {iconsOpen ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />}
                  </span>
                </button>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                  placeholder={t('lists.namePlaceholder' as MessageKey)}
                  maxLength={100}
                  className="input-field flex-1"
                />
              </div>

              {iconsOpen && (
                <div>
                  <span className="block mb-2 text-xs uppercase tracking-wider text-gray-400 font-semibold">{t('lists.iconLabel' as MessageKey)}</span>
                  <div className="grid grid-cols-7 gap-1 max-h-44 overflow-y-auto">
                    {LIST_ICON_KEYS.map((key) => {
                      const Icon = LIST_ICONS[key]
                      const active = icon === key
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            haptics.tap()
                            // picking the chosen icon again hands it back to the names suggestion
                            setPicked(picked === key ? null : key)
                            setIconsOpen(false)
                          }}
                          className={`flex items-center justify-center h-9 rounded transition-colors ${
                            active
                              ? 'bg-orange-100 dark:bg-ink-700 ring-1 ring-orange-500'
                              : 'hover:bg-gray-100 dark:hover:bg-ink-750 text-gray-500 dark:text-ink-300'
                          }`}
                          style={active ? { color } : undefined}
                          aria-label={key}
                          aria-pressed={active}
                        >
                          <Icon size={18} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <span className="block mb-2 text-xs uppercase tracking-wider text-gray-400 font-semibold">{t('lists.colorLabel' as MessageKey)}</span>
                <div className="flex flex-wrap gap-2">
                  {LIST_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { haptics.tap(); setColor(c) }}
                      className={`w-7 h-7 rounded-full transition-shadow ${
                        color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-ink-850' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                      aria-pressed={color === c}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button onClick={onClose} className="btn-secondary flex-1 border border-gray-200 dark:border-ink-600">
                {t('common.cancel' as MessageKey)}
              </button>
              <button onClick={submit} disabled={!trimmed || createList.isPending} className="btn-primary flex-1 disabled:opacity-50">
                {t('common.create' as MessageKey)}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
