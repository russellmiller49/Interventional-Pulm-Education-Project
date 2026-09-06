import { hemodynamicsLearnerCopyErrors } from './controlPanel'
import { routeStopIds, type RouteStopId } from './routeSpine'
import { hemodynamicsSourceById } from './sources'

/**
 * The one table: what you see → where it lives → the shortlist.
 *
 * The module already carried every one of these rows — across the troubleshooting reference, the
 * validity sequence, the normal-waveform reference, the cardiac-output failure modes and the
 * derived-metric records. What it lacked was one named table that every section highlights and
 * none restates. Paraphrase is how a grammar dies: a learner who meets "sluggish return" in one
 * place and "rounded upstroke" in another is learning two things.
 *
 * Each row is given a place on the spine, or one of two places that are not on it — the technique
 * of a measurement, and the inputs of a calculation. Where the engine models the row, a test runs
 * it (`signal-grammar.test.ts`): the direction claims are checked against the simulation rather
 * than asserted. The trend rule footnotes the table: compare against this patient's own baseline,
 * at end expiration.
 */
export type GrammarLocus = RouteStopId | 'technique' | 'inputs'

export const grammarLocusLabels: Readonly<Record<GrammarLocus, string>> = {
  line: 'The line',
  ra: 'The right atrium',
  rv: 'The right ventricle',
  pa: 'The pulmonary artery',
  wedge: 'The occlusion',
  technique: 'The measurement technique',
  inputs: 'The inputs of the calculation',
}

/** Which engine behaviour the row's direction claim is checked against, if any. */
export type GrammarEngineCheck =
  | 'level-offset'
  | 'scale-only'
  | 'overdamped'
  | 'underdamped'
  | 'ra-morphology'
  | 'rv-morphology'
  | 'pa-morphology'
  | 'spontaneous-wedge'
  | 'false-wedge'
  | 'thermodilution-technique'
  | 'derived-withholding'

export interface SignalGrammarRow {
  readonly id: string
  /** The presentation, in the words the learner will meet on the monitor. */
  readonly whatYouSee: string
  readonly locus: GrammarLocus
  /** A finer place inside the locus, when the locus alone is too coarse. */
  readonly locusDetail?: string
  /** At most four; the exact shortlist every later section reuses. */
  readonly shortlist: readonly string[]
  /** What to do first — never a treatment, always a check or a withdrawal. */
  readonly firstMove: string
  readonly engineCheck?: GrammarEngineCheck
  /** The pathway section ids that teach or highlight this row. */
  readonly taughtIn: readonly string[]
  readonly sourceIds: readonly string[]
}

