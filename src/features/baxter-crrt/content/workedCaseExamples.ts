import type { CrrtClaimTopic } from './learnerSourceMap'
import type { CrrtWorkedFilterTermId, CrrtWorkedSignalId } from '../workedCaseModel'

/**
 * CRRT-02 worked cases. Three cases — CRRT-05, CRRT-15 and the former capstone CRRT-16 — are
 * taught as worked examples rather than scored reasoning forms. Each states its learning point,
 * names the live values to read and the real controls to try, compares the simulator's own
 * response with the learner's run, and says plainly what the simulator does not show.
 *
 * Every numeric claim in `comparison.interpretation` is checked against the simulation in
 * `__tests__/workedCaseExamples.test.tsx`. Clinical statements remain pending attributable review;
 * `awaitingReview` lists the decisions this content does not make.
 */
export const CRRT_WORKED_CASE_EXAMPLE_VERSION = 'crrt-02-worked-examples-2026-09-14'

export const crrtWorkedCaseIds = ['CRRT-05', 'CRRT-15', 'CRRT-16'] as const
export type CrrtWorkedCaseId = (typeof crrtWorkedCaseIds)[number]

export interface CrrtWorkedComparisonArm {
  readonly label: string
  /** Case interventions performed in order through the learner reducer, by id suffix. */
  readonly interventionSuffixes: readonly string[]
  /** Simulated clock at which the arm is read. */
  readonly observeSeconds: number
}

export interface CrrtWorkedTryStep {
  readonly text: string
  /** Case actions named by this step, rendered with their live labels. */
  readonly actionSuffixes: readonly string[]
}

export interface CrrtWorkedTaughtNote {
  readonly text: string
  /** Empty means no registered source supports the statement yet; it is listed for review. */
  readonly sourceIds: readonly string[]
  /** Claim topics audited in `learnerSourceMap`; device-manual records are not audited there. */
  readonly claimTopics: readonly CrrtClaimTopic[]
}

export interface CrrtWorkedCheckOption {
  readonly id: string
  readonly label: string
  readonly feedback: string
  readonly matchesExample: boolean
}

export interface CrrtWorkedCheck {
  readonly id: string
  readonly teachingPurpose: string
  readonly prompt: string
  readonly hint: string
  readonly options: readonly CrrtWorkedCheckOption[]
  readonly explanation: string
}

export interface CrrtWorkedRunContext {
  readonly formatted: Readonly<Record<CrrtWorkedSignalId, string>>
  readonly modalityLabel: string
  readonly anticoagulationListed: boolean
}

export interface CrrtWorkedDomain {
  readonly id: 'access' | 'filtration' | 'interruptions' | 'pressure-pattern' | 'anticoagulation'
  readonly label: string
  readonly thisRun: (context: CrrtWorkedRunContext) => string
  readonly canVerify: string
  readonly decidedBy: string
}

export interface CrrtWorkedDomainDemonstration {
  readonly domains: readonly CrrtWorkedDomain[]
  readonly filterTermLabels: Readonly<Record<CrrtWorkedFilterTermId, string>>
  readonly teamSummary: (context: CrrtWorkedRunContext) => readonly string[]
}

export interface CrrtWorkedInterventionCopy {
  readonly label?: string
  readonly description?: string
  readonly response?: string
}

/** Case copy replaced in the runtime registry so the case, hints and debrief teach the same thing. */
export interface CrrtWorkedCaseRevision {
  readonly goal: string
  readonly patientDescription?: string
  readonly visibleFindings?: readonly string[]
  readonly hints: readonly [string, string, string]
  readonly interventions: Readonly<Record<string, CrrtWorkedInterventionCopy>>
  readonly reassessmentLabel: string
  readonly debrief: {
    readonly summary: string
    readonly trendReview: string
    readonly causalChain: readonly string[]
    readonly transferQuestion: string
  }
}

