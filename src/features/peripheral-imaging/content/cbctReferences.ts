import { LESSONS } from '../data/lessons'
import { SOURCE_BY_ID } from '../data/sources'
import type { SourceId } from '../types'
import { imagingLearnerCopyErrors } from './learnerCopy'
import type { ImagingSectionId } from './pathway'

/**
 * Two reference aids for the CBCT sections (Prompt 04, owner decisions OD4-09 and OD4-10,
 * 2026-09-22). Both are built only from the course's own teaching and the studies it cites; every
 * row names where it comes from, and the validator holds that source to the lesson data.
 */

/** Where a row's wording comes from: a block of a section, or one of its takeaways. */
export interface TeachingBasis {
  readonly sectionId: ImagingSectionId
  readonly block?: string
  readonly takeaway?: string
}

/* ------------------------------------------------------------------ *
 * OD4-09 · fixed installation and mobile scanner (brief B)
 * ------------------------------------------------------------------ */

export interface FixedMobileRow {
  readonly id: string
  readonly aspect: string
  /** A statement that applies to both columns is printed once across them. */
  readonly both?: string
  readonly fixed?: string
  readonly mobile?: string
  readonly basis: readonly TeachingBasis[]
  readonly sourceIds: readonly SourceId[]
}

export const FIXED_MOBILE_COMPARISON: readonly FixedMobileRow[] = [
  {
    id: 'shared',
    aspect: 'Same in both',
    both: 'Portability changes logistics, not the physics. Both need the lesion centred in three dimensions, clearance for the full spin, a breath-hold plan and effective protection.',
    basis: [
      { sectionId: 'mobile-suite', takeaway: 'Portability changes logistics, not the physics.' },
      { sectionId: 'cbct-acquisition', block: 'Center the lesion in three dimensions' },
      { sectionId: 'cbct-acquisition', block: 'Make readiness a team check' },
    ],
    sourceIds: ['setser', 'mobile'],
  },
  {
    id: 'workflow',
    aspect: 'Workflow',
    fixed:
      'Plan bronchoscope and robot docking around the actual CBCT spin path. Room access, motion limits, detector clearance and navigation integration are installation-specific.',
    mobile:
      'Check table radiolucency, pedestal and base interference, power and parking, patient and robot clearance, image export and room shielding with the responsible team. Floor space for a C-arm is not a verified rotational clearance. Keep roles clear during scanner entry, positioning, acquisition, review and the return to sampling.',
    basis: [
      { sectionId: 'fixed-suite', block: 'Plan around the installed room' },
      { sectionId: 'mobile-suite', block: 'Commission the combination' },
      { sectionId: 'mobile-suite', block: 'Preserve orientation and registration' },
    ],
    sourceIds: ['setser', 'mobile', 'wabip'],
  },
  {
    id: 'configuration',
    aspect: 'Physical configuration',
    fixed:
      'May be floor-, ceiling- or robot-mounted, often with an integrated imaging table and dedicated shielding.',
    mobile:
      'A scanner brought into a procedure room, working with that room’s table and shielding, so the room, table and scanner are commissioned together.',
    basis: [
      { sectionId: 'fixed-suite', block: 'Plan around the installed room' },
      { sectionId: 'mobile-suite', takeaway: 'Commission the room, table and scanner together.' },
    ],
    sourceIds: ['setser', 'mobile'],
  },
  {
    id: 'capability',
    aspect: 'Imaging capability',
    both: 'Field of view, angular range, scan time, exposure modes, reconstructed image quality and workflow differ among models and software versions. A mobile label does not imply universally lower dose or poorer images, and a fixed label does not establish every navigation or overlay capability.',
    basis: [{ sectionId: 'mobile-suite', block: 'Compare capabilities individually' }],
    sourceIds: ['mobile', 'setser', 'tg272'],
  },
  {
    id: 'integration',
    aspect: 'Integration with navigation',
    fixed:
      'Supported table and C-arm position tracking can keep an overlay aligned through recognized equipment movement; lung-volume change and local deformation are separate problems. Fixed CBCT with augmented fluoroscopy is described in two primary studies.',
    mobile:
      'DICOM export alone does not show that two systems share a coordinate frame: verify orientation, volume identity and supported coordinate transfer. Robotic bronchoscopy integrated with a mobile CBCT has been studied, and mobile CBCT with a thin bronchoscope and radial probe is described in a retrospective series.',
    basis: [
      { sectionId: 'fixed-suite', block: 'Use integration deliberately' },
      { sectionId: 'mobile-suite', block: 'Preserve orientation and registration' },
    ],
    sourceIds: ['setser', 'pritchett', 'verhoeven', 'confirm', 'mobile'],
  },
]

