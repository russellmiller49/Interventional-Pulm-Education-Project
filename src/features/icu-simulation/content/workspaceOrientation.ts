/**
 * The ICU Simulator's missing foundation (WP10 §5.5): what the integrated workspace is, the loop
 * it asks you to run, and what reclassification means. Every scenario assumes this and none of it
 * was previously taught — the module opened directly into its longest multisystem case.
 *
 * Authoring only. No patient state, scoring rule, or answer key belongs here.
 */
export const ICU_WORKSPACE_ORIENTATION_ID = 'workspace-orientation'

export interface IcuOrientationLoopStep {
  readonly id: string
  readonly title: string
  readonly body: string
}

export interface IcuOrientationSection {
  readonly id: string
  readonly title: string
  readonly paragraphs: readonly string[]
  readonly bullets?: readonly string[]
}

export const icuWorkspaceOrientationTitle = 'The integrated workspace and the reassessment loop'

export const icuWorkspaceOrientationSummary =
  'One synthetic patient, one clock, and several supports that interact. Learn the loop before the first scenario.'

export const icuWorkspaceOrientationLoop: readonly IcuOrientationLoopStep[] = Object.freeze([
  {
    id: 'review',
    title: 'Review',
    body: 'Read the whole bedside before touching anything: monitor, ventilator, circulatory support, renal support, labs, and the trend behind each of them. The workspace deliberately shows several systems at once because the scenarios are built so that no single panel is sufficient.',
  },
  {
    id: 'classify',
    title: 'Classify',
    body: 'State which support is limiting right now, and say why. This is the module’s spine claim in the form of a question — not "what is wrong with the patient" but "which of the supports in front of me is currently the constraint on perfusion, gas exchange, or clearance".',
  },
  {
    id: 'intervene',
    title: 'Intervene',
    body: 'Act on the limiting support, and only on it. Changing several supports at once makes the response uninterpretable, which is the most common way a run stops teaching anything.',
  },
  {
    id: 'advance',
    title: 'Advance',
    body: 'Move the clock. Physiology and device responses in this model are time-dependent: some consequences appear within a minute of simulated time and some over hours, so an unchanged display immediately after an action is not evidence that nothing happened.',
  },
  {
    id: 'reassess',
    title: 'Reassess',
    body: 'Return to Review with the prediction you committed to. Compare what you expected against what the model produced, and let the difference — not the elapsed time — decide whether the classification still holds.',
  },
])

export const icuWorkspaceOrientationSections: readonly IcuOrientationSection[] = Object.freeze([
  {
    id: 'what-this-is',
    title: 'What the integrated workspace is',
    paragraphs: [
      'Every other module in this curriculum isolates one support so its behavior can be read cleanly. This module removes that isolation on purpose. One synthetic patient runs on one clock, with ventilation, circulatory support, renal support, and hemodynamics all modeled together, so a change in one shows up in the others.',
      'That is also the module’s limitation. The interactions are bounded educational approximations built to make a reasoning habit visible; they are not a patient-specific prediction and cannot be used to plan care.',
    ],
    bullets: [
      'The panels are one patient, not four devices that happen to share a screen.',
      'The clock is shared: advancing time advances every system at once.',
      'Displayed values follow the model’s assumptions, not a specific real device revision.',
    ],
  },
  {
    id: 'the-loop',
    title: 'The loop the scenarios ask you to run',
    paragraphs: [
      'Each scenario is worked as a repeating cycle rather than as a checklist. The value is in the cycle, not in the individual action: the loop forces a commitment before an intervention and a comparison after it.',
    ],
  },
  {
    id: 'reclassification',
    title: 'What reclassification means',
    paragraphs: [
      'Reclassification is the point of the loop. It means that the support you named as limiting is no longer the limiting one — either because your intervention relieved it, or because it was never the constraint and the real one has now become visible.',
      'It is not a correction of an error and it is not a penalty. In a multisystem patient the limiting support is expected to move: relieving a ventilation constraint can unmask a circulatory one, and supporting the circulation can unmask a renal or fluid constraint. A run in which the classification never changes is usually a run in which reassessment was skipped.',
      'What makes reclassification legible is having committed to the earlier classification explicitly. If the first classification was never stated, the second one cannot be recognized as a change.',
    ],
    bullets: [
      'Name the limiting support before intervening, every cycle.',
      'Change one support at a time so the response can be attributed.',
      'Treat a moving classification as expected information, not as a mistake.',
      'A display that has not moved yet is not the same as a support that is not responding.',
    ],
  },
  {
    id: 'scope',
    title: 'Scope and boundaries',
    paragraphs: [
      'Scenario content, device responses, laboratory trajectories, and timing are synthetic and bounded. Escalation decisions, device selection, and any therapy shown here remain the responsibility of the treating team under current manufacturer instructions and local policy.',
    ],
  },
])
