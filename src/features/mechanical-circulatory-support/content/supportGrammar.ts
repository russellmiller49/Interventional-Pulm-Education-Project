import type { McsAction, McsDerivedMetrics, McsDeviceKind } from '../engine/types'
import { mcsLearnerCopyErrors, mcsSourceIdsRegistered } from './learnerCopy'
import type { McsSpineStopId } from './supportSpine'

/**
 * The one table: what moved → where the constraint lives → the shortlist.
 *
 * Every device section in this module localises a problem the same way. A displayed flow that
 * falls at an unchanged setting is a statement about the pathway, and the reading beside it says
 * which part: what reaches the inlet, what the outlet ejects against, whether the pump is still
 * in two chambers, or whether the active component's own estimate has stopped being trustworthy.
 * The table is authored once here; every section highlights its rows and none restates one in
 * different words, because paraphrase is how a table dies.
 *
 * Each row carries the engine claim behind it. `support-grammar.test.ts` runs every claim through
 * the reducer, so a row cannot say a direction the simulation does not produce. The magnitudes
 * are not in the copy — a learner leaves with a direction and a comparison, never a number.
 */

export const mcsGrammarRowIds = [
  'upstream-inflow',
  'downstream-afterload',
  'pathway-position',
  'active-component-power',
  'inherited-ventricle',
  'timing',
  'serial-not-a-sum',
] as const

export type McsGrammarRowId = (typeof mcsGrammarRowIds)[number]

export type McsGrammarDirection = 'up' | 'down' | 'flat'

export interface McsGrammarMetricExpectation {
  readonly metric: keyof McsDerivedMetrics
  readonly direction: McsGrammarDirection
  /** For `up`/`down`, the smallest change that counts; for `flat`, the largest change allowed. */
  readonly by?: number
}

export interface McsGrammarEngineClaim {
  readonly label: string
  readonly device: McsDeviceKind
  readonly setup: readonly McsAction[]
  readonly change: readonly McsAction[]
  readonly expect: readonly McsGrammarMetricExpectation[]
  /** Alarm ids that must be active after the change, and ids that must not be. */
  readonly alarmsActive?: readonly string[]
  readonly alarmsInactive?: readonly string[]
}

export interface McsGrammarRow {
  readonly id: McsGrammarRowId
  /** The pattern on the screen. */
  readonly whatMoved: string
  /** Where on the loop the constraint lives. */
  readonly whereTheConstraintLives: string
  readonly stopIds: readonly McsSpineStopId[]
  /** At most four things to check, in order. */
  readonly shortlist: readonly string[]
  /** The sections that highlight this row. */
  readonly taughtIn: readonly string[]
  readonly engineClaims: readonly McsGrammarEngineClaim[]
}

export interface McsSupportGrammar {
  readonly rows: readonly McsGrammarRow[]
  /** The footnote every reading of the table carries. */
  readonly trendRule: string
  readonly sourceIds: readonly string[]
}

const preloadLimited = (value: number): McsAction => ({
  type: 'SET_PATIENT_CONTROL',
  control: 'preloadPercent',
  value,
})
const resistance = (value: number): McsAction => ({
  type: 'SET_PATIENT_CONTROL',
  control: 'systemicVascularResistanceDynSecCm5',
  value,
})
const rightVentricle = (value: number): McsAction => ({
  type: 'SET_PATIENT_CONTROL',
  control: 'rightVentricularContractility',
  value,
})
const leftLevel = (value: number): McsAction => ({
  type: 'SET_IMPELLA_CONTROL',
  side: 'left',
  control: 'performanceLevel',
  value,
})