/** What the course's own 3D scenes do and do not distinguish (OD4-09: field sizes equalised). */
export const FIXED_MOBILE_MODEL_NOTE =
  'In this course’s scenes the fixed and the mobile C-arm draw the same detector field and the same field of view; they differ only in how they are mounted. The scenes are authored illustrations, not a comparison of devices.'

export const FIXED_MOBILE_LIMIT =
  'No device, ranking or number: capabilities vary by model and software version, and no study the course cites compares a fixed with a mobile installation directly.'

/* ------------------------------------------------------------------ *
 * OD4-10 · team readiness before a CBCT spin (brief C)
 * ------------------------------------------------------------------ */

export const TEAM_READINESS_STATUS =
  'Teaching aid from the Peripheral Bronchoscopy Imaging course. Not an institutional protocol, an anesthesia protocol, a credentialing standard or a universal pre-procedure checklist. Your institution’s policy governs.'

export interface TeamReadinessRow {
  readonly id: string
  readonly role: 'Bronchoscopist' | 'Technologist' | 'Anesthesia' | 'Whole team'
  readonly confirm: string
  readonly basis: TeachingBasis
}

/**
 * Only source-backed teaching rows. The two organizational-suggestion rows the brief drafted (a
 * read-aloud call-and-answer, and a post-spin note of why a repeat was needed) were removed by the
 * owner (OD4-10) and must not come back as rows here; local workflow may be added later only if
 * specifically wanted, labelled as local practice.
 */
export const TEAM_READINESS_ROWS: readonly TeamReadinessRow[] = [
  {
    id: 'question',
    role: 'Bronchoscopist',
    confirm: 'The question the spin must answer: localization, or tool-in-lesion.',
    basis: { sectionId: 'imaging-questions', takeaway: 'State the question before acquiring.' },
  },
  {
    id: 'tool',
    role: 'Bronchoscopist',
    confirm: 'The lesion and the actual biopsy tool configuration.',
    basis: { sectionId: 'cbct-acquisition', block: 'Make readiness a team check' },
  },
  {
    id: 'protocol',
    role: 'Technologist',
    confirm: 'Protocol, coverage and clearance for the full spin.',
    basis: { sectionId: 'cbct-acquisition', block: 'Make readiness a team check' },
  },
  {
    id: 'centring',
    role: 'Technologist',
    confirm: 'The lesion is centred on both scouts.',
    basis: { sectionId: 'cbct-acquisition', block: 'Center the lesion in three dimensions' },
  },
  {
    id: 'trial-rotation',
    role: 'Technologist',
    confirm: 'A non-irradiating trial rotation, when supported.',
    basis: { sectionId: 'cbct-acquisition', block: 'Make readiness a team check' },
  },
  {
    id: 'breath-hold',
    role: 'Anesthesia',
    confirm: 'A stable breath hold or ventilation pause, monitoring and stopping criteria.',
    basis: { sectionId: 'cbct-acquisition', block: 'Make readiness a team check' },
  },
  {
    id: 'announce',
    role: 'Anesthesia',
    confirm: 'The intended state, and who announces readiness for acquisition.',
    basis: { sectionId: 'changing-anatomy', block: 'Plan the breath hold with anesthesia' },
  },
  {
    id: 'oxygen',
    role: 'Anesthesia',
    confirm: 'That normal oxygen saturation is not proof of adequate CO₂ elimination.',
    basis: { sectionId: 'changing-anatomy', block: 'Plan the breath hold with anesthesia' },
  },
  {
    id: 'shielding',
    role: 'Whole team',
    confirm: 'Effective shielding and maintained patient access.',
    basis: { sectionId: 'cbct-acquisition', block: 'Make readiness a team check' },
  },
  {
    id: 'barrier',
    role: 'Whole team',
    confirm:
      'Staff not needed at the bedside are behind an effective barrier while monitoring and patient access continue.',
    basis: { sectionId: 'staff-protection', block: 'Time, distance and shielding' },
  },
  {
    id: 'clear',
    role: 'Whole team',
    confirm:
      'The patient’s arms, the table, the robot, the bronchoscope, the lines and the anesthesia equipment are clear of the spin.',
    basis: { sectionId: 'cbct-acquisition', block: 'Make readiness a team check' },
  },
]

