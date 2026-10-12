import {
  PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG,
  PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
} from '../engine/pressureModel'
import type { BaxterCrrtLearnLessonId } from './learnerRegistry'
import { CRRT_NUMBERS } from './teachingNumbers'

const N = CRRT_NUMBERS.value

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
  readonly advancedTool?: 'citrate-path' | 'citrate-comparison'
  readonly kind: 'read' | 'guided' | 'question' | 'builder' | 'numeric'
  readonly run?: 'workflow' | 'delivery' | 'access' | 'fluid' | 'integration'
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
    | 'integration-entry'
    | 'integration-profile'
    | 'integration-inspect'
    | 'integration-decision'
    | 'integration-action'
    | 'integration-balance'
    | 'integration-reassess'
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
        'Dialysate flows on the fluid side of the membrane. Replacement fluid enters the blood path. Ultrafiltration moves water from blood across the membrane to the effluent path, which carries everything leaving the fluid side of the filter to collection.',
        'The four names describe which transport paths are used. Combining mechanisms does not establish a better modality; the treatment goal and clinical context still determine the choice. Quantitative settings come later.',
      ],
    },
    {
      id: 'goals-case',
      title: 'Apply: identify goals and constraints',
      exampleId: 'constructed-overload-acidosis',
      kind: 'question',
      instruction: 'Frame the prescription for this patient before choosing any setting.',
      teaching: [],
      question:
        'An adult with oliguric AKI has gained fluid every day this week, and her metabolic acidosis has not improved with initial treatment. Her blood pressure is labile. You are starting CRRT. How do you frame the prescription?',
      choices: [
        option(
          'fluid-only',
          'One goal, fluid removal; running continuously will take care of the acidosis.',
          false,
          'Running continuously only spreads the treatment over time. The acidosis is treated by dialysate or replacement flow, which you prescribe as an effluent dose. The fluid comes off through a separate net-removal rate.',
        ),
        option(
          'two-goals',
          'Two goals, acid-base control and fluid removal, both limited by blood pressure.',
          true,
          `Each goal has its own control. The effluent dose handles solute and acid-base: aim for a delivered ${N('dose-delivered')}. Net removal handles the fluid, and her blood pressure sets how fast you can take it.`,
        ),
        option(
          'most-mechanisms',
          'One goal, maximal clearance; CVVHDF will cover the acidosis and the fluid together.',
          false,
          'CVVHDF combines diffusion and convection, but trials have not shown that one continuous modality gives better outcomes than another. Choosing one still leaves two decisions open: the effluent dose for the acidosis and the net-removal rate for the fluid.',
        ),
      ],
    },
    {
      id: 'goals-transfer',
      title: 'Apply again: a different fluid goal',
      exampleId: 'constructed-no-removal',
      kind: 'question',
      instruction: 'Work out both answers: what happens to solute, and what happens to fluid.',
      teaching: [],
      question:
        'A second patient needs solute clearance but no fluid off, so net CRRT removal is set to 0 mL/h. Infusions and feeds run at 150 mL/h; urine and drains total 50 mL/h. What happens over the next 24 hours?',
      choices: [
        option(
          'neutral',
          'Solute is cleared and the fluid balance stays even.',
          false,
          'Zero net removal only means the machine takes no fluid. Intake of 150 mL/h against 50 mL/h of output leaves the patient 100 mL/h positive, which is 2.4 L over the day.',
        ),
        option(
          'no-support',
          'Fluid balance stays even and no solute is cleared.',
          false,
          'Clearance comes from dialysate or replacement flow leaving as effluent, and that runs whether or not there is net removal. The balance is not even either: 150 mL/h in and 50 mL/h out is 100 mL/h positive.',
        ),
        option(
          'gain',
          'Solute is cleared and the patient gains 2.4 L.',
          true,
          'Dialysate and replacement flow do the clearing; net removal is a separate setting. With it at zero, 150 mL/h in and 50 mL/h out leaves the patient 100 mL/h positive, or 2.4 L in 24 hours.',
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
        'Select all six readouts. Find the actual sites used by TMP (transmembrane pressure) and filter pressure drop, then compare the isolated return-side change.',
      teaching: [
        'Access pressure is measured before the blood pump. Filter pressure is measured upstream of the filter; return pressure describes the return segment; effluent pressure is measured on the fluid path.',
        `TMP and filter pressure drop are calculated from the monitored readings; neither has its own sensor. The PrisMax AW8035 manual prints TMP = (filter + return) / 2 − effluent ${PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG} mmHg. For filter drop it prints filter − return and says the filter and return readings are corrected for a ${PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG} mmHg sensor-height bias. This simulation applies that ${PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG} mmHg to the drop itself; whether a console's displayed values follow that arithmetic awaits device review. Neither constant is an alarm threshold.`,
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
        'Read the before and after columns in the table. Blood flow is the same in both.',
      teaching: [],
      question:
        'Blood flow has stayed at 100 mL/min. Access pressure has gone from −15 to −35 mmHg. Filter, return and effluent pressures, TMP and filter pressure drop have not moved. What do you do first?',
      choices: [
        option(
          'access-region',
          'Check the access line for a kink or clamp, then the patient’s position.',
          true,
          `Access pressure is measured before the pump. A more negative reading with everything downstream unchanged puts the resistance between the patient and the pump. A kinked line, a closed clamp, a catheter tip against the vessel wall and a clotting lumen all read the same, so you look: line first, then position, then the catheter. PrisMax alarms “Access Extremely Negative” ${N('access-low-limit')}; the trend tells you where to look long before that.`,
        ),
        option(
          'catheter-only',
          'Flush the access lumen; a reading this negative means the catheter is clotting.',
          false,
          'The region is right, the diagnosis is early. A kink, a clamp or a tip against the vessel wall gives the same reading as a clotting lumen. Flushing comes after you have looked at the line and the patient’s position.',
        ),
        option(
          'filter-only',
          'Check the filter for clot; the access reading falls when the filter resists flow.',
          false,
          'The filter sits after the pump. A clotting filter raises filter pressure and widens the filter pressure drop, and here both are unchanged. Only the reading before the pump moved, so start between the patient and the pump.',
        ),
      ],
    },
    {
      id: 'pressure-transfer',
      title: 'Apply again: a different pressure pattern',
      exampleId: 'unlabeled-pattern-b',
      kind: 'question',
      tool: 'unknown-return',
      instruction: 'Read the second table the same way. Blood flow is again unchanged.',
      teaching: [],
      question:
        'At the same blood flow, return pressure has risen from 20 to 40 mmHg and filter pressure from 50 to 70 mmHg. Filter pressure drop is still 5 mmHg. What do you do first?',
      choices: [
        option(
          'filter',
          'Inspect the filter first; filter pressure rose, and a clotting filter raises it.',
          false,
          `A clotting filter raises filter pressure more than return pressure, so the pressure drop across it widens. PrisMax raises its filter clotting advisory at ${N('clotting-advisory')}. Here the drop has not changed, so the new resistance is not in the filter.`,
        ),
        option(
          'return',
          'Assess the patient and inspect the return path; the readings point to a region, not a specific cause.',
          true,
          `Filter pressure is measured upstream of the filter, so it rises with anything downstream of it. Both readings rose by 20 mmHg and the drop across the filter is unchanged: the resistance is after the filter. TMP rises too, because it is calculated from the filter and return readings. Check the return line for a kink or clamp, then the catheter position and the return chamber for clot. PrisMax alarms “Return Extremely Positive” ${N('return-high-limit')}.`,
        ),
        option(
          'ignore',
          'Keep observing without inspecting; an unchanged filter pressure drop suggests the circuit is intact.',
          false,
          `The drop is a difference. Filter and return pressures each rose by 20 mmHg, so the difference stayed at 5 mmHg while the return limb became harder to push blood through. Left alone, a return obstruction ends in the “Return Extremely Positive” alarm (${N('return-high-limit')}) and lost treatment time.`,
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
      instruction:
        'Work out what the dialysate change does to clearance, effluent and the patient.',
      teaching: [],
      question:
        'An 80 kg patient on CVVHD has a rising potassium. You raise dialysate from 1,000 to 2,000 mL/h and leave net removal at 100 mL/h. What changes?',
      choices: [
        option(
          'infusion',
          'Clearance rises, and the patient takes in an extra 1,000 mL/h.',
          false,
          'Dialysate runs on the fluid side of the membrane and leaves as effluent. It never enters the blood, so it adds nothing to the patient’s intake. Effluent goes up by the same 1,000 mL/h.',
        ),
        option(
          'lab',
          'Clearance nearly doubles, so the potassium falls twice as fast.',
          false,
          'The first half is right: at these flows small-solute clearance follows the effluent rate, and that goes from 1,100 to 2,100 mL/h. The potassium is another matter. It also depends on the blood level, on release from cells and on intake, so you recheck it; you don’t predict it.',
        ),
        option(
          'diffusion',
          'Clearance and effluent rise; fluid removal stays the same.',
          true,
          `More dialysate means more diffusion, and all of it leaves as effluent: 1,100 mL/h becomes 2,100 mL/h. At 80 kg that takes the dose from about 14 to about 26 mL/kg/h, against a delivered target of ${N('dose-delivered')}. Net removal is a separate setting and is still 100 mL/h.`,
        ),
      ],
    },
    {
      id: 'transport-transfer',
      title: 'Apply again: replacement-supported filtration',
      exampleId: 'transport-case-b',
      kind: 'question',
      instruction: 'Now work out the same three things for a replacement change.',
      teaching: [],
      question:
        'On CVVH with post-filter replacement, you raise replacement from 1,000 to 2,000 mL/h. Filtration rises to match and net removal stays at 100 mL/h. What is the main change?',
      choices: [
        option(
          'convection',
          'More water crosses the membrane, carrying solute by convection; replacement offsets part of that water.',
          true,
          `Filtration goes from 1,100 to 2,100 mL/h, and solute goes with the water. Replacement puts back all but the 100 mL/h of net removal, so the patient’s fluid loss is unchanged. With post-filter replacement all of that water comes out of the blood inside the filter: check the filtration fraction and keep it under ${N('filtration-fraction-ceiling')}.`,
        ),
        option(
          'replacement-dialysate',
          'Replacement works like dialysate: it runs on the fluid side and clears solute by diffusion.',
          false,
          'Replacement is infused into the blood, before or after the filter. It clears by convection: plasma water is filtered out carrying solute, and clean fluid takes its place. Dialysate is the fluid that stays on the other side of the membrane.',
        ),
        option(
          'all-patient-loss',
          'The extra effluent is extra fluid removed from the patient, even though the removal setting is unchanged.',
          false,
          'Effluent rose by 1,000 mL/h and replacement rose by the same 1,000 mL/h. The patient’s net removal is the difference between what is filtered and what is replaced, and it is still 100 mL/h.',
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
        'Synthetic example: 80 kg, CVVHD, dialysate 1,900 mL/h and net CRRT removal 100 mL/h. Net CRRT removal is the net ultrafiltration the machine takes from the patient; PrisMax sets it as patient fluid removal (PFR). Replacement, PBP, syringe and makeup flows are zero. Total effluent is 2,000 mL/h. These are illustration values, not a treatment target.',
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
      instruction: 'Calculate what was delivered over the whole 24 hours.',
      teaching: [],
      question:
        'Same 80 kg patient, effluent 2,000 mL/h. The circuit clotted twice and treatment ran for 12 of the last 24 hours. What dose was delivered over the day?',
      choices: [
        option(
          '25',
          '25 mL/kg/h; the prescription was the same throughout.',
          false,
          '25 mL/kg/h is the dose while running. Over the day only 12 hours of effluent were produced: 2,000 × 12 ÷ 24 ÷ 80 = 12.5 mL/kg/h.',
        ),
        option(
          '12.5',
          '12.5 mL/kg/h; half of the effluent was produced.',
          true,
          `2,000 × 12 ÷ 24 ÷ 80 = 12.5 mL/kg/h, about half the delivered target of ${N('dose-delivered')}. Downtime is the usual reason delivery falls short, which is why you prescribe ${N('dose-prescribed')}. Twelve hours down is far more than that margin covers, so find out why the circuit keeps stopping.`,
        ),
        option(
          '50',
          '50 mL/kg/h; the daily volume ran in half of the time.',
          false,
          'Downtime removes effluent; it does not concentrate it. 24,000 mL over 24 hours at 80 kg is 12.5 mL/kg/h. Dividing by the 12 hours that ran only gives back the running rate of 25 mL/kg/h.',
        ),
      ],
    },
    {
      id: 'fluid-transfer',
      title: 'Apply again: account for all patient fluid',
      exampleId: 'synthetic-patient-ledger-b',
      kind: 'question',
      instruction: 'Count net CRRT removal once, then add the intake and the other outputs.',
      teaching: [],
      question:
        'Over the same 24 hours: intake 3,600 mL, urine and drains 1,200 mL, net CRRT removal 1,800 mL. What is the patient’s fluid balance?',
      choices: [
        option(
          'negative',
          '−1,800 mL; the machine’s net removal is the balance.',
          false,
          'That is what the machine took. The patient also took in 3,600 mL and put out 1,200 mL by other routes: 3,600 − 1,200 − 1,800 = +600 mL.',
        ),
        option(
          'zero',
          '0 mL; the circuit’s own fluids make up the difference.',
          false,
          'Net CRRT removal is already what is left after dialysate, replacement and pre-blood-pump fluid are accounted for. Counting them again double-counts. The balance is 3,600 − 1,200 − 1,800 = +600 mL.',
        ),
        option(
          'positive',
          '+600 mL; intake minus other output minus net removal.',
          true,
          '3,600 − 1,200 − 1,800 = +600 mL. The machine removed 1,800 mL and the patient still gained fluid, because intake ran ahead of everything coming out.',
        ),
      ],
    },
  ],
}
