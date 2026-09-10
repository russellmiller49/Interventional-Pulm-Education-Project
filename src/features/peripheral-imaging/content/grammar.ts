import { SOURCE_BY_ID } from '../data/sources'
import type { SourceId } from '../types'
import { chainStopIds, type ChainStopId } from './imagingChain'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { isImagingSectionId, type ImagingSectionId } from './pathway'

/**
 * The one troubleshooting table: what you see → the likely cause → what to consider.
 *
 * Built once, from the draft's decision guide and the synthesis document's escalation ladder,
 * taught in the section that assembles it, and highlighted by reference in every section a row
 * belongs to. No section restates a row in different words. Each row also records the component of
 * image formation the problem arises at (`lives`), which the capstone sort uses; the table prints
 * the clinical cause. The trend rule is its footnote.
 */
export interface GrammarRow {
  readonly id: string
  /** What the learner sees. */
  readonly see: string
  /** The chain stop the problem lives at. */
  readonly lives: ChainStopId
  /** The likely cause, in the words the table prints: "a single projection collapses depth". */
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
    see: 'The lesion is obscured by a rib, the cardiac silhouette or the diaphragm while the tool is sharp.',
    lives: 'patient',
    livesPlain: 'anatomical superimposition in this projection',
    shortlist: [
      'change the projection, planned from the CT',
      'recenter and recollimate',
      'do not increase dose first',
    ],
    taughtIn: ['signal'],
    litIn: ['good-image', 'projection', 'signal'],
    sourceIds: ['setser', 'tg272'],
  },
  {
    id: 'grainy',
    see: 'The image is noisy or low in contrast although the lesion is well positioned.',
    lives: 'source',
    livesPlain: 'photon statistics and scatter radiation',
    shortlist: [
      'collimate',
      'patient thickness and the projection',
      'the fluoroscopy preset and window/level',
      'increase output only then',
    ],
    taughtIn: ['signal'],
    litIn: ['signal', 'field'],
    sourceIds: ['tg125', 'tg272', 'wabip'],
  },
  {
    id: 'blur-or-lag',
    see: 'The tool blurs while it moves, or the image looks smooth but lags behind the movement.',
    lives: 'detector',
    livesPlain: 'temporal resolution — pulse width, pulse rate and processing',
    shortlist: [
      'pulse width',
      'pulse rate',
      'frame averaging and image lag',
      'a coordinated ventilation pause',
    ],
    taughtIn: ['time'],
    litIn: ['time'],
    sourceIds: ['tg272', 'tg125'],
  },
  {
    id: 'overlap-depth',
    see: 'The tool and lesion overlap in one projection, and their depth relationship is unknown.',
    lives: 'beam',
    livesPlain: 'a single projection collapses depth',
    shortlist: ['a sufficiently separated second projection', 'DTS or CBCT'],
    taughtIn: ['projection'],
    litIn: ['chain-walk', 'projection', 'dts-acquisition'],
    sourceIds: ['setser', 'pritchett'],
  },
  {
    id: 'elongated-depth',
    see: 'Structures are sharp in-plane but elongated in depth, and the tool is absent from prior-derived content.',
    lives: 'reconstruction',
    livesPlain: 'the DTS reconstruction — angular coverage and prior contribution',
    shortlist: [
      'angular coverage',
      'which content was acquired now',
      'what the prior CT contributed',
    ],
    taughtIn: ['dts-acquisition'],
    litIn: ['dts-acquisition', 'dts-interpretation'],
    sourceIds: ['saad'],
  },
  {
    id: 'target-vanished',
    see: 'The lesion is no longer visualized, or the overlay no longer matches the underlying anatomy.',
    lives: 'patient',
    livesPlain: 'CT-to-body divergence — the anatomy has changed',
    shortlist: [
      'atelectasis, deformation, bleeding',
      'registration error',
      'reconfirm the lesion; do not redirect to a stale overlay',
    ],
    taughtIn: ['current-anatomy'],
    litIn: ['current-anatomy', 'fixed-suite', 'changing-anatomy'],
    sourceIds: ['setser', 'ilocate', 'pritchett'],
  },
  {
    id: 'small-on-screen',
    see: 'Image quality is adequate, but the anatomy is small on the monitor.',
    lives: 'display',
    livesPlain: 'the display',
    shortlist: [
      'display zoom on the stored image',
      'bring the monitor closer',
      'not acquisition magnification',
    ],
    taughtIn: ['field'],
    litIn: ['good-image', 'field'],
    sourceIds: ['tg272', 'tg125'],
  },
  {
    id: 'dose-number',
    see: 'A dose index or a dose notification appears.',
    lives: 'detector',
    livesPlain: 'the dose metric — which quantity it is',
    shortlist: [
      'reference air kerma or kerma–area product',
      'the units',
      'the acquisition modes included',
    ],
    taughtIn: ['dose-reporting'],
    litIn: ['staff-protection', 'dose-reporting'],
    sourceIds: ['wabip', 'aapm12', 'skin'],
  },
  {
    id: 'probe-pattern',
    see: 'The radial EBUS view is concentric, eccentric, or shows no lesional pattern.',
    lives: 'patient',
    livesPlain: 'radial EBUS — probe position relative to the lesion',
    shortlist: [
      'concentric, eccentric or no lesional view',
      'atelectasis can mimic a lesion',
      'the rEBUS probe is not the biopsy tool',
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