/** What is deliberately absent, printed with the aid. */
export const TEAM_READINESS_ABSENT =
  'Deliberately absent: breath-hold durations, PEEP or oxygen settings, stopping thresholds, and collision-check procedures for any named system. Those belong to local anesthesia practice and to the device’s instructions.'

/** The copyable text: the status line first, then the rows by role. No value is filled in. */
export function teamReadinessText(): string {
  const roles = [...new Set(TEAM_READINESS_ROWS.map((row) => row.role))]
  return [
    'Before a CBCT spin, confirm',
    TEAM_READINESS_STATUS,
    ...roles.flatMap((role) => [
      '',
      role,
      ...TEAM_READINESS_ROWS.filter((row) => row.role === role).map((row) => `- ${row.confirm}`),
    ]),
  ].join('\n')
}

/** Organizational suggestions the owner removed (OD4-10); none may reappear in the aid. */
export const REMOVED_ORGANIZATIONAL_SUGGESTIONS =
  /read.?aloud|call[- ]and[- ]answer|why (a|the|each) repeat/i

function basisErrors(where: string, basis: TeachingBasis): string[] {
  const lesson = LESSONS.find((candidate) => candidate.id === basis.sectionId)
  if (!lesson) return [`${where} cites an unknown section ${basis.sectionId}.`]
  if (basis.block && !lesson.blocks.some((block) => block.title === basis.block))
    return [`${where} cites a block ${basis.sectionId} does not have: ${basis.block}.`]
  if (basis.takeaway && !lesson.takeaway.includes(basis.takeaway))
    return [`${where} cites a takeaway ${basis.sectionId} does not have: ${basis.takeaway}.`]
  if (!basis.block && !basis.takeaway) return [`${where} names no block or takeaway.`]
  return []
}

export function validateCbctReferences(): readonly string[] {
  const errors: string[] = []
  for (const row of FIXED_MOBILE_COMPARISON) {
    const where = `Fixed/mobile row ${row.id}`
    if (Boolean(row.both) === Boolean(row.fixed || row.mobile))
      errors.push(`${where} must be either shared or split into two columns.`)
    for (const text of [row.aspect, row.both, row.fixed, row.mobile])
      if (text) errors.push(...imagingLearnerCopyErrors(where, text))
    // No row may teach a size, a ranking or a number: the comparison is workflow, not a device table.
    if (/\d/.test([row.both, row.fixed, row.mobile].join(' ')))
      errors.push(`${where} carries a number.`)
    for (const basis of row.basis) errors.push(...basisErrors(where, basis))
    for (const sourceId of row.sourceIds)
      if (!SOURCE_BY_ID.has(sourceId)) errors.push(`${where} cites an unregistered source.`)
  }
  for (const text of [
    FIXED_MOBILE_MODEL_NOTE,
    FIXED_MOBILE_LIMIT,
    TEAM_READINESS_STATUS,
    TEAM_READINESS_ABSENT,
  ])
    errors.push(...imagingLearnerCopyErrors('CBCT reference note', text))
  const ids = new Set<string>()
  for (const row of TEAM_READINESS_ROWS) {
    const where = `Readiness row ${row.id}`
    if (ids.has(row.id)) errors.push(`${where} is declared twice.`)
    ids.add(row.id)
    errors.push(...imagingLearnerCopyErrors(where, row.confirm), ...basisErrors(where, row.basis))
    if (REMOVED_ORGANIZATIONAL_SUGGESTIONS.test(row.confirm))
      errors.push(`${where} restores an organizational suggestion the owner removed.`)
  }
  return errors
}

const cbctReferenceErrors = validateCbctReferences()
if (cbctReferenceErrors.length > 0) {
  throw new Error(`The CBCT reference aids are invalid:\n${cbctReferenceErrors.join('\n')}`)
}
