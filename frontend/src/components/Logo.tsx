export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/icons/logo.png"
      width={size}
      height={size}
      alt="OrangTask"
      className={className}
      style={{ objectFit: 'contain' }}
      draggable={false}
    />
  )
}
