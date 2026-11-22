import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import {
  DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent, type Modifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useHaptics } from '../hooks/useHaptics'

// hold this long without moving to grab a row a quick drag still scrolls or swipes
const HOLD = { delay: 250, tolerance: 6 }

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

const DisabledContext = createContext(false)

// the click that ends a drag would open the row or follow its link so eat it
function swallowNextClick() {
  const stop = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  window.addEventListener('click', stop, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 100)
}

export function SortableList({ ids, onReorder, disabled = false, immediate = false, children }: {
  ids: string[]
  onReorder: (ids: string[]) => void
  disabled?: boolean
  immediate?: boolean
  children: ReactNode
}) {
  const haptics = useHaptics()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: immediate ? { distance: 4 } : HOLD }),
    useSensor(TouchSensor, { activationConstraint: immediate ? { delay: 120, tolerance: 6 } : HOLD }),
  )

  const handleEnd = ({ active, over }: DragEndEvent) => {
    swallowNextClick()
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    haptics.tap()
    onReorder(arrayMove(ids, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      onDragStart={() => haptics.drag()}
      onDragEnd={handleEnd}
      onDragCancel={swallowNextClick}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <DisabledContext.Provider value={disabled}>{children}</DisabledContext.Provider>
      </SortableContext>
    </DndContext>
  )
}

export function SortableItem({ id, className = '', useHandle = false, children }: {
  id: string
  className?: string
  useHandle?: boolean
  children: (dragging: boolean, handleProps?: Record<string, unknown>) => ReactNode
}) {
  const disabled = useContext(DisabledContext)
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id, disabled })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 20 : undefined,
  }

  const handleProps = !disabled && useHandle
    ? { ref: setActivatorNodeRef, ...attributes, ...listeners }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled || useHandle ? {} : listeners)}
      className={`${disabled ? '' : '[-webkit-touch-callout:none]'} ${
        isDragging ? 'shadow-lg ring-1 ring-orange-500/60 cursor-grabbing' : ''
      } ${className}`}
    >
      {children(isDragging, handleProps)}
    </div>
  )
}
