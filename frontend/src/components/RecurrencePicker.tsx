import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Plus } from 'lucide-react'
import { useHaptics } from '../hooks/useHaptics'
import { t, tCount, type MessageKey } from '../lib/i18n'

const selectClass =
  'px-2 h-9 text-sm bg-white dark:bg-ink-750 border border-gray-300 dark:border-ink-500 outline-none focus:border-orange-500'

function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function IntervalStepper({
  value,
  freq,
  onChange,
}: {
  value: number
  freq: RecurrenceFreq
  onChange: (next: number) => void
}) {
  const step = (delta: number) => onChange(Math.min(MAX_INTERVAL, Math.max(1, value + delta)))
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-ink-300 mb-2">
        {t('repeat.every' as MessageKey)}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={value <= 1}
          aria-label={t('repeat.decreaseInterval' as MessageKey)}
          className="w-9 h-9 flex items-center justify-center border border-gray-300 dark:border-ink-600 hover:border-orange-500 disabled:opacity-40 disabled:hover:border-gray-300 dark:disabled:hover:border-ink-600 transition-colors"
        >
          <Minus size={16} />
        </button>
        <input
          type="number"
          min={1}
          max={MAX_INTERVAL}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (Number.isFinite(next)) onChange(Math.min(MAX_INTERVAL, Math.max(1, Math.trunc(next))))
          }}
          aria-label={t('repeat.every' as MessageKey)}
          className={`${selectClass} w-16 text-center`}
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={value >= MAX_INTERVAL}
          aria-label={t('repeat.increaseInterval' as MessageKey)}
          className="w-9 h-9 flex items-center justify-center border border-gray-300 dark:border-ink-600 hover:border-orange-500 disabled:opacity-40 transition-colors"
        >
          <Plus size={16} />
        </button>
        <span className="text-sm text-gray-600 dark:text-ink-300">{tCount(unitKey(freq), value)}</span>
      </div>
    </div>
  )
}

