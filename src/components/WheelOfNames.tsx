import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildSegments,
  computeLandingRotation,
  parseNames,
  pickWeightedIndex,
  removeName,
  segmentIndexAtPointer,
  shuffled,
} from '../lib/wheel'
import { playTick, primeWheelAudio } from '../lib/wheelSound'

const DEFAULT_NAMES = 'VoidFrame Studios\nTeam Trenchcoat\nGolden Gear'
const SLICE_FILLS = ['#15110a', '#050403']
const SPIN_DURATION = 4600
const REVEAL_PAUSE = 450

const easeOut = [0.16, 1, 0.3, 1] as const
const easeSnap = [0.22, 1, 0.36, 1] as const

type Phase = 'idle' | 'spinning' | 'revealed' | 'shuffling' | 'listed'

const SHUFFLE_STEPS = 14

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
  const [phase, setPhase] = useState<Phase>('idle')
  const [winner, setWinner] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [hideWeights, setHideWeights] = useState(false)
  const [shuffleOrder, setShuffleOrder] = useState<string[] | null>(null)
  const [displayOrder, setDisplayOrder] = useState<string[]>([])
  const rafRef = useRef<number | null>(null)
  const revealTimeoutRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (revealTimeoutRef.current !== null) {
        window.clearTimeout(revealTimeoutRef.current)
      }
    },
    [],
  )

  const names = useMemo(() => parseNames(namesText), [namesText])
  const entries = useMemo(
    () => names.map((name) => ({ name, weight: weights[name] ?? 1 })),
    [names, weights],
  )
  const totalWeight = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0)
  /** Segments actually drawn/spun on the wheel — equal-sized when weights are hidden, so
   *  the wheel's look never gives away the odds even though picks stay weighted. */
  const displayEntries = useMemo(
    () => (hideWeights ? entries.map((e) => ({ ...e, weight: 1 })) : entries),
    [entries, hideWeights],
  )
  const segments = useMemo(() => buildSegments(displayEntries), [displayEntries])

  const setWeight = (name: string, weight: number) =>
    setWeights((prev) => ({ ...prev, [name]: weight }))

  const resetWeights = () => setWeights({})

  const spin = useCallback(() => {
    if (phase !== 'idle' || entries.length < 2) return

    primeWheelAudio()
    const winnerIdx = pickWeightedIndex(entries.map((e) => e.weight))
    const segs = segments
    const spins = 6 + Math.floor(Math.random() * 3)
    const target = computeLandingRotation(segs[winnerIdx], rotation, spins)

    setPhase('spinning')

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
        rafRef.current = null
        revealTimeoutRef.current = window.setTimeout(() => {
          setWinner(segs[winnerIdx].name)
          setPhase('revealed')
        }, REVEAL_PAUSE)
      }
    }
    rafRef.current = requestAnimationFrame(frame)
  }, [entries, segments, rotation, phase])

  useEffect(() => {
    if (phase !== 'shuffling' || !shuffleOrder) return
    const finalOrder = shuffleOrder
    let step = 0
    let timeout = 0

    const run = () => {
      if (step < SHUFFLE_STEPS) {
        setDisplayOrder(shuffled(finalOrder))
        playTick()
        timeout = window.setTimeout(run, 70 + step * step * 2.2)
        step++
      } else {
        setDisplayOrder(finalOrder)
        playTick()
        timeout = window.setTimeout(() => setPhase('listed'), 500)
      }
    }
    timeout = window.setTimeout(run, 0)

    return () => window.clearTimeout(timeout)
  }, [phase, shuffleOrder])

  const startShuffle = useCallback(() => {
    if (phase !== 'idle' || names.length < 2) return
    primeWheelAudio()
    setWinner(null)
    setDisplayOrder(names)
    setShuffleOrder(shuffled(names))
    setPhase('shuffling')
  }, [phase, names])

  const endShuffle = useCallback(() => {
    setShuffleOrder(null)
    setPhase('idle')
  }, [])

  const dropNames = useCallback((toDrop: string[]) => {
    setNamesText((text) => toDrop.reduce((acc, n) => removeName(acc, n), text))
    setWeights((prev) => {
      const next = { ...prev }
      for (const n of toDrop) delete next[n]
      return next
    })
  }, [])

  const removeFromList = useCallback(
    (name: string) => {
      dropNames([name])
      const remaining = (shuffleOrder ?? []).filter((n) => n !== name)
      if (remaining.length === 0) {
        endShuffle()
      } else {
        setShuffleOrder(remaining)
      }
    },
    [shuffleOrder, dropNames, endShuffle],
  )

  const removeAllListed = useCallback(() => {
    dropNames(shuffleOrder ?? [])
    endShuffle()
  }, [shuffleOrder, dropNames, endShuffle])

  const keepWinner = useCallback(() => {
    setWinner(null)
    setPhase('idle')
  }, [])

  const removeWinner = useCallback(() => {
    if (winner) dropNames([winner])
    setWinner(null)
    setPhase('idle')
  }, [winner, dropNames])

  const listOrder = phase === 'shuffling' ? displayOrder : (shuffleOrder ?? [])

  const fontSize = names.length > 10 ? 10 : names.length > 6 ? 12 : 15

  return (
    <div className="flex flex-col items-center gap-10 py-4 lg:flex-row lg:items-start lg:justify-center lg:gap-14">
      <div className="flex flex-col items-center">
        <div className="relative h-[320px] w-[320px] sm:h-[400px] sm:w-[400px]">
          <div
            className="pointer-events-none absolute -inset-10 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(207,185,145,0.14),transparent_65%)]"
            aria-hidden
          />

          <AnimatePresence>
            {(phase === 'shuffling' || phase === 'listed') && (
              <motion.div
                key="list"
                className="absolute inset-0 flex flex-col"
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.12, filter: 'blur(8px)' }}
                transition={{ duration: 0.5, ease: easeSnap }}
              >
                <p className="mb-2 text-center font-sans text-xs font-medium uppercase tracking-[0.3em] text-[#9d9795]">
                  {phase === 'shuffling' ? 'Shuffling…' : 'Random order'}
                </p>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#cfb991]/40 bg-white/[0.02] p-2 shadow-[0_0_60px_-15px_rgba(218,170,0,0.35)]">
                  <motion.ul
                    className="space-y-1.5"
                    animate={{
                      filter: phase === 'shuffling' ? 'blur(1.5px)' : 'blur(0px)',
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <AnimatePresence initial={false}>
                      {listOrder.map((name, i) => (
                        <motion.li
                          key={name}
                          layout
                          exit={{ opacity: 0, x: 40 }}
                          transition={{
                            layout: { type: 'spring', stiffness: 520, damping: 38 },
                            duration: 0.25,
                          }}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                            i === 0 && phase === 'listed'
                              ? 'border-[#cfb991]/60 bg-[#cfb991]/[0.1]'
                              : 'border-white/10 bg-white/[0.03]'
                          }`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#cfb991]/50 font-sans text-xs tabular-nums text-[#cfb991]">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-[#ebd99f]">
                            {name}
                          </span>
                          {phase === 'listed' && (
                            <button
                              type="button"
                              onClick={() => removeFromList(name)}
                              aria-label={`Remove ${name} from wheel`}
                              className="shrink-0 rounded-full px-2 text-lg leading-none text-[#9d9795] transition hover:text-[#ebd99f]"
                            >
                              ×
                            </button>
                          )}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(phase === 'idle' || phase === 'spinning') && (
              <motion.div
                key="wheel"
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.7, filter: 'blur(8px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 2.3, filter: 'blur(10px)' }}
                transition={{ duration: 0.7, ease: easeSnap }}
              >
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
                  disabled={phase !== 'idle' || entries.length < 2}
                  className="absolute left-1/2 top-1/2 z-20 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#cfb991]/70 bg-black font-display text-sm font-semibold uppercase tracking-widest text-[#ebd99f] transition hover:bg-[#cfb991]/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {phase === 'spinning' ? '···' : 'Spin'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {phase === 'revealed' && winner && (
              <motion.div
                key="reveal"
                className="absolute inset-0 flex items-center justify-center px-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(207,185,145,0.3),transparent_60%)]"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 0.6, 0.35], scale: 1 }}
                  transition={{ duration: 1.7, ease: easeOut }}
                  aria-hidden
                />
                <motion.p
                  className="animate-gold-sheen relative z-10 text-center font-display text-2xl font-bold leading-tight sm:text-3xl"
                  initial={{ opacity: 0, scale: 0.75, filter: 'blur(14px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  transition={{ duration: 0.75, delay: 0.3, ease: easeOut }}
                >
                  {winner}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-8 flex min-h-[52px] w-full max-w-md items-center justify-center">
          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div
                key="shuffle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, ease: easeOut }}
              >
                <button
                  type="button"
                  onClick={startShuffle}
                  disabled={names.length < 2}
                  className="rounded-full border border-[#c9a227]/60 bg-[#c9a227]/10 px-6 py-2.5 font-sans text-xs font-semibold uppercase tracking-wider text-[#e8d48b] transition hover:bg-[#c9a227]/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Shuffle remaining ({names.length})
                </button>
              </motion.div>
            )}
            {phase === 'listed' && (
              <motion.div
                key="list-actions"
                className="flex items-center gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.4, ease: easeOut }}
              >
                <button
                  type="button"
                  onClick={endShuffle}
                  className="rounded-full border border-[#555960] px-5 py-2 font-sans text-xs font-medium uppercase tracking-wider text-[#ebd99f] transition hover:bg-[#555960]/20"
                >
                  Keep all in wheel
                </button>
                <button
                  type="button"
                  onClick={removeAllListed}
                  className="rounded-full border border-[#c9a227]/60 bg-[#c9a227]/10 px-5 py-2 font-sans text-xs font-medium uppercase tracking-wider text-[#e8d48b] transition hover:bg-[#c9a227]/20"
                >
                  Remove all from wheel
                </button>
              </motion.div>
            )}
            {phase === 'revealed' && (
              <motion.div
                key="actions"
                className="flex items-center gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.4, delay: 0.6, ease: easeOut }}
              >
                <button
                  type="button"
                  onClick={keepWinner}
                  className="rounded-full border border-[#555960] px-5 py-2 font-sans text-xs font-medium uppercase tracking-wider text-[#ebd99f] transition hover:bg-[#555960]/20"
                >
                  Keep in wheel
                </button>
                <button
                  type="button"
                  onClick={removeWinner}
                  className="rounded-full border border-[#c9a227]/60 bg-[#c9a227]/10 px-5 py-2 font-sans text-xs font-medium uppercase tracking-wider text-[#e8d48b] transition hover:bg-[#c9a227]/20"
                >
                  Remove from wheel
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="w-full max-w-sm">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-[#555960]/40 bg-white/[0.02] px-4 py-3 text-left transition hover:border-[#cfb991]/40"
          aria-expanded={panelOpen}
        >
          <span className="font-sans text-xs font-medium uppercase tracking-[0.3em] text-[#ddb945]">
            Entries
          </span>
          <span className="flex items-center gap-2 font-sans text-xs text-[#9d9795]">
            {names.length} {names.length === 1 ? 'name' : 'names'}
            <motion.span
              animate={{ rotate: panelOpen ? 0 : -90 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="inline-block text-[#cfb991]"
              aria-hidden
            >
              ▾
            </motion.span>
          </span>
        </button>

        <motion.div
          initial={false}
          animate={{ height: panelOpen ? 'auto' : 0, opacity: panelOpen ? 1 : 0 }}
          transition={{ duration: 0.35, ease: easeOut }}
          style={{ overflow: 'hidden' }}
        >
          <div className="pt-4">
            <label className="font-sans text-xs font-medium uppercase tracking-[0.3em] text-[#ddb945]">
              Entries
            </label>
            <textarea
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              disabled={phase !== 'idle'}
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
                disabled={phase !== 'idle'}
                className="font-sans text-xs text-[#c4bfc0] underline-offset-4 hover:underline disabled:opacity-50"
              >
                Reset to equal
              </button>
            </div>

            <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#555960]/30 bg-white/[0.02] px-3 py-2">
              <span className="font-sans text-xs text-[#c4bfc0]">
                Hide weights on the wheel
              </span>
              <span className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={hideWeights}
                  onChange={(e) => setHideWeights(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-[#555960]/60 transition peer-checked:bg-[#cfb991]/70" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[#ebd99f] transition peer-checked:translate-x-4" />
              </span>
            </label>

            <div className="mt-3 space-y-3">
              {names.length === 0 && (
                <p className="font-sans text-sm text-[#6b6560]">
                  Add at least two names above.
                </p>
              )}
              {names.map((name) => {
                const w = weights[name] ?? 1
                const pct =
                  totalWeight > 0 ? (Math.max(0, w) / totalWeight) * 100 : 0
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
                      disabled={phase !== 'idle'}
                      onChange={(e) => setWeight(name, Number(e.target.value))}
                      className="h-1 flex-1 cursor-pointer accent-[#cfb991] disabled:opacity-50"
                      aria-label={`Weight for ${name}`}
                    />
                    <span className="w-12 shrink-0 text-right font-sans text-xs tabular-nums text-[#9d9795]">
                      {hideWeights ? '—' : `${pct.toFixed(0)}%`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
