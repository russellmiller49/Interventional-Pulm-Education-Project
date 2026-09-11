import type { ScopeControlId } from '../components/scope/types'
import type { SourceRef } from '../data/sources'
import type { ControlStripVerdict } from './controlPanel'
import type { BronchSectionId } from './sectionIds'

/**
 * The one diagnostic grammar (medical-education-modules P5): what you see → where the problem lives
 * → a shortlist of at most four → which control, if any. Built once, taught in `view-loss`, and
 * highlighted by reference everywhere else — no section restates a row in its own words.
 *
 * Trend rule, printed under every excerpt: compare with this patient's own earlier view and state,
 * and with your last certain landmark — not with a remembered picture of a normal airway.
 */
export type GrammarRowId =
  | 'red-out'
  | 'lens-obscured'
  | 'white-out'
  | 'dark-field'
  | 'clear-but-lost'
  | 'missing-expected-branch'
  | 'handle-turns-view-static'
  | 'poor-return-leak'
  | 'poor-return-collapse'
  | 'no-return-patent-view'
  | 'red-field-wedged-bleeding'
  | 'effort-down-oxygenation-held'
  | 'pressure-up-volume-down'
  | 'state-disagrees'

export interface GrammarRow {
  readonly id: GrammarRowId
  readonly see: string
  readonly lives: string
  readonly shortlist: readonly string[]
  readonly verdict: ControlStripVerdict
  /** Controls that are the answer (verdict this-control), or the harmful reflex, where one exists. */
  readonly thisControl: readonly ScopeControlId[]
  readonly harmfulReflex: ScopeControlId | null
  readonly taughtIn: BronchSectionId
  readonly sourceRefs: readonly SourceRef[]
}

export const GRAMMAR_TREND_RULE =
  'Compare with this patient’s own earlier view and state, and with your last certain landmark — not with a remembered picture of a normal airway.'

const VIEW_LOSS: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
]

