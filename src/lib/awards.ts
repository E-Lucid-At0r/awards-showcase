import Papa from 'papaparse'

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
  /** Set when student scoring is combined in: distinct professor/TA voters (weight vs students). */
  professorCount?: number
  /** Non-fatal data warnings (unmatched teams etc.). */
  notes?: string[]
}

/** Renames a category (by index) both in `categoryLabels` and its `byCategory` block. */
export function renameCategory(
  data: ParsedAwards,
  index: number,
  label: string,
): ParsedAwards {
  return {
    ...data,
    categoryLabels: data.categoryLabels.map((l, i) => (i === index ? label : l)),
    byCategory: data.byCategory.map((b, i) => (i === index ? { ...b, label } : b)),
  }
}

/** Renames the final/overall award section (e.g. "Grand average"). */
export function renameOverall(data: ParsedAwards, label: string): ParsedAwards {
  return { ...data, overall: { ...data.overall, label } }
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

interface GroupSheet {
  teamNames: string[]
  scoreKeys: string[]
  /** Per team: mean score of every voter row, one entry per score column. */
  byTeamScores: Map<string, number[]>
  /** Most distinct voter names seen on any one team — robust to name typos in a single row. */
  voterCount: number
}

/** Google Form: group rows by team, average each score column. */
function readGroupSheet(
  rows: Record<string, string>[],
  headers: string[],
): GroupSheet {
  const teamKey =
    headers.find((h) => /presenting team name/i.test(h)) ?? ''
  if (!teamKey) {
    throw new Error('Missing a "Presenting Team Name" column.')
  }
  const fullKey = headers.find(
    (h) => /^full name$/i.test(h) || /full name/i.test(h),
  )
  const ti = headers.indexOf(teamKey)
  const voterKey = fullKey ?? headers[ti + 1]

  let scoreKeys: string[]
  if (fullKey !== undefined) {
    const i = headers.indexOf(fullKey)
    scoreKeys = headers.slice(i + 1)
  } else {
    scoreKeys = headers.slice(ti + 2)
  }

  if (scoreKeys.length < 1) {
    throw new Error('Need at least one score column after team info.')
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

  let voterCount = 0
  for (const teamRows of groups.values()) {
    const names = new Set(
      teamRows
        .map((r) => String(r[voterKey] ?? '').trim().toLowerCase())
        .filter(Boolean),
    )
    voterCount = Math.max(voterCount, names.size)
  }

  return { teamNames, scoreKeys, byTeamScores, voterCount }
}

function buildGroupAwards(
  teamNames: string[],
  scoreKeys: string[],
  byTeamScores: Map<string, number[]>,
  extra: Partial<ParsedAwards> = {},
): ParsedAwards {
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
    ...extra,
  }
}

function parseGroupMode(
  rows: Record<string, string>[],
  headers: string[],
): ParsedAwards {
  const { teamNames, scoreKeys, byTeamScores } = readGroupSheet(rows, headers)
  return buildGroupAwards(teamNames, scoreKeys, byTeamScores)
}

/** One row per nominee: col0 = name, remaining columns = scores */
function parseRowMode(
  rows: Record<string, string>[],
  headers: string[],
): ParsedAwards {
  const nameKey = headers[0]
  const scoreKeys = headers.slice(1)
  if (scoreKeys.length < 1) {
    throw new Error('Row mode needs a name column plus at least one score column.')
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

function readCsv(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
  })

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message ?? 'CSV parse error')
  }

  const fields = parsed.meta.fields?.filter(Boolean) ?? []
  if (fields.length < 2) {
    throw new Error(
      `Need at least a name column and one score column. Found ${fields.length}.`,
    )
  }

  const rows = parsed.data.filter((r) =>
    Object.values(r).some((v) => String(v ?? '').trim()),
  )

  if (rows.length === 0) {
    throw new Error('No data rows in CSV.')
  }

  return { rows, fields }
}

export function parseAwardsCsv(csv: string): ParsedAwards {
  const { rows, fields } = readCsv(csv)
  const hasTeamCol = fields.some((f) => /presenting team name/i.test(f))
  if (hasTeamCol) {
    return parseGroupMode(rows, fields)
  }
  return parseRowMode(rows, fields)
}

const normTeam = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Professor/TA sheet + student sheet (both Google Form style, grouped by team).
 * Per column: (P × professorAvg + 1 × studentAvg) / (P + 1), P = professors voting per team.
 * Teams are matched by name (case/space-insensitive); a team with no student votes
 * falls back to its professor average. Student-only teams are dropped.
 */
export function parseCombinedCsv(
  professorCsv: string,
  studentCsv: string,
): ParsedAwards {
  const read = (csv: string, who: string) => {
    try {
      const { rows, fields } = readCsv(csv)
      return readGroupSheet(rows, fields)
    } catch (e) {
      throw new Error(`${who}: ${e instanceof Error ? e.message : 'could not parse.'}`)
    }
  }
  const prof = read(professorCsv, 'Professor/TA CSV')
  const stud = read(studentCsv, 'Student CSV')

  if (prof.scoreKeys.length !== stud.scoreKeys.length) {
    throw new Error(
      `Professor/TA CSV has ${prof.scoreKeys.length} score columns but student CSV has ${stud.scoreKeys.length}.`,
    )
  }

  const P = prof.voterCount
  const studentByTeam = new Map(
    stud.teamNames.map((t) => [normTeam(t), stud.byTeamScores.get(t)!]),
  )

  const noStudentVotes: string[] = []
  const combined = new Map<string, number[]>()
  for (const team of prof.teamNames) {
    const p = prof.byTeamScores.get(team)!
    const s = studentByTeam.get(normTeam(team))
    if (!s) {
      noStudentVotes.push(team)
      combined.set(team, p)
    } else {
      combined.set(team, p.map((v, i) => (P * v + s[i]) / (P + 1)))
    }
  }

  if (noStudentVotes.length === prof.teamNames.length) {
    throw new Error('No team names match between the professor/TA and student CSVs.')
  }

  const profTeams = new Set(prof.teamNames.map(normTeam))
  const studentOnly = stud.teamNames.filter((t) => !profTeams.has(normTeam(t)))

  const notes: string[] = []
  if (noStudentVotes.length) {
    notes.push(`No student votes (professor score only): ${noStudentVotes.join(', ')}`)
  }
  if (studentOnly.length) {
    notes.push(`Student teams not in professor CSV (ignored): ${studentOnly.join(', ')}`)
  }

  return buildGroupAwards(prof.teamNames, prof.scoreKeys, combined, {
    professorCount: P,
    notes,
  })
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
