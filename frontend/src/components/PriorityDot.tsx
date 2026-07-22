const PRIORITY_COLORS: Record<string, string> = {
  none: '#6b7280',
  low: '#3b82f6',
  medium: '#eab308',
  high: '#ef4444',
}

export const PRIORITY_LABELS: Record<string, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export function PriorityDot({ priority, size = 8 }: { priority: string; size?: number }) {
  if (priority === 'none') return null
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: PRIORITY_COLORS[priority] || PRIORITY_COLORS.none }}
      title={`${PRIORITY_LABELS[priority]} priority`}
    />
  )
}

export { PRIORITY_COLORS }