export const BRONCH_GRAMMAR: readonly GrammarRow[] = [
  {
    id: 'red-out',
    see: 'A close, poorly defined pink or red field; no accessory deployed; the patient stable',
    lives: 'The lens is against mucosa',
    shortlist: [
      'Stop advancing',
      'Reduce the bend',
      'Withdraw slightly',
      'Restore a view of the lumen',
    ],
    verdict: 'this-control',
    thisControl: ['insertion', 'deflection'],
    harmfulReflex: 'suction',
    taughtIn: 'view-loss',
    sourceRefs: VIEW_LOSS,
  },
  {
    id: 'lens-obscured',
    see: 'The image stays smeared or obscured in a position you have already confirmed',
    lives: 'Secretion or blood on the lens',
    shortlist: ['Controlled suction', 'A lens-clearing maneuver', 'Withdraw to clean when needed'],
    verdict: 'this-control',
    thisControl: ['suction'],
    harmfulReflex: 'insertion',
    taughtIn: 'view-loss',
    sourceRefs: VIEW_LOSS,
  },
  {
    id: 'white-out',
    see: 'A bright, washed-out field',
    lives: 'Proximity, reflective fluid or the imaging settings',
    shortlist: ['Recover working distance', 'Check the imaging system'],
    verdict: 'this-control',
    thisControl: ['insertion'],
    harmfulReflex: null,
    taughtIn: 'view-loss',
    sourceRefs: VIEW_LOSS,
  },
  {
    id: 'dark-field',
    see: 'A dark image',
    lives: 'Illumination or the system, a narrow space, or a true obstruction',
    shortlist: [
      'Do not advance in search of light',
      'Check the system',
      'Withdraw to a known view',
    ],
    verdict: 'no-control-retrace',
    thisControl: [],
    harmfulReflex: 'insertion',
    taughtIn: 'view-loss',
    sourceRefs: VIEW_LOSS,
  },
  {
    id: 'clear-but-lost',
    see: 'A clear image, but you are not sure which airway it is',
    lives: 'Anatomical uncertainty, not the image',
    shortlist: [
      'Stop',
      'Name the last certain landmark',
      'Withdraw to a recognizable parent',
      'Re-identify, then re-attempt',
    ],
    verdict: 'no-control-retrace',
    thisControl: [],
    harmfulReflex: 'insertion',
    taughtIn: 'view-loss',
    sourceRefs: VIEW_LOSS,
  },
  {
    id: 'missing-expected-branch',
    see: 'Fewer openings than the pattern you expected',
    lives:
      'An incomplete view, a location other than the one assumed, obstruction, surgery or a true variant',
    shortlist: [
      'Retrace to the parent',
      'Review the CT and the declared profile',
      'Document what is present',
      'Never label an arbitrary opening',
    ],
    verdict: 'no-control-retrace',
    thisControl: [],
    harmfulReflex: 'insertion',
    taughtIn: 'right-side',
    sourceRefs: [
      { sourceId: 'T11', location: { kind: 'time-span', start: '00:36:14', end: '00:37:48' } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
    ],
  },
  {
    id: 'handle-turns-view-static',
    see: 'The handle turns but the distal view barely changes',
    lives: 'A clamped or looped shaft absorbing the rotation',
    shortlist: [
      'Pause advancement',
      'Relieve the clamp',
      'Restore a smooth shaft path',
      'Retest a small rotation',
    ],
    verdict: 'this-control',
    thisControl: ['rotation'],
    harmfulReflex: 'insertion',
    taughtIn: 'branch-entry',
    sourceRefs: [
      { sourceId: 'T10', location: { kind: 'time-span', start: '00:06:57', end: '00:09:28' } },
      { sourceId: 'T11', location: { kind: 'time-span', start: '00:01:47', end: '00:05:01' } },
    ],
  },
  {
    id: 'poor-return-leak',
    see: 'Lavage fluid appears to escape proximally around the tip',
    lives: 'An unstable wedge',
    shortlist: ['Reassess alignment', 'Obtain a gentle seal', 'Do not advance forcibly'],
    verdict: 'this-control',
    thisControl: ['insertion', 'deflection'],
    harmfulReflex: null,
    taughtIn: 'poor-return',
    sourceRefs: [
      { sourceId: 'T13', location: { kind: 'time-span', start: '00:11:58', end: '00:15:33' } },
    ],
  },
  {
    id: 'poor-return-collapse',
    see: 'The visible distal lumen collapses when suction is applied',
    lives: 'Excessive suction, or a vulnerable distal airway',
    shortlist: ['Release or reduce suction', 'Reassess the tip position and method'],
    verdict: 'this-control',
    thisControl: ['suction'],
    harmfulReflex: 'suction',
    taughtIn: 'poor-return',
    sourceRefs: [
      { sourceId: 'T13', location: { kind: 'time-span', start: '00:11:58', end: '00:15:33' } },
    ],
  },
  {
    id: 'no-return-patent-view',
    see: 'No return at all, with a patent distal view',
    lives:
      'The suction path: channel, valve, trap, tubing, vacuum source, or an accessory in the channel',
    shortlist: [
      'Check the channel and valve',
      'Check the trap and tubing',
      'Check the vacuum source',
      'Before adding more fluid',
    ],
    verdict: 'no-control-change-the-plan',
    thisControl: [],
    harmfulReflex: null,
    taughtIn: 'poor-return',
    sourceRefs: [
      { sourceId: 'T13', location: { kind: 'time-span', start: '00:11:58', end: '00:15:33' } },
    ],
  },
  {
    id: 'red-field-wedged-bleeding',
    see: 'A red field after sampling, with the tip wedged in the sampled segment',
    lives: 'Active bleeding that the scope is containing',
    shortlist: [
      'Do not withdraw reflexively',
      'Stop sampling and call for help',
      'Support oxygenation and ventilation',
      'Protect the other lung',
    ],
    verdict: 'no-control-stop-and-communicate',
    thisControl: [],
    harmfulReflex: 'insertion',
    taughtIn: 'bleeding-priorities',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 138, to: 143 } },
      { sourceId: 'T09', location: { kind: 'time-span', start: '00:25:10', end: '00:33:41' } },
    ],
  },
  {
    id: 'effort-down-oxygenation-held',
    see: 'Reduced effort or responsiveness while oximetry still looks acceptable',
    lives: 'The patient: hypoventilation, with supplemental oxygen delaying desaturation',
    shortlist: [
      'Announce it and pause the procedure',
      'Assess the airway, effort, oxygen delivery and sedation',
      'Support ventilation with the team',
    ],
    verdict: 'no-control-stop-and-communicate',
    thisControl: [],
    harmfulReflex: null,
    taughtIn: 'deterioration',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 77, to: 79 } },
      { sourceId: 'U1', location: { kind: 'section', label: 'monitoring recommendations' } },
    ],
  },
  {
    id: 'pressure-up-volume-down',
    see: 'On a volume-targeted mode: peak pressure up and exhaled volume down, oximetry unchanged at first',
    lives:
      'Scope or tube obstruction, secretions or clot, the circuit, dynamic hyperinflation, a pneumothorax or a displaced tube',
    shortlist: [
      'Pause and restore ventilation',
      'Work it through with the respiratory therapist',
      'Never raise alarm limits to continue',
    ],
    verdict: 'no-control-stop-and-communicate',
    thisControl: [],
    harmfulReflex: null,
    taughtIn: 'scope-in-a-tube',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 155, to: 158 } },
      { sourceId: 'T15', location: { kind: 'time-span', start: '00:16:23', end: '00:22:00' } },
    ],
  },
  {
    id: 'state-disagrees',
    see: 'The assistant reports a protected state, but the image shows exposed bristles or open jaws',
    lives: 'The accessory state, not the words',
    shortlist: [
      'Stop the channel movement',
      'Verify the visible state',
      'Restore the protected state',
      'Then draw it into the channel',
    ],
    verdict: 'this-control',
    thisControl: ['accessory'],
    harmfulReflex: 'insertion',
    taughtIn: 'protected-accessories',
    sourceRefs: [
      { sourceId: 'T13', location: { kind: 'time-span', start: '00:20:40', end: '00:22:51' } },
    ],
  },
]

export const GRAMMAR_ROW_IDS: readonly GrammarRowId[] = BRONCH_GRAMMAR.map((row) => row.id)

export function grammarRow(id: GrammarRowId): GrammarRow {
  const row = BRONCH_GRAMMAR.find((candidate) => candidate.id === id)
  if (!row) throw new Error(`Unknown grammar row ${id}`)
  return row
}
