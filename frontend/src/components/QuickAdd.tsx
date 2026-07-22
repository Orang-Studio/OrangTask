import { useState, useEffect, useRef, forwardRef } from 'react'
import { Plus, Calendar, Flag, Repeat } from 'lucide-react'
import { parseQuickAdd } from '../lib/chrono'
import { formatDueDate } from '../lib/date'
import { useHaptics } from '../hooks/useHaptics'

interface Props {
  onAdd: (data: { title: string; due_date: string | null; priority: string; recurrence_rule: string | null }) => void
  placeholder?: string
}

export const QuickAdd = forwardRef<HTMLInputElement, Props>(function QuickAdd(
  { onAdd, placeholder = 'Add a task...  (try "report friday high priority")' },
  ref
) {
  const [value, setValue] = useState('')
  const [preview, setPreview] = useState<ReturnType<typeof parseQuickAdd> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const haptics = useHaptics()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setPreview(null)
      return
    }
    debounceRef.current = setTimeout(() => {
      setPreview(parseQuickAdd(value))
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  const submit = () => {
    if (!value.trim()) return
    const parsed = parseQuickAdd(value)
    if (!parsed.title.trim()) return
    haptics.tap()
    onAdd({
      title: parsed.title,
      due_date: parsed.due_date ? parsed.due_date.toISOString() : null,
      priority: parsed.priority,
      recurrence_rule: parsed.recurrence_rule,
    })
    setValue('')
    setPreview(null)
  }

  const hasMeta = preview && (preview.due_date || preview.priority !== 'none' || preview.recurrence_rule)

  return (
    <div className="border-t border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-850">
      {hasMeta && (
        <div className="flex items-center gap-2 px-4 pt-2 text-xs flex-wrap animate-slide-in">
          {preview.due_date && (
            <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 rounded">
              <Calendar size={11} />
              {formatDueDate(preview.due_date.toISOString())}
            </span>
          )}
          {preview.priority !== 'none' && (
            <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 dark:bg-ink-700 dark:text-ink-300 rounded capitalize">
              <Flag size={11} />
              {preview.priority}
            </span>
          )}
          {preview.recurrence_rule && (
            <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 dark:bg-ink-700 dark:text-ink-300 rounded">
              <Repeat size={11} />
              Recurring
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-3">
        <Plus size={20} className="text-orange-500 flex-shrink-0" />
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
            if (e.key === 'Escape') {
              setValue('')
              setPreview(null)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-gray-400 dark:placeholder:text-ink-400"
          enterKeyHint="done"
        />
      </div>
    </div>
  )
})
