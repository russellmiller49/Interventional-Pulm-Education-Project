import type { CrrtFoundationTask, CrrtFoundationChoice } from './foundationLessons'
import type { BaxterCrrtLearnLessonId } from './learnerRegistry'

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
      instruction: 'Use the stated sampling site to decide what this report can establish.',
      teaching: [],
      question:
        'Constructed handoff: post-filter ionized calcium is low, but no systemic sample is available. What does the report establish?',
      choices: [
        choice(
          'systemic-safe',
          'Patient calcium is adequate because circuit anticoagulation is effective.',
          false,
          'A circuit result cannot establish patient calcium safety. Obtain correctly identified systemic information before that conclusion.',
        ),
        choice(
          'circuit-only',
          'It informs circuit effect; patient calcium safety still needs systemic information.',
          true,
          'The sample describes extracorporeal blood. A separate systemic result and the actual replacement infusion address patient calcium support.',
        ),
        choice(
          'accumulation-proven',
          'Citrate accumulation is established because ionized calcium is low.',
          false,
          'Low post-filter calcium is part of the intended circuit effect. It does not diagnose systemic accumulation.',
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
      instruction:
        'Choose the interpretation supported by this different constructed clinical context.',
      teaching: [],
      question:
        'During RCA, worsening perfusion accompanies acidosis, rising systemic total/ionized calcium ratio and increasing calcium replacement requirements. What does this combination warrant?',
      choices: [
        choice(
          'alkali-overload',
          'Interpret the pattern as isolated excess alkali with preserved metabolism.',
          false,
          'Isolated alkali excess does not explain this linked pattern. Impaired citrate handling requires consideration with the clinical deterioration.',
        ),
        choice(
          'circuit-dose',
          'Conclude that circuit anticoagulation is insufficient and increase citrate.',
          false,
          'These are systemic warning trends. They do not establish insufficient circuit anticoagulation; an automatic citrate increase is unsupported and could add to the systemic load.',
        ),
        choice(
          'accumulation-concern',
          'Raise concern for accumulation and promptly verify the linked clinical and sampling data.',
          true,
          'The combination raises concern for impaired citrate metabolism. Check sample identity, trends, actual infusions and perfusion with the responsible team; no single result is definitive.',
        ),
      ],
    },
    {
      id: 'alkalosis-application',
      title: 'Apply: a different acid-base course',
      exampleId: 'citrate-alkalosis-trends',
      kind: 'question',
      instruction: 'Distinguish a net alkali problem from impaired citrate metabolism.',
      teaching: [],
      question:
        'Another constructed patient develops alkalosis while systemic calcium indices and replacement requirements remain stable. Which explanation belongs in the differential?',
      choices: [
        choice(
          'net-alkali',
          'Net alkali excess with preserved citrate metabolism, alongside other causes of alkalosis.',
          true,
          'Preserved calcium handling and alkalosis fit net alkali excess better than the preceding accumulation pattern. Review the whole prescription and other causes before attributing it to citrate.',
        ),
        choice(
          'accumulation-certain',
          'Citrate accumulation is established by the acid-base change alone.',
          false,
          'Alkalosis is not a synonym for accumulation. Linked calcium handling, metabolism and clinical context distinguish the questions.',
        ),
        choice(
          'circuit-failure',
          'Circuit anticoagulation has failed because the patient has alkalosis.',
          false,
          'A systemic acid-base result cannot establish circuit anticoagulant effect. Use circuit sampling and behavior for that question.',
        ),
      ],
    },
    {
      id: 'citrate-transfer',
      title: 'Transfer: a pressure change without laboratory data',
      exampleId: 'citrate-pressure-handoff',
      kind: 'question',
      instruction:
        'Decide what is justified when a later handoff lacks the information used in the worked examples.',
      teaching: [],
      question:
        'A handoff reports rising circuit pressures during RCA. Sampling sites and current calcium/acid-base trends are missing. Which next step is justified?',
      choices: [
        choice(
          'empiric-citrate',
          'Increase citrate to reverse the pressure change, then seek the missing samples.',
          false,
          'A pressure change does not diagnose inadequate citrate effect. Escalating medication before mechanical and patient assessment is unsupported.',
        ),
        choice(
          'parallel-assessment',
          'Assess patient and circuit, verify delivery, and obtain correctly identified systemic and circuit information.',
          true,
          'Mechanical localization and the anticoagulation review answer different questions. Neither pressure nor one unlabeled laboratory result can replace the other.',
        ),
        choice(
          'ignore-systemic',
          'Use the pressure trend as a substitute for systemic calcium and acid-base assessment.',
          false,
          'Circuit pressure cannot establish systemic metabolic safety. The missing clinical and sampling information remains necessary.',
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
        'Compare the profiles at the same applied blood flow. Choose a supported regional interpretation; more than one description of the uncertainty is acceptable.',
      teaching: [],
      question: 'Which interpretation can the first interval support?',
      choices: [
        choice(
          'filter-certain',
          'Filter clotting is established because filter pressure rose, regardless of return pressure.',
          false,
          'Filter pressure alone cannot establish clotting. The accompanying return-pressure change at unchanged flow supports an outflow-region assessment.',
        ),
        choice(
          'return-resistance',
          'Increased return-side resistance is plausible; pressure alone cannot identify its physical cause.',
          true,
          'The return and filter readings rise together at unchanged applied flow. Localize the return region, then inspect; line, catheter and patient outflow factors are not separated by these pressures alone.',
        ),
        choice(
          'access-only',
          'An isolated access-side limitation explains the profile, without checking the return segment.',
          false,
          'An isolated access limitation would be expected to affect the upstream profile. Read the return change rather than treating every pressure alert as an access problem.',
        ),
        choice(
          'outflow-uncertain',
          'The return region needs inspection; tubing, catheter and patient outflow remain to be distinguished.',
          true,
          'This appropriately limits the conclusion to a region. The available signals do not identify a unique physical cause.',
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
      instruction: 'Choose information that can distinguish causes within the suspected region.',
      teaching: [],
      question: 'Which inspection would most directly clarify this pressure change?',
      choices: [
        choice(
          'inspect-return',
          'Assess patient safety and inspect return tubing, catheter, connections and patient position.',
          true,
          'These observations can distinguish a mechanical restriction from other outflow problems. Pressure direction alone cannot do that.',
        ),
        choice(
          'inspect-dialysate',
          'Inspect the dialysate bag alone and use its appearance to identify the blood-path cause.',
          false,
          'The fluid-side bag does not distinguish the competing return-path causes. Review the blood return segment and patient.',
        ),
        choice(
          'calcium-only',
          'Request systemic calcium alone and use that result to identify the circuit location.',
          false,
          'Systemic calcium is not a mechanical localization test. The suspected return region requires a patient and circuit inspection.',
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
      instruction:
        'Read the anticoagulation method in this applied prescription before interpreting the circuit problem.',
      teaching: [],
      question: 'What does this record justify about anticoagulation?',
      choices: [
        choice(
          'start-citrate',
          'Start citrate from the pressure values because an obstruction establishes inadequate anticoagulation.',
          false,
          'A mechanical pressure pattern does not authorize a citrate regimen. This case has no applied citrate protocol, and the module cannot supply one.',
        ),
        choice(
          'calcium-diagnosis',
          'Diagnose citrate accumulation from the pressure pattern without verifying citrate exposure.',
          false,
          'Verify the actual therapy first. Citrate is not applied in this run, and pressure is not a diagnostic measure of citrate metabolism.',
        ),
        choice(
          'review-strategy',
          'Address the verified mechanical contributor and review the prescribed strategy with the responsible team.',
          true,
          'The applied method is none. Mechanical cause correction and a review of anticoagulation strategy are distinct; no drug response can be inferred from this pressure profile.',
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
      instruction:
        'Use the inspection and the paused state to choose a plan. More than one plan can be supported.',
      teaching: [],
      question:
        'The authored inspection confirms a return-region restriction but does not specify its physical cause. Which plan will you follow in this bounded simulation?',
      choices: [
        choice(
          'unsafe-flow',
          'Increase blood flow through the unresolved restriction and infer safety from delivery.',
          false,
          'Increasing flow does not correct the restriction, and this simulation does not apply it. The next task carries out a supported plan and verifies it.',
        ),
        choice(
          'defer',
          'Keep delivery paused and escalate because the physical correction cannot be verified.',
          true,
          'The simulation will remain paused while you record its consequences. Escalation alone will not improve the pressure model or restore delivery; this is not instruction to delay clinical care.',
        ),
        choice(
          'correct',
          'Apply the existing verified regional correction, then verify this case before resumption.',
          true,
          'The existing authored correction is permitted after inspection and pause. It supplies no physical maneuver, clamp sequence or universal restart rule.',
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
      instruction:
        'Review the actual final state and record reassessment when treatment resumed. Choose what belongs in the handoff.',
      teaching: [],
      question: 'Which handoff accounts for both this run and the limits of its observations?',
      choices: [
        choice(
          'complete-runtime',
          'Report the current hourly settings as delivered for the whole hour and omit the pause.',
          false,
          'Current settings do not reconstruct prior delivery. The recorded interruption must remain in the dose and fluid account.',
        ),
        choice(
          'reconcile',
          'Report regional findings, actions, current pump state, recorded delivery/downtime, both fluid ledgers and remaining patient/protocol checks.',
          true,
          'Reconcile actual delivery and patient balance over the common hour. A corrected pressure profile does not establish patient recovery; a paused escalation path remains unresolved and must be handed off as such.',
        ),
        choice(
          'patient-neutral',
          'Report patient fluid neutrality whenever the machine has removed some fluid.',
          false,
          'Machine removal is only one term. Compare it with external inputs and non-CRRT outputs; positive patient balance can coexist with CRRT removal.',
        ),
      ],
    },
    {
      id: 'integration-transfer',
      title: 'Transfer to an incomplete handoff',
      exampleId: 'integrated-missing-record-v1',
      kind: 'question',
      instruction:
        'Use the same reasoning with a different record. There is no simulated run on this screen.',
      teaching: [],
      question:
        'A separate handoff gives only the final pump settings and total effluent volume. It omits urine, external intake, interruption times and anticoagulation delivery. What can you conclude?',
      choices: [
        choice(
          'patient-equals-effluent',
          'Whole-patient fluid loss equals the effluent total, so the missing fields are unnecessary.',
          false,
          'Effluent includes fluid streams beyond net patient removal. External intake/output and delivery history are still needed.',
        ),
        choice(
          'dose-from-settings',
          'The final settings establish the delivered dose for the entire treatment interval.',
          false,
          'Final settings do not establish runtime or actual delivery. A common interval and recorded treatment history are necessary.',
        ),
        choice(
          'request-history',
          'Retain the reported effluent total and request the missing patient and delivery history before reconciling balance or adequacy.',
          true,
          'Preserve what is known while marking what is unavailable. Neither missing urine nor unrecorded downtime should be silently converted to zero.',
        ),
      ],
    },
  ],
}