export const MCS_SUPPORT_GRAMMAR: McsSupportGrammar = {
  rows: [
    {
      id: 'upstream-inflow',
      whatMoved:
        'Displayed flow falls at an unchanged setting, and the filling pressure on the side the pump draws from is low — often with a suction alarm.',
      whereTheConstraintLives: 'Upstream of the inlet: what is reaching the pump.',
      stopIds: ['venous-return', 'right-heart'],
      shortlist: ['volume', 'the right ventricle', 'obstruction to return', 'the inlet position'],
      taughtIn: [
        'impella-unloading-placement',
        'impella-suction-purge-rv',
        'mcs-device-selection-integration',
      ],
      engineClaims: [
        {
          label: 'less arrives in front of a transvalvular pump at an unchanged level',
          device: 'impella',
          setup: [],
          change: [preloadLimited(60)],
          expect: [
            { metric: 'leftDeviceFlowLMin', direction: 'down', by: 0.5 },
            { metric: 'pcwpMmHg', direction: 'down', by: 3 },
            { metric: 'rapMmHg', direction: 'down', by: 3 },
            { metric: 'mapMmHg', direction: 'down', by: 10 },
          ],
        },
        {
          label: 'raising the level does not clear a suction alarm the inflow caused',
          device: 'impella',
          setup: [leftLevel(7), preloadLimited(55)],
          change: [leftLevel(9)],
          expect: [{ metric: 'leftDeviceFlowLMin', direction: 'up', by: 0.1 }],
          alarmsActive: ['impella-left-suction'],
        },
      ],
    },
    {
      id: 'downstream-afterload',
      whatMoved:
        'Displayed flow falls at an unchanged setting while the mean arterial pressure rises.',
      whereTheConstraintLives: 'Downstream of the outlet: what the pump ejects against.',
      stopIds: ['aorta-and-body'],
      shortlist: ['systemic resistance', 'hypertension', 'obstruction to outflow'],
      taughtIn: ['impella-unloading-placement', 'lvad-parameters-assessment'],
      engineClaims: [
        {
          label: 'a stiffer circulation against a transvalvular pump',
          device: 'impella',
          setup: [],
          change: [resistance(1900)],
          expect: [
            { metric: 'leftDeviceFlowLMin', direction: 'down', by: 0.2 },
            { metric: 'effectiveSystemicFlowLMin', direction: 'down', by: 0.5 },
            { metric: 'mapMmHg', direction: 'up', by: 15 },
          ],
        },
        {
          label: 'a stiffer circulation against a durable pump at an unchanged speed',
          device: 'lvad',
          setup: [],
          change: [resistance(1900)],
          expect: [
            { metric: 'deviceFlowLMin', direction: 'down', by: 0.3 },
            { metric: 'effectiveSystemicFlowLMin', direction: 'down', by: 0.5 },
            { metric: 'mapMmHg', direction: 'up', by: 15 },
          ],
        },
      ],
    },
    {
      id: 'pathway-position',
      whatMoved:
        'Displayed flow falls at an unchanged setting, the ventricle refills rather than empties, and a placement alarm appears.',
      whereTheConstraintLives:
        'The pathway itself: the inlet and the outlet are no longer in two chambers.',
      stopIds: ['left-ventricle', 'aortic-valve'],
      shortlist: ['the position of the inlet', 'the position of the outlet'],
      taughtIn: ['impella-unloading-placement'],
      engineClaims: [
        {
          label: 'a transvalvular pump moved out of its aligned position',
          device: 'impella',
          setup: [],
          change: [
            { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'position', value: 'too-deep' },
          ],
          expect: [
            { metric: 'leftDeviceFlowLMin', direction: 'down', by: 0.8 },
            { metric: 'lvedvMl', direction: 'up', by: 5 },
            { metric: 'pcwpMmHg', direction: 'up', by: 0 },
          ],
          alarmsActive: ['impella-left-position'],
        },
      ],
    },
    {
      id: 'active-component-power',
      whatMoved: 'Power rises while the displayed flow and the delivered flow do not move.',
      whereTheConstraintLives:
        'The active component: the assumptions behind the flow estimate have broken, so the display can no longer be read as delivery.',
      stopIds: ['left-ventricle'],
      shortlist: ['the high-power pattern', 'the trend of power against the display'],
      taughtIn: ['lvad-alarms-emergencies'],
      engineClaims: [
        {
          label: 'the high-power pattern at an unchanged speed and unchanged loading',
          device: 'lvad',
          setup: [],
          change: [{ type: 'SET_LVAD_CONTROL', control: 'suspectedPumpThrombosis', value: true }],
          expect: [
            { metric: 'pumpPowerW', direction: 'up', by: 1 },
            { metric: 'deviceFlowLMin', direction: 'flat', by: 0.25 },
            { metric: 'effectiveSystemicFlowLMin', direction: 'flat', by: 0.25 },
          ],
          alarmsActive: ['lvad-high-power'],
        },
      ],
    },
    {
      id: 'inherited-ventricle',
      whatMoved:
        'The device is doing what it was asked — timing aligned, level unchanged — while delivered flow falls and the right atrial pressure rises.',
      whereTheConstraintLives: 'Not the device: the ventricle every left-sided device inherits.',
      stopIds: ['right-heart'],
      shortlist: ['the right ventricle', 'the support ceiling of this mechanism'],
      taughtIn: ['iabp-efficacy-limits', 'mcs-device-selection-integration'],
      engineClaims: [
        {
          label: 'the right ventricle weakens under aligned counterpulsation',
          device: 'iabp',
          setup: [],
          change: [rightVentricle(0.4)],
          expect: [
            { metric: 'timingQualityPercent', direction: 'flat', by: 1 },
            { metric: 'effectiveSystemicFlowLMin', direction: 'down', by: 0.8 },
            { metric: 'rapMmHg', direction: 'up', by: 4 },
          ],
        },
        {
          label: 'a higher level gains little when the right ventricle is the limit',
          device: 'impella',
          setup: [rightVentricle(0.34), preloadLimited(88), leftLevel(7)],
          change: [leftLevel(8)],
          expect: [
            { metric: 'leftDeviceFlowLMin', direction: 'flat', by: 0.5 },
            { metric: 'rapMmHg', direction: 'flat', by: 1 },
          ],
          alarmsActive: ['impella-left-suction'],
        },
      ],
    },
    {
      id: 'timing',
      whatMoved:
        'The arterial trace changes shape and the timing synchrony falls, while no device flow appears anywhere.',
      whereTheConstraintLives: "The device's timing against the beat.",
      stopIds: ['aortic-valve'],
      shortlist: ['inflation early or late', 'deflation early or late', 'the trigger'],
      taughtIn: ['iabp-timing-triggering'],
      engineClaims: [
        {
          label: 'early inflation moved to the notch',
          device: 'iabp',
          setup: [{ type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value: -120 }],
          change: [{ type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value: 0 }],
          expect: [
            { metric: 'timingQualityPercent', direction: 'up', by: 10 },
            { metric: 'mapMmHg', direction: 'up', by: 2 },
            { metric: 'effectiveSystemicFlowLMin', direction: 'flat', by: 1 },
            { metric: 'deviceFlowLMin', direction: 'flat', by: 0 },
          ],
          alarmsInactive: ['iabp-early-inflation'],
        },
        {
          label: 'deflation left late',
          device: 'iabp',
          setup: [],
          change: [{ type: 'SET_IABP_CONTROL', control: 'deflationOffsetMs', value: 120 }],
          expect: [
            { metric: 'timingQualityPercent', direction: 'down', by: 10 },
            { metric: 'effectiveSystemicFlowLMin', direction: 'down', by: 0.3 },
            { metric: 'deviceFlowLMin', direction: 'flat', by: 0 },
          ],
          alarmsActive: ['iabp-late-deflation'],
        },
      ],
    },
    {
      id: 'serial-not-a-sum',
      whatMoved: 'Two pump flows appear on one screen.',
      whereTheConstraintLives:
        'Not a constraint at all — pathways in series carry one stream twice, so the two numbers are never added.',
      stopIds: ['venous-return', 'right-heart'],
      shortlist: ['read effective delivery', 'never add the two displayed flows'],
      taughtIn: ['mcs-foundations-mechanisms', 'impella-suction-purge-rv'],
      engineClaims: [
        {
          label: 'a right-sided pump started beside a left-sided one',
          device: 'impella',
          setup: [rightVentricle(0.36), leftLevel(7)],
          change: [{ type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true }],
          expect: [
            { metric: 'rightDeviceFlowLMin', direction: 'up', by: 1 },
            { metric: 'leftDeviceFlowLMin', direction: 'up', by: 0.5 },
            { metric: 'effectiveSystemicFlowLMin', direction: 'up', by: 0.5 },
          ],
          alarmsInactive: ['impella-left-suction'],
        },
      ],
    },
  ],
  trendRule:
    "Read every row against this patient's own earlier readings, not against a number carried from elsewhere. A displayed flow that has fallen is a statement about this pathway now; a displayed flow that merely differs from what you expected is not.",
  sourceIds: [
    'mcs-bedside-reference-supplied',
    'ishlt-hfsa-acute-mcs-2023',
    'ishlt-durable-mcs-2023',
    'mcs-educational-model-v1',
  ],
}

