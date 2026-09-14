import type { CrrtFoundationChoice, CrrtFoundationTask } from './foundationLessons'
import type { BaxterCrrtLearnLessonId } from './learnerRegistry'
import type { PrismaxSimulatorHotspotId } from './prismaxSimulator'

export const CRRT_OPERATIONAL_VERSION = 'crrt-operations-2026-09-13-v1'
export const crrtHardwareFunctionTeaching: Record<PrismaxSimulatorHotspotId, string> = {
  'solution-pumps':
    'Fluid pumps move solutions along their assigned circuit paths. For the CVVHD reference, trace dialysate toward the fluid side of the filter and effluent toward collection. The illustration does not assign a local disposable or pump configuration.',
  'syringe-pump':
    'The syringe-pump position belongs to a separate added-solution pathway. Its connection site and solution must be verified; seeing this hardware does not establish an anticoagulant, dose or operating sequence. Syringe delivery is excluded from the three-control setup exercise.',
  'safety-monitoring':
    'Pressure connections provide information about their circuit segments; air monitoring and the return-line clamp are safety-related hardware. Their exact alarm responses require the manufacturer instructions. The following run shows only the responses encoded by this educational engine.',
  'fluid-management':
    'Bag scales support fluid accounting as fluid leaves supply bags and accumulates in collection. Trace each bag to its circuit path. Effluent collection includes spent dialysate and ultrafiltered water; it is not the same quantity as net fluid removed from the patient.',
}
const choice = (
  id: string,
  label: string,
  correct: boolean,
  feedback: string,
): CrrtFoundationChoice => ({ id, label, correct, feedback })

/** Two existing lesson IDs. Device functions and case actions retain their source/review gates. */
export const crrtOperationalTasks: Partial<
  Record<BaxterCrrtLearnLessonId, readonly CrrtFoundationTask[]>
