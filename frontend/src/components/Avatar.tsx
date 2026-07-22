interface Props {
  name?: string | null
  url?: string | null
  size?: number
}

export function Avatar({ name, url, size = 24 }: Props) {
  if (url) {
    return (
      <img
        src={url}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
        alt={name || ''}
        title={name || undefined}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }}
      title={name || undefined}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}
