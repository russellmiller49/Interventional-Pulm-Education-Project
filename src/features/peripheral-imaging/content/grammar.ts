import { SOURCE_BY_ID } from '../data/sources'
import type { SourceId } from '../types'
import { chainStopIds, type ChainStopId } from './imagingChain'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { isImagingSectionId, type ImagingSectionId } from './pathway'

/**
 * The one diagnostic grammar: what you see → where in the chain it lives → the shortlist.
 *
 * Built once, from the draft's decision guide and the synthesis document's escalation ladder,
 * taught in the section that assembles it, and lit by reference in every section a row belongs
 * to. No section restates a row in different words; paraphrase drift is how grammars die. The
 * trend rule is its footnote.
 */
export interface GrammarRow {
  readonly id: string
  /** What the learner sees. */
  readonly see: string
  /** The chain stop the problem lives at. */
  readonly lives: ChainStopId
  /** The stop in the words the table prints: "the beam — one ray". */
  readonly livesPlain: string
  readonly shortlist: readonly string[]
  readonly taughtIn: readonly ImagingSectionId[]
  readonly litIn: readonly ImagingSectionId[]
  readonly sourceIds: readonly SourceId[]
}

export const GRAMMAR_TREND_RULE =
  'Compare against this patient’s own baseline image and acquisition state, not a remembered picture of a good one.'

export const IMAGING_GRAMMAR: readonly GrammarRow[] = Object.freeze([
  {
    id: 'hidden-by-anatomy',
    see: 'The target is hidden by a rib, the heart or the diaphragm while the tool is crisp.',
    lives: 'patient',
    livesPlain: 'the patient — superimposition on one ray',
    shortlist: [
      'change the angle, planned on the CT',
      'recenter and collimate',
      'not more photons',
    ],
    taughtIn: ['signal'],
    litIn: ['good-image', 'projection', 'signal'],
    sourceIds: ['setser', 'tg272'],
  },
  {
    id: 'grainy',
    see: 'The image is grainy or washed out although the target is well positioned.',
    lives: 'source',
    livesPlain: 'the source and the detector — photons and scatter',
    shortlist: [
      'close the field',
      'thickness and angle',
      'the preset and the window',
      'more output only then',
    ],
    taughtIn: ['signal'],
    litIn: ['signal', 'field'],
    sourceIds: ['tg125', 'tg272', 'wabip'],
  },
  {
    id: 'blur-or-lag',
    see: 'The tool blurs while it moves, or the picture is smooth but late.',
    lives: 'detector',
    livesPlain: 'the detector — time sampling',
    shortlist: ['pulse width', 'pulse rate', 'processing lag', 'a coordinated pause'],
    taughtIn: ['time'],
    litIn: ['time'],
    sourceIds: ['tg272', 'tg125'],
  },
  {
    id: 'overlap-depth',
    see: 'Tool and target overlap in one view, and the depth between them is unknown.',
    lives: 'beam',
    livesPlain: 'the beam — one ray',
    shortlist: ['a separated second view', 'a sweep or an orbit'],
    taughtIn: ['projection'],
    litIn: ['chain-walk', 'projection', 'dts-acquisition'],
    sourceIds: ['setser', 'pritchett'],
  },
  {
    id: 'elongated-depth',
    see: 'Sharp in the plane, elongated in depth, and the tool is missing from the prior.',
    lives: 'reconstruction',
    livesPlain: 'the reconstruction — the sweep and the prior',
    shortlist: ['angular coverage', 'which pixels are current', 'what the prior contributed'],
    taughtIn: ['dts-acquisition'],
    litIn: ['dts-acquisition', 'dts-interpretation'],
    sourceIds: ['saad'],
  },
  {
    id: 'target-vanished',
    see: 'The target has vanished, or the overlay no longer matches what lies underneath it.',
    lives: 'patient',
    livesPlain: 'the patient — the state has changed',
    shortlist: ['collapse, deformation, bleeding', 'registration', 'do not chase the overlay'],
    taughtIn: ['current-anatomy'],
    litIn: ['current-anatomy', 'fixed-suite', 'changing-anatomy'],
    sourceIds: ['setser', 'ilocate', 'pritchett'],
  },
  {
    id: 'small-on-screen',
    see: 'The image is fine but small on the screen.',
    lives: 'display',
    livesPlain: 'the display',
    shortlist: ['zoom the stored image', 'move the monitor', 'not acquisition magnification'],
    taughtIn: ['field'],
    litIn: ['good-image', 'field'],
    sourceIds: ['tg272', 'tg125'],
  },
  {
    id: 'dose-number',
    see: 'A dose number or an alert appears.',
    lives: 'detector',
    livesPlain: 'the beam and the detector — which quantity',
    shortlist: ['reference air kerma or area product', 'the units', 'the modes included'],
    taughtIn: ['dose-reporting'],
    litIn: ['staff-protection', 'dose-reporting'],
    sourceIds: ['wabip', 'aapm12', 'skin'],
  },
  {
    id: 'probe-pattern',
    see: 'The radial probe shows tissue all round, tissue on one side, or nothing at all.',
    lives: 'patient',
    livesPlain: 'the acoustic chain — the probe’s place in tissue',
    shortlist: [
      'within, adjacent or not in contact',
      'collapsed lung mimics tissue',
      'the probe is not the tool',
    ],
    taughtIn: ['two-dimensional'],
    litIn: ['two-dimensional', 'tool-confirmation'],
    sourceIds: ['ilocate', 'mobile'],
  },
])