> = {
  'crrt-alarms-troubleshooting': [
    {
      id: 'machine-orientation',
      title: 'From the circuit to the machine',
      exampleId: 'hardware-reference',
      kind: 'guided',
      operation: 'hardware',
      instruction:
        'Explore the four hardware regions, then trace the fluid destinations below. These selections explain functions; they do not operate a machine.',
      teaching: [
        'You have followed blood and fluid through the circuit and separated prescribed rates from projected delivery. Now connect those paths to the hardware before starting a reference run.',
        'By the end of this lesson, use the patient context, pressure pattern, pump state and recorded delivery to assess an interruption and verify the response to an action.',
        'The original educational interface below supports a CVVHD setup with three flow entries. The broader modality illustrations in earlier lessons do not expand this operational interface. Exact disposable loading, connection technique, alarm priorities, blood return and emergency procedures require the current manufacturer instructions and local protocol.',
      ],
    },
    {
      id: 'machine-setup',
      title: 'Prepare the reference CVVHD run',
      exampleId: 'cvvhd-workflow-04',
      run: 'workflow',
      kind: 'guided',
      operation: 'setup',
      instruction:
        'Use New patient and complete the displayed setup steps. Enter the illustrative values: blood flow 120 mL/min, dialysate 1,800 mL/h and patient fluid removal 100 mL/h. Review, prime and start the modeled treatment.',
      teaching: [
        'This normal reference uses the existing setup workflow and CRRT-04 initial state, with an 80 kg synthetic patient. The values are teaching inputs, not a prescription recommendation.',
        'An entered draft is not applied. Applying reviewed values configures the engine; priming alone delivers no treatment to the patient. Recorded delivery begins only after the modeled start and an observation interval.',
      ],
    },
    {
      id: 'normal-delivery',
      title: 'Read a normal operating reference',
      exampleId: 'cvvhd-workflow-04',
      run: 'workflow',
      kind: 'guided',
      operation: 'normal',
      instruction:
        'Record 15 minutes, then compare the applied flows, pump state, six pressure readouts and recorded delivery from this same run.',
      teaching: [
        'Blood flow and fluid-pump settings have different units. The effluent-based dose is an intensity proxy, not a direct clearance measurement. The displayed pressure values are synthetic operating points, not clinical normal ranges.',
        'Follow access → pump → filter → return in the canonical circuit. Select a pressure readout to locate its site or calculated relationship. Recorded totals cover only the interval that has actually elapsed.',
      ],
    },
    {
      id: 'delivery-interpretation',
      title: 'Apply: a setting is not a delivery record',
      exampleId: 'entered-versus-recorded-b',
      run: 'workflow',
      kind: 'question',
      instruction: 'Interpret a different operating history.',
      teaching: [],
      question:
        'Two runs have the same applied CVVHD flows now. One has a longer interruption during the charting interval. What establishes their delivered dose over that interval?',
      choices: [
        choice(
          'current',
          'The current effluent setting alone establishes equal delivered dose.',
          false,
          'Current rates omit the earlier interruption. Compare actual accumulated effluent, the same charting interval and patient weight.',
        ),
        choice(
          'recorded',
          'Compare actual accumulated effluent over the same interval and weight.',
          true,
          'The delivery record includes time when fluid did not move. Applying the same setting now does not rewrite that history.',
        ),
        choice(
          'pressure',
          'A reassuring pressure pattern proves the full prescribed dose was delivered.',
          false,
          'Pressures describe current circuit conditions and trends; they do not replace the accumulated delivery record.',
        ),
      ],
    },
    {
      id: 'alarm-arrival',
      title: 'New run: assess the patient and emerging alert',
      exampleId: 'access-run-13',
      run: 'access',
      kind: 'guided',
      operation: 'alarm-arrival',
      instruction:
        'Review the case assessment, then advance to the next event at 30 minutes. Compare the alert, access pressure, pump state and delivered volume.',
      teaching: [
        'This starts the existing CRRT-13 access case with different applied flows. The reference run has ended for this exercise; none of its volumes carry into this case.',
        'At the bedside, assess the patient and the connected circuit promptly and follow the displayed device instructions. An acknowledgement records that an alert was seen; it does not identify or correct its cause.',
        'This engine emits generic fault alerts. Manufacturer priority and automatic pump responses are not encoded. Read the actual modeled pump flags below: an alert itself does not automatically stop these pumps.',
      ],
    },
    {
      id: 'alarm-localize',
      title: 'Choose a discriminating inspection',
      exampleId: 'access-run-13',
      run: 'access',
      kind: 'question',
      instruction: 'Choose the next assessment after the more negative access-pressure pattern.',
      teaching: [],
      question:
        'The case has developed an access-side pressure change. Which action best distinguishes a correctable access-path problem?',
      choices: [
        choice(
          'inspect',
          'Assess the patient and inspect the access catheter and pre-pump tubing for a mechanical cause.',
          true,
          'The pressure pattern localizes a region. Patient position, catheter findings and the access line help distinguish causes before selecting a correction.',
        ),
        choice(
          'speed',
          'Increase blood flow immediately to overcome the resistance.',
          false,
          'Do not use a higher blood-flow setting as a substitute for assessing the patient and access path. It can worsen the pressure demand while leaving the cause unresolved.',
        ),
        choice(
          'ack-only',
          'Acknowledge the alert and assume the access path is restored.',
          false,
          'Acknowledgement changes an alert record. It does not remove resistance or establish restored delivery.',
        ),
      ],
    },
    {
      id: 'alarm-repair',
      title: 'Acknowledge, inspect and correct the modeled cause',
      exampleId: 'access-run-13',
      run: 'access',
      kind: 'guided',
      operation: 'alarm-repair',
      instruction:
        'Acknowledge the alert, inspect the access path, pause this case and record 10 minutes of interruption. Then apply the case’s access-position correction and inspect the resulting alert record.',
      teaching: [
        'This is one authored response path, not a universal alarm procedure. The deliberate pause stops both modeled pumps. External patient fluids continue during the interruption.',
        'A pressure can look less abnormal when the blood pump stops. That alone does not prove the cause is corrected. Compare the fault/alert state and then verify delivery after permitted continuation.',
      ],
    },
    {
      id: 'alarm-continuation',
      title: 'Decide whether continuation is supported',
      exampleId: 'access-run-13',
      run: 'access',
      kind: 'question',
      instruction: 'Use the completed inspection and correction in this authored case.',
      teaching: [],
      question:
        'The modeled access cause has been corrected while treatment is paused. Which continuation plan is supported?',
      choices: [
        choice(
          'resume-verify',
          'Use the permitted case resume action, then reassess the patient, pressures, pump state and new delivery.',
          true,
          'This case allows resumption after its pause and correction prerequisites. Verification still requires observation after resumption; the action alone is not proof of restored delivery.',
        ),
        choice(
          'universal',
          'Use the same resume sequence for every device alarm once it is acknowledged.',
          false,
          'Exact continuation, replacement or termination steps depend on the alarm, patient, disposable and manufacturer instructions. This case does not establish a universal restart sequence.',
        ),
        choice(
          'return',
          'Perform blood return automatically because the pressure improved during the pause.',
          false,
          'A stopped-pump pressure is not evidence that blood return is appropriate. Return or discard decisions require the specific clinical situation and manufacturer/local instructions.',
        ),
      ],
    },
    {
      id: 'alarm-verify',
      title: 'Verify the response after continuation',
      exampleId: 'access-run-13',
      run: 'access',
      kind: 'guided',
      operation: 'alarm-verify',
      instruction:
        'Resume this case, record 10 minutes, and confirm the recorded response. Compare the stopped interval with new delivery and the pressure profile at restored blood flow.',
      teaching: [
        'New volume accumulation and restored flow supply evidence of delivery after resumption. The interruption remains in the cumulative record; it is not erased when the alert resolves. The simulator does not substitute for bedside patient reassessment.',
      ],
    },
    {
      id: 'alarm-transfer',
      title: 'Apply again: normal pressure with no new delivery',
      exampleId: 'verification-transfer-b',
      kind: 'question',
      instruction:
        'Interpret a changed observation without assuming the earlier correction applies.',
      teaching: [],
      question:
        'In a different run, the alert is acknowledged and the pressure looks less abnormal, but the blood pump remains stopped and recorded effluent has not increased. What has been verified?',
      choices: [
        choice(
          'restored',
          'Successful treatment delivery has been verified by the pressure alone.',
          false,
          'Stopped-flow pressures can look reassuring without any treatment delivery. Check the patient, cause, device state and permitted next step.',
        ),
        choice(
          'not-restored',
          'Delivery has not been demonstrated; reassess the cause and device state before permitted continuation.',
          true,
          'Acknowledgement, pressure at stopped flow and actual delivery are separate observations. No new effluent and a stopped pump do not establish restored treatment.',
        ),
      ],
    },
  ],
  'crrt-fluid-liberation': [
    {
      id: 'delivery-reference',
      title: 'One charting interval for all fluid',
      exampleId: 'delivery-run-04',
      run: 'delivery',
      kind: 'read',
      instruction: 'Read the prepared reference before advancing its clock.',
      teaching: [
        'Use the prior circuit and dose concepts to calculate whole-patient balance from recorded delivery, distinguish a net-removal adjustment from solute-support flows, and plan clinical reassessment when considering liberation.',
        'This fresh CRRT-04 run is prepared through the same setup reducer: 80 kg, CVVHD, blood 120 mL/min, dialysate 1,800 mL/h and machine patient fluid removal 100 mL/h. No treatment time has elapsed. These are teaching inputs, not a recommended prescription.',
        'The case schedules a pause at 2 hours and resumption at 3 hours. These are authored scenario events, not instructions to resume a clinical treatment automatically. Record each event boundary and include external intake and output throughout the same interval.',
      ],
    },
    {
      id: 'delivery-timeline',
      title: 'Record delivery through an interruption',
      exampleId: 'delivery-run-04',
      run: 'delivery',
      kind: 'guided',
      operation: 'delivery-timeline',
      instruction:
        'Advance through the four hourly observations. Stop to read the 2-hour pause and the 3-hour resumption; compare recorded volume in each interval.',
      teaching: [
        'Each row is the difference between actual engine totals at its two endpoints. A rate shown now is not multiplied by all elapsed time. The timeline includes the stopped hour and any physical delivery limits enforced by the existing engine.',
      ],
    },
    {
      id: 'recorded-balance',
      title: 'Calculate whole-patient balance',
      exampleId: 'delivery-run-04',
      run: 'delivery',
      kind: 'numeric',
      operation: 'balance',
      instruction:
        'Use the recorded 0–4 hour chart below. Enter the signed whole-patient balance in mL: positive for gain, negative for loss.',
      teaching: [
        'Use external intake minus non-CRRT output minus net CRRT removal, accounting for any additional device net gain once. Dialysate and replacement must not be counted again outside the net-removal term.',
      ],
    },
    {
      id: 'missing-chart-data',
      title: 'Apply again: a missing output record',
      exampleId: 'incomplete-chart-b',
      run: 'delivery',
      kind: 'question',
      operation: 'missing-chart',
      instruction:
        'Review a deliberately incomplete chart copy for the same interval. The engine record is intact, but this chart withholds urine output.',
      teaching: [],
      question: 'What balance can you report from this incomplete chart?',
      choices: [
        choice(
          'zero-output',
          'Enter zero for unrecorded urine and report an exact whole-patient balance.',
          false,
          'An absent record does not establish zero output. Reconcile the urine record and any other missing terms before reporting an exact balance.',
        ),
        choice(
          'reconcile',
          'Report that exact balance is unavailable and reconcile the missing urine output.',
          true,
          'A missing chart term must remain unavailable. Neither the machine-removal total nor an assumption of zero fills that gap.',
        ),
      ],
    },
    {
      id: 'net-change',
      title: 'New run: change net removal separately',
      exampleId: 'fluid-run-10',
      run: 'fluid',
      kind: 'guided',
      operation: 'net-change',
      instruction:
        'Review patient tolerance and the external-fluid ledger, then apply the case’s net-removal adjustment. Compare the immediate settings before advancing time.',
      teaching: [
        'This starts the existing CRRT-10 fluid case with high external intake. The case action changes patient fluid removal from 250 to 350 mL/h while blood flow and dialysate stay fixed. This is a synthetic case choice, not a universal safe rate or target.',
        'The applied rate changes immediately. Prior accumulated volume and patient model state do not change until time advances. Net removal affects the patient’s fluid ledger; blood flow and dialysate have different transport and circuit roles.',
      ],
    },
    {
      id: 'net-observe',
      title: 'Observe the subsequent modeled interval',
      exampleId: 'fluid-run-10',
      run: 'fluid',
      kind: 'guided',
      operation: 'net-observe',
      instruction:
        'Record 30 minutes and compare accumulated fluid and the model’s limited tolerance indicators with the starting state.',
      teaching: [
        'The fluid ledger integrates recorded delivery and external flows. The engine’s reserve and stress indices are bounded teaching proxies, not blood-pressure measurements or evidence that a bedside patient tolerates this rate.',
        'Clinical reassessment includes perfusion, hemodynamics, fluid goals and the continuing need for solute and acid–base support. This lesson does not infer a potassium or pH trajectory from effluent alone.',
      ],
    },
    {
      id: 'flow-transfer',
      title: 'Apply: match the control to the problem',
      exampleId: 'flow-change-transfer-b',
      kind: 'question',
      instruction: 'Separate a patient fluid goal from transport and circuit settings.',
      teaching: [],
      question:
        'A different patient’s immediate concern is excessive fluid loss during CRRT, while the need for solute support persists. What distinction should guide reassessment?',
      choices: [
        choice(
          'dialysate',
          'Dialysate flow is the same quantity as net patient fluid removal.',
          false,
          'Dialysate is a fluid-side solute-support flow. Net removal requires its own review alongside all patient inputs and outputs.',
        ),
        choice(
          'separate',
          'Reassess net removal and all patient inputs/outputs while separately reviewing blood flow and solute-support requirements.',
          true,
          'These controls address different quantities. An appropriate clinical adjustment depends on patient response, the prescription and current instructions; this exercise supplies no universal rate.',
        ),
        choice(
          'pump',
          'Increasing blood flow alone establishes a safer net-removal rate.',
          false,
          'Blood flow changes circuit and transport conditions. It does not by itself establish the patient’s tolerance or the appropriate net fluid goal.',
        ),
      ],
    },
    {
      id: 'liberation-reassessment',
      title: 'Reassess the need for ongoing support',
      exampleId: 'clinical-reassessment-worked',
      kind: 'read',
      instruction:
        'Work through the clinical reassessment domains. This is a clinical reasoning example, not a simulated kidney-recovery result.',
      teaching: [
        'Start with the original indication for CRRT and whether it persists. Reassess evidence of native kidney recovery, including urine output and the course of kidney function in context; no single urine threshold in this lesson establishes readiness.',
        'Worked example: the initial fluid overload has improved and urine output has increased. That invites reassessment, but does not establish adequate native solute or acid–base control. Review current and anticipated fluid inputs, output, solute and acid–base needs, and hemodynamic stability before planning a trial off support.',
        'If a trial off is clinically appropriate, specify what to monitor, when to review fluid and laboratory trends, who reassesses, and the findings that prompt escalation or renewed support. Align the plan with goals of care and local practice. The engine here does not model recovery of native kidney function.',
        'The physical stop, return/discard, disconnection and restart sequences remain outside this exercise. Use the exact manufacturer instructions and local protocol for those decisions.',
      ],
    },
    {
      id: 'liberation-transfer',
      title: 'Apply again: urine improves but support needs persist',
      exampleId: 'clinical-reassessment-transfer-b',
      kind: 'question',
      instruction: 'Choose a reassessment plan for this different clinical example.',
      teaching: [],
      question:
        'Urine output is improving, but substantial ongoing intake and unresolved solute/acid–base concerns remain. Which plan is supported?',
      choices: [
        choice(
          'urine-only',
          'Stop CRRT solely because urine output increased; no specific follow-up plan is needed.',
          false,
          'Urine recovery alone does not establish that all fluid, solute and acid–base needs are met. Review the original indication, native function and hemodynamics, with an explicit monitoring and contingency plan.',
        ),
        choice(
          'reassess',
          'Reassess the original indication, native function, fluid and solute/acid–base needs and hemodynamics; define monitoring and contingencies before any trial off.',
          true,
          'The unresolved needs require clinical reassessment. A planned trial off, when appropriate, requires follow-up and criteria for escalation or renewed support rather than a universal stop threshold.',
        ),
      ],
    },
  ],
}