export interface CrrtWorkedCaseExample {
  readonly caseId: CrrtWorkedCaseId
  readonly learningPoint: string
  readonly readFirst: readonly CrrtWorkedSignalId[]
  readonly readFirstNote: string
  readonly tryIt: readonly CrrtWorkedTryStep[]
  readonly comparison: {
    readonly arms: readonly [CrrtWorkedComparisonArm, CrrtWorkedComparisonArm]
    readonly signalIds: readonly CrrtWorkedSignalId[]
    readonly interpretation: readonly string[]
    /** How to read the learner's own run against the modeled difference. */
    readonly runNote: string
  }
  readonly demonstration: 'pressure-locations' | 'filter-domains' | null
  readonly domainDemonstration: CrrtWorkedDomainDemonstration | null
  readonly taughtNotShown: readonly CrrtWorkedTaughtNote[]
  readonly reassess: readonly string[]
  readonly alternatives: readonly string[]
  readonly check: CrrtWorkedCheck | null
  /** Generic options removed from the learner surface; their records stay for compatibility. */
  readonly retired: {
    readonly interventionSuffixes: readonly string[]
    readonly reassessmentSuffixes: readonly string[]
    readonly reason: string
  }
  readonly awaitingReview: readonly string[]
  readonly revision: CrrtWorkedCaseRevision
}

const SIX_HOURS = 21_600

function deliveredDoseText(context: CrrtWorkedRunContext): string {
  const delivered = context.formatted['delivered-dose']
  return delivered === 'Unavailable' ? 'not yet charted' : delivered
}