export function grammarRow(id: string): GrammarRow {
  const row = IMAGING_GRAMMAR.find((candidate) => candidate.id === id)
  if (!row) throw new Error(`Unknown grammar row ${id}`)
  return row
}

export function grammarRowsLitIn(sectionId: ImagingSectionId): readonly GrammarRow[] {
  return IMAGING_GRAMMAR.filter((row) => row.litIn.includes(sectionId))
}

export function validateImagingGrammar(
  rows: readonly GrammarRow[] = IMAGING_GRAMMAR,
): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const row of rows) {
    const where = `Grammar row ${row.id}`
    if (ids.has(row.id)) errors.push(`${where} is declared twice.`)
    ids.add(row.id)
    if (!chainStopIds.includes(row.lives)) errors.push(`${where} lives at an unknown stop.`)
    errors.push(
      ...imagingLearnerCopyErrors(`${where} see`, row.see),
      ...imagingLearnerCopyErrors(`${where} lives`, row.livesPlain),
    )
    if (row.shortlist.length === 0 || row.shortlist.length > 4) {
      errors.push(`${where} shortlist must hold one to four items.`)
    }
    for (const item of row.shortlist)
      errors.push(...imagingLearnerCopyErrors(`${where} shortlist`, item))
    if (row.taughtIn.length === 0) errors.push(`${where} is taught nowhere.`)
    for (const sectionId of [...row.taughtIn, ...row.litIn]) {
      if (!isImagingSectionId(sectionId))
        errors.push(`${where} names an unknown section ${sectionId}.`)
    }
    for (const sectionId of row.taughtIn) {
      if (!row.litIn.includes(sectionId))
        errors.push(`${where} is taught in ${sectionId} but not lit there.`)
    }
    if (row.sourceIds.length === 0) errors.push(`${where} cites nothing.`)
    for (const sourceId of row.sourceIds) {
      if (!SOURCE_BY_ID.has(sourceId))
        errors.push(`${where} cites an unregistered source ${sourceId}.`)
    }
  }
  errors.push(...imagingLearnerCopyErrors('The trend rule', GRAMMAR_TREND_RULE))
  return errors
}

const grammarErrors = validateImagingGrammar()
if (grammarErrors.length > 0) {
  throw new Error(`The imaging grammar is invalid:\n${grammarErrors.join('\n')}`)
}
