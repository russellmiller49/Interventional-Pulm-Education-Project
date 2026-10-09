import type { CrrtFoundationTask, CrrtFoundationChoice } from './foundationLessons'
import type { BaxterCrrtLearnLessonId } from './learnerRegistry'
import { CRRT_NUMBERS } from './teachingNumbers'

const N = CRRT_NUMBERS.value

export const CRRT_ADVANCED_VERSION = 'crrt-advanced-2026-09-13-v1'
const choice = (
  id: string,
  label: string,
  correct: boolean,
  feedback: string,
): CrrtFoundationChoice => ({ id, label, correct, feedback })

/** Clinical vignettes are authored teaching applications, not engine laboratory outputs. */
export const crrtAdvancedTasks: Partial<
  Record<BaxterCrrtLearnLessonId, readonly CrrtFoundationTask[]>
> = {
  'crrt-anticoagulation': [
    {
      id: 'citrate-orient',
      title: 'Circuit effect and patient safety',
      exampleId: 'citrate-concept-reference',
      kind: 'read',
      instruction:
        'Build on the blood and effluent paths from earlier lessons. The objective is to distinguish circuit anticoagulation from patient calcium and metabolic effects.',
      teaching: [
        'Regional citrate anticoagulation (RCA) acts in extracorporeal blood. Ionized calcium is the free calcium measured in blood; total calcium also includes bound calcium.',
        'First follow the normal path, then compare sampling domains and clinical patterns. This is conceptual teaching for an ICU clinician, not training to start or adjust an RCA protocol.',
      ],
    },
    {
      id: 'citrate-path',
      title: 'Follow citrate and select the sampling points',
      exampleId: 'citrate-concept-reference',
      kind: 'guided',
      advancedTool: 'citrate-path',
      instruction:
        'Select each location, including Circuit sample and Systemic sample. Compare the explanation with the highlighted location on the canonical circuit.',
      teaching: [],
    },
    {
      id: 'sample-application',
      title: 'Apply: interpret a sample report',
      exampleId: 'citrate-sample-handoff',
      kind: 'question',
      instruction: 'Say which compartment the result describes before saying what it means.',
      teaching: [],
      question: `On regional citrate, the post-filter ionized calcium comes back inside the ${N('postfilter-ica')} target. No systemic sample has been sent this shift. What does the result tell you?`,
      choices: [
        choice(
          'systemic-safe',
          'The circuit is anticoagulated, and the patient’s calcium is adequate.',
          false,
          'Post-filter blood has had citrate added and no calcium given back yet, so it is meant to be low. The patient’s level depends on the calcium infusion and on how well the citrate is metabolized. Only a systemic sample shows it.',
        ),
        choice(
          'circuit-only',
          'The circuit is anticoagulated; the patient’s calcium is unknown.',
          true,
          `A post-filter ionized calcium of ${N('postfilter-ica')} means the citrate dose is doing its job in the circuit; a second source accepts anything ${N('postfilter-ica-ceiling')}. It says nothing about the patient. Send a systemic ionized calcium now: the calcium infusion is titrated to keep it at ${N('systemic-ica')}.`,
        ),
        choice(
          'accumulation-proven',
          'The circuit is anticoagulated, and citrate is starting to accumulate.',
          false,
          `A low post-filter value is the target, not a warning. Accumulation shows on the patient’s side: a falling systemic ionized calcium, a rising calcium requirement, and a total-to-ionized calcium ratio ${N('calcium-ratio')}.`,
        ),
      ],
    },
    {
      id: 'calcium-worked',
      title: 'Worked example: follow an infusion',
      exampleId: 'citrate-calcium-delivery-reference',
      kind: 'read',
      instruction: 'Read how verified delivery changes the interpretation of a low patient result.',
      teaching: [
        'Constructed example: systemic ionized calcium has fallen, the post-filter result is unchanged, and inspection confirms that the separate calcium infusion was interrupted.',
        'The interruption provides patient-side delivery evidence. Review it with the systemic result and clinical condition; changing citrate solely because the patient calcium is low would confuse the two questions. The reviewed local protocol governs any treatment response.',
      ],
    },
    {
      id: 'citrate-patterns',
      title: 'Compare four physiological patterns',
      exampleId: 'citrate-pattern-reference',
      kind: 'guided',
      advancedTool: 'citrate-comparison',
      instruction:
        'Open each pattern and compare circuit information, patient calcium and acid-base context. These patterns support a differential, not a diagnosis from one value.',
      teaching: [],
    },
    {
      id: 'metabolic-application',
      title: 'Apply: interpret linked trends',
      exampleId: 'citrate-metabolic-trends',
      kind: 'question',
      instruction: 'Name what is happening, then choose your first move.',
      teaching: [],
      question: `A patient in worsening shock on regional citrate has a new metabolic acidosis. The calcium infusion has been turned up three times today to hold the systemic ionized calcium, and the total-to-ionized calcium ratio is now ${N('calcium-ratio')}. What is happening, and what do you do first?`,
      choices: [
        choice(
          'alkali-overload',
          'Lactic acidosis from shock; treat the shock and leave the citrate running.',
          false,
          'Shock is the reason this is happening, not an alternative explanation. A poorly perfused liver cannot metabolize citrate, so it builds up, binds calcium and stops yielding bicarbonate. Leaving the citrate running adds to the load.',
        ),
        choice(
          'circuit-dose',
          'Calcium lost in the effluent; raise the calcium infusion and continue the citrate.',
          false,
          `Calcium is lost in the effluent, and the infusion covers that at a steady rate. A requirement that keeps climbing with a ratio ${N('calcium-ratio')} means calcium is being bound by citrate that is still in the blood. Keep the ionized calcium safe, but more calcium alone leaves the cause in place.`,
        ),
        choice(
          'accumulation-concern',
          'Citrate accumulation; reduce or stop the citrate and keep replacing calcium.',
          true,
          `A rising calcium requirement, a ratio ${N('calcium-ratio')} and a new metabolic acidosis in a patient who cannot metabolize citrate is accumulation. Reduce or stop the citrate first. Keep replacing calcium against the systemic ionized calcium, and decide how the circuit will be anticoagulated without citrate. Check that the total and ionized calcium came from the same systemic sample, both in mmol/L.`,
        ),
      ],
    },
    {
      id: 'alkalosis-application',
      title: 'Apply: a different acid-base course',
      exampleId: 'citrate-alkalosis-trends',
      kind: 'question',
      instruction: 'Tell a net alkali problem apart from citrate that is not being metabolized.',
      teaching: [],
      question: `Three days into regional citrate, a patient has a steadily rising bicarbonate and a metabolic alkalosis. The systemic ionized calcium is steady on an unchanged calcium infusion, and the total-to-ionized calcium ratio is not ${N('calcium-ratio')}. Which explanation fits?`,
      choices: [
        choice(
          'net-alkali',
          'Citrate load exceeds effluent removal; metabolism is intact.',
          true,
          `Metabolized citrate becomes bicarbonate. A steady ionized calcium on an unchanged infusion and a ratio that is not ${N('calcium-ratio')} show the citrate is being metabolized, so the alkalosis means more citrate is reaching the patient than the effluent removes. The fix is on that balance: less citrate in or more removed in the effluent, by your unit’s citrate protocol. Look for other causes of alkalosis as well.`,
        ),
        choice(
          'accumulation-certain',
          'Citrate is accumulating; the liver is no longer metabolizing it.',
          false,
          `Accumulation is citrate that is not metabolized: ionized calcium falls, the calcium requirement climbs, the ratio goes ${N('calcium-ratio')} and the patient turns acidotic. Here the citrate is being turned into bicarbonate, which is the opposite problem.`,
        ),
        choice(
          'circuit-failure',
          'Citrate dose is too low; the circuit is under-anticoagulated.',
          false,
          `Whether the circuit is anticoagulated is read from the post-filter ionized calcium, target ${N('postfilter-ica')}. A systemic alkalosis says the opposite of too little: more citrate is reaching the patient than is being removed.`,
        ),
      ],
    },
    {
      id: 'citrate-transfer',
      title: 'Transfer: a pressure change without laboratory data',
      exampleId: 'citrate-pressure-handoff',
      kind: 'question',
      instruction: 'Decide what to do when the handover leaves out the calcium results.',
      teaching: [],
      question:
        'At handover you are told the filter pressure drop and TMP have been climbing for two hours on regional citrate. Nobody can say when the last post-filter or systemic calcium was sent. What do you do first?',
      choices: [
        choice(
          'empiric-citrate',
          'Increase citrate to reverse the pressure change, then seek the missing samples.',
          false,
          `A rising pressure drop and TMP say the filter is clotting. They do not say why. If the citrate line is clamped or the bag is empty, a higher rate fixes nothing; if the post-filter ionized calcium is already ${N('postfilter-ica')}, extra citrate only loads the patient. Measure before you change the dose.`,
        ),
        choice(
          'parallel-assessment',
          'Assess the patient and circuit, verify delivery, and get correctly labeled systemic and circuit samples.',
          true,
          `Two questions, worked at the same time. Mechanical: how far above its starting value is the pressure drop or TMP? PrisMax raises its filter clotting advisory at ${N('clotting-advisory')}. Anticoagulation: verify delivery, meaning the citrate and the calcium are actually running. Then, from labeled samples: is the post-filter ionized calcium ${N('postfilter-ica')}? The systemic sample is for the patient: it sets the calcium infusion and shows accumulation early.`,
        ),
        choice(
          'ignore-systemic',
          'Localize the pressure change first; the calcium and acid–base review can wait for the next routine samples.',
          false,
          'Localizing the pressure is half the job. With no recent systemic calcium you do not know whether the patient is safe on the citrate already running, and the next routine sample may be hours away. Send both samples now, while you examine the circuit.',
        ),
      ],
    },
  ],
  'crrt-pressure-profile-integration': [
    {
      id: 'case-entry',
      title: 'Review one new treatment run',
      exampleId: 'integrated-run-v1',
      kind: 'guided',
      run: 'integration',
      operation: 'integration-entry',
      instruction:
        'Review the patient, applied prescription and initial profile. Record the first interval, then connect the new findings to the earlier lessons.',
      teaching: [
        'This bounded case combines the circuit, flow and pressure relationships, interruptions, anticoagulation context and both fluid ledgers. It is a guided version of Practice case CRRT-14, which the earlier lessons did not use.',
        'Read the starting findings before advancing time. The cause is initially undisclosed. The model does not simulate bedside inspection, citrate metabolism or a complete clinical response.',
      ],
    },
    {
      id: 'case-localize',
      title: 'Localize the change and state the uncertainty',
      exampleId: 'integrated-run-v1',
      kind: 'question',
      run: 'integration',
      operation: 'integration-profile',
      instruction:
        'Compare the two profiles at the same blood flow. Two of these options describe the finding in different words, and both are accepted.',
      teaching: [],
      question:
        'Blood flow is unchanged. Compared with the starting profile, return pressure and filter pressure have both risen. Where is the problem?',
      choices: [
        choice(
          'filter-certain',
          'In the filter; filter pressure has risen, so the filter is clotting.',
          false,
          'Filter pressure is measured upstream of the filter, so it rises with any resistance downstream of that site. A clotting filter raises it more than the return pressure. Here the two rose together, which puts the resistance after the filter.',
        ),
        choice(
          'return-resistance',
          'After the filter; something on the return side is resisting flow.',
          true,
          'Return and filter pressures rising together at the same blood flow is a return-side resistance. The readings give you the region. They cannot tell a kinked line from a malpositioned catheter or a patient lying on the tubing, so the next step is to look.',
        ),
        choice(
          'access-only',
          'Before the pump; the access lumen is limiting inflow.',
          false,
          'An inflow problem makes the access pressure more negative and leaves the readings after the pump alone. Here the readings after the pump are the ones that moved.',
        ),
        choice(
          'outflow-uncertain',
          'On the return side; line, catheter or position, cause not yet known.',
          true,
          'That is as far as the readings go: the return region, with the physical cause still to be found by looking at the line, the catheter and the patient.',
        ),
      ],
    },
    {
      id: 'case-inspection-choice',
      title: 'Choose the discriminating inspection',
      exampleId: 'integrated-run-v1',
      kind: 'question',
      run: 'integration',
      operation: 'integration-profile',
      instruction: 'Choose where you look first.',
      teaching: [],
      question:
        'Return and filter pressures are both up at the same blood flow. What do you check first?',
      choices: [
        choice(
          'inspect-return',
          'The patient, then the return line, clamp and catheter.',
          true,
          `Return pressure is what it takes to push blood back into the patient, so look along that route. Is the patient lying on the line? Is there a kink or a partly closed clamp? Has the catheter moved? Is there clot in the return chamber? PrisMax alarms “Return Extremely Positive” ${N('return-high-limit')}; act on the trend before it gets there.`,
        ),
        choice(
          'inspect-dialysate',
          'The dialysate and effluent bags, then their scales and fluid lines.',
          false,
          'Bags, scales and fluid lines are on the other side of the membrane. A problem there shows in the effluent pressure or as a scale alarm. It does not raise the return pressure.',
        ),
        choice(
          'calcium-only',
          'The anticoagulation order, then the most recent laboratory results.',
          false,
          'Anticoagulation is the question to ask when the filter is clotting, and that shows as a widening pressure drop across the filter. Here filter and return pressures rose together, which puts the resistance after the filter. Look at the return limb first and review anticoagulation afterwards.',
        ),
      ],
    },
    {
      id: 'case-inspect',
      title: 'Inspect and record the interruption',
      exampleId: 'integrated-run-v1',
      kind: 'guided',
      run: 'integration',
      operation: 'integration-inspect',
      instruction:
        'Perform the selected inspection, explicitly pause modeled delivery and record the interruption. Compare what stops with what continues.',
      teaching: [],
    },
    {
      id: 'case-anticoagulation',
      title: 'Reconcile the anticoagulation context',
      exampleId: 'integrated-run-v1',
      kind: 'question',
      run: 'integration',
      operation: 'integration-inspect',
      instruction: 'Read the anticoagulation line in this prescription before you answer.',
      teaching: [],
      question:
        'This circuit is running with no anticoagulation. Inspection found a restriction on the return side, and treatment is paused. What does that mean for anticoagulation?',
      choices: [
        choice(
          'start-citrate',
          'Start an anticoagulant now; the rising pressures show the circuit is clotting.',
          false,
          'Return and filter pressures rising together put the resistance after the filter, and inspection found it there. An anticoagulant does nothing for a kinked line or a malpositioned catheter. Whether this circuit should have anticoagulation is a real question, but the pressure pattern is not what answers it.',
        ),
        choice(
          'calcium-diagnosis',
          'Leave anticoagulation out of it; the restriction was mechanical, not clot.',
          false,
          'The cause was mechanical, but the consequences are not. For every minute paused, blood stands still in a filter with no anticoagulation, and each stop shortens the filter’s life. Clear the restriction, restart, then review whether this circuit should be running unprotected.',
        ),
        choice(
          'review-strategy',
          'Clear the restriction first, then revisit anticoagulation once it is running.',
          true,
          'The pressure rise has a mechanical cause, and you fix that with your hands. Separately, this circuit has no anticoagulation, and blood standing in a paused filter clots. Once it is running again, ask why it has none: regional citrate is first choice where it is available and not contraindicated, because it does not raise the patient’s bleeding risk.',
        ),
      ],
    },
    {
      id: 'case-plan',
      title: 'Choose a permitted plan',
      exampleId: 'integrated-run-v1',
      kind: 'question',
      run: 'integration',
      operation: 'integration-decision',
      instruction: 'Use the inspection finding and the paused state to choose your plan.',
      teaching: [],
      question:
        'Inspection has confirmed a restriction on the return side. Treatment is paused. What is your plan?',
      choices: [
        choice(
          'unsafe-flow',
          'Restart at a lower blood flow and keep watching the return pressure.',
          false,
          'A lower flow brings the return pressure down without removing the restriction. You are left with a slow circuit that clots sooner and a return limb that can still obstruct completely. Clear it, then restart at the prescribed flow.',
        ),
        choice(
          'defer',
          'Stay paused and call the nephrology team to assess the circuit.',
          false,
          'Calling is reasonable; waiting is the problem. While you wait no dose is delivered and the blood in a paused filter is clotting. A kink, a clamp or the patient’s position is yours to fix now, and you can call while you do it. If you cannot clear it, plan the blood return before the filter is lost.',
        ),
        choice(
          'correct',
          'Clear the restriction, restart, then confirm delivery.',
          true,
          'Free the line or reposition, restart at the prescribed blood flow, and then check that it worked: return and filter pressures back toward their starting values, both pumps running, and the effluent total climbing. The time paused stays in the delivery record.',
        ),
      ],
    },
    {
      id: 'case-action',
      title: 'Carry out the plan and observe',
      exampleId: 'integrated-run-v1',
      kind: 'guided',
      run: 'integration',
      operation: 'integration-action',
      instruction:
        'Carry out the chosen supported plan and record to the one-hour boundary. Compare the subsequent profile, pump state and delivery with the earlier record.',
      teaching: [],
    },
    {
      id: 'case-balance',
      title: 'Reconcile the one-hour fluid record',
      exampleId: 'integrated-run-v1',
      kind: 'numeric',
      run: 'integration',
      operation: 'integration-balance',
      instruction:
        'Calculate signed whole-patient balance from the recorded volumes over this same hour. Positive means net gain; negative means net loss. Enter mL, rounded to one decimal place if needed.',
      teaching: [],
    },
    {
      id: 'case-reassess',
      title: 'Reassess the run and its remaining limits',
      exampleId: 'integrated-run-v1',
      kind: 'question',
      run: 'integration',
      operation: 'integration-reassess',
      instruction: 'The hour is over. Choose the handoff you give.',
      teaching: [],
      question: 'Which handoff covers both what happened in this hour and what is still open?',
      choices: [
        choice(
          'complete-runtime',
          'Report the corrected pressure profile and the actions taken; the pause fixed the problem, so no checks remain open.',
          false,
          'A normal profile after the fix tells the next person the circuit is running. It leaves out the minutes of downtime, which lowered the delivered dose, and the things nobody has confirmed yet: why the return side obstructed and whether it will happen again.',
        ),
        choice(
          'reconcile',
          'Report findings, actions, pump state, recorded delivery and downtime, both fluid ledgers, and the checks still open.',
          true,
          `The next person needs what happened, what the circuit is doing now, what was delivered and what is still unknown. Delivered dose comes from the recorded effluent, pause included, against a target of ${N('dose-delivered')}. Fluid is two ledgers: what the machine removed, and where the patient ended up.`,
        ),
        choice(
          'patient-neutral',
          'Report this hour’s machine removal as the patient’s fluid balance, alongside the settings and pressures.',
          false,
          'Machine removal is one term. The patient’s balance is intake minus non-CRRT output minus net CRRT removal, and the intake and urine carried on through the pause.',
        ),
      ],
    },
    {
      id: 'integration-transfer',
      title: 'Transfer to an incomplete handoff',
      exampleId: 'integrated-missing-record-v1',
      kind: 'question',
      instruction: 'Use the same reasoning on a different record. There is no run on this screen.',
      teaching: [],
      question:
        'A handoff note gives the current pump settings and a total effluent volume, without saying what period the total covers. Urine, intake and interruption times are missing. What do you do with it?',
      choices: [
        choice(
          'patient-equals-effluent',
          'Use the effluent total as the patient’s fluid loss for now, and ask for the other fields later.',
          false,
          'Effluent is spent dialysate and replacement fluid plus the net removal. Most of it never came from the patient, so it overstates the fluid loss many times over.',
        ),
        choice(
          'dose-from-settings',
          'Calculate the delivered dose from the current settings over the whole interval, then ask for the history.',
          false,
          `Settings give the dose while running. Any downtime lowers what was delivered, and the note does not say how much there was. A calculation from settings can read ${N('dose-delivered')} when the patient received far less.`,
        ),
        choice(
          'request-history',
          'Keep the effluent total and request the missing patient and delivery history before reconciling balance or dose.',
          true,
          'The effluent total is real data. Divide it by the weight and by the hours it covers and you have the delivered dose, so the first thing to get is the period. Balance needs the intake and the urine as well. Until you have them, report the total as it stands and leave the blanks as blanks.',
        ),
      ],
    },
  ],
}
