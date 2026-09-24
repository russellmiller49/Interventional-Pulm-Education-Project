/**
 * The CRRT glossary (CRRT-FELLOW-04, F-24).
 *
 * One concise list of the terms a learner meets across Learn, Practice and Challenge, each written
 * from wording this module already teaches and tied to the record that supports it. Nothing here
 * is a new clinical claim: a definition either restates the module's own circuit drawing and
 * lessons, or restates what a registered source record says, and the test for this file checks
 * that every cited record resolves to a learner citation and, for a clinical-publication basis,
 * that the record's own registered claim covers the topic (`crrtSourceSupportsClaim`).
 *
 * Distinct concepts stay distinct. Prescribed flow is not actual flow, effluent is not the
 * patient's fluid loss, net machine removal is not whole-patient balance, ultrafiltration is not
 * net ultrafiltration, and a model marker is not a measured laboratory value. Where the sources
 * leave a question open — how a nonzero makeup flow enters the patient ledger — the entry says so
 * and says what the simulation does about it, rather than supplying an answer.
 *
 * Draft: no clinician has reviewed these definitions. Like `learnerSourceMap.ts`, this module
 * imports registries only, so the CRRT harnesses that run under plain `npx tsx` can load it.
 */

import type { CrrtClaimTopic } from './learnerSourceMap'

export type CrrtGlossaryGroupId =
  | 'flows-and-fluids'
  | 'fluid-ledgers'
  | 'prescribed-and-delivered'
  | 'transport'
  | 'pressures'
  | 'model-markers-and-alerts'

export const CRRT_GLOSSARY_GROUPS: readonly {
  readonly id: CrrtGlossaryGroupId
  readonly title: string
}[] = Object.freeze([
  { id: 'flows-and-fluids', title: 'Circuit flows and fluids' },
  { id: 'fluid-ledgers', title: 'The two fluid ledgers' },
  { id: 'prescribed-and-delivered', title: 'Prescribed and delivered therapy' },
  { id: 'transport', title: 'Solute and water transport' },
  { id: 'pressures', title: 'Calculated pressures' },
  { id: 'model-markers-and-alerts', title: 'Model markers and simulated alerts' },
])

/**
 * What a definition rests on.
 *
 * - `module-drawing` — read off this module's own circuit schematic or engine behavior. Not a
 *   claim taken from a published source; `detail` says which part of the module.
 * - `device-manual` — a PrisMax operator's manual record (`MATH-PM-*`, `FLUID-PM-*`, …).
 * - `clinical-publication` — a registered publication whose own claim covers `topic`.
 */
export type CrrtGlossaryBasis =
  | {
      readonly kind: 'module-drawing'
      readonly detail: string
      readonly sourceIds?: readonly string[]
    }
  | {
      readonly kind: 'device-manual'
      readonly sourceIds: readonly string[]
      readonly detail: string
    }
  | {
      readonly kind: 'clinical-publication'
      readonly sourceIds: readonly string[]
      readonly topic: CrrtClaimTopic
      readonly detail: string
    }

export interface CrrtGlossaryEntry {
  readonly id: string
  readonly group: CrrtGlossaryGroupId
  /** The term as it is written in this module. */
  readonly term: string
  /** Other names a learner meets for the same thing, including the PrisMax console name. */
  readonly alsoCalled: readonly string[]
  readonly definition: string
  /** Neighbouring concepts this term must not be collapsed into. */
  readonly notTheSameAs: readonly string[]
  /** What stays unresolved or unmodeled here, stated so it cannot be read as settled. */
  readonly openQuestion?: string
  readonly basis: readonly CrrtGlossaryBasis[]
}

const entry = (value: CrrtGlossaryEntry): CrrtGlossaryEntry =>
  Object.freeze({
    ...value,
    alsoCalled: Object.freeze([...value.alsoCalled]),
    notTheSameAs: Object.freeze([...value.notTheSameAs]),
    basis: Object.freeze([...value.basis]),
  })

const CIRCUIT_DRAWING = 'This module’s circuit drawing (an original teaching schematic).'

