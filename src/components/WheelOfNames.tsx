import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildSegments,
  computeLandingRotation,
  parseNames,
  pickWeightedIndex,
  segmentIndexAtPointer,
} from '../lib/wheel'
import { playTick, primeWheelAudio } from '../lib/wheelSound'

const DEFAULT_NAMES = 'VoidFrame Studios\nTeam Trenchcoat\nGolden Gear'
const SLICE_FILLS = ['#15110a', '#050403']
const SPIN_DURATION = 4600

function truncate(name: string, max: number): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const p1 = polarToCartesian(cx, cy, r, startDeg)
  const p2 = polarToCartesian(cx, cy, r, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`
}

export function WheelOfNames() {
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const names = useMemo(() => parseNames(namesText), [namesText])
  const entries = useMemo(
    () => names.map((name) => ({ name, weight: weights[name] ?? 1 })),
    [names, weights],
  )
  const totalWeight = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0)
  const segments = useMemo(() => buildSegments(entries), [entries])

  const setWeight = (name: string, weight: number) =>
    setWeights((prev) => ({ ...prev, [name]: weight }))

  const resetWeights = () => setWeights({})

  const spin = useCallback(() => {
    if (spinning || entries.length < 2) return

    primeWheelAudio()
    const winnerIdx = pickWeightedIndex(entries.map((e) => e.weight))
    const segs = buildSegments(entries)
    const spins = 6 + Math.floor(Math.random() * 3)
    const target = computeLandingRotation(segs[winnerIdx], rotation, spins)

    setWinner(null)
    setSpinning(true)

    const from = rotation
    const delta = target - from
    const start = performance.now()
    let lastIdx = segmentIndexAtPointer(segs, from)

    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / SPIN_DURATION)
      const eased = 1 - Math.pow(1 - t, 4)
      const current = from + delta * eased
      setRotation(current)

      const idx = segmentIndexAtPointer(segs, current)
      if (idx !== lastIdx) {
        lastIdx = idx
        playTick()
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        setSpinning(false)
        setWinner(segs[winnerIdx].name)
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(frame)
  }, [entries, rotation, spinning])

  const fontSize = names.length > 10 ? 10 : names.length > 6 ? 12 : 15

  return (
    <div className="flex flex-col items-center gap-10 py-4 lg:flex-row lg:items-start lg:justify-center lg:gap-14">
      <div className="flex flex-col items-center">
        <div className="relative h-[320px] w-[320px] sm:h-[400px] sm:w-[400px]">
          <div
            className="pointer-events-none absolute -inset-10 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(207,185,145,0.14),transparent_65%)]"
            aria-hidden
          />

          <svg
            viewBox="0 0 400 400"
            className="relative z-10 h-full w-full drop-shadow-[0_0_40px_rgba(0,0,0,0.6)]"
          >
            <circle
              cx={200}
              cy={200}
              r={192}
              fill="none"
              stroke="#cfb991"
              strokeOpacity={0.5}
              strokeWidth={2}
            />
            <g transform={`rotate(${rotation} 200 200)`}>
              {segments.map((seg, i) => (
                <path
                  key={`slice-${seg.name}-${i}`}
                  d={describeArcPath(200, 200, 186, seg.startAngle, seg.endAngle)}
                  fill={SLICE_FILLS[i % SLICE_FILLS.length]}
                  stroke="#8e6f3e"
                  strokeWidth={1}
                />
              ))}
              {segments.map((seg, i) => {
                const mid = (seg.startAngle + seg.endAngle) / 2
                return (
                  <text
                    key={`label-${seg.name}-${i}`}
                    x={200}
                    y={200}
                    fontSize={fontSize}
                    fill="#ebd99f"
                    textAnchor="middle"
                    className="font-display"
                    transform={`rotate(${mid} 200 200) translate(0 -160)`}
                  >
                    {truncate(seg.name, 18)}
                  </text>
                )
              })}
            </g>
            <circle cx={200} cy={200} r={46} fill="#000000" stroke="#cfb991" strokeWidth={2} />
          </svg>

          <svg
            viewBox="0 0 28 24"
            className="pointer-events-none absolute left-1/2 top-[-4px] z-20 h-6 w-7 -translate-x-1/2 drop-shadow-[0_0_10px_rgba(218,170,0,0.7)]"
            aria-hidden
          >
            <polygon points="14,24 0,0 28,0" fill="#ebd99f" />
          </svg>

          <button
            type="button"
            onClick={spin}
            disabled={spinning || entries.length < 2}
            className="absolute left-1/2 top-1/2 z-20 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#cfb991]/70 bg-black font-display text-sm font-semibold uppercase tracking-widest text-[#ebd99f] transition hover:bg-[#cfb991]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {spinning ? '···' : 'Spin'}
          </button>
        </div>

        <div className="mt-8 h-[92px] w-full max-w-md">
          {winner && !spinning && (
            <div className="rounded-2xl border border-[#cfb991]/60 bg-[#cfb991]/[0.08] px-8 py-5 text-center shadow-[0_0_60px_-12px_rgba(218,170,0,0.4)]">
              <p className="font-sans text-xs font-medium uppercase tracking-[0.3em] text-[#9d9795]">
                Selected
              </p>
              <p className="animate-gold-sheen mt-1 font-display text-2xl font-bold sm:text-3xl">
                {winner}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-sm">
        <label className="font-sans text-xs font-medium uppercase tracking-[0.3em] text-[#ddb945]">
          Entries
        </label>
        <textarea
          value={namesText}
          onChange={(e) => setNamesText(e.target.value)}
          disabled={spinning}
          rows={6}
          placeholder="One name per line"
          className="mt-2 w-full resize-y rounded-xl border border-[#555960]/60 bg-white/[0.02] px-4 py-3 font-sans text-sm text-[#ebd99f] outline-none placeholder:text-[#6b6560] focus:border-[#cfb991]/60 disabled:opacity-60"
        />

        <div className="mt-6 flex items-center justify-between">
          <label className="font-sans text-xs font-medium uppercase tracking-[0.3em] text-[#ddb945]">
            Weights
          </label>
          <button
            type="button"
            onClick={resetWeights}
            disabled={spinning}
            className="font-sans text-xs text-[#c4bfc0] underline-offset-4 hover:underline disabled:opacity-50"
          >
            Reset to equal
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {names.length === 0 && (
            <p className="font-sans text-sm text-[#6b6560]">
              Add at least two names above.
            </p>
          )}
          {names.map((name) => {
            const w = weights[name] ?? 1
            const pct = totalWeight > 0 ? (Math.max(0, w) / totalWeight) * 100 : 0
            return (
              <div key={name} className="flex items-center gap-3">
                <span
                  className="w-28 shrink-0 truncate font-sans text-sm text-[#c4bfc0]"
                  title={name}
                >
                  {name}
                </span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={w}
                  disabled={spinning}
                  onChange={(e) => setWeight(name, Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer accent-[#cfb991] disabled:opacity-50"
                  aria-label={`Weight for ${name}`}
                />
                <span className="w-12 shrink-0 text-right font-sans text-xs tabular-nums text-[#9d9795]">
                  {pct.toFixed(0)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
