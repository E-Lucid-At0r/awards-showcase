import Papa from 'papaparse'

export const CATEGORY_COUNT = 8

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Strip Google Form style prefixes (`a)`, `b)`), numeric `1)`, and text in
 * parentheses or square brackets from column headers for display.
 */
export function cleanCategoryLabel(raw: string): string {
  const original = raw.trim()
  let s = original
  s = s.replace(/^[a-z]\)\s*/i, '')
  s = s.replace(/^\d+\)\s*/, '')
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s.replace(/\s*\([^)]*\)/g, '')
    s = s.replace(/\s*\[[^\]]*\]/g, '')
  }
  s = s.replace(/\s+/g, ' ').trim()
  return s || original
}

/** Top three *score tiers*: 1st = highest distinct score(s), 2nd = next, 3rd = next. Ties share a tier. */
export interface PodiumTiers {
  /** Third-highest distinct score — may be multiple teams */
  third: { name: string; score: number }[]
  /** Second-highest distinct score */
  second: { name: string; score: number }[]
  /** Highest score(s) — 1st place */
  first: { name: string; score: number }[]
}

export interface CategoryBlock {
  label: string
  podium: PodiumTiers
}

export interface ParsedAwards {
  mode: 'group' | 'rows'
  teamCount: number
  categoryLabels: string[]
  byCategory: CategoryBlock[]
  overall: CategoryBlock
}

export type Slide =
  | {
      kind: 'title'
      sectionIndex: number
      sectionTotal: number
      label: string
      isOverall: boolean
      /** Opening slide before any category (e.g. event title only) */
      isIntro?: boolean
      /** Shown under main title on intro slide only */
      subtitle?: string
    }
  | {
      kind: 'place'
      sectionIndex: number
      sectionTotal: number
      categoryLabel: string
      isOverall: boolean
      placeLabel: '3rd Place' | '2nd Place' | '1st Place'
      rank: 1 | 2 | 3
      /** All teams tied for this place (same score) */
      teams: { name: string; score: number }[]
    }

/**
 * Higher score = better. Same score = same place (tie).
 *
 * Medals use the **three highest distinct scores** (not “top three teams”):
 * - **1st:** every team tied for the highest score
 * - **2nd:** every team tied for the **next** highest score (after 1st’s score)
 * - **3rd:** every team tied for the **third** highest distinct score
 *
 * Teams below the 3rd distinct score are not shown on the podium.
 */
export function computePodiumTiers(
  entries: { name: string; score: number }[],
): PodiumTiers {
  if (entries.length === 0) {
    return { third: [], second: [], first: [] }
  }

  const normalized = entries.map((e) => ({
    name: e.name,
    score: Number(e.score.toFixed(6)),
  }))

  const sorted = [...normalized].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.name.localeCompare(b.name)
  })

  const distinctScores = [...new Set(sorted.map((e) => e.score))].sort(
    (a, b) => b - a,
  )

  const s1 = distinctScores[0]
  const s2 = distinctScores[1]
  const s3 = distinctScores[2]

  const first = sorted.filter((e) => e.score === s1)
  const second =
    s2 !== undefined ? sorted.filter((e) => e.score === s2) : []
  const third = s3 !== undefined ? sorted.filter((e) => e.score === s3) : []

  return { first, second, third }
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** Google Form: group by team, average judge rows. */
function parseGroupMode(
  rows: Record<string, string>[],
  headers: string[],
): ParsedAwards {
  const teamKey =
    headers.find((h) => /presenting team name/i.test(h)) ?? ''
  const fullKey = headers.find(
    (h) => /^full name$/i.test(h) || /full name/i.test(h),
  )

  let scoreKeys: string[]
  if (fullKey !== undefined) {
    const i = headers.indexOf(fullKey)
    scoreKeys = headers.slice(i + 1, i + 1 + CATEGORY_COUNT)
  } else {
    const ti = headers.indexOf(teamKey)
    scoreKeys = headers.slice(ti + 2, ti + 2 + CATEGORY_COUNT)
  }

  if (scoreKeys.length < CATEGORY_COUNT) {
    throw new Error(
      `Need ${CATEGORY_COUNT} score columns after team info. Found ${scoreKeys.length}.`,
    )
  }

  const groups = new Map<string, Record<string, string>[]>()
  for (const row of rows) {
    const team = String(row[teamKey] ?? '').trim()
    if (!team) continue
    if (!groups.has(team)) groups.set(team, [])
    groups.get(team)!.push(row)
  }

  if (groups.size === 0) {
    throw new Error('No rows with a presenting team name.')
  }

  const teamNames = [...groups.keys()].sort((a, b) => a.localeCompare(b))

  const byTeamScores = new Map<string, number[]>()
  for (const team of teamNames) {
    const teamRows = groups.get(team)!
    const scores = scoreKeys.map((key) => {
      const vals = teamRows.map((r) => {
        const raw = String(r[key] ?? '').trim().replace(',', '.')
        const v = parseFloat(raw)
        if (Number.isNaN(v)) {
          throw new Error(`Invalid number for team "${team}" in column "${key}".`)
        }
        return v
      })
      return mean(vals)
    })
    byTeamScores.set(team, scores)
  }

  const categoryLabels = scoreKeys.map((k) => cleanCategoryLabel(k.trim()))

  const byCategory: CategoryBlock[] = categoryLabels.map((label, i) => ({
    label,
    podium: computePodiumTiers(
      teamNames.map((name) => ({
        name,
        score: byTeamScores.get(name)![i],
      })),
    ),
  }))

  const overallPodium = computePodiumTiers(
    teamNames.map((name) => {
      const s = byTeamScores.get(name)!
      return { name, score: mean(s) }
    }),
  )

  return {
    mode: 'group',
    teamCount: teamNames.length,
    categoryLabels,
    byCategory,
    overall: { label: 'Grand average', podium: overallPodium },
  }
}

