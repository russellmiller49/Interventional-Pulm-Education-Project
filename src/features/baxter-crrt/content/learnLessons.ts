import type { LearnBlock } from '@/features/learning-module/types'

import { BAXTER_CRRT_LEARN_LESSON_IDS, type BaxterCrrtLearnLessonId } from './learnerRegistry'

export type BaxterCrrtEmbeddedLabId = 'LAB-PRESCRIPTION' | 'LAB-PRESSURE-LOCALIZATION'

export interface BaxterCrrtLearnLesson extends LearnBlock {
  readonly id: BaxterCrrtLearnLessonId
  readonly summary: string
  readonly sourceRecordIds: readonly string[]
  readonly reviewStatus: 'pending'
  readonly embeddedLabId?: BaxterCrrtEmbeddedLabId
}

const lesson = (
  value: Omit<BaxterCrrtLearnLesson, 'reviewStatus'>,
): Readonly<BaxterCrrtLearnLesson> =>
  Object.freeze({
    ...value,
    paragraphs: value.paragraphs ? [...value.paragraphs] : undefined,
    bullets: value.bullets ? [...value.bullets] : undefined,
    sourceRecordIds: Object.freeze([...value.sourceRecordIds]),
    reviewStatus: 'pending' as const,
  })

/**
 * Draft didactic prose mined from the existing sourced cases and retired concept labs.
 * `reviewStatus: pending` is intentional until the owner completes the clinical/editorial pass.
 */