export const crrtGlossary: readonly CrrtGlossaryEntry[] = Object.freeze([
  entry({
    id: 'pbp',
    group: 'flows-and-fluids',
    term: 'Pre-blood-pump (PBP) fluid',
    alsoCalled: ['PBP', 'Qpbp (PrisMax flow term)'],
    definition:
      'Fluid that joins the blood path before the blood pump, and therefore before the filter. In this module’s drawing, citrate enters here too where it is used; actual infusion sites depend on the approved configuration.',
    notTheSameAs: [
      'Pre-filter replacement, which enters after the blood pump, just before the filter.',
      'A solution name: PBP describes a location, not which solution runs there.',
    ],
    basis: [
      { kind: 'module-drawing', detail: CIRCUIT_DRAWING },
      {
        kind: 'device-manual',
        sourceIds: ['MATH-PM-001', 'FLUID-PM-002'],
        detail: 'PrisMax counts PBP in the effluent target and subtracts it from patient removal.',
      },
    ],
  }),
  entry({
    id: 'dialysate',
    group: 'flows-and-fluids',
    term: 'Dialysate',
    alsoCalled: ['Qdial (PrisMax flow term)'],
    definition:
      'Solution that runs along the fluid side of the membrane, countercurrent to blood. It is not infused into the blood; solutes exchange across the membrane.',
    notTheSameAs: ['Replacement fluid, which enters the blood path itself.'],
    basis: [
      { kind: 'module-drawing', detail: CIRCUIT_DRAWING },
      {
        kind: 'device-manual',
        sourceIds: ['MATH-PM-001', 'FLUID-PM-002'],
        detail:
          'PrisMax counts dialysate in the effluent target and subtracts it from patient removal.',
      },
    ],
  }),
  entry({
    id: 'pre-filter-replacement',
    group: 'flows-and-fluids',
    term: 'Pre-filter replacement',
    alsoCalled: ['Predilution'],
    definition:
      'Replacement fluid given into the blood path after the blood pump and before the filter, so it dilutes blood before it reaches the membrane.',
    notTheSameAs: [
      'PBP fluid, which enters before the blood pump.',
      'Post-filter replacement, which enters after the membrane.',
    ],
    openQuestion:
      'This simulation does not model how the pre/post split changes clearance, filtration fraction or filter pressures; moving replacement between the two ports changes only the two flow settings here.',
    basis: [
      { kind: 'module-drawing', detail: CIRCUIT_DRAWING },
      {
        kind: 'device-manual',
        sourceIds: ['MATH-PM-001'],
        detail: 'PrisMax counts replacement flow in the effluent target.',
      },
    ],
  }),
  entry({
    id: 'post-filter-replacement',
    group: 'flows-and-fluids',
    term: 'Post-filter replacement',
    alsoCalled: ['Postdilution'],
    definition:
      'Replacement fluid given into the blood path after the filter, on the return side, so this fluid never crosses the membrane.',
    notTheSameAs: ['Pre-filter replacement, which dilutes blood before the membrane.'],
    basis: [
      { kind: 'module-drawing', detail: CIRCUIT_DRAWING },
      {
        kind: 'device-manual',
        sourceIds: ['MATH-PM-001'],
        detail: 'PrisMax counts replacement flow in the effluent target.',
      },
    ],
  }),
  entry({
    id: 'syringe',
    group: 'flows-and-fluids',
    term: 'Syringe flow',
    alsoCalled: ['Qsyr (PrisMax flow term)'],
    definition:
      'Flow from the syringe pump, a separate added-solution pathway. PrisMax counts it in the effluent target and subtracts it again from patient fluid removal, so it is counted once.',
    notTheSameAs: [
      'A specific drug or anticoagulant: this module does not say which solution runs through the syringe or at what rate.',
    ],
    basis: [
      {
        kind: 'device-manual',
        sourceIds: ['MATH-PM-001', 'FLUID-PM-002'],
        detail: 'Qsyr appears in both PrisMax expressions.',
      },
    ],
  }),
  entry({
    id: 'makeup',
    group: 'flows-and-fluids',
    term: 'Makeup flow',
    alsoCalled: ['Qmakeup (PrisMax flow term)'],
    definition:
      'A flow term that PrisMax includes in its effluent-pump target. The manual’s expression for patient fluid removed does not subtract a makeup volume.',
    notTheSameAs: [
      'Syringe, PBP, dialysate or replacement flow, each of which the patient-removal expression does subtract.',
    ],
    openQuestion:
      'Unresolved: no registered source says where a nonzero makeup volume belongs in the patient ledger. This module does not define makeup any further. Its worked examples hold makeup at zero, and whenever makeup has run the simulation withholds cumulative machine removal and whole-patient balance instead of guessing.',
    basis: [
      {
        kind: 'device-manual',
        sourceIds: ['MATH-PM-001', 'FLUID-PM-002'],
        detail:
          'The effluent expression carries Qmakeup; the patient-fluid-removed expression omits it.',
      },
    ],
  }),
  entry({
    id: 'effluent',
    group: 'flows-and-fluids',
    term: 'Effluent',
    alsoCalled: ['Qeff (PrisMax effluent-pump target)', 'total effluent'],
    definition:
      'Everything the effluent pump draws from the fluid side of the filter: spent dialysate and all the water that crossed the membrane. On PrisMax the effluent target is the sum of the enabled flow terms — patient fluid removal, PBP, replacement, dialysate, syringe and makeup.',
    notTheSameAs: [
      'The patient’s fluid loss: effluent also contains the fluid the circuit added — dialysate, replacement, PBP and syringe.',
      'Net machine fluid removal, which is only one term inside the effluent.',
    ],
    basis: [
      {
        kind: 'device-manual',
        sourceIds: ['MATH-PM-001'],
        detail: 'Qeff = Qpfr + Qpbp + Qrep + Qdial + Qsyr + Qmakeup.',
      },
    ],
  }),
  entry({
    id: 'net-machine-removal',
    group: 'fluid-ledgers',
    term: 'Net machine fluid removal',
    alsoCalled: [
      'Net ultrafiltration (net UF)',
      'Patient Fluid Removal (PFR) — the PrisMax setting',
      'net CRRT removal',
      'machine PFR',
    ],
    definition:
      'The net volume the machine removes from the patient: effluent minus the fluids the circuit added (PBP, dialysate, replacement and syringe).',
    openQuestion:
      'The PrisMax patient-removal expression does not subtract makeup; see Makeup flow.',
    notTheSameAs: [
      'Whole-patient fluid balance, which also counts every other input and output.',
      'Ultrafiltration (UF), which is all the water that crossed the membrane, including water that replacement fluid gives back.',
      'Effluent.',
    ],
    basis: [
      {
        kind: 'device-manual',
        sourceIds: ['FLUID-PM-002', 'FLUID-PM-001'],
        detail: 'Vpfr = Veff − Vpbp − Vdial − Vrep − Vsyr; PFR is distinct from patient balance.',
      },
    ],
  }),
  entry({
    id: 'whole-patient-balance',
    group: 'fluid-ledgers',
    term: 'Whole-patient fluid balance',
    alsoCalled: ['Patient balance', 'net patient balance'],
    definition:
      'All patient inputs minus all patient outputs over one shared time window: external intake minus urine and other non-CRRT output, minus net machine removal, plus any device net gain. Positive means the patient gained fluid; negative means a loss.',
    notTheSameAs: [
      'The PFR setting or net machine removal alone.',
      'An exact number when an input or output is missing: a missing urine record makes the balance unavailable, not a balance with zero urine.',
    ],
    basis: [
      {
        kind: 'device-manual',
        sourceIds: ['FLUID-PM-001'],
        detail: 'Machine PFR and whole-patient fluid balance are different quantities.',
      },
    ],
  }),
  entry({
    id: 'prescribed-flow',
    group: 'prescribed-and-delivered',
    term: 'Prescribed (set) flow',
    alsoCalled: ['Setting', 'BFR set (blood-flow rate setting)'],
    definition:
      'The rate entered for a pump. Blood flow is set in mL/min; dialysate, replacement and fluid removal in mL/h. A setting stays in place while delivery is paused or stopped.',
    notTheSameAs: ['Actual flow, which can be zero while the setting is unchanged.'],
    basis: [
      {
        kind: 'module-drawing',
        detail:
          'This simulation’s set-versus-actual blood-flow rule: flow reaches the circuit only when the pump runs, both lumens are connected and the setting is above zero.',
      },
      {
        kind: 'clinical-publication',
        sourceIds: ['GUID-RRT-ICU-2026'],
        topic: 'prescribed-versus-delivered',
        detail: 'Prescribed and delivered continuous therapy differ during interruptions.',
      },
    ],
  }),
  entry({
    id: 'actual-flow',
    group: 'prescribed-and-delivered',
    term: 'Actual blood flow',
    alsoCalled: ['Delivered blood flow', 'BFR through circuit'],
    definition:
      'The blood flow the circuit is carrying now. It is zero whenever the blood pump is stopped or a lumen is disconnected, whatever the setting says.',
    notTheSameAs: ['The prescribed setting.'],
    basis: [
      {
        kind: 'module-drawing',
        detail: 'This simulation’s set-versus-actual blood-flow rule.',
      },
      {
        kind: 'clinical-publication',
        sourceIds: ['GUID-RRT-ICU-2026'],
        topic: 'prescribed-versus-delivered',
        detail: 'Prescribed and delivered continuous therapy differ during interruptions.',
      },
    ],
  }),
  entry({
    id: 'delivered-dose',
    group: 'prescribed-and-delivered',
    term: 'Prescribed dose and delivered dose',
    alsoCalled: ['Effluent dose (mL/kg/h)'],
    definition:
      'Prescribed dose is the effluent rate divided by the documented weight. Delivered dose uses the effluent actually produced over an interval, so downtime lowers it even when the settings never change. Both are intensity proxies, not measured solute clearance.',
    notTheSameAs: ['A clinical target: this module supplies no dose target.'],
    basis: [
      {
        kind: 'device-manual',
        sourceIds: ['DOSE-PM-001'],
        detail: 'PrisMax displays an effluent rate normalized by body weight.',
      },
      {
        kind: 'clinical-publication',
        sourceIds: ['TEXT-CRRT-NEYRA-2026'],
        topic: 'delivered-therapy',
        detail: 'Kidney-replacement decisions consider the therapy actually delivered.',
      },
    ],
  }),
  entry({
    id: 'downtime',
    group: 'prescribed-and-delivered',
    term: 'Downtime',
    alsoCalled: ['Interruption'],
    definition:
      'Time when treatment is not being delivered. In this simulation it is clock time that passes while delivery is paused or stopped, so a pause and resume at the same moment add none.',
    notTheSameAs: ['A pause itself: downtime accrues only while the clock moves.'],
    basis: [
      {
        kind: 'module-drawing',
        detail: 'This simulation’s delivery accounting.',
      },
      {
        kind: 'clinical-publication',
        sourceIds: ['GUID-RRT-ICU-2026'],
        topic: 'prescribed-versus-delivered',
        detail: 'Interruptions open a gap between prescribed and delivered therapy.',
      },
    ],
  }),
  entry({
    id: 'diffusion',
    group: 'transport',
    term: 'Diffusion',
    alsoCalled: ['Diffusive clearance'],
    definition:
      'Solute movement across the membrane down a concentration gradient. It is shaped by dialysate flow, blood-side delivery and membrane properties; dialysate supplies it in CVVHD and CVVHDF.',
    notTheSameAs: ['Convection, where solute is carried along with water.'],
    basis: [
      {
        kind: 'clinical-publication',
        sourceIds: ['REVIEW-CKRT-CORE-2025'],
        topic: 'solute-transport-mechanisms',
        detail: 'The review describes diffusion, convection, ultrafiltration and adsorption.',
      },
    ],
  }),
  entry({
    id: 'convection',
    group: 'transport',
    term: 'Convection',
    alsoCalled: ['Convective clearance'],
    definition:
      'Solute carried across the membrane with water; how much crosses depends on sieving. Replacement-supported filtration can increase it (CVVH, CVVHDF).',
    notTheSameAs: [
      'Diffusion.',
      'Ultrafiltration, which names the water movement rather than the solute it carries.',
    ],
    basis: [
      {
        kind: 'clinical-publication',
        sourceIds: ['REVIEW-CKRT-CORE-2025'],
        topic: 'solute-transport-mechanisms',
        detail: 'The review describes diffusion, convection, ultrafiltration and adsorption.',
      },
    ],
  }),
  entry({
    id: 'ultrafiltration',
    group: 'transport',
    term: 'Ultrafiltration (UF)',
    alsoCalled: ['Water crossing the membrane'],
    definition: 'The movement of water across the membrane from the blood side to the fluid side.',
    notTheSameAs: [
      'Net ultrafiltration (net machine removal): replacement fluid can give back much of the water that crossed.',
      'Convection, which is the solute carried by that water.',
    ],
    basis: [
      {
        kind: 'clinical-publication',
        sourceIds: ['REVIEW-CKRT-CORE-2025'],
        topic: 'solute-transport-mechanisms',
        detail: 'The review describes diffusion, convection, ultrafiltration and adsorption.',
      },
    ],
  }),
  entry({
    id: 'tmp',
    group: 'pressures',
    term: 'Transmembrane pressure (TMP)',
    alsoCalled: ['TMP'],
    definition:
      'A calculated pressure difference across the membrane, not a measured site. PrisMax AW8035 prints TMP = (filter + return) ÷ 2 − effluent − 18 mmHg. The −18 mmHg is part of the displayed expression, not an alarm limit.',
    notTheSameAs: ['Filter pressure, which is a measured site at the filter inlet.'],
    basis: [
      {
        kind: 'device-manual',
        sourceIds: ['MATH-PM-002'],
        detail: 'Manual p217 · PDF p218.',
      },
    ],
  }),
  entry({
    id: 'filter-drop',
    group: 'pressures',
    term: 'Filter pressure drop',
    alsoCalled: ['ΔPfil', 'filter drop'],
    definition:
      'A calculated difference: filter pressure minus return pressure. This simulation also applies a −25 mmHg sensor-height correction to the drop.',
    notTheSameAs: ['Filter pressure alone.'],
    openQuestion:
      'Held for device review: the manual applies the −25 mmHg correction to the filter and return readings, and whether it belongs on the drop itself is not settled (G01-CRRT-02).',
    basis: [
      {
        kind: 'device-manual',
        sourceIds: ['DEV-PM-010'],
        detail: 'Manual pp201–202 · PDF pp202–203.',
      },
    ],
  }),
  entry({
    id: 'urea-marker',
    group: 'model-markers-and-alerts',
    term: 'Small-solute (urea) marker',
    alsoCalled: ['Urea marker'],
    definition:
      'A model quantity in mmol/L that this simulation removes by delivered clearance alone. Its starting value is a supplied teaching value.',
    notTheSameAs: [
      'A measured urea or BUN result: it is not a laboratory value, and its change over time is not modeled physiology.',
    ],
    basis: [
      {
        kind: 'module-drawing',
        detail:
          'This simulation’s solute pools, which lack solution composition and reviewed source terms.',
      },
    ],
  }),
  entry({
    id: 'creatinine-marker',
    group: 'model-markers-and-alerts',
    term: 'Creatinine marker',
    alsoCalled: [],
    definition:
      'A model marker supplied in mg/dL at case start. The simulation does not model how it changes during treatment.',
    notTheSameAs: [
      'A reported laboratory creatinine trend, or evidence of kidney recovery or worsening.',
    ],
    basis: [
      {
        kind: 'module-drawing',
        detail: 'Each case’s supplied starting values (a synthetic teaching record).',
      },
    ],
  }),
  entry({
    id: 'simulated-alert',
    group: 'model-markers-and-alerts',
    term: 'Simulated alert',
    alsoCalled: ['Generic training alert'],
    definition:
      'A generic alert this teaching model raises for a modeled fault, such as a simulated access-obstruction alert. Acknowledging it does not correct its cause.',
    notTheSameAs: [
      'A PrisMax alarm: the simulated alerts are not mapped to manufacturer alarm names, priorities, colors or automatic pump responses.',
    ],
    basis: [
      {
        kind: 'module-drawing',
        detail: 'This simulation’s generic fault alerts; device alarm mapping awaits review.',
      },
    ],
  }),
])

export function crrtGlossaryEntry(id: string): CrrtGlossaryEntry | undefined {
  return crrtGlossary.find((candidate) => candidate.id === id)
}

export const CRRT_GLOSSARY_STATUS =
  'Draft glossary. Definitions restate this module’s own lessons and circuit drawing, or a registered source record; no clinician has reviewed them yet.' as const

if (new Set(crrtGlossary.map(({ id }) => id)).size !== crrtGlossary.length) {
  throw new Error('CRRT glossary ids must be unique.')
}