function WeekdaySelector({ value, onChange }: { value: number[]; onChange: (next: number[]) => void }) {
  const order = useMemo(() => weekdayOrder(), [])
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-ink-300 mb-2">
        {t('repeat.onDays' as MessageKey)}
      </div>
      <div className="flex gap-1">
        {order.map((day) => {
          const selected = value.includes(day)
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              aria-label={weekdayName(day, 'long')}
              onClick={() => {
                // never leave a weekly rule with nothing to fire on
                if (selected && value.length === 1) return
                onChange(selected ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))
              }}
              className={`${chipClass(selected)} flex-1 px-0`}
            >
              {weekdayName(day, 'narrow')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MonthlySelector({
  draft,
  onChange,
}: {
  draft: Recurrence
  onChange: (next: Recurrence) => void
}) {
  const order = useMemo(() => weekdayOrder(), [])
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...draft, monthlyMode: 'dayOfMonth' })}
          className={chipClass(draft.monthlyMode === 'dayOfMonth')}
        >
          {t('repeat.monthlyDayOption' as MessageKey, { day: draft.monthDay })}
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...draft, monthlyMode: 'dayOfWeek' })}
          className={chipClass(draft.monthlyMode === 'dayOfWeek')}
        >
          {t('repeat.monthlyNth' as MessageKey, {
            ordinal: ordinalLabel(draft.weekOrdinal),
            weekday: weekdayName(draft.monthWeekday, 'long'),
          })}
        </button>
      </div>

      {draft.monthlyMode === 'dayOfMonth' ? (
        <select
          value={draft.monthDay}
          onChange={(e) => onChange({ ...draft, monthDay: Number(e.target.value) })}
          aria-label={t('repeat.onDays' as MessageKey)}
          className={selectClass}
        >
          {MONTH_DAYS.map((day) => (
            <option key={day} value={day}>
              {t('repeat.monthlyDayOption' as MessageKey, { day })}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex gap-2">
          <select
            value={draft.weekOrdinal}
            onChange={(e) => onChange({ ...draft, weekOrdinal: Number(e.target.value) })}
            aria-label={t('repeat.onDays' as MessageKey)}
            className={selectClass}
          >
            {ORDINALS.map((ordinal) => (
              <option key={ordinal} value={ordinal}>
                {ordinalLabel(ordinal)}
              </option>
            ))}
          </select>
          <select
            value={draft.monthWeekday}
            onChange={(e) => onChange({ ...draft, monthWeekday: Number(e.target.value) })}
            aria-label={t('repeat.onDays' as MessageKey)}
            className={selectClass}
          >
            {order.map((day) => (
              <option key={day} value={day}>
                {weekdayName(day, 'long')}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

function EndsSelector({ draft, onChange }: { draft: Recurrence; onChange: (next: Recurrence) => void }) {
  const end = recurrenceEnd(draft)
  const select = (next: RecurrenceEnd) => {
    if (next === 'never') onChange({ ...draft, count: null, until: null })
    else if (next === 'onDate') onChange({ ...draft, count: null, until: draft.until ?? todayIso() })
    else onChange({ ...draft, until: null, count: draft.count ?? 5 })
  }

  const row = (option: RecurrenceEnd, label: string, trailing?: React.ReactNode) => (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="radio"
        name="repeat-ends"
        checked={end === option}
        onChange={() => select(option)}
        className="accent-orange-500"
      />
      <span className="text-sm">{label}</span>
      {trailing}
    </label>
  )

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-ink-300 mb-2">
        {t('repeat.ends' as MessageKey)}
      </div>
      <div className="space-y-2">
        {row('never', t('repeat.endsNever' as MessageKey))}
        {row(
          'onDate',
          t('repeat.endsOnDate' as MessageKey),
          <input
            type="date"
            value={draft.until ?? todayIso()}
            min={todayIso()}
            onChange={(e) => onChange({ ...draft, count: null, until: e.target.value || todayIso() })}
            disabled={end !== 'onDate'}
            aria-label={t('repeat.endsOnDate' as MessageKey)}
            className={`${selectClass} ml-auto disabled:opacity-40`}
          />,
        )}
        {row(
          'afterCount',
          t('repeat.after' as MessageKey),
          <span className="flex items-center gap-2 ml-auto">
            <input
              type="number"
              min={1}
              max={MAX_COUNT}
              value={draft.count ?? 5}
              onChange={(e) => {
                const next = Number(e.target.value)
                if (!Number.isFinite(next)) return
                onChange({ ...draft, until: null, count: Math.min(MAX_COUNT, Math.max(1, Math.trunc(next))) })
              }}
              disabled={end !== 'afterCount'}
              aria-label={t('repeat.after' as MessageKey)}
              className={`${selectClass} w-16 text-center disabled:opacity-40`}
            />
            <span className="text-sm text-gray-600 dark:text-ink-300">
              {tCount('repeat.occurrences', draft.count ?? 5)}
            </span>
          </span>,
        )}
      </div>
    </div>
  )
}

function RecurrenceDialog({
  rule,
  anchor,
  onClose,
  onConfirm,
}: {
  rule: string | null | undefined
  anchor: Date
  onClose: () => void
  onConfirm: (rrule: string) => void
}) {
  const parsed = useMemo(() => parseRecurrence(rule), [rule])
  const wasCustom = Boolean(rule?.trim()) && parsed === null
  const [draft, setDraft] = useState<Recurrence>(
    () => parsed ?? defaultRecurrence('WEEKLY', anchor, null),
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // swallow it so the surrounding task panel stays open
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const summary = describeRecurrence(toRrule(draft))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label={t('repeat.title' as MessageKey)}
        className="w-full max-w-md bg-white dark:bg-ink-850 border border-gray-200 dark:border-ink-600 shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-ink-700">
          <h2 className="font-bold uppercase tracking-wide">{t('repeat.title' as MessageKey)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {wasCustom && (
            <p className="text-xs px-3 py-2 border border-amber-400 text-amber-700 dark:text-amber-400">
              {t('repeat.customRuleNotice' as MessageKey)}
            </p>
          )}

          <div className="grid grid-cols-4 gap-1">
            {FREQUENCIES.map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => setDraft(defaultRecurrence(freq, anchor, draft))}
                className={`${chipClass(draft.freq === freq)} px-1`}
              >
                {t(FREQ_LABEL_KEYS[freq])}
              </button>
            ))}
          </div>

          <IntervalStepper
            value={draft.interval}
            freq={draft.freq}
            onChange={(interval) => setDraft({ ...draft, interval })}
          />

          {draft.freq === 'WEEKLY' && (
            <WeekdaySelector value={draft.byDay} onChange={(byDay) => setDraft({ ...draft, byDay })} />
          )}
          {draft.freq === 'MONTHLY' && <MonthlySelector draft={draft} onChange={setDraft} />}

          <EndsSelector draft={draft} onChange={setDraft} />

          <p className="text-sm font-medium text-orange-600 dark:text-orange-400">{summary}</p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-ink-700">
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={() => onConfirm(toRrule(draft))} className="btn-primary">
            {t('common.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function RecurrenceField({
  rule,
  anchor,
  onChange,
}: {
  rule: string | null | undefined
  anchor: Date
  onChange: (rrule: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const haptics = useHaptics()
  const isSet = Boolean(rule?.trim())

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <button
        type="button"
        onClick={() => {
          haptics.tap()
          setOpen(true)
        }}
        aria-label={t('repeat.edit' as MessageKey)}
        className={`flex-1 min-w-0 text-left truncate px-3 h-9 text-sm border transition-colors hover:border-orange-500 ${
          isSet
            ? 'border-gray-300 dark:border-ink-600'
            : 'border-gray-300 dark:border-ink-600 text-gray-400'
        }`}
      >
        {describeRecurrence(rule)}
      </button>
      {isSet && (
        <button
          type="button"
          onClick={() => {
            haptics.tap()
            onChange(null)
          }}
          aria-label={t('repeat.remove' as MessageKey)}
          className="w-9 h-9 flex items-center justify-center flex-shrink-0 border border-gray-300 dark:border-ink-600 text-gray-400 hover:border-orange-500 hover:text-gray-600 dark:hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <RecurrenceDialog
            rule={rule}
            anchor={anchor}
            onClose={() => setOpen(false)}
            onConfirm={(rrule) => {
              onChange(rrule)
              setOpen(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