export const signalGrammarRows: readonly SignalGrammarRow[] = Object.freeze([
  {
    id: 'reference-offset',
    whatYouSee: 'The whole tracing sits higher or lower than it should; every shape is intact.',
    locus: 'line',
    locusDetail: 'the reference',
    shortlist: ['level', 'zero'],
    firstMove: 'Re-level against the reference, then zero to air — as two separate steps.',
    engineCheck: 'level-offset',
    taughtIn: ['pressure-system', 'pac-signal-validation'],
    sourceIds: ['arterial-pressure-five-step-2020', 'clinical-hemodynamics-waveforms'],
  },
  {
    id: 'display-scale',
    whatYouSee: 'The tracing is tiny, flat or clipped; its shape is intact once the scale fits.',
    locus: 'line',
    locusDetail: 'the display',
    shortlist: ['scale', 'channel'],
    firstMove: 'Read the axis and choose a scale that fits the chamber before judging the shape.',
    engineCheck: 'scale-only',
    taughtIn: ['pressure-system', 'pac-signal-validation'],
    sourceIds: ['monitor-workflow-supplied', 'clinical-hemodynamics-waveforms'],
  },
  {
    id: 'overdamped',
    whatYouSee:
      'A rounded upstroke, a lost notch and a narrow pulse pressure; the flush returns slowly with no ring.',
    locus: 'line',
    locusDetail: 'the fluid path, damped',
    shortlist: ['air or blood', 'clot or kink', 'bag pressure', 'loose or compliant tubing'],
    firstMove:
      'Trace the line from patient to monitor and repair the fluid path; then flush again.',
    engineCheck: 'overdamped',
    taughtIn: ['pressure-system', 'pac-signal-validation'],
    sourceIds: ['arterial-pressure-five-step-2020', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'underdamped',
    whatYouSee:
      'A sharp overshoot and a deep undershoot; the flush rings for several beats; the systolic reads high.',
    locus: 'line',
    locusDetail: 'the fluid path, resonant',
    shortlist: ['tubing length and components', 'the transducer', 'catheter motion'],
    firstMove:
      'Simplify and secure the line, replace a suspect component, then flush again before reading the peaks.',
    engineCheck: 'underdamped',
    taughtIn: ['pressure-system', 'pac-signal-validation'],
    sourceIds: ['arterial-pressure-five-step-2020', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'atrial-shape',
    whatYouSee: 'A low, quiet tracing with a, c and v waves and two descents.',
    locus: 'ra',
    shortlist: ['it is where it says', 'read the mean', 'at end expiration'],
    firstMove: 'Freeze the trace, find end expiration, and read at the base of the c wave.',
    engineCheck: 'ra-morphology',
    taughtIn: ['waveform-interpretation', 'catheter-advancement'],
    sourceIds: ['clinical-hemodynamics-waveforms', 'cvp-measurement-2017'],
  },
  {
    id: 'ventricular-shape',
    whatYouSee:
      'A tall systolic peak, a diastole that dips to the floor and then rises, and no notch.',
    locus: 'rv',
    shortlist: [
      'the tip is in the ventricle',
      'a transit position',
      'a stop if you meant the artery',
    ],
    firstMove:
      'Do not read it as a pulmonary-artery pressure; advance or withdraw until the shape you meant appears.',
    engineCheck: 'rv-morphology',
    taughtIn: ['waveform-interpretation', 'catheter-advancement', 'pac-signal-validation'],
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'arterial-shape',
    whatYouSee: 'The same peak, but the floor steps up and a notch appears on the way down.',
    locus: 'pa',
    shortlist: ['confirmed pulmonary artery', 'the position every measurement starts from'],
    firstMove: 'Confirm it by the notch and the diastolic step-up, not by the insertion depth.',
    engineCheck: 'pa-morphology',
    taughtIn: ['waveform-interpretation', 'catheter-advancement', 'pawp-capture'],
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'spontaneous-wedge',
    whatYouSee:
      'The pulmonary-artery pulsatility fades and an atrial shape returns while the balloon is down.',
    locus: 'pa',
    locusDetail: 'the tip, too far',
    shortlist: ['distal migration', 'a stopped branch', 'never flush it'],
    firstMove:
      'Treat it as an occlusion: withdraw under the responsible clinician until the artery returns.',
    engineCheck: 'spontaneous-wedge',
    taughtIn: ['pawp-capture', 'pac-signal-validation'],
    sourceIds: ['pac-waveforms-part-1-2021', 'edwards-swan-ganz-ifu-2023'],
  },
  {
    id: 'false-wedge',
    whatYouSee:
      'The "wedge" keeps pulmonary-artery pulsatility, or its mean is not below the diastolic pressure, or it keeps rising.',
    locus: 'wedge',
    shortlist: ['incomplete occlusion', 'lung zone', 'over-wedged'],
    firstMove:
      'Reject the value and deflate; never add balloon volume to make a poor occlusion look better.',
    engineCheck: 'false-wedge',
    taughtIn: ['pawp-capture', 'pac-signal-validation'],
    sourceIds: ['pac-waveforms-part-1-2021', 'edwards-swan-ganz-ifu-2023'],
  },
  {
    id: 'series-disagreement',
    whatYouSee:
      'Three thermodilution curves disagree, or one is late, double-peaked or slow to fall.',
    locus: 'technique',
    shortlist: [
      'injection speed and timing',
      'injectate volume and temperature',
      'the rhythm',
      'tricuspid regurgitation or a shunt',
    ],
    firstMove:
      'Judge each curve on its own acquisition, exclude for a technical reason the curve shows, repeat with standardised technique — never average a poor curve in.',
    engineCheck: 'thermodilution-technique',
    taughtIn: ['thermodilution-series', 'pac-signal-validation'],
    sourceIds: ['pac-derived-part-2-2021', 'master-hemodynamics-reference'],
  },
  {
    id: 'derived-contradiction',
    whatYouSee: 'A calculated number that contradicts the patient in front of you.',
    locus: 'inputs',
    shortlist: ['each pressure input', 'the flow and its method', 'the moment they were taken'],
    firstMove:
      'Trace every input back to its measurement and its validity before reading the output.',
    engineCheck: 'derived-withholding',
    taughtIn: ['derived-hemodynamics', 'pac-signal-validation'],
    sourceIds: ['pac-derived-part-2-2021', 'master-hemodynamics-reference'],
  },
])

export const SIGNAL_GRAMMAR_TREND_RULE =
  'Every row is read against this patient, not a table: the change from their own baseline, taken at end expiration, means more than any single number.'

const rowById = new Map(signalGrammarRows.map((row) => [row.id, row]))

export function signalGrammarRow(id: string): SignalGrammarRow {
  const row = rowById.get(id)
  if (!row) throw new Error(`Unknown signal-grammar row: ${id}`)
  return row
}

export function signalGrammarRowsFor(sectionId: string): readonly SignalGrammarRow[] {
  return signalGrammarRows.filter((row) => row.taughtIn.includes(sectionId))
}

export function validateSignalGrammar(
  rows: readonly SignalGrammarRow[] = signalGrammarRows,
): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const loci = new Set<string>([...routeStopIds, 'technique', 'inputs'])
  for (const row of rows) {
    if (ids.has(row.id)) errors.push(`Grammar row ${row.id} is declared twice.`)
    ids.add(row.id)
    if (!loci.has(row.locus)) errors.push(`Grammar row ${row.id} names an unknown locus.`)
    if (row.shortlist.length === 0 || row.shortlist.length > 4) {
      errors.push(`Grammar row ${row.id} needs one to four shortlist items.`)
    }
    if (row.taughtIn.length === 0) errors.push(`Grammar row ${row.id} is taught nowhere.`)
    if (row.sourceIds.length === 0) errors.push(`Grammar row ${row.id} cites nothing.`)
    for (const sourceId of row.sourceIds) {
      if (!hemodynamicsSourceById.has(sourceId)) {
        errors.push(`Grammar row ${row.id} cites an unregistered source: ${sourceId}.`)
      }
    }
    errors.push(
      ...hemodynamicsLearnerCopyErrors(`Grammar row ${row.id} presentation`, row.whatYouSee),
      ...hemodynamicsLearnerCopyErrors(`Grammar row ${row.id} first move`, row.firstMove),
      ...row.shortlist.flatMap((item) =>
        hemodynamicsLearnerCopyErrors(`Grammar row ${row.id} shortlist`, item),
      ),
    )
    if (/\b(give|start|titrate|bolus|infuse)\b/i.test(row.firstMove)) {
      errors.push(`Grammar row ${row.id} phrases a treatment as its first move.`)
    }
  }
  errors.push(...hemodynamicsLearnerCopyErrors('The trend rule', SIGNAL_GRAMMAR_TREND_RULE))
  return errors
}

const grammarErrors = validateSignalGrammar()
if (grammarErrors.length > 0) {
  throw new Error(`Signal grammar is invalid:\n${grammarErrors.join('\n')}`)
}
