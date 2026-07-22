import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, CornerDownLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSearch } from '../hooks/useSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { PriorityDot } from './PriorityDot'
import { formatDueDate } from '../lib/date'

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  // only hit the server once the user pauses typing
  const debouncedQuery = useDebouncedValue(query, 250)
  const { data: results, isFetching } = useSearch(debouncedQuery)
  const pending = isFetching || debouncedQuery !== query

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIdx(0)
  }, [results])

  // escape closes from anywhere while open, even if focus left the input
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleKey = (e: React.KeyboardEvent) => {
    // escape always closes, even before any results have loaded
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (!results) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      const r = results[selectedIdx]
      navigate(`/list/${r.list_id}?task=${r.id}`)
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center pt-[15vh] px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="w-full max-w-xl bg-white dark:bg-ink-850 border border-gray-200 dark:border-ink-600 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 border-b border-gray-200 dark:border-ink-700">
              <Search size={18} className="text-gray-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Search tasks..."
                className="flex-1 bg-transparent py-4 outline-none text-[15px]"
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {query.length < 2 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">Type at least 2 characters</div>
              )}
              {query.length >= 2 && pending && !results?.length && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">Searching…</div>
              )}
              {query.length >= 2 && !pending && results?.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No results for "{debouncedQuery}"</div>
              )}
              {results?.map((r, i) => (
                <button
                  key={r.id}
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => {
                    navigate(`/list/${r.list_id}?task=${r.id}`)
                    onClose()
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    i === selectedIdx ? 'bg-orange-50 dark:bg-ink-750' : ''
                  }`}
                >
                  <PriorityDot priority={r.priority} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${r.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                      {r.title}
                    </div>
                    <div className="text-xs text-gray-400">
                      {r.list_name}
                      {r.due_date && ` · ${formatDueDate(r.due_date)}`}
                    </div>
                  </div>
                  {i === selectedIdx && <CornerDownLeft size={14} className="text-gray-400" />}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
