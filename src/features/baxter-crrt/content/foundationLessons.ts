import {
  PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG,
  PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
} from '../engine/pressureModel'
import type { BaxterCrrtLearnLessonId } from './learnerRegistry'

export type CrrtFoundationTool =
  | 'overview'
  | 'modalities'
  | 'blood-walk'
  | 'fluid-walk'
  | 'pressure-sites'
  | 'known-pressure'
  | 'unknown-access'
  | 'unknown-return'
  | 'mechanisms'
  | 'transport-comparison'
  | 'worked-dose'
  | 'builder'
  | 'fluid-balance'
export interface CrrtFoundationChoice {
  readonly id: string
  readonly label: string
  readonly correct: boolean
  readonly feedback: string
}
export interface CrrtFoundationTask {
  readonly id: string
  readonly title: string
  readonly exampleId: string
  readonly instruction: string
  readonly teaching: readonly string[]
  readonly tool?: CrrtFoundationTool
  readonly kind: 'read' | 'guided' | 'question' | 'builder' | 'numeric'
  readonly run?: 'workflow' | 'delivery' | 'access' | 'fluid'
  readonly operation?:
    | 'hardware'
    | 'setup'
    | 'normal'
    | 'alarm-arrival'
    | 'alarm-repair'
    | 'alarm-verify'
    | 'delivery-timeline'
    | 'balance'
    | 'missing-chart'
    | 'net-change'
    | 'net-observe'
  readonly question?: string
  readonly choices?: readonly CrrtFoundationChoice[]
}
const option = (
  id: string,
  label: string,
  correct: boolean,
  feedback: string,
): CrrtFoundationChoice => ({ id, label, correct, feedback })

/** Task order within the four existing IDs; the site's canonical lesson order stays authoritative. */
export const crrtFoundationTasks: Partial<
  Record<BaxterCrrtLearnLessonId, readonly CrrtFoundationTask[]>