/** One row per nominee: col0 = name, next 8 = scores */
function parseRowMode(
  rows: Record<string, string>[],
  headers: string[],
): ParsedAwards {
  const nameKey = headers[0]
  const scoreKeys = headers.slice(1, 1 + CATEGORY_COUNT)
  if (scoreKeys.length < CATEGORY_COUNT) {
    throw new Error(
      `Row mode needs name + ${CATEGORY_COUNT} score columns (${1 + CATEGORY_COUNT} columns).`,
    )
  }

  const contestants: { name: string; scores: number[] }[] = []
  for (const row of rows) {
    const name = String(row[nameKey] ?? '').trim()
    if (!name) continue
    const scores = scoreKeys.map((key, j) => {
      const raw = String(row[key] ?? '').trim().replace(',', '.')
      const v = parseFloat(raw)
      if (Number.isNaN(v)) {
        throw new Error(`Invalid number for "${name}" in column ${j + 2}.`)
      }
      return v
    })
    contestants.push({ name, scores })
  }

  if (contestants.length === 0) {
    throw new Error('No data rows with a name.')
  }

  const categoryLabels = scoreKeys.map((k) => cleanCategoryLabel(k.trim()))

  const byCategory: CategoryBlock[] = categoryLabels.map((label, i) => ({
    label,
    podium: computePodiumTiers(
      contestants.map((c) => ({ name: c.name, score: c.scores[i] })),
    ),
  }))

  const overallPodium = computePodiumTiers(
    contestants.map((c) => ({
      name: c.name,
      score: mean(c.scores),
    })),
  )

  return {
    mode: 'rows',
    teamCount: contestants.length,
    categoryLabels,
    byCategory,
    overall: { label: 'Grand average', podium: overallPodium },
  }
}

export function parseAwardsCsv(csv: string): ParsedAwards {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
  })

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message ?? 'CSV parse error')
  }

  const fields = parsed.meta.fields?.filter(Boolean) ?? []
  if (fields.length < 1 + CATEGORY_COUNT) {
    throw new Error(
      `Need at least ${1 + CATEGORY_COUNT} columns. Found ${fields.length}.`,
    )
  }

  const rows = parsed.data.filter((r) =>
    Object.values(r).some((v) => String(v ?? '').trim()),
  )

  if (rows.length === 0) {
    throw new Error('No data rows in CSV.')
  }

  const hasTeamCol = fields.some((f) => /presenting team name/i.test(f))
  if (hasTeamCol) {
    return parseGroupMode(rows, fields)
  }
  return parseRowMode(rows, fields)
}

/**
 * Build slides: title → 3rd → 2nd → 1st (always three place slides per section).
 * Tiers use the 1st / 2nd / 3rd **highest distinct scores**; ties share a tier.
 * Empty tiers (not enough distinct scores) still get a slide with `teams: []`.
 */
export function buildSlides(data: ParsedAwards): Slide[] {
  const slides: Slide[] = []
  const sections: CategoryBlock[] = [...data.byCategory, data.overall]
  const sectionTotal = sections.length

  slides.push({
    kind: 'title',
    sectionIndex: 0,
    sectionTotal,
    label: 'The Game Awards',
    subtitle: 'CGT 365',
    isOverall: false,
    isIntro: true,
  })

  const tierOrder: Array<{
    key: keyof PodiumTiers
    placeLabel: '3rd Place' | '2nd Place' | '1st Place'
    rank: 1 | 2 | 3
  }> = [
    { key: 'third', placeLabel: '3rd Place', rank: 3 },
    { key: 'second', placeLabel: '2nd Place', rank: 2 },
    { key: 'first', placeLabel: '1st Place', rank: 1 },
  ]

  sections.forEach((block, sectionIndex) => {
    const isOverall = sectionIndex === sections.length - 1
    slides.push({
      kind: 'title',
      sectionIndex: sectionIndex + 1,
      sectionTotal,
      label: block.label,
      isOverall,
    })

    const { podium } = block
    for (const { key, placeLabel, rank } of tierOrder) {
      const teams = podium[key]
      if (teams.length === 0) continue
      slides.push({
        kind: 'place',
        sectionIndex: sectionIndex + 1,
        sectionTotal,
        categoryLabel: block.label,
        isOverall,
        placeLabel,
        rank,
        teams,
      })
    }
  })

  return slides
}