export const mcsGrammarRowById: ReadonlyMap<McsGrammarRowId, McsGrammarRow> = new Map(
  MCS_SUPPORT_GRAMMAR.rows.map((row) => [row.id, row]),
)

export function mcsGrammarRow(id: McsGrammarRowId): McsGrammarRow {
  const row = mcsGrammarRowById.get(id)
  if (!row) throw new Error(`Unknown grammar row: ${id}`)
  return row
}

/** The rows a section highlights, in table order. */
export function mcsGrammarRowsFor(sectionId: string): readonly McsGrammarRow[] {
  return MCS_SUPPORT_GRAMMAR.rows.filter((row) => row.taughtIn.includes(sectionId))
}

export function validateMcsSupportGrammar(
  grammar: McsSupportGrammar = MCS_SUPPORT_GRAMMAR,
): string[] {
  const errors: string[] = []
  const ids = grammar.rows.map((row) => row.id)
  if (new Set(ids).size !== ids.length) errors.push('two rows share an id')
  for (const id of mcsGrammarRowIds) {
    if (!ids.includes(id)) errors.push(`row ${id} is declared but has no record`)
  }
  for (const row of grammar.rows) {
    if (row.shortlist.length === 0 || row.shortlist.length > 4) {
      errors.push(`${row.id}: the shortlist must hold one to four items`)
    }
    if (row.taughtIn.length === 0) errors.push(`${row.id}: no section highlights this row`)
    if (row.engineClaims.length === 0) errors.push(`${row.id}: carries no engine claim`)
    for (const claim of row.engineClaims) {
      if (claim.expect.length === 0) errors.push(`${row.id}: ${claim.label} expects nothing`)
    }
    errors.push(...mcsLearnerCopyErrors(`${row.id}.whatMoved`, row.whatMoved))
    errors.push(
      ...mcsLearnerCopyErrors(`${row.id}.whereTheConstraintLives`, row.whereTheConstraintLives),
    )
    for (const item of row.shortlist) {
      errors.push(...mcsLearnerCopyErrors(`${row.id}.shortlist`, item))
    }
  }
  errors.push(...mcsLearnerCopyErrors('trendRule', grammar.trendRule))
  if (grammar.sourceIds.length === 0) errors.push('no sources')
  if (!mcsSourceIdsRegistered(grammar.sourceIds)) {
    errors.push('names a source that is not registered')
  }
  return errors
}

const grammarErrors = validateMcsSupportGrammar()
if (grammarErrors.length > 0) {
  throw new Error(`Invalid MCS support grammar:\n- ${grammarErrors.join('\n- ')}`)
}
