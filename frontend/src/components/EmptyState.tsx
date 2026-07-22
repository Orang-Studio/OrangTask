import { LucideIcon } from 'lucide-react'
import { Mascot, MascotPose } from './Mascot'

export function EmptyState({
  icon: Icon,
  title,
  description,
  pose = 'idle',
}: {
  /** optional small Lucide badge tucked beside the mascot */
  icon?: LucideIcon
  title: string
  description: string
  /** mascot expression - pick the one that fits the empty context */
  pose?: MascotPose
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 select-none">
      <div className="relative mb-4">
        <Mascot pose={pose} size={132} />
        {Icon && (
          <span className="absolute -bottom-1 -right-1 w-9 h-9 flex items-center justify-center bg-white dark:bg-ink-750 border-2 border-ink-200 dark:border-ink-600">
            <Icon size={18} className="text-orange-500" strokeWidth={2} />
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold uppercase tracking-wide mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-ink-400 max-w-xs">{description}</p>
    </div>
  )
}
