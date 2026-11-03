import type { DolphinSourceId } from '../data/sources'

/**
 * The bronchoscopy record.
 *
 * `nmmp-2019` is the form in use (Smith 2019): an airway drawing after Harper 2001 labeled from the
 * trachea to RB1–RB9 and LB1–LB9, with free-text lines under six headings (trachea, right tracheal
 * bronchus, right and left main bronchus, right and left lung). The paper form has no per-site
 * reached, appearance, secretions or sample fields and no drug or lidocaine fields; this template
 * splits each site's free-text line into those four fields, and its `status` says so. The form's
 * three "BAL fluid volume yield (ml)" blanks sit under the right tracheal bronchus, the right lung
 * and the left lung; the report act numbers its three return entries in that order, and `status`
 * names the order (the inputs are labeled by position in `ReportControl`). `tursiops-draft` is a
 * proposal that adds the tracheal bronchus divisions and branches 10 to 14 from the ten-animal
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
    status:
      'The form in use (Smith 2019). On paper each site has free-text lines; here each line is split into reached, appearance, secretions and sample. Its three lavage yield blanks, in order: under the right tracheal bronchus, the right lung (RB1–RB9) and the left lung (LB1–LB9).',
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