const replacementSplitExample: CrrtWorkedCaseExample = {
  caseId: 'CRRT-05',
  learningPoint:
    'Moving replacement fluid from after the filter to before it changes where the blood is diluted, not how much fluid is exchanged. Total replacement, effluent volume and the effluent dose display stay the same. Fluid given before the filter lowers the solute concentration reaching the membrane, which can change the clearance obtained from each milliliter of effluent and the burden on the filter; fluid given after the filter keeps that concentration but can concentrate blood inside the filter.',
  readFirst: [
    'blood-flow',
    'pre-replacement-flow',
    'post-replacement-flow',
    'total-replacement-flow',
    'prescribed-dose',
    'filter-pressure',
    'tmp',
  ],
  readFirstNote:
    'Values update with this run. The effluent dose display is the effluent rate divided by body weight.',
  tryIt: [
    {
      text: 'Record the first clinical step, then change the split. The same change is offered under Active case controls on the machine.',
      actionSuffixes: ['action-assess', 'action-safe-candidate'],
    },
    {
      text: 'Advance +1 hr or +6 hr, then compare your run with the modeled comparison.',
      actionSuffixes: [],
    },
    {
      text: 'Reset case to run it again without the change and compare the two.',
      actionSuffixes: [],
    },
  ],
  comparison: {
    arms: [
      {
        label: 'Keep 1,200 mL/h after the filter',
        interventionSuffixes: [],
        observeSeconds: SIX_HOURS,
      },
      {
        label: 'Move 900 mL/h before the filter',
        interventionSuffixes: ['action-assess', 'action-safe-candidate'],
        observeSeconds: SIX_HOURS,
      },
    ],
    signalIds: [
      'pre-replacement-flow',
      'post-replacement-flow',
      'total-replacement-flow',
      'prescribed-dose',
      'delivered-dose',
      'downtime',
      'urea-marker',
      'filter-pressure',
      'tmp',
    ],
    interpretation: [
      'Only the pre- and post-filter flows differ. Total replacement, the effluent dose display, delivered dose, downtime, the small-solute marker, filter pressure and TMP are the same after six simulated hours.',
      'This simulator holds the solute concentration reaching the filter and the filtration fraction constant, so it cannot reproduce the dilution effect. Identical clearance here is a limit of the simulator, not evidence that the split makes no difference.',
    ],
    runNote:
      'Your change from the start includes time passing; the modeled difference isolates the split. The flows in your run should move by the modeled difference, and any other change comes from time, not from the split.',
  },
  demonstration: null,
  domainDemonstration: null,
  taughtNotShown: [
    {
      text: 'Pre-filter replacement can reduce the solute concentration presented to the filter and may change clearance and filter burden; post-filter replacement preserves that concentration but may increase hemoconcentration within the filter. Neither split is universally preferred.',
      sourceIds: ['REVIEW-CKRT-CORE-2025'],
      claimTopics: ['solute-transport-mechanisms'],
    },
    {
      text: 'PrisMax presents total predilution and filtration fraction as calculations from the circuit flows. This module calculates neither, because the device expression it would need is held for review.',
      sourceIds: ['MATH-PM-003'],
      claimTopics: [],
    },
    {
      text: "PrisMax's plasma-flow expression depends on blood flow and hematocrit; both belong in any discussion of how concentrated blood becomes inside the filter.",
      sourceIds: ['MATH-PM-005'],
      claimTopics: [],
    },
  ],
  reassess: [
    'The flow display: pre- and post-filter replacement changed, while total replacement and effluent did not.',
    'Treatment is still running: delivered dose matches the prescribed dose and no downtime has accrued.',
    'Filter pressure, TMP and the solute trend over hours rather than a single reading.',
    "The prescriber's reason for the split and the local protocol that governs it.",
  ],
  alternatives: [
    'Keeping all replacement after the filter, splitting it, or giving more before the filter can each be reasonable; the choice depends on filter life, blood flow, hematocrit and the clearance goal, and it belongs to the prescriber under local protocol.',
    'Whether and how to adjust the prescription for pre-filter dilution is a clinical decision this module does not calculate.',
    'Keeping the original split and deferring quantitative interpretation remains an acceptable path in this case.',
  ],
  check: {
    id: 'crrt05-dose-display-after-split',
    teachingPurpose:
      'Separates the effluent dose display, which counts volume, from the clearance that pre-filter dilution can change.',
    prompt:
      'You move 900 of the 1,200 mL/h replacement before the filter. What happens to the effluent dose display?',
    hint: 'The display is the effluent rate divided by body weight. Did either one change?',
    options: [
      {
        id: 'higher',
        label: 'It rises, because more fluid now travels through the filter',
        matchesExample: false,
        feedback:
          'More fluid does travel through the filter with the blood, but the effluent pump removes the same total volume each hour and body weight is unchanged, so the display does not move.',
      },
      {
        id: 'unchanged',
        label: 'It stays the same',
        matchesExample: true,
        feedback:
          'This matches the simulator and the arithmetic: the effluent rate and body weight are unchanged, so the display does not move. What the display cannot show is concentration. Pre-filter fluid dilutes the blood the effluent is drawn from, so clearance per milliliter of effluent can change while the number stays the same.',
      },
      {
        id: 'lower',
        label: 'It falls, because the blood is diluted',
        matchesExample: false,
        feedback:
          'The dilution is real, but the display is built from the effluent rate and body weight, and neither changed. Dilution can change clearance without moving the display, which is why the display alone cannot tell you what the split did.',
      },
    ],
    explanation:
      'The effluent dose display is the effluent rate divided by body weight. Moving replacement fluid before the filter changes neither, so the display is unchanged in this run. Pre-filter dilution can still change the clearance that the effluent represents, and the display does not capture that.',
  },
  retired: {
    interventionSuffixes: ['action-unsafe-candidate'],
    reassessmentSuffixes: ['reassess-none'],
    reason:
      'The former unsafe option asked learners to declare one split universally superior. It taught no distinction; the guidance that no split is universally preferred is now stated directly.',
  },
  awaitingReview: [
    'Whether the simulator should model how pre-filter dilution lowers the concentration reaching the filter, and from which source.',
    'Whether and how a prescribed dose should be adjusted for pre-filter replacement.',
    'Confirmation that the cited core-curriculum passage supports the predilution and hemoconcentration statements as worded.',
    'Device review of the PrisMax total-predilution and filtration-fraction expressions.',
  ],
  revision: {
    goal: 'Compare where replacement fluid enters the circuit without changing how much is given.',
    hints: [
      'Start with the flow display: which flows change, and do total replacement or effluent change?',
      'The effluent dose display is the effluent rate divided by body weight. Pre-filter fluid changes concentration, not volume.',
      'After the change, confirm treatment is still running and delivered dose matches the prescribed dose, then follow the filter and solute trend over hours.',
    ],
    interventions: {
      'action-safe-candidate': {
        response:
          'The split is now 900 mL/h before the filter and 300 mL/h after it; total replacement stays 1,200 mL/h. Confirm delivery, then follow filter pressure, TMP and the solute trend before drawing a clinical conclusion.',
      },
    },
    reassessmentLabel:
      'Reassessed the flow split, delivered dose, downtime, and the filter and solute trend',
    debrief: {
      summary:
        'Moving replacement fluid before the filter changed the flow split without changing total replacement, effluent volume, or the effluent dose display.',
      trendReview:
        'Compare your run with the modeled comparison: the flows differ while dose, delivery and pressures match. The simulator does not reproduce the effect of dilution on clearance or on concentration inside the filter.',
      causalChain: [
        'Pre-filter replacement dilutes blood before the membrane; post-filter replacement enters after it.',
        'The effluent rate and body weight set the effluent dose display, so the display does not move when only the split changes.',
        'Pre-filter dilution can lower the concentration reaching the filter and change clearance and filter burden; post-filter replacement can concentrate blood inside the filter.',
        'Reassess the flows, delivery, and the filter and solute trend over hours; the split itself is a prescriber and local-protocol decision.',
      ],
      transferQuestion:
        'If a colleague proposes moving some replacement fluid before the filter, what would you check on the flow display, the dose display, and the filter trend afterward?',
    },
  },
}

