import type { CrrtFoundationChoice, CrrtFoundationTask } from './foundationLessons'
import type { BaxterCrrtLearnLessonId } from './learnerRegistry'
import type { PrismaxSimulatorHotspotId } from './prismaxSimulator'
import { CRRT_NUMBERS } from './teachingNumbers'

const N = CRRT_NUMBERS.value

export const CRRT_OPERATIONAL_VERSION = 'crrt-operations-2026-09-13-v1'
export const crrtHardwareFunctionTeaching: Record<PrismaxSimulatorHotspotId, string> = {
  'solution-pumps':
    'Fluid pumps move solutions along their assigned circuit paths. For the CVVHD reference, trace dialysate toward the fluid side of the filter and effluent toward collection. The illustration does not assign a local disposable or pump configuration.',
  'syringe-pump':
    'The syringe-pump position belongs to a separate added-solution pathway. Its connection site and solution must be verified; seeing this hardware does not establish an anticoagulant, dose or operating sequence. Syringe delivery is excluded from the three-control setup exercise.',
  'safety-monitoring':
    'Pressure connections provide information about their circuit segments; air monitoring and the return-line clamp are safety-related hardware. Their exact alarm responses require the manufacturer instructions. The following run shows only the responses this educational simulation models.',
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
        'This normal reference is a guided version of the setup in Practice case CRRT-04, with an 80 kg simulated patient. The values are teaching inputs, not a prescription recommendation.',
        'An entered draft is not applied. Applying reviewed values configures the simulation; priming alone delivers no treatment to the patient. Recorded delivery begins only after the modeled start and an observation interval.',
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
      instruction: 'Decide which record tells you what a run delivered.',
      teaching: [],
      question:
        'Two 80 kg patients are on CVVHD with effluent running at 1,900 mL/h, which is 23.75 mL/kg/h. Run A has not stopped. Run B was down for 6 of the last 24 hours. Which record tells you what run B delivered?',
      choices: [
        choice(
          'current',
          'The effluent rate on the screen now, multiplied by 24 hours.',
          false,
          'The rate on the screen is what the machine is doing now. It assumes all 24 hours ran, and 6 of them did not.',
        ),
        choice(
          'recorded',
          'The effluent volume collected over the same 24 hours.',
          true,
          `Delivered dose is the effluent actually collected, divided by weight and by the hours in the interval. For run B that is 1,900 × 18 ÷ 24 ÷ 80, about 17.8 mL/kg/h, which is under the delivered target of ${N('dose-delivered')}. Run A delivered its full 23.75. Losses like this are why you prescribe ${N('dose-prescribed')}.`,
        ),
        choice(
          'pressure',
          'The pressure history, which shows when the filter was working.',
          false,
          'Pressures tell you what the circuit is doing at each moment and where a resistance is. They do not measure volume. Only the collected effluent tells you how much treatment was delivered.',
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
        'This starts a guided version of Practice case CRRT-13; its applied flows differ from the reference run. The reference run has ended for this exercise; none of its volumes carry into this case.',
        'At the bedside, assess the patient and the connected circuit promptly and follow the displayed device instructions. An acknowledgement records that an alert was seen; it does not identify or correct its cause.',
        'This simulation raises generic, simulated alerts, not PrisMax alarms. Manufacturer priority and automatic pump responses are not modeled. Read the actual modeled pump flags below: an alert itself does not automatically stop these pumps.',
      ],
    },
    {
      id: 'alarm-localize',
      title: 'Choose a discriminating inspection',
      exampleId: 'access-run-13',
      run: 'access',
      kind: 'question',
      instruction: 'Choose your first move at the bedside.',
      teaching: [],
      question:
        'At 30 minutes the access pressure has become steadily more negative with blood flow unchanged at 120 mL/min, and the alert is showing. What do you do first?',
      choices: [
        choice(
          'inspect',
          'Look at the patient, then the access line and catheter.',
          true,
          `Access pressure is the pump pulling against whatever lies between the patient and the pump. In order: the patient, then the access line for a kink or a clamp, then the patient’s position and whether the catheter has moved. PrisMax alarms “Access Extremely Negative” ${N('access-low-limit')}.`,
        ),
        choice(
          'speed',
          'Turn the blood flow down until the alert clears, then carry on.',
          false,
          'A lower flow makes the pressure less negative, and it can buy time while you reposition a catheter that is sucking against the vessel wall. It is not the fix. The resistance is still there, and a slow circuit clots sooner. Find the cause first.',
        ),
        choice(
          'ack-only',
          'Acknowledge the alert and watch whether the pressure recovers.',
          false,
          'Acknowledging records that you saw the alert. The resistance is still there, and if it gets worse the pump cannot draw its set flow. Look at the line and the patient now.',
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
      instruction: 'The cause has been found and corrected. Decide what happens next.',
      teaching: [],
      question:
        'The access-position problem has been corrected, and treatment has been paused for 10 minutes. What do you do next?',
      choices: [
        choice(
          'resume-verify',
          'Resume, then recheck the patient, pressures, pump state and new delivery.',
          true,
          'The cause is fixed, so restart. Then prove it worked: access pressure back near its earlier value at the full 120 mL/min, both pumps running, and the effluent volume climbing again. The 10 minutes stopped stays in the delivery record.',
        ),
        choice(
          'universal',
          'Resume with the steps that cleared the last alert; this one has been acknowledged.',
          false,
          'Each alarm has its own cause and its own way back. Resuming is reasonable here because the access-position problem was fixed, not because the alert was acknowledged. An air or blood-leak alarm needs a different sequence, which the PrisMax screen gives for each alarm.',
        ),
        choice(
          'return',
          'Return the blood and end the run; the pressure improved during the pause.',
          false,
          'With the pump stopped, nothing is pulling on the access line, so the pressure drifts toward zero whatever the cause. That improvement tells you nothing. Returning the blood and ending the run is for a circuit you cannot keep, such as a clotting filter or failed access. Here the cause is fixed and the circuit is usable.',
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
      instruction: 'Read what has and has not happened in this different run.',
      teaching: [],
      question:
        'In another run an access pressure alert was acknowledged and the pressure now reads closer to normal. The blood pump is still stopped and the effluent total has not moved. Where does this run stand?',
      choices: [
        choice(
          'restored',
          'Treatment delivery has resumed; the pressure is closer to its starting value.',
          false,
          'A stopped pump pulls on nothing, so the access pressure drifts back toward zero by itself. Delivery means the blood pump running and the effluent total rising, and neither is true here.',
        ),
        choice(
          'not-restored',
          'Delivery has not resumed; recheck the cause and the pump before restarting.',
          true,
          'Three separate facts: the alert was acknowledged, the pressure reads better because the pump is stopped, and no effluent has been produced. Blood standing in the filter clots, so go back to the cause now: line, position, catheter. Then restart and watch the effluent total climb.',
        ),
        choice(
          'cause-corrected',
          'The cause has been corrected; the alert was acknowledged and the pressure improved.',
          false,
          'Acknowledging silences the alert and changes nothing in the line. The pressure improved because the pump stopped pulling. You know the cause is fixed only when the pump runs at its set flow and the pressure holds.',
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
        'This fresh run is a guided version of Practice case CRRT-04, prepared with the same setup steps: 80 kg, CVVHD, blood 120 mL/min, dialysate 1,800 mL/h and machine patient fluid removal (PFR) 100 mL/h. No treatment time has elapsed. These are teaching inputs, not a recommended prescription.',
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
        'Each row is the difference between the simulation’s recorded totals at its two endpoints. A rate shown now is not multiplied by all elapsed time. The timeline includes the stopped hour and any physical delivery limits the simulation enforces.',
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
        'This copy of the chart covers the same interval, but the urine output was never written down.',
      teaching: [],
      question: 'The urine output box is blank. What balance do you report?',
      choices: [
        choice(
          'zero-output',
          'Chart the urine as 0 mL and report the balance to the mL.',
          false,
          'A blank is not a zero. Charting zero overstates the patient’s gain by whatever the urine really was, and the next person sets net removal from your number.',
        ),
        choice(
          'reconcile',
          'Report the balance as incomplete, then find the urine output.',
          true,
          'Balance is intake minus non-CRRT output minus net CRRT removal, and one term is missing. Say so and give the terms you have. Then get the urine volume from the bedside chart or the collection bag and finish the sum.',
        ),
        choice(
          'machine-only',
          'Report the machine’s net removal as the balance for the interval.',
          false,
          'Net CRRT removal is one of three terms. Without intake and urine it tells you what the machine took, not where the patient ended up.',
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
        'This starts a guided version of Practice case CRRT-10, which has high external intake. The case action changes patient fluid removal (PFR) from 250 to 350 mL/h while blood flow and dialysate stay fixed. This is a simulated case choice, not a universal safe rate or target.',
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
        'The fluid ledger integrates recorded delivery and external flows. The simulation’s reserve and stress indices are bounded teaching proxies, not blood-pressure measurements or evidence that a bedside patient tolerates this rate.',
        'Clinical reassessment includes perfusion, hemodynamics, fluid goals and the continuing need for solute and acid–base support. This lesson does not infer a potassium or pH trajectory from effluent alone.',
      ],
    },
    {
      id: 'flow-transfer',
      title: 'Apply: match the control to the problem',
      exampleId: 'flow-change-transfer-b',
      kind: 'question',
      instruction: 'Match the control to the problem.',
      teaching: [],
      question:
        'A patient on CVVHD has had net removal running at 350 mL/h. Blood pressure is falling, the vasopressor dose is climbing, and the day’s fluid goal has already been exceeded. The potassium still needs the circuit. What do you change first?',
      choices: [
        choice(
          'dialysate',
          'Turn dialysate down; it is the flow that sets how much fluid the patient loses.',
          false,
          'Dialysate stays on the fluid side of the membrane and leaves as effluent. None of it comes from the patient. Turning it down costs potassium clearance and the machine still takes the same 350 mL/h.',
        ),
        choice(
          'separate',
          'Turn net removal down; leave the dialysate and blood flow where they are.',
          true,
          'Net removal is the one control that sets how much fluid the machine takes from the patient. Turn it down, to zero if the pressure is still falling, and keep dialysate running so clearance continues. Then recount every input and output and reset the fluid goal.',
        ),
        choice(
          'pump',
          'Turn blood flow down; a slower circuit takes less fluid from the patient.',
          false,
          'Blood flow sets how fast blood moves through the filter, not how much fluid comes off. Net removal is the same 350 mL/h at any blood flow. Slowing the pump does nothing for the blood pressure and makes the filter more likely to clot.',
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
      instruction: 'Decide what the rising urine output does and does not tell you.',
      teaching: [],
      question:
        'On day 6 of CRRT, urine output has picked up over the last 24 hours. The patient is still on several infusions and feeds, and the potassium and bicarbonate are only controlled with the circuit running. What is the plan?',
      choices: [
        choice(
          'urine-only',
          'Plan a trial off now; improving urine output shows the fluid and solute/acid–base needs are being met.',
          false,
          'Urine volume shows the kidneys are making water. It does not show they are clearing potassium and acid, and here those are only controlled with the circuit running. A trial off now would be decided on fluid alone.',
        ),
        choice(
          'reassess',
          'Before any trial off, reassess the indication, fluid and solute/acid–base needs, native function and hemodynamics, and plan monitoring.',
          true,
          `Go back to why CRRT was started and ask whether each reason has resolved: the fluid, the potassium and acid-base, and whether the kidneys can keep up with the ongoing intake. Urine output is the most useful single sign: ${N('liberation-urine-output')}, predicts coming off. If you then try time off, decide beforehand what you will measure, when, and what result puts the patient back on.`,
        ),
        choice(
          'fixed-threshold',
          'Continue unchanged until urine output reaches a fixed threshold, then stop.',
          false,
          `A urine volume helps you choose when to try: ${N('liberation-urine-output')}, predicts coming off. It does not decide the question alone. Stopping at a number ignores the potassium and acid-base, and waiting for one can keep a recovering patient on the circuit longer than needed.`,
        ),
      ],
    },
  ],
}
