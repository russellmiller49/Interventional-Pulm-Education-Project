import type { DolphinSourceId } from '../data/sources'

/**
 * The bronchoscopy record.
 *
 * `nmmp-2019` is the form in use (Smith 2019): the trachea, the tracheal bronchus, both main
 * bronchi, branches 1 to 9 on each side, and the lavage fluid volume returned. `tursiops-draft` is
 * a proposal that adds the tracheal bronchus divisions and branches 10 to 14 from the ten-animal
 * mapping, with instilled as well as returned volume; the NMMP form is the one that counts.
 *
 * The report act pre-fills "reached" from the survey the section's scope lab recorded and refuses
 * "reached" for a site the scope never entered: an honest record writes "not reached".
 */
export type ReportTemplateId = 'nmmp-2019' | 'tursiops-draft'

export interface ReportSite {
  readonly id: string
  /** The centerline label a survey visit maps to. */
  readonly abbr: string
  readonly label: string
}

export interface ReportTemplate {
  readonly id: ReportTemplateId
  readonly title: string
  readonly status: string
  readonly sites: readonly ReportSite[]
  /** How many lavage return entries the form holds. */
  readonly balReturnEntries: number
  readonly recordsInstilled: boolean
  readonly sourceIds: readonly DolphinSourceId[]
}

const numbered = (side: 'R' | 'L', from: number, to: number): ReportSite[] =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const n = from + i
    return { id: `${side.toLowerCase()}b${n}`, abbr: `${side}B${n}`, label: `${side}B${n}` }
  })

const CENTRAL: readonly ReportSite[] = [
  { id: 'trachea', abbr: 'TRA', label: 'Trachea' },
  { id: 'rtb', abbr: 'RTB', label: 'Right tracheal bronchus' },
  { id: 'rmb', abbr: 'RMB', label: 'Right main bronchus' },
  { id: 'lmb', abbr: 'LMB', label: 'Left main bronchus' },
]

export const DOLPHIN_REPORT_TEMPLATES: Readonly<Record<ReportTemplateId, ReportTemplate>> = {
  'nmmp-2019': {
    id: 'nmmp-2019',
    title: 'NMMP Dolphin Bronchoscopy Form',
    status: 'The form in use (Smith 2019).',
    sites: [...CENTRAL, ...numbered('R', 1, 9), ...numbered('L', 1, 9)],
    balReturnEntries: 3,
    recordsInstilled: false,
    sourceIds: ['nmmp-form-2019'],
  },
  'tursiops-draft': {
    id: 'tursiops-draft',
    title: 'Extended record for the bottlenose dolphin',
    status: 'Proposed from the ten-animal mapping; the NMMP form is the one that counts.',
    sites: [
      ...CENTRAL.slice(0, 2),
      { id: 'rt1', abbr: 'RT1', label: 'RT1' },
      { id: 'rt2', abbr: 'RT2', label: 'RT2' },
      { id: 'rt3', abbr: 'RT3', label: 'RT3' },
      ...CENTRAL.slice(2),
      ...numbered('R', 1, 14),
      ...numbered('L', 1, 14),
    ],
    balReturnEntries: 3,
    recordsInstilled: true,
    sourceIds: ['nmmp-mapping-2026', 'nmmp-form-2019'],
  },
}

export type SiteReached = 'reached' | 'not-reached'
export type SiteFinding = 'normal' | 'abnormal' | 'not-seen'

export interface ReportRow {
  readonly reached: SiteReached
  readonly appearance: SiteFinding
  readonly secretions: 'none' | 'some' | 'copious' | 'not-seen'
  readonly sampled: 'none' | 'lavage' | 'brush' | 'biopsy'
}

/**
 * The value a site's "reached" field may take, given the survey. A site the scope never entered
 * may not be written as reached.
 */
export function allowedReached(
  site: ReportSite,
  visited: ReadonlySet<string>,
): readonly SiteReached[] {
  return visited.has(site.abbr) ? ['reached', 'not-reached'] : ['not-reached']
}

export function initialReportRow(site: ReportSite, visited: ReadonlySet<string>): ReportRow {
  const reached = visited.has(site.abbr)
  return {
    reached: reached ? 'reached' : 'not-reached',
    appearance: reached ? 'normal' : 'not-seen',
    secretions: reached ? 'none' : 'not-seen',
    sampled: 'none',
  }
}

/** What is wrong with a written row: a claim the survey does not support. */
export function reportRowErrors(
  site: ReportSite,
  row: ReportRow,
  visited: ReadonlySet<string>,
): readonly string[] {
  const errors: string[] = []
  if (row.reached === 'reached' && !visited.has(site.abbr)) {
    errors.push(`${site.label} was not entered on this survey; write it as not reached.`)
  }
  if (row.reached === 'not-reached' && (row.appearance !== 'not-seen' || row.sampled !== 'none')) {
    errors.push(`${site.label} was not reached, so it has no appearance or sample to record.`)
  }
  return errors
}
