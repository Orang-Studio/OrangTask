export function TaskSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-ink-700">
      <div className="skeleton w-5 h-5 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
    </div>
  )
}

export function TaskListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <TaskSkeleton key={i} />
      ))}
    </div>
  )
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton h-9 rounded" />
      ))}
    </div>
  )
}
