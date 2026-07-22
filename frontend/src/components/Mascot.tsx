/** pip - the OrangTask fox mascot */

export type MascotPose = 'idle' | 'happy' | 'sleeping' | 'searching'

const FUR = '#f97316' // orange-500, brand fur
const FUR_DARK = '#ea580c' // orange-600, shadow blocking
const FUR_LIGHT = '#fb923c' // orange-400, ear/tail highlight
const CREAM = '#ffe8cf' // belly, muzzle, tail tip, inner ear
const INK = '#1a1a1a' // eyes, nose, line work

export function Mascot({
  pose = 'idle',
  size = 132,
  float = true,
  className = '',
}: {
  pose?: MascotPose
  size?: number
  float?: boolean
  className?: string
}) {
  // eye centers (symmetric around x=120)
  const eyeY = 104
  const lx = 104
  const rx = 136

  const closedHappy = (cx: number) =>
    `M ${cx - 7} ${eyeY + 2} Q ${cx} ${eyeY - 6} ${cx + 7} ${eyeY + 2}`
  const closedSleep = (cx: number) =>
    `M ${cx - 7} ${eyeY - 1} Q ${cx} ${eyeY + 5} ${cx + 7} ${eyeY - 1}`

  const eyesClosed = pose === 'happy' || pose === 'sleeping'
  const closedPath = pose === 'sleeping' ? closedSleep : closedHappy

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className={`${float ? 'mascot-float' : ''} ${className}`.trim()}
      style={{ overflow: 'visible' }}
    >
      {/* ---- Tail (behind body, right side) ---- */}
      <g>
        <path
          d="M 150 200 L 138 150 L 152 120 L 180 105 L 210 122 L 222 152 L 214 186 L 188 206 L 162 208 Z"
          fill={FUR_DARK}
        />
        <path
          d="M 152 196 L 144 152 L 156 126 L 180 112 L 205 127 L 214 153 L 207 182 L 185 199 L 164 201 Z"
          fill={FUR}
        />
        {/* cream tail tip */}
        <path d="M 180 105 L 210 122 L 200 138 L 173 122 Z" fill={CREAM} />
      </g>

      {/* ---- Body ---- */}
      <path
        d="M 120 150 C 95 150 78 174 78 198 C 78 217 96 226 120 226 C 144 226 162 217 162 198 C 162 174 145 150 120 150 Z"
        fill={FUR}
      />
      {/* belly */}
      <path
        d="M 120 174 C 106 174 97 189 97 202 C 97 216 108 222 120 222 C 132 222 143 216 143 202 C 143 189 134 174 120 174 Z"
        fill={CREAM}
      />
      {/* front paws */}
      <ellipse cx="104" cy="219" rx="9" ry="11" fill={CREAM} />
      <ellipse cx="136" cy="219" rx="9" ry="11" fill={CREAM} />
      <path d="M 104 214 L 104 224 M 100 214 L 100 224 M 108 214 L 108 224" stroke={FUR_DARK} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <path d="M 136 214 L 136 224 M 132 214 L 132 224 M 140 214 L 140 224" stroke={FUR_DARK} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />

      {/* ---- Ears (behind head) ---- */}
      <path d="M 70 95 L 58 38 L 108 72 Z" fill={FUR} />
      <path d="M 170 95 L 182 38 L 132 72 Z" fill={FUR} />
      <path d="M 75 88 L 67 52 L 99 71 Z" fill={CREAM} />
      <path d="M 165 88 L 173 52 L 141 71 Z" fill={CREAM} />

      {/* ---- Head (with pointed cheek tufts + muzzle) ---- */}
      <path
        d="M 76 80 C 76 58 96 48 120 48 C 144 48 164 58 164 80
           L 178 104 L 152 112 L 168 134 L 140 144 L 120 166
           L 100 144 L 72 134 L 88 112 L 62 104 Z"
        fill={FUR}
      />
      {/* cream face mask (rounded muzzle) */}
      <path
        d="M 90 106 C 90 98 104 95 120 95 C 136 95 150 98 150 106 C 150 128 138 150 120 164 C 102 150 90 128 90 106 Z"
        fill={CREAM}
      />

      {/* ---- Face ---- */}
      {eyesClosed ? (
        <>
          <path d={closedPath(lx)} stroke={INK} strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d={closedPath(rx)} stroke={INK} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx={lx} cy={eyeY} rx="5.2" ry="7" fill={INK} />
          <ellipse cx={rx} cy={eyeY} rx="5.2" ry="7" fill={INK} />
          <circle cx={lx + 1.8} cy={eyeY - 2.4} r="1.7" fill="#ffffff" />
          <circle cx={rx + 1.8} cy={eyeY - 2.4} r="1.7" fill="#ffffff" />
        </>
      )}

      {/* nose + mouth */}
      <path d="M 112 138 L 128 138 Q 122 150 120 152 Q 118 150 112 138 Z" fill={INK} />
      <path d="M 120 152 Q 120 158 113 159 M 120 152 Q 120 158 127 159" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* whiskers */}
      <path
        d="M 108 144 L 80 139 M 108 150 L 82 152 M 132 144 L 160 139 M 132 150 L 158 152"
        stroke={INK}
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* rosy cheeks on happy */}
      {pose === 'happy' && (
        <>
          <ellipse cx="92" cy="120" rx="6" ry="4" fill={FUR_LIGHT} opacity="0.55" />
          <ellipse cx="148" cy="120" rx="6" ry="4" fill={FUR_LIGHT} opacity="0.55" />
        </>
      )}

      {/* ---- Pose accessories ---- */}
      {pose === 'happy' && (
        <g>
          <circle cx="190" cy="60" r="15" fill={FUR} />
          <path d="M 182 60 L 188 67 L 199 53" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      )}

      {pose === 'sleeping' && (
        <g fill={INK} opacity="0.4" fontFamily="DM Sans, system-ui, sans-serif" fontWeight={700}>
          <text x="172" y="58" fontSize="16">z</text>
          <text x="188" y="42" fontSize="22">Z</text>
        </g>
      )}

      {pose === 'searching' && (
        <g>
          <circle cx="186" cy="58" r="13" fill="none" stroke={INK} strokeWidth="4" opacity="0.55" />
          <path d="M 196 68 L 206 78" stroke={INK} strokeWidth="4" strokeLinecap="round" opacity="0.55" />
        </g>
      )}
    </svg>
  )
}
