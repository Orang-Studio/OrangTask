import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useState, useEffect, useMemo, useRef, type RefObject } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Task } from '../lib/api'
import { TaskItem } from '../components/TaskItem'
import { TaskDetail } from '../components/TaskDetail'
import { QuickAdd } from '../components/QuickAdd'
import { PriorityDot } from '../components/PriorityDot'
import { useCalendarTasks, useCreateTask, useCompleteTask, useDeleteTask, useUpdateTask } from '../hooks/useTasks'
import { useLists } from '../hooks/useLists'
import { useLayout } from '../components/Layout'
import { useHaptics } from '../hooks/useHaptics'
import { useIsMobile } from '../hooks/useMediaQuery'
import { t, type MessageKey } from '../lib/i18n'

const MAX_CHIPS = 3

function locale() {
  return typeof document !== 'undefined' && document.documentElement.lang ? document.documentElement.lang : 'en-US'
}

// first weekday of the locale 0 Sunday Monday when the browser does not tell
function firstWeekday(): number {
  try {
    const info = new Intl.Locale(locale()) as Intl.Locale & {
      weekInfo?: { firstDay: number }
      getWeekInfo?: () => { firstDay: number }
    }
    const firstDay = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay
    if (firstDay) return firstDay % 7
  } catch {}
  return 1
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function hasTime(d: Date) {
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

// times other than the 23 59 end of day default show on the chip
function chipTime(task: Task) {
  if (!task.due_date) return ''
  const d = new Date(task.due_date)
  if (!hasTime(d) || (d.getHours() === 23 && d.getMinutes() === 59)) return ''
  return d.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' })
}

function monthLabel(month: Date) {
  const name = month.toLocaleDateString(locale(), { month: 'long' })
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.getFullYear()}`
}

function TaskChip({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const done = task.status === 'done'
  const overdue = !done && !!task.due_date && new Date(task.due_date).getTime() < Date.now()
  const time = chipTime(task)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onOpen(task)
      }}
      title={task.title}
      className={`w-full flex items-center gap-1 px-1.5 h-5 text-xs text-left border-l-2 truncate
        bg-gray-100 hover:bg-gray-200 dark:bg-ink-700 dark:hover:bg-ink-600 transition-colors
        ${done ? 'line-through text-gray-400 opacity-70' : overdue ? 'text-red-600 dark:text-red-400' : ''}`}
      style={{ borderLeftColor: task.list_color || '#f97316' }}
    >
      <PriorityDot priority={task.priority} size={6} />
      {time && <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{time}</span>}
      <span className="truncate">{task.title}</span>
    </button>
  )
}

function DayPopover({
  day, tasks, alignRight, alignBottom, onOpenTask, onAdd, onClose, inputRef,
}: {
  day: Date
  tasks: Task[]
  alignRight: boolean
  alignBottom: boolean
  onOpenTask: (task: Task) => void
  onAdd: (title: string) => void
  onClose: () => void
  inputRef: RefObject<HTMLInputElement>
}) {
  const [title, setTitle] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const submit = () => {
    if (!title.trim()) return
    onAdd(title.trim())
    setTitle('')
  }

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className={`absolute z-30 w-72 max-w-[80vw] bg-white dark:bg-ink-850 border border-gray-200 dark:border-ink-500 shadow-lg
        ${alignRight ? 'right-0' : 'left-0'} ${alignBottom ? 'bottom-0' : 'top-0'}`}
    >
      <div className="flex items-center justify-between px-3 h-10 border-b border-gray-200 dark:border-ink-700">
        <span className="text-xs font-bold uppercase tracking-wide">
          {day.toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
        <button onClick={onClose} aria-label={t('common.close')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400 px-1 py-2">{t('calendar.noTasks' as MessageKey)}</p>
        ) : (
          tasks.map((task) => <TaskChip key={task.id} task={task} onOpen={onOpenTask} />)
        )}
      </div>
      <div className="border-t border-gray-200 dark:border-ink-700 p-2">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder={t('calendar.addPlaceholder' as MessageKey)}
          className="w-full bg-transparent outline-none text-sm px-1 h-8 placeholder:text-gray-400"
        />
      </div>
    </div>
  )
}

export function UpcomingPage() {
  const isMobile = useIsMobile()
  const haptics = useHaptics()
  const { data: lists } = useLists()
  const createTask = useCreateTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()
  const { registerQuickAdd } = useLayout()

  const today = new Date()
  const todayKey = dayKey(today)
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [popoverDay, setPopoverDay] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const quickAddRef = useRef<HTMLInputElement>(null)
  const popoverInputRef = useRef<HTMLInputElement>(null)

  const weekStart = firstWeekday()
  const gridStart = addDays(month, -((month.getDay() - weekStart + 7) % 7))
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const weeks = Math.ceil((((month.getDay() - weekStart + 7) % 7) + daysInMonth) / 7)
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))
  const gridEnd = addDays(gridStart, weeks * 7)

  const { data: tasks } = useCalendarTasks(gridStart, gridEnd)

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks ?? []) {
      if (!task.due_date) continue
      const key = dayKey(new Date(task.due_date))
      const bucket = map.get(key)
      if (bucket) bucket.push(task)
      else map.set(key, [task])
    }
    return map
  }, [tasks])

  const defaultList = lists?.[0]

  useEffect(() => {
    if (!defaultList) {
      registerQuickAdd(null)
      return
    }
    registerQuickAdd(() => {
      if (isMobile) quickAddRef.current?.focus()
      else {
        setPopoverDay(selectedDay)
        setTimeout(() => popoverInputRef.current?.focus(), 0)
      }
    })
    return () => registerQuickAdd(null)
  }, [registerQuickAdd, defaultList, isMobile, selectedDay])

  useEffect(() => {
    if (selectedTask && tasks) {
      const updated = tasks.find((task) => task.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
    }
  }, [tasks])

  const dueOn = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    // same end of day default as the Today page
    return new Date(y, m - 1, d, 23, 59).toISOString()
  }

  const addTask = (key: string, data: { title: string; due_date?: string | null; priority?: string; recurrence_rule?: string | null }) => {
    if (!defaultList) return
    createTask.mutate({
      list_id: defaultList.id,
      title: data.title,
      due_date: data.due_date || dueOn(key),
      priority: (data.priority as Task['priority']) || 'none',
      recurrence_rule: data.recurrence_rule ?? null,
    })
  }

  const shiftMonth = (delta: number) => {
    haptics.tap()
    setPopoverDay(null)
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  const goToday = () => {
    haptics.tap()
    setPopoverDay(null)
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDay(todayKey)
  }

  const selectDay = (day: Date) => {
    const key = dayKey(day)
    setSelectedDay(key)
    if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1))
    else if (!isMobile) setPopoverDay(key)
  }

  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    addDays(gridStart, i).toLocaleDateString(locale(), { weekday: isMobile ? 'narrow' : 'short' }),
  )

  const selectedTasks = byDay.get(selectedDay) ?? []
  const selectedDate = new Date(`${selectedDay}T00:00`)

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-4 md:px-6 h-14 border-b border-gray-200 dark:border-ink-700 flex-shrink-0">
          <CalendarDays size={20} className="text-orange-500" />
          <h1 className="text-lg font-bold uppercase tracking-wide truncate">{t('upcoming.title' as MessageKey)}</h1>
          <span className="text-sm text-gray-400 ml-1 truncate">{monthLabel(month)}</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={goToday}
              className="px-3 h-8 text-xs font-bold uppercase tracking-wide border border-gray-300 dark:border-ink-500 hover:bg-gray-100 dark:hover:bg-ink-700"
            >
              {t('date.today' as MessageKey)}
            </button>
            <button
              onClick={() => shiftMonth(-1)}
              aria-label={t('calendar.previousMonth' as MessageKey)}
              className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => shiftMonth(1)}
              aria-label={t('calendar.nextMonth' as MessageKey)}
              className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className={`flex flex-col ${isMobile ? 'flex-shrink-0' : 'flex-1 min-h-0'}`}>
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-ink-700 flex-shrink-0">
            {weekdayLabels.map((label, i) => (
              <div key={i} className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-gray-400 text-center md:text-left">
                {label}
              </div>
            ))}
          </div>

          <div
            className={`grid grid-cols-7 ${isMobile ? '' : 'flex-1 min-h-0'}`}
            style={isMobile ? undefined : { gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
          >
            {days.map((day, i) => {
              const key = dayKey(day)
              const dayTasks = byDay.get(key) ?? []
              const inMonth = day.getMonth() === month.getMonth()
              const isToday = key === todayKey
              const isSelected = key === selectedDay
              const col = i % 7
              const row = Math.floor(i / 7)

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectDay(day)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selectDay(day)
                    }
                  }}
                  className={`relative border-b border-r border-gray-200 dark:border-ink-700 cursor-pointer outline-none
                    ${col === 6 ? 'border-r-0' : ''}
                    ${inMonth ? '' : 'bg-gray-50 dark:bg-ink-900'}
                    ${isMobile ? 'h-14 flex flex-col items-center pt-1' : 'p-1 min-h-0 flex flex-col gap-0.5 hover:bg-gray-50 dark:hover:bg-ink-750'}
                    ${isMobile && isSelected ? 'bg-orange-50 dark:bg-ink-700' : ''}
                    focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 text-xs flex-shrink-0
                      ${isToday ? 'bg-orange-500 text-white font-bold rounded-full' : inMonth ? '' : 'text-gray-400'}`}
                  >
                    {day.getDate()}
                  </span>

                  {isMobile ? (
                    <div className="flex gap-0.5 mt-1">
                      {dayTasks.slice(0, MAX_CHIPS).map((task) => (
                        <span
                          key={task.id}
                          className={`w-1.5 h-1.5 rounded-full ${task.status === 'done' ? 'opacity-40' : ''}`}
                          style={{ backgroundColor: task.list_color || '#f97316' }}
                        />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-0.5 min-h-0 overflow-hidden">
                        {dayTasks.slice(0, MAX_CHIPS).map((task) => (
                          <TaskChip key={task.id} task={task} onOpen={setSelectedTask} />
                        ))}
                      </div>
                      {dayTasks.length > MAX_CHIPS && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDay(key)
                            setPopoverDay(key)
                          }}
                          className="text-xs text-left px-1.5 text-gray-500 hover:text-orange-500 font-medium"
                        >
                          {t('calendar.more' as MessageKey, { count: dayTasks.length - MAX_CHIPS })}
                        </button>
                      )}
                      {popoverDay === key && (
                        <DayPopover
                          day={day}
                          tasks={dayTasks}
                          alignRight={col >= 4}
                          alignBottom={row >= weeks - 2}
                          onOpenTask={(task) => {
                            setPopoverDay(null)
                            setSelectedTask(task)
                          }}
                          onAdd={(title) => addTask(key, { title })}
                          onClose={() => setPopoverDay(null)}
                          inputRef={popoverInputRef}
                        />
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {isMobile && (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-4 pb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                {selectedDate.toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              {selectedTasks.length > 0 ? (
                <AnimatePresence initial={false}>
                  {selectedTasks.map((task) => (
                    <div key={task.id} className="animate-slide-in group">
                      <TaskItem
                        task={task}
                        selected={selectedTask?.id === task.id}
                        onToggleComplete={(tk) => completeTask.mutate({ id: tk.id, complete: tk.status !== 'done' })}
                        onDelete={(tk) => {
                          haptics.error()
                          deleteTask.mutate(tk)
                          if (selectedTask?.id === tk.id) setSelectedTask(null)
                        }}
                        onOpen={(tk) => setSelectedTask(tk)}
                      />
                    </div>
                  ))}
                </AnimatePresence>
              ) : (
                <p className="px-4 py-2 text-sm text-gray-400">{t('calendar.noTasks' as MessageKey)}</p>
              )}
            </div>
            {defaultList && (
              <QuickAdd
                ref={quickAddRef}
                placeholder={t('calendar.addPlaceholder' as MessageKey)}
                onAdd={(data) => addTask(selectedDay, data)}
              />
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetail
            key="task-detail"
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(patch) => updateTask.mutate(patch)}
            onDelete={(task) => deleteTask.mutate(task)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