const filterTrendExample: CrrtWorkedCaseExample = {
  caseId: 'CRRT-15',
  learningPoint:
    'Localize a filter pressure trend by reading the signals together. The filter pressure drop is filter pressure minus return pressure, so added resistance inside the filter raises filter pressure and the drop while return pressure stays the same. Resistance further downstream on the return side raises filter and return pressure together and leaves the drop unchanged, and a change on the effluent side moves TMP without changing the drop. A pattern tells you where resistance changed, not why; a pressure trend alone does not establish that anticoagulation is inadequate.',
  readFirst: [
    'blood-flow',
    'access-pressure',
    'filter-pressure',
    'return-pressure',
    'effluent-pressure',
    'tmp',
    'filter-drop',
    'delivered-dose',
    'downtime',
  ],
  readFirstNote:
    'Values update with this run. Access resistance in this case is position dependent, which shows in access pressure.',
  tryIt: [
    {
      text: 'Advance +6 hr and watch filter pressure, return pressure, the drop and TMP.',
      actionSuffixes: [],
    },
    {
      text: 'Record the first clinical step, then review delivery and downtime while one hour of treatment runs.',
      actionSuffixes: ['action-assess', 'action-safe-candidate'],
    },
    {
      text: 'Use the pressure location comparison to see each pattern at a size you can read.',
      actionSuffixes: [],
    },
  ],
  comparison: {
    arms: [
      { label: 'Start of treatment', interventionSuffixes: [], observeSeconds: 0 },
      { label: 'After six hours', interventionSuffixes: [], observeSeconds: SIX_HOURS },
    ],
    signalIds: [
      'access-pressure',
      'filter-pressure',
      'return-pressure',
      'effluent-pressure',
      'tmp',
      'filter-drop',
      'delivered-dose',
      'downtime',
    ],
    interpretation: [
      'Over six simulated hours, filter pressure and the drop rise by well under 1 mmHg while access, return and effluent pressures do not change: a filter-side pattern.',
      'TMP rises by half as much as filter pressure, because TMP averages filter and return pressure and neither the return nor the effluent reading moved.',
      'The change is too small to read as a trend on the display. This simulator builds filter burden slowly and does not reproduce a visible clotting trend; the pressure location comparison shows each pattern at a readable size.',
      'Delivered dose matches the prescribed dose with no downtime, so interruptions are not contributing in this run.',
    ],
    runNote:
      'The modeled difference is six hours of treatment from the start. Your change covers your own run clock and any actions you took.',
  },
  demonstration: 'pressure-locations',
  domainDemonstration: null,
  taughtNotShown: [
    {
      text: 'PrisMax presents the filter pressure drop as filter minus return pressure. Where its sensor-height correction belongs in the displayed drop is held for device review.',
      sourceIds: ['DEV-PM-010'],
      claimTopics: [],
    },
    {
      text: "Circuit pressures depend on flow, resistance and the operating point rather than universal normal values, so compare a patient's own trend instead of a fixed number.",
      sourceIds: ['DEV-PM-009'],
      claimTopics: [],
    },
    {
      text: 'TMP is calculated from filter, return and effluent pressures, which is why an effluent-side change moves TMP without changing the drop.',
      sourceIds: ['MATH-PM-002'],
      claimTopics: [],
    },
    {
      text: 'Effluent pressure is held constant in this case, the prescription lists no anticoagulation method, and no anticoagulation control is available, so the simulator cannot examine those contributors. Alarm limits and PrisMax troubleshooting sequences are not modeled.',
      sourceIds: [],
      claimTopics: [],
    },
  ],
  reassess: [
    'Filter and return pressure together, and the drop between them.',
    'TMP and effluent pressure, for the membrane and effluent side.',
    'Access pressure and delivered blood flow, for contributors upstream of the filter.',
    'Delivered versus prescribed dose and downtime, to see whether interruptions are part of the picture.',
    'The trend over time rather than a single reading, with filter change and anticoagulation decisions made under the device instructions and local protocol.',
  ],
  alternatives: [
    'Holding the current state and requesting review of the whole trend is reasonable when inspection does not find a correctable cause.',
    'A filter-side pattern is compatible with more than one cause. Clotting is one possibility, and it does not by itself identify the anticoagulation plan as the problem.',
    'When to change the filter, and whether to change anticoagulation, follow the device instructions and local protocol.',
  ],
  check: {
    id: 'crrt15-where-resistance-increased',
    teachingPurpose:
      'Uses the filter pressure drop to separate resistance inside the filter from resistance upstream, downstream or on the effluent side.',
    prompt:
      'Filter pressure and the filter pressure drop are higher, and return pressure is unchanged. Where did resistance increase?',
    hint: 'The drop is filter pressure minus return pressure. Which location raises filter pressure without raising return pressure?',
    options: [
      {
        id: 'access-catheter',
        label: 'Access catheter',
        matchesExample: false,
        feedback:
          'Resistance before the blood pump makes access pressure more negative. In the location comparison it leaves filter pressure, return pressure and the drop unchanged, so it does not explain this pattern.',
      },
      {
        id: 'filter',
        label: 'Inside the filter',
        matchesExample: true,
        feedback:
          'This matches the location comparison: resistance inside the filter raises filter pressure while return pressure stays the same, so the drop rises. It locates the change but does not name the cause; check delivery, downtime and access before assigning one.',
      },
      {
        id: 'return-line',
        label: 'Return line',
        matchesExample: false,
        feedback:
          'Resistance on the return side raises return pressure and filter pressure together, so the drop stays the same. Here return pressure did not change.',
      },
      {
        id: 'effluent-line',
        label: 'Effluent line',
        matchesExample: false,
        feedback:
          'An effluent-side change moves TMP but leaves filter pressure, return pressure and the drop unchanged. Here filter pressure and the drop moved.',
      },
    ],
    explanation:
      'Read filter and return pressure as a pair. Filter pressure rising with return pressure unchanged places the added resistance between the two sensors, inside the filter. Both rising together suggests resistance downstream on the return side. Access pressure reflects resistance before the pump, and an effluent-side change shows up in TMP.',
  },
  retired: {
    interventionSuffixes: ['action-unsafe-candidate'],
    reassessmentSuffixes: ['reassess-none'],
    reason:
      'The former unsafe option asked learners to label the trend as anticoagulation failure and escalate blindly. The plausible contrast it contained, a mechanical or flow cause versus the anticoagulation plan, is now taught directly and in the location check.',
  },
  awaitingReview: [
    'Whether this case should schedule a pressure change so the run itself shows a readable filter-side trend, and at what size.',
    "Review of the simulator's filter-burden rates, which are too slow to produce a visible trend.",
    'Device review of where the PrisMax sensor-height correction belongs in the displayed pressure drop.',
    'Which PrisMax alarms and troubleshooting steps should accompany a filter-side pattern.',
  ],
  revision: {
    goal: 'Localize where a filter pressure trend comes from before assigning a cause.',
    patientDescription:
      'A patient is receiving CVVHDF. Read access, filter, return and effluent pressures, the filter pressure drop and TMP together to localize where a filter pressure trend comes from, change one factor at a time, and avoid labeling every trend as anticoagulation failure.',
    visibleFindings: [
      'Filter pressure, return pressure, the filter pressure drop and TMP are separate signals; read them together.',
      'Access resistance in this case is position dependent, which shows in access pressure; delivered dose and downtime remain available.',
      'The run starts from a stable circuit, and filter pressure changes slowly as treatment continues. Reassess the whole circuit before assigning anticoagulation failure or changing therapy.',
    ],
    hints: [
      'Read filter pressure and return pressure together: the filter pressure drop is filter minus return.',
      'If filter pressure and the drop rise while return pressure stays the same, the added resistance is inside the filter; if filter and return rise together, look downstream.',
      'Check delivered dose, downtime and access pressure before attributing a filter trend to anticoagulation.',
    ],
    interventions: {
      'action-safe-candidate': {
        label: 'Check blood-flow delivery and downtime, then observe one hour',
        description:
          'Compare delivered with prescribed dose, review downtime and access pressure, then observe one hour of treatment.',
        response:
          'After one hour of treatment, compare filter pressure, return pressure, the drop and TMP with their starting values before assigning a cause.',
      },
    },
    reassessmentLabel:
      'Reassessed filter, return and effluent pressures, the drop, TMP, delivered dose and downtime',
    debrief: {
      summary:
        'Filter pressure, return pressure, the filter pressure drop and TMP localize where resistance changed; the pattern locates the change but does not name its cause.',
      trendReview:
        'In the modeled six-hour comparison, filter pressure and the drop rose with return pressure unchanged, a filter-side pattern too small to read on the display. Compare your run with the pressure location comparison.',
      causalChain: [
        'The filter pressure drop is filter pressure minus return pressure.',
        'Resistance inside the filter raises filter pressure and the drop; return-side resistance raises filter and return pressure together; an effluent-side change moves TMP without changing the drop.',
        'The location narrows the inspection; delivered dose, downtime and access pressure are checked before a cause is assigned.',
        'A pressure trend alone does not establish anticoagulation status; filter change and anticoagulation decisions follow the device instructions and local protocol.',
      ],
      transferQuestion:
        'Another circuit shows return and filter pressures rising together with an unchanged drop. Where would you look first, and why?',
    },
  },
}