export const baxterCrrtLearnLessons: readonly BaxterCrrtLearnLesson[] = Object.freeze([
  lesson({
    id: 'crrt-indications-modality',
    title: 'CRRT indications and modality selection',
    summary:
      'Start with a patient-centered goal, then choose the transport and fluid strategy that serves it.',
    paragraphs: [
      'CRRT is a way to deliver kidney support continuously; it is not a diagnosis or a goal by itself. First define the problem to solve—solute control, acid-base support, fluid removal, or a combination—and name the physiologic constraint that makes a continuous approach useful.',
      'The modality label describes how solute and water move through the circuit. The prescription still has to specify the intended dose, fluid goal, anticoagulation plan, monitoring plan, and conditions for reassessment.',
    ],
    bullets: [
      'SCUF emphasizes net ultrafiltration with minimal intended solute clearance.',
      'CVVH emphasizes convection through replacement-fluid-supported hemofiltration.',
      'CVVHD emphasizes diffusion through dialysate flow.',
      'CVVHDF combines diffusive and convective transport.',
      'No modality is universally best; selection depends on the treatment goal, patient context, device configuration, and local practice.',
    ],
    sourceRecordIds: [
      'TEXT-CRRT-NEYRA-2026',
      'REVIEW-CRRT-PRINCIPLES-2021',
      'REVIEW-CKRT-CORE-2025',
      'GUID-RRT-ICU-2026',
      'GUID-NICE-NG148-2024',
    ],
  }),
  lesson({
    id: 'crrt-circuit-pressures',
    title: 'Circuit anatomy and pressure localization',
    summary:
      'Use the circuit path to localize a pattern before reacting to an isolated pressure value.',
    paragraphs: [
      'Trace the blood path from patient access through the access segment, blood pump, filter, return segment, and back to the patient. The effluent path leaves the filter and is measured separately.',
      'Pressure values are location-dependent signals. Interpret access, filter, return, effluent, transmembrane pressure, and filter pressure drop together and across time. A number by itself does not establish a diagnosis or a universal alarm response.',
    ],
    bullets: [
      'Start with patient safety and visible circuit inspection.',
      'Name the likely location and competing explanations before changing a control.',
      'Correct the cause, then verify the pressure pattern, delivery, circuit, and patient response.',
      'Use current PrisMax instructions and local policy for exact alarm and restart actions.',
    ],
    embeddedLabId: 'LAB-PRESSURE-LOCALIZATION',
    sourceRecordIds: [
      'DEV-PM-009',
      'DEV-PM-010',
      'MATH-PM-002',
      'TEXT-RRT-HOSTE-2024',
      'REVIEW-CRRT-PRINCIPLES-2021',
      'SYNTH-LAB-PRESSURE-001',
    ],
  }),
  lesson({
    id: 'crrt-solute-transport',
    title: 'Solute and water transport',
    summary:
      'Separate diffusion, convection, ultrafiltration, and adsorption before interpreting a modality.',
    paragraphs: [
      'Diffusion moves solute down a concentration gradient across the membrane and is shaped by dialysate flow, blood-side delivery, membrane properties, and molecule size. Convection carries dissolved solute with ultrafiltered plasma water; its effect depends on ultrafiltration and sieving behavior.',
      'Ultrafiltration describes water movement across the membrane. Adsorption describes solute binding to the membrane or circuit. These mechanisms can coexist, but they should not be treated as interchangeable explanations.',
    ],
    bullets: [
      'Follow the direction of blood, dialysate, replacement fluid, and effluent separately.',
      'Ask which mechanism is intended before predicting a response to a flow change.',
      'Displayed flows are inputs to a model, not proof that the intended clearance reached the patient.',
    ],
    sourceRecordIds: [
      'REVIEW-CRRT-PRINCIPLES-2021',
      'TEXT-RRT-HOSTE-2024',
      'REVIEW-CKRT-CORE-2025',
      'GUID-RRT-ICU-2026',
      'SYNTH-LAB-TRANSPORT-001',
    ],
  }),
  lesson({
    id: 'crrt-prescription-dosing',
    title: 'Prescription and delivered dose',
    summary:
      'Translate the clinical goal into explicit flows, then reconcile prescribed and delivered therapy.',
    paragraphs: [
      'A complete prescription makes each flow and its purpose explicit. Effluent-based dose is commonly normalized to weight for comparison, but the displayed or prescribed number is not the same as therapy actually delivered over time.',
      'Predilution can reduce the concentration presented to the filter and may change clearance and filter burden. Postdilution preserves concentration at the filter but may increase hemoconcentration. The balance is context dependent; this module does not prescribe a universal split.',
    ],
    bullets: [
      'Document the weight convention used for dose calculations.',
      'Track downtime and interruptions when comparing prescribed with delivered dose.',
      'Keep patient fluid removal separate from total effluent and from the whole-patient fluid balance.',
      'Verify solution identity, line destination, set compatibility, and local protocol before use.',
    ],
    embeddedLabId: 'LAB-PRESCRIPTION',
    sourceRecordIds: [
      'MATH-PM-001',
      'MATH-PM-003',
      'MATH-PM-005',
      'DOSE-PM-001',
      'FLUID-PM-002',
      'TEXT-CRRT-NEYRA-2026',
      'REVIEW-CRRT-PRINCIPLES-2021',
      'REVIEW-CKRT-CORE-2025',
      'SYNTH-LAB-PRESCRIPTION-001',
      'SYNTH-LAB-PREPOST-001',
    ],
  }),
  // C2 §4 — localization precedes citrate. A learner who cannot yet name a place on the circuit
  // has no way to read a citrate result as belonging to the circuit rather than to the patient.
  lesson({
    id: 'crrt-alarms-troubleshooting',
    title: 'Alarms and cause-first troubleshooting',
    summary:
      'Turn a changed pressure pattern into a place on the circuit, then verify the cause before anything resumes.',
    paragraphs: [
      'An alarm is a device response to a detected condition; acknowledgement is not proof that the condition has resolved. Start with the patient, then inspect the corresponding circuit, fluid, detector, scale, or power domain — the same circuit you traced earlier, with each pressure still sitting where it sat then.',
      'Power interruption and end-of-treatment decisions follow the same doctrine: assess the patient and circuit, verify device state and downtime, use current instructions and local policy, and never infer a universal blood-return or discard decision from the simulator.',
    ],
    bullets: [
      'Assess patient safety and call for appropriate help.',
      'Identify the device response and the interrupted therapy.',
      'Name the location the pattern points to before naming the fix.',
      'Inspect the corresponding physical domain.',
      'Verify correction before any continuation decision.',
      'Reassess delivery, downtime, recurrence, and the patient.',
    ],
    sourceRecordIds: [
      'DEV-PM-008',
      'DEV-PM-012',
      'DEV-PM-013',
      'DEV-PM-014',
      'TEXT-RRT-HOSTE-2024',
      'GUID-RRT-ICU-2026',
    ],
  }),
  lesson({
    id: 'crrt-anticoagulation',
    title: 'Anticoagulation and citrate safety',
    summary:
      'Follow citrate into the circuit and calcium back to the patient, and keep the two sampling domains answering different questions.',
    paragraphs: [
      'Anticoagulation strategy is shaped by bleeding risk, circuit behavior, treatment goals, monitoring capability, and the authorized local protocol. The circuit and the patient must be reassessed together.',
      'Citrate is the case where that pairing becomes concrete. It joins the blood path before the pump and therefore before the filter, so its intended effect is on blood that is outside the patient; the blood it acted on then returns through the return lumen, and calcium replacement supports the patient on its own separate line. A sample drawn from the circuit and a sample drawn from the patient describe two different compartments, and neither substitutes for the other.',
      'For citrate-based therapy, trend recognition matters: verify sampling and timing, review circuit delivery, compare linked calcium and acid-base information, and escalate discordant patterns. This module intentionally does not provide medication quantities or a dosing protocol.',
    ],
    bullets: [
      'Confirm the prescribed strategy and the monitoring plan before treatment.',
      'Say which compartment a result describes before saying what it means.',
      'Distinguish recurrent filter burden from an isolated pressure fluctuation.',
      'Treat verification, communication, and reassessment as safety actions.',
      'Follow the current local citrate/calcium protocol and responsible clinical team.',
    ],
    sourceRecordIds: [
      'TEXT-CRRT-NEYRA-2026',
      'REVIEW-CKRT-CORE-2025',
      'GUID-RRT-ICU-2026',
      'SYNTH-LAB-CITRATE-001',
    ],
  }),
  lesson({
    id: 'crrt-fluid-liberation',
    title: 'Fluid management and liberation',
    summary: 'Maintain two fluid ledgers and make liberation a reassessed clinical transition.',
    paragraphs: [
      'The machine fluid-removal value is only one part of the whole-patient balance. Reconcile all external inputs, non-machine outputs, device removal, interruptions, and unintended variance over the same interval.',
      'Liberation is not a console-only event. Reassess the original indication, native kidney function, hemodynamics, fluid trajectory, solute and acid-base control, medication and nutrition needs, and the plan if support is stopped.',
    ],
    bullets: [
      'Keep the device ledger distinct from the whole-patient ledger.',
      'Use a shared time window and document downtime or missing data.',
      'State the intended net goal and the safety conditions that would prompt reassessment.',
      'Plan the patient, circuit, communication, and documentation steps for any transition off therapy.',
    ],
    sourceRecordIds: [
      'FLUID-PM-001',
      'FLUID-PM-002',
      'TEXT-CRRT-NEYRA-2026',
      'WHITE-2024',
      'GONEUTRAL-2024',
      'SYNTH-LAB-FLUID-001',
      'GUID-RRT-ICU-2026',
    ],
  }),
  lesson({
    id: 'crrt-pressure-profile-integration',
    title: 'Read the pressure profile: where in the circuit is the problem?',
    summary:
      'Localize a deteriorating run from the whole pressure profile, then reconcile prescription, anticoagulation, and fluid before deciding what to change.',
    paragraphs: [
      'Every earlier section supplies one reading of the same run. Circuit anatomy says where each transducer sits. Transport and prescription say what the run was supposed to deliver. Anticoagulation says how the filter was being protected. The fluid ledger says what was being removed and at what rate. A single pressure value does not distinguish among those; the profile read together with its trend often does.',
      'Read the profile as a set of relationships rather than a list of numbers. Access pressure describes the inflow side, return pressure the outflow side, and transmembrane pressure with filter pressure drop describe the membrane and the filter itself. Ask which combination of those would have to be true for each competing explanation, then look for the one the whole profile supports. Name the location before naming the fix.',
      'The competing explanations usually available are a patient-side or access-side inflow limitation, a return-side obstruction, progressive filter clotting, and a delivery target that is simply too aggressive for the current hemodynamics. Each of these can present with a falling delivered dose and a rising alarm burden, so the discriminating information is which pressures moved, in which direction, and over what interval — together with what the patient was doing at the time.',
      'This section does not supply a threshold table or a universal corrective sequence. Exact alarm limits, restart behavior, and the actions permitted at each state come from current PrisMax instructions and local policy, and the anticoagulation response comes from the authorized local protocol and the responsible clinical team.',
    ],
    bullets: [
      'Start with the patient and a visible circuit inspection before interpreting any number.',
      'State the profile as a pattern: which pressures moved, in which direction, over what interval.',
      'List the competing locations explicitly, then say what each one predicts for the other pressures.',
      'Check the prescription and the fluid-removal rate as candidate causes, not only the circuit.',
      'Separate a recurring pattern from a single fluctuation before treating it as filter failure.',
      'Correct the cause, then verify the pressure profile, the delivered dose, the circuit, and the patient.',
    ],
    sourceRecordIds: [
      'DEV-PM-009',
      'DEV-PM-010',
      'MATH-PM-002',
      'FLUID-PM-002',
      'TEXT-RRT-HOSTE-2024',
      'REVIEW-CRRT-PRINCIPLES-2021',
      'REVIEW-CKRT-CORE-2025',
      'SYNTH-LAB-PRESSURE-001',
      'GUID-RRT-ICU-2026',
    ],
  }),
])

if (
  baxterCrrtLearnLessons.map(({ id }) => id).join('|') !== BAXTER_CRRT_LEARN_LESSON_IDS.join('|')
) {
  throw new Error('CRRT Learn lessons must match the stable lesson registry exactly.')
}

export const baxterCrrtLearnLessonById = new Map(
  baxterCrrtLearnLessons.map((item) => [item.id, item] as const),
)

export const baxterCrrtPriorPlatformAdvancedBlock: Readonly<LearnBlock> = Object.freeze({
  id: 'crrt-prior-prismaflex-transfer',
  title: 'If you previously trained on Prismaflex',
  level: 'advanced',
  paragraphs: [
    'Carry over the clinical verification domains—not memorized screen sequences. PrisMax uses its own procedure workflow, terminology, scale topology, calculation displays, alarm presentation, and stop/end controls. Confirm every workflow against the current PrisMax instructions and local configuration.',
  ],
})
