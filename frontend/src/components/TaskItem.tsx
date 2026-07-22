import { useState, useRef } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { Check, Trash2, CheckCircle2, GitBranch } from 'lucide-react'
import { Task } from '../lib/api'
import { Avatar } from './Avatar'
import { PriorityDot } from './PriorityDot'
import { formatDueDate, isOverdue } from '../lib/date'
import { useHaptics } from '../hooks/useHaptics'
import { useIsMobile } from '../hooks/useMediaQuery'

interface Props {
  task: Task
  onToggleComplete: (task: Task) => void
  onDelete: (task: Task) => void
  onOpen: (task: Task) => void
  selected?: boolean
}

export function TaskItem({ task, onToggleComplete, onDelete, onOpen, selected }: Props) {
  const haptics = useHaptics()
  const isMobile = useIsMobile()
  const controls = useAnimation()
  const [completing, setCompleting] = useState(false)
  const done = task.status === 'done'
  const overdue = !done && isOverdue(task.due_date)
  const dragStartX = useRef(0)

  const handleComplete = () => {
    if (!done) {
      haptics.success()
      setCompleting(true)
      // let the strike-through + fade play before notifying parent
      setTimeout(() => {
        onToggleComplete(task)
        setCompleting(false)
      }, 300)
    } else {
      haptics.tap()
      onToggleComplete(task)
    }
  }

  const handleSwipeEnd = (_e: unknown, info: { offset: { x: number } }) => {
    const threshold = 80
    if (info.offset.x < -threshold) {
      haptics.swipe()
      controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } }).then(() => onDelete(task))
    } else if (info.offset.x > threshold && !done) {
      haptics.swipe()
      controls.start({ x: 0 })
      handleComplete()
    } else {
      controls.start({ x: 0 })
    }
  }

  return (
    <div className="relative overflow-hidden">
      {/* swipe action backgrounds (mobile) */}
      {isMobile && (
        <>
          <div className="absolute inset-y-0 left-0 w-1/2 bg-orange-500 flex items-center pl-5">
            <CheckCircle2 size={20} className="text-white" />
          </div>
          <div className="absolute inset-y-0 right-0 w-1/2 bg-red-600 flex items-center justify-end pr-5">
            <Trash2 size={20} className="text-white" />
          </div>
        </>
      )}

      <motion.div
        drag={isMobile ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragStart={() => haptics.drag()}
        onDragEnd={handleSwipeEnd}
        animate={controls}
        className={`relative flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-800 cursor-pointer transition-colors
          ${selected ? 'bg-orange-50 dark:bg-ink-750' : 'hover:bg-gray-50 dark:hover:bg-ink-750'}
          ${completing ? 'animate-fade-out' : ''}`}
        onClick={() => onOpen(task)}
      >
        {/* checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleComplete()
          }}
          aria-label={done ? 'Mark incomplete' : 'Mark complete'}
          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
            ${done ? 'bg-orange-500 border-orange-500 animate-scale-check' : 'border-gray-400 dark:border-ink-400 hover:border-orange-500'}`}
          style={{ minWidth: 24, minHeight: 24 }}
        >
          {done && <Check size={14} className="text-white" strokeWidth={3} />}
        </button>

        {/* content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <PriorityDot priority={task.priority} />
            <span
              className={`text-[15px] leading-tight truncate transition-all ${
                done ? 'line-through text-gray-400 dark:text-ink-400' : ''
              }`}
            >
              {task.title}
            </span>
          </div>

          {(task.due_date || (task.tag_names && task.tag_names.length > 0) || (task.subtask_count ?? 0) > 0 || task.assigned_to) && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {task.due_date && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    overdue
                      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-ink-700 dark:text-ink-400'
                  }`}
                >
                  {formatDueDate(task.due_date)}
                </span>
              )}
              {(task.subtask_count ?? 0) > 0 && (
                <span className="text-xs text-gray-500 dark:text-ink-400 flex items-center gap-0.5">
                  <GitBranch size={11} />
                  {task.subtask_count}
                </span>
              )}
              {task.tag_names?.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                >
                  {tag}
                </span>
              ))}
              {task.assigned_to && (
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-ink-400">
                  <Avatar name={task.assignee_name} url={task.assignee_avatar} size={16} />
                  {task.assignee_name}
                </span>
              )}
              {task.list_name && (
                <span className="text-xs text-gray-400 dark:text-ink-500 truncate">
                  {task.list_name}
                </span>
              )}
            </div>
          )}
        </div>

        {/* desktop delete on hover */}
        {!isMobile && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              haptics.tap()
              onDelete(task)
            }}
            aria-label="Delete task"
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 size={16} />
          </button>
        )}
      </motion.div>
    </div>
  )
}