> = {
  'crrt-indications-modality': [
    {
      id: 'orient',
      title: 'Two treatment goals, one blood circuit',
      exampleId: 'normal-orientation',
      kind: 'read',
      tool: 'overview',
      instruction:
        'Follow blood from patient access to the filter and back. Separate the two questions the prescription must answer.',
      teaching: [
        'Continuous renal replacement therapy (CRRT) provides kidney support over time. Solute and acid-base support address the composition of blood. Net fluid removal addresses how much fluid CRRT removes from the patient.',
        'Blood leaves the patient through the access limb, passes a pump and filter, then returns through the return limb. The membrane separates blood from the fluid compartment. Later tasks add each fluid path to this same circuit.',
        'The continuous approach spreads treatment over time. Hemodynamic tolerance, urgency and the ability to maintain treatment matter; a modality name alone does not answer these questions. General ICU physiology is the prerequisite; this lesson introduces the CRRT terms.',
      ],
    },
    {
      id: 'worked-goal',
      title: 'Worked example: separate support from removal',
      exampleId: 'constructed-solute-support',
      kind: 'read',
      instruction: 'Read how the clinician separates a treatment goal from a constraint.',
      teaching: [
        'Constructed example: an adult with AKI needs ongoing solute and acid-base support. The team currently seeks no net removal by CRRT, and hemodynamic instability makes rapid fluid shifts difficult to tolerate.',
        'Reasoning: name solute/acid-base support as the goal, zero net CRRT removal as a separate fluid assumption, and tolerance plus continuity as constraints. Zero CRRT removal does not mean the whole patient is fluid-neutral.',
        'An urgent threat requires timely clinical treatment and escalation. A software exercise or checklist must never delay it. These examples do not select an individual regimen.',
      ],
    },
    {
      id: 'modality-preview',
      title: 'Put the modality names on the circuit',
      exampleId: 'modality-illustrations',
      kind: 'guided',
      tool: 'modalities',
      instruction:
        'Select each of the four modality views and follow the active paths. These are illustrations, not applied prescriptions.',
      teaching: [
        'Dialysate flows on the fluid side of the membrane. Replacement fluid enters the blood path. Ultrafiltration moves water from blood across the membrane to the effluent path.',
        'The four names describe which transport paths are used. Combining mechanisms does not establish a better modality; the treatment goal and clinical context still determine the choice. Quantitative settings come later.',
      ],
    },
    {
      id: 'goals-case',
      title: 'Apply: identify goals and constraints',
      exampleId: 'constructed-overload-acidosis',
      kind: 'question',
      instruction: 'Choose the goals and constraint present in this different constructed case.',
      teaching: [],
      question:
        'An adult with oliguric AKI has progressive fluid accumulation and persistent metabolic acidosis despite initial treatment. Blood pressure is labile. Which description best frames a kidney-support discussion?',
      choices: [
        option(
          'fluid-only',
          'Fluid removal alone; the continuous label addresses the acid-base problem.',
          false,
          'A delivery schedule does not itself specify acid-base support. Both the composition of blood and fluid accumulation are relevant here.',
        ),
        option(
          'two-goals',
          'Solute/acid-base support and fluid management; hemodynamic tolerance constrains delivery.',
          true,
          'This identifies the two goals separately and recognizes tolerance as a constraint. It does not prescribe a modality or a removal rate.',
        ),
        option(
          'most-mechanisms',
          'Use the modality with the most mechanisms; it resolves the tolerance question.',
          false,
          'More mechanisms do not establish superiority or tolerability. Define the goals and reassess the patient rather than choosing by the number of active paths.',
        ),
      ],
    },
    {
      id: 'goals-transfer',
      title: 'Apply again: a different fluid goal',
      exampleId: 'constructed-no-removal',
      kind: 'question',
      instruction: 'Use the same distinction when the fluid goal changes.',
      teaching: [],
      question:
        'A second constructed patient needs solute support. Net CRRT removal is set to zero while external intake exceeds urine and other output. Which statement follows?',
      choices: [
        option(
          'neutral',
          'The patient is fluid-neutral because CRRT removes no net fluid.',
          false,
          'External intake still exceeds non-CRRT output. The patient can gain fluid despite zero net CRRT removal.',
        ),
        option(
          'no-support',
          'Zero net removal prevents the circuit from supporting solute control.',
          false,
          'Dialysate or replacement-supported filtration can support solute transport while net CRRT removal is zero.',
        ),
        option(
          'gain',
          'Solute support and zero net CRRT removal can coexist with a positive patient balance.',
          true,
          'CRRT removal and whole-patient balance are different quantities. Intake and non-CRRT outputs remain part of the patient ledger.',
        ),
      ],
    },
  ],
  'crrt-circuit-pressures': [
    {
      id: 'trace-blood',
      title: 'Walk the normal blood path',
      exampleId: 'normal-circuit-100',
      kind: 'guided',
      tool: 'blood-walk',
      instruction:
        'Select the six stops in order. Each stop highlights its position on the fixed circuit.',
      teaching: [
        'Start with a normal circuit before a fault. The pump draws blood through the access segment, drives it through the filter and returns it to the patient. A pressure describes the segment where it is measured, not the whole circuit.',
      ],
    },
    {
      id: 'trace-fluids',
      title: 'Add the fluids one path at a time',
      exampleId: 'fluid-topology',
      kind: 'guided',
      tool: 'fluid-walk',
      instruction:
        'Select each fluid path and identify where it enters or leaves. The combined view illustrates topology, not a prescription.',
      teaching: [
        'Dialysate stays on the fluid side of the membrane as a bulk flow, while solutes exchange across it. Pre- and post-filter replacement enter blood at different sites. Pre-blood-pump (PBP) fluid enters before the blood pump. Effluent leaves the fluid compartment for collection.',
        'PBP describes a location; it does not establish which solution should run there. Citrate solution selection and dosing remain protocol-dependent.',
      ],
    },
    {
      id: 'read-sites',
      title: 'Four sites and two calculated relationships',
      exampleId: 'normal-circuit-100',
      kind: 'guided',
      tool: 'pressure-sites',
      instruction:
        'Select all six readouts. Find the actual sites used by TMP and filter pressure drop, then compare the isolated return-side change.',
      teaching: [
        'Access pressure is measured before the blood pump. Filter pressure is measured upstream of the filter; return pressure describes the return segment; effluent pressure is measured on the fluid path.',
        `TMP and filter pressure drop are calculated from the raw monitored readings. For the pinned PrisMax AW8035 profile, displayed TMP = (filter + return) / 2 − effluent ${PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG} mmHg; displayed filter drop = filter − return ${PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG} mmHg. These fixed device display offsets are not alarm thresholds. Neither calculated value has its own sensor.`,
        'These are synthetic normal operating points, not clinical normal ranges or alarm thresholds. Compare patterns and context rather than diagnosing from a single pressure.',
      ],
    },
    {
      id: 'known-fault',
      title: 'Known fault → predict and explain',
      exampleId: 'known-return-obstruction',
      kind: 'guided',
      tool: 'known-pressure',
      instruction:
        'In the lab, predict the six signals for a known return-line obstruction, reveal the result, and review the explanation.',
      teaching: [
        'The earlier comparison showed why a return-side resistance change can raise return and filter pressures together. Now use all six signals at the same modeled blood flow. This is a known-fault consequence exercise; you are not identifying an unseen cause.',
      ],
    },
    {
      id: 'unknown-pattern',
      title: 'Unknown pattern → region and inspection',
      exampleId: 'unlabeled-pattern-a',
      kind: 'question',
      tool: 'unknown-access',
      instruction:
        'Use the displayed change at matched blood flow to choose a supported region and a discriminating inspection.',
      teaching: [],
      question:
        'These synthetic readings changed with blood flow held at 100 mL/min. Which conclusion is supported?',
      choices: [
        option(
          'access-region',
          'An access-side problem is supported; assess the patient and inspect the catheter and pre-pump line to distinguish causes.',
          true,
          'The access pressure became more negative while the downstream readings stayed the same. Catheter and access-line resistance use identical pressure inputs here, so physical inspection is needed for that finer distinction.',
        ),
        option(
          'catheter-only',
          'The pressure pattern proves catheter obstruction; further access-line inspection adds no information.',
          false,
          'The model gives catheter and access-line resistance the same pressure signature. The pattern supports a region, not a unique catheter diagnosis.',
        ),
        option(
          'filter-only',
          'The pattern establishes filter obstruction; use the isolated access pressure to choose a filter intervention.',
          false,
          'Filter and return readings did not separate further here. Start with the access region and a discriminating inspection, without inferring an intervention from one value.',
        ),
      ],
    },
    {
      id: 'pressure-transfer',
      title: 'Apply again: a different pressure pattern',
      exampleId: 'unlabeled-pattern-b',
      kind: 'question',
      tool: 'unknown-return',
      instruction: 'Reconsider the region in this different synthetic comparison.',
      teaching: [],
      question:
        'At the same blood flow, return and filter pressures rise together while filter pressure drop stays unchanged. What should you inspect to refine the interpretation?',
      choices: [
        option(
          'filter',
          'Focus on the filter alone because any higher filter pressure proves filter clotting.',
          false,
          'Filter pressure can rise because resistance downstream has increased. The unchanged filter pressure drop limits a filter-only interpretation.',
        ),
        option(
          'return',
          'Assess the patient and inspect the return path for increased resistance; the readings do not identify one specific cause.',
          true,
          'A return-side resistance increase can raise both readings together without widening filter pressure drop. Physical findings and patient context distinguish the cause.',
        ),
        option(
          'ignore',
          'Treat the unchanged pressure drop as proof that no circuit problem is present.',
          false,
          'An unchanged calculated difference can coexist with meaningful changes in its component pressures. Inspect the supported region and verify the cause.',
        ),
      ],
    },
  ],
  'crrt-solute-transport': [
    {
      id: 'mechanisms',
      title: 'At the membrane: solute and water',
      exampleId: 'conceptual-filter',
      kind: 'guided',
      tool: 'mechanisms',
      instruction:
        'Select diffusion, convection and ultrafiltration. Compare what crosses the membrane in the filter inset.',
      teaching: [
        'Diffusion is solute movement down a concentration gradient. Convection is solute transport with water crossing the membrane; how much solute crosses depends on sieving. Ultrafiltration names the water movement itself.',
        'Replacement fluid enters the blood path to replace part of the filtered volume. Dialysate flows on the opposite side; it is not directly infused into blood, but solute exchange across the membrane is the purpose of dialysis.',
        'Adsorption means binding to the membrane or circuit. It is not a flow-selected substitute for these modalities and is not quantitatively modeled here.',
      ],
    },
    {
      id: 'transport-modalities',
      title: 'Connect mechanisms to modalities',
      exampleId: 'modality-illustrations',
      kind: 'guided',
      tool: 'modalities',
      instruction:
        'Select all four views. Compare active dialysate and replacement paths while the blood topology stays fixed.',
      teaching: [
        'SCUF emphasizes net ultrafiltration; CVVH uses replacement-supported hemofiltration; CVVHD uses dialysate-supported diffusion; CVVHDF combines the two solute-transport approaches.',
        'These views constrain incompatible paths. Changing a picture does not apply a machine prescription. The supported device workflow remains separately scoped.',
      ],
    },
    {
      id: 'compare-flows',
      title: 'Change one fluid flow at a time',
      exampleId: 'synthetic-flow-comparison',
      kind: 'guided',
      tool: 'transport-comparison',
      instruction:
        'Try each isolated change. Compare total effluent, water crossing the membrane and net CRRT removal against the same baseline.',
      teaching: [
        'Baseline illustration: dialysate 1,000 mL/h, post-filter replacement 1,000 mL/h, net CRRT removal 100 mL/h; other added fluid terms are zero.',
        'The ledger calculates fluid rates. The transport captions describe expected mechanisms; this view does not model patient potassium, pH, measured clearance or tolerability.',
      ],
    },
    {
      id: 'transport-case',
      title: 'Apply: a change in solute-support flow',
      exampleId: 'transport-case-a',
      kind: 'question',
      instruction: 'Interpret the changed flow without inventing a patient response.',
      teaching: [],
      question:
        'A CVVHD illustration increases dialysate flow while net CRRT removal stays fixed. Which interpretation is supported?',
      choices: [
        option(
          'infusion',
          'The added dialysate is directly infused into blood, increasing patient intake by the same rate.',
          false,
          'Dialysate is a fluid-side flow. It is not a direct blood-path infusion, although solutes exchange across the membrane.',
        ),
        option(
          'lab',
          'The flow change establishes a specific fall in potassium over the next hour.',
          false,
          'Fluid-flow arithmetic does not establish a patient laboratory trajectory. Clearance also depends on blood-side delivery, membrane behavior and patient factors.',
        ),
        option(
          'diffusion',
          'Dialysate-supported transport and total effluent change; net CRRT removal need not change.',
          true,
          'Changing dialysate flow can change diffusive transport and the effluent-pump burden. The separately specified net CRRT removal remains fixed in this illustration.',
        ),
      ],
    },
    {
      id: 'transport-transfer',
      title: 'Apply again: replacement-supported filtration',
      exampleId: 'transport-case-b',
      kind: 'question',
      instruction: 'Now interpret a different path change.',
      teaching: [],
      question:
        'A CVVH illustration increases replacement flow and matching filtration while holding net CRRT removal fixed. What is the main distinction?',
      choices: [
        option(
          'convection',
          'More water crosses the membrane with convective solute transport; the replacement offsets part of that water loss.',
          true,
          'Replacement-supported filtration can increase convective transport without the same increase in net patient removal. The exact solute response is not calculated here.',
        ),
        option(
          'replacement-dialysate',
          'Replacement stays on the fluid side of the membrane and acts as dialysate.',
          false,
          'Replacement enters the blood path. Dialysate follows a separate fluid-side path.',
        ),
        option(
          'all-patient-loss',
          'All increased effluent must be additional net fluid loss from the patient.',
          false,
          'The added replacement must be accounted for before interpreting net CRRT removal. Total effluent is not the patient’s net loss.',
        ),
      ],
    },
  ],
  'crrt-prescription-dosing': [
    {
      id: 'worked-dose',
      title: 'One example, one denominator, one interval',
      exampleId: 'synthetic-80kg-24h',
      kind: 'read',
      tool: 'worked-dose',
      instruction:
        'Follow the worked calculation from the prescription to the common 24-hour interval.',
      teaching: [
        'Synthetic example: 80 kg, CVVHD, dialysate 1,900 mL/h and net CRRT removal 100 mL/h. Replacement, PBP, syringe and makeup flows are zero. Total effluent is 2,000 mL/h. These are illustration values, not a treatment target.',
        'Running dose proxy: 2,000 ÷ 80 = 25 mL/kg/h. With three hours of assumed downtime, 21 of 24 hours run: 2,000 × 21 ÷ 24 ÷ 80 = 21.875 mL/kg/h.',
        'Both values are projected from entered assumptions. Effluent-based intensity is a proxy, not measured solute clearance. Only recorded delivery from a run over the same interval can support a delivered-dose claim.',
      ],
    },
    {
      id: 'downtime-comparison',
      title: 'Build and interpret a downtime comparison',
      exampleId: 'synthetic-80kg-24h',
      kind: 'builder',
      tool: 'builder',
      instruction:
        'Use the three-stage builder. Increase only downtime from 3 to 6 hours, compare the result, then explain what changed and what stayed fixed.',
      teaching: [
        'The builder below is bound to the same 80 kg example. It does not send settings to a device. Blood flow is in mL/min; dialysate and removal are in mL/h. The time window and weight remain unchanged.',
        'Advanced filtration fraction and makeup attribution retain their existing source gates. They are not prerequisites for this valid basic downtime calculation.',
      ],
    },
    {
      id: 'patient-balance',
      title: 'Read the patient ledger as well as the machine',
      exampleId: 'synthetic-zero-removal',
      kind: 'read',
      tool: 'fluid-balance',
      instruction: 'Compare the two ledgers over one common 24-hour interval.',
      teaching: [
        'Separate machine effluent, net removal attributable to CRRT and whole-patient balance. External intake and non-CRRT outputs continue when CRRT is interrupted. Positive patient balance means gain; negative means loss.',
        'This changed example holds net CRRT removal at zero while intake is 150 mL/h and urine/other output is 50 mL/h. The patient therefore gains fluid. Replacement and PBP are already accounted for in the machine net-removal term and must not be counted twice.',
        'In simplified SCUF with all other fluid terms zero, effluent and net CRRT removal can have the same numerical rate. The quantities still describe different concepts.',
      ],
    },
    {
      id: 'dose-transfer',
      title: 'Apply: a different interruption',
      exampleId: 'synthetic-80kg-12h-running',
      kind: 'question',
      instruction:
        'Calculate the consequence of a different downtime interval. No treatment target is being requested.',
      teaching: [],
      question:
        'For the same 80 kg example and 2,000 mL/h effluent rate, assume 12 of 24 hours actually run. Which projected time-averaged dose follows?',
      choices: [
        option(
          '25',
          '25 mL/kg/h, because the running prescription did not change.',
          false,
          '25 mL/kg/h describes the running prescription. Half of the common 24-hour interval has no CRRT delivery in these assumptions.',
        ),
        option(
          '12.5',
          '12.5 mL/kg/h, while the running prescription remains 25 mL/kg/h.',
          true,
          '2,000 × 12 ÷ 24 ÷ 80 = 12.5. The time-averaged projection and the unchanged running prescription answer different questions.',
        ),
        option(
          '50',
          '50 mL/kg/h, because the same rate ran for fewer hours.',
          false,
          'Shorter running time reduces the delivered-volume assumption over a fixed interval. It does not double the dose.',
        ),
      ],
    },
    {
      id: 'fluid-transfer',
      title: 'Apply again: account for all patient fluid',
      exampleId: 'synthetic-patient-ledger-b',
      kind: 'question',
      instruction: 'Use net CRRT removal once, then include external inputs and outputs.',
      teaching: [],
      question:
        'Over a common 24-hour interval, external intake totals 3,600 mL, non-CRRT output totals 1,200 mL, and recorded net CRRT removal totals 1,800 mL. Which whole-patient balance follows?',
      choices: [
        option(
          'negative',
          '−1,800 mL; net CRRT removal is the whole-patient balance.',
          false,
          'This omits external intake and non-CRRT output. Net machine removal alone does not describe patient balance.',
        ),
        option(
          'zero',
          '0 mL; replacement and dialysate must be subtracted again.',
          false,
          'Net CRRT removal already accounts for the circuit’s added fluids. Subtracting them again would double-count them.',
        ),
        option(
          'positive',
          '+600 mL; intake minus non-CRRT output minus net CRRT removal.',
          true,
          '3,600 − 1,200 − 1,800 = +600 mL. Positive means gain. This uses recorded interval totals, not the current rate multiplied by all elapsed time.',
        ),
      ],
    },
  ],
}
