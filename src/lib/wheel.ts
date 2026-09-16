export interface WheelSegment {
  name: string
  weight: number
  /** Degrees, clockwise from the top (12 o'clock), 0-360. */
  startAngle: number
  endAngle: number
}

/** One name per non-empty line, trimmed, de-duplicated (case-insensitive), order preserved. */
export function parseNames(raw: string): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const line of raw.split('\n')) {
    const name = line.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

export function buildSegments(
  entries: { name: string; weight: number }[],
): WheelSegment[] {
  const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0)
  const equalShare = 360 / Math.max(1, entries.length)

  let angle = 0
  return entries.map((e) => {
    const w = Math.max(0, e.weight)
    const span = total > 0 ? (w / total) * 360 : equalShare
    const segment: WheelSegment = {
      name: e.name,
      weight: e.weight,
      startAngle: angle,
      endAngle: angle + span,
    }
    angle += span
    return segment
  })
}

/** Weighted-random index into `weights`. Falls back to uniform pick if all weights are zero. */
export function pickWeightedIndex(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0)
  if (total <= 0) return Math.floor(Math.random() * weights.length)

  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i])
    if (r <= 0) return i
  }
  return weights.length - 1
}

/** Which segment currently sits under the fixed top pointer for a given wheel rotation. */
export function segmentIndexAtPointer(
  segments: WheelSegment[],
  rotationDeg: number,
): number {
  const mod = ((rotationDeg % 360) + 360) % 360
  const local = (360 - mod) % 360
  for (let i = 0; i < segments.length; i++) {
    if (local >= segments[i].startAngle && local < segments[i].endAngle) {
      return i
    }
  }
  return segments.length - 1
}

/**
 * Next absolute rotation (keeps growing, never resets) so the wheel comes to rest with a
 * random point inside `segment` under the top pointer, after spinning forward `extraSpins`
 * additional full turns for effect.
 */
export function computeLandingRotation(
  segment: WheelSegment,
  currentRotation: number,
  extraSpins: number,
): number {
  const span = segment.endAngle - segment.startAngle
  const margin = Math.min(span / 4, 6)
  const target =
    segment.startAngle + margin + Math.random() * Math.max(0, span - margin * 2)

  const targetMod = (360 - target + 360) % 360
  const currentMod = ((currentRotation % 360) + 360) % 360
  const forwardDelta = ((targetMod - currentMod) % 360 + 360) % 360

  return currentRotation + forwardDelta + extraSpins * 360
}