const recurrentFilterLossExample: CrrtWorkedCaseExample = {
  caseId: 'CRRT-16',
  learningPoint:
    'Recurrent early filter loss can have more than one contributor acting together. Work domain by domain: access and blood-flow delivery, filtration and concentration inside the filter, interruptions and downtime, the pressure pattern across the filter, and anticoagulation or protocol. Verify what the circuit data can show, fix what is mechanical and verified, and escalate what depends on medication choice or local policy with a concise summary.',
  readFirst: [
    'blood-flow',
    'access-pressure',
    'pre-replacement-flow',
    'post-replacement-flow',
    'hematocrit',
    'filter-pressure',
    'filter-drop',
    'tmp',
    'delivered-dose',
    'downtime',
  ],
  readFirstNote:
    'Values update with this run. Earlier circuits are described in the case history, not simulated.',
  tryIt: [
    {
      text: 'Advance +6 hr and watch access pressure, filter pressure, the drop, delivered dose and downtime.',
      actionSuffixes: [],
    },
    {
      text: 'Work through the domain table and decide which domains this run can verify.',
      actionSuffixes: [],
    },
    {
      text: 'Record your plan with the case actions. They document the plan and do not change the simulated circuit.',
      actionSuffixes: ['action-assess', 'action-safe-candidate', 'action-communicate'],
    },
  ],
  comparison: {
    arms: [
      { label: 'Wait six hours', interventionSuffixes: [], observeSeconds: SIX_HOURS },
      {
        label: 'Record the plan, then wait six hours',
        interventionSuffixes: ['action-assess', 'action-safe-candidate', 'action-communicate'],
        observeSeconds: SIX_HOURS,
      },
    ],
    signalIds: [
      'access-pressure',
      'filter-pressure',
      'return-pressure',
      'tmp',
      'filter-drop',
      'delivered-dose',
      'downtime',
    ],
    interpretation: [
      'Both arms are identical: recording the plan documents your reasoning but does not change access, the filter or delivery in this simulator.',
      "At the start of the run, the simulator's filter-burden terms come from access dysfunction, filtration fraction and hematocrit; the interruption, low-effective-flow and procoagulant terms are zero.",
      'Over six hours those terms raise filter pressure by well under 1 mmHg, so the simulator does not reproduce the earlier circuit losses. The summary relies on the case history and on the data you can verify.',
    ],
    runNote:
      'The modeled difference is what recording the plan changes, and it is zero for every signal. Changes in your run come from time passing or from the machine controls.',
  },
  demonstration: 'filter-domains',
  domainDemonstration: {
    domains: [
      {
        id: 'access',
        label: 'Access and blood-flow delivery',
        thisRun: (context) =>
          `Access pressure ${context.formatted['access-pressure']} at blood flow ${context.formatted['blood-flow']}; this case's access resistance is position dependent.`,
        canVerify: 'Yes: access pressure and delivered blood flow.',
        decidedBy: 'Bedside team, for catheter position and access function.',
      },
      {
        id: 'filtration',
        label: 'Filtration and concentration inside the filter',
        thisRun: (context) =>
          `${context.modalityLabel} with ${context.formatted['pre-replacement-flow']} replacement before and ${context.formatted['post-replacement-flow']} after the filter; hematocrit ${context.formatted.hematocrit}.`,
        canVerify:
          'Partly: flows and hematocrit are shown; filtration fraction is not calculated here.',
        decidedBy: 'Prescriber.',
      },
      {
        id: 'interruptions',
        label: 'Interruptions and downtime',
        thisRun: (context) =>
          `Downtime ${context.formatted.downtime}; delivered dose ${deliveredDoseText(context)} against ${context.formatted['prescribed-dose']} prescribed.`,
        canVerify: 'Yes: downtime and delivered versus prescribed dose.',
        decidedBy: 'Bedside team.',
      },
      {
        id: 'pressure-pattern',
        label: 'Pressure pattern across the filter',
        thisRun: (context) =>
          `Filter ${context.formatted['filter-pressure']}, return ${context.formatted['return-pressure']}, drop ${context.formatted['filter-drop']}, TMP ${context.formatted.tmp}.`,
        canVerify: 'Yes, for location: filter and return pressure, the drop and TMP.',
        decidedBy: 'Bedside team, with the device instructions.',
      },
      {
        id: 'anticoagulation',
        label: 'Anticoagulation and protocol',
        thisRun: (context) =>
          context.anticoagulationListed
            ? 'An anticoagulation method is listed, but its protocol is not represented here.'
            : 'No anticoagulation method is listed in this case prescription.',
        canVerify: 'No: no anticoagulation protocol is represented in this case.',
        decidedBy: 'Responsible clinical team under local protocol.',
      },
    ],
    filterTermLabels: {
      access: 'Access dysfunction',
      filtration: 'Filtration fraction',
      hematocrit: 'Hematocrit',
      interruption: 'Interruptions',
      'low-flow': 'Low effective blood flow',
      procoagulant: 'Procoagulant burden',
    },
    teamSummary: (context) => [
      'Recurrent early filter loss; earlier circuits are described in the history.',
      `Access: access pressure ${context.formatted['access-pressure']} at ${context.formatted['blood-flow']}; check catheter position and access function.`,
      `Filtration: ${context.modalityLabel}, ${context.formatted['pre-replacement-flow']} before and ${context.formatted['post-replacement-flow']} after the filter, hematocrit ${context.formatted.hematocrit}; filtration fraction not calculated here.`,
      `Delivery: downtime ${context.formatted.downtime}; delivered dose ${deliveredDoseText(context)} against ${context.formatted['prescribed-dose']} prescribed.`,
      `Pressure pattern: filter ${context.formatted['filter-pressure']}, return ${context.formatted['return-pressure']}, drop ${context.formatted['filter-drop']}, TMP ${context.formatted.tmp}.`,
      context.anticoagulationListed
        ? 'Anticoagulation: a method is listed; protocol questions go to the responsible team.'
        : 'Anticoagulation: no method listed; the plan goes to the responsible team.',
      'Request: team review of access and of the anticoagulation or protocol question; reassess the pressure pattern, delivered dose and downtime on the next circuit.',
    ],
  },
  taughtNotShown: [
    {
      text: 'Access dysfunction, concentration effects, interruptions, and other patient or protocol factors can combine to shorten filter life rather than act alone.',
      sourceIds: [],
      claimTopics: [],
    },
    {
      text: 'Circuit pressures depend on flow, resistance and the operating point rather than universal normal values.',
      sourceIds: ['DEV-PM-009'],
      claimTopics: [],
    },
    {
      text: 'The filter pressure drop is filter minus return pressure, which locates resistance within the filter but does not identify its cause.',
      sourceIds: ['DEV-PM-010'],
      claimTopics: [],
    },
    {
      text: 'Anticoagulation choice, filter-change criteria and alarm responses are not represented; they follow the device instructions and local protocol.',
      sourceIds: [],
      claimTopics: [],
    },
  ],
  reassess: [
    'Access pressure and delivered blood flow after any access intervention.',
    'Filter pressure, the drop and TMP over time on the next circuit.',
    'Delivered versus prescribed dose, and downtime by reason.',
    "The team's response to the escalation summary, and the life of the next filter.",
  ],
  alternatives: [
    'Preserving the circuit state and escalating before attributing a cause is an acceptable path.',
    'Teams differ in access management and anticoagulation choices under local protocol; the simulator cannot judge whether an anticoagulation plan is adequate.',
    'More than one domain may need action at the same time.',
  ],
  check: null,
  retired: {
    interventionSuffixes: ['action-unsafe-candidate'],
    reassessmentSuffixes: ['reassess-none'],
    reason:
      'The former unsafe option asked learners to assume one medication-related cause and bypass mechanical review. Its contrast is now taught through the domain table and the direct guidance to verify mechanical contributors before escalating the rest.',
  },
  awaitingReview: [
    'A registered source for the statement that access, concentration, interruption and protocol factors combine to shorten filter life.',
    'Whether the integrated case should simulate the earlier circuits, and with what history, so the run shows the recurrent pattern.',
    'Whether the case actions should change the simulated circuit, for example an access correction, and with what response.',
    'Which escalation path and summary content the local team expects.',
  ],
  revision: {
    goal: 'Summarize recurrent filter loss domain by domain and escalate what the circuit data cannot settle.',
    visibleFindings: [
      'The case history describes repeated early filter loss with more than one plausible contributor; earlier circuits are described, not simulated.',
      'The simulation runs the current circuit: access, filter and return pressures, delivered dose and downtime are available.',
      'The actions in this case record your plan and do not change the simulated circuit.',
    ],
    hints: [
      'List the domains: access and blood-flow delivery, filtration and concentration, interruptions and downtime, the pressure pattern across the filter, and anticoagulation or protocol.',
      'For each domain, name the run data that can verify it; the actions in this case record the plan and do not change the circuit.',
      'Escalate the domains the circuit data cannot settle, such as anticoagulation choice, to the responsible team with a short summary.',
    ],
    interventions: {
      'action-safe-candidate': {
        response:
          'Plan recorded. This action does not change the simulated circuit; use the domain table to separate verified contributors from questions for the team.',
      },
    },
    reassessmentLabel:
      'Reassessed access, the filter pressure pattern, delivered dose, downtime and the escalation summary',
    debrief: {
      summary:
        'Recurrent filter loss is summarized domain by domain: what the circuit data verified, what was corrected, and what was escalated.',
      trendReview:
        "The actions in this case record the plan and do not change the simulated circuit. Compare the domain table with your run's pressures, delivered dose and downtime.",
      causalChain: [
        'Access, filtration and concentration, interruptions, and anticoagulation or protocol factors can combine to shorten filter life.',
        'Circuit data can verify access pressure, the pressure pattern across the filter, delivered dose and downtime.',
        'Verified mechanical contributors are corrected; medication and local-policy questions go to the responsible team with the summary.',
      ],
      transferQuestion:
        'Which pressure, delivery and downtime values would you put in a one-paragraph summary for the team reviewing the next circuit?',
    },
  },
}

export const crrtWorkedCaseExamples: readonly CrrtWorkedCaseExample[] = Object.freeze([
  replacementSplitExample,
  filterTrendExample,
  recurrentFilterLossExample,
])

const exampleByCaseId = new Map<string, CrrtWorkedCaseExample>(
  crrtWorkedCaseExamples.map((example) => [example.caseId, example]),
)

export function getCrrtWorkedCaseExample(caseId: string): CrrtWorkedCaseExample | undefined {
  return exampleByCaseId.get(caseId)
}
