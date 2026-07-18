import { baxterCrrtAuthoredCaseTemplates } from './phase7ReviewCases'
import { baxterCrrtSupplementalSourceReferences } from './phase7ReviewSources'
import { baxterCrrtPilotCases } from './pilotCases'
import { baxterCrrtPilotSourceReferences } from './provenance'
import {
  CRRT_ALL_CASE_IDS,
  collectCrrtCaseSemanticIssues,
  runtimeCrrtCaseRegistrySchema,
  validateCrrtCaseRegistry,
  type CrrtCaseId,
  type RuntimeCrrtCase,
  type SourceReference,
} from './schema'
import { BAXTER_CRRT_CONTENT_VERSION } from './versions'

interface CaseNarrative {
  readonly id: CrrtCaseId
  readonly templateId: CrrtCaseId
  readonly title: string
  readonly stationId: RuntimeCrrtCase['stationId']
  readonly difficulty: RuntimeCrrtCase['difficulty']
  readonly patientDescription: string
  readonly learningObjectives: readonly string[]
  readonly goal: string
  readonly mechanism: string
  readonly safeAction: string
  readonly acceptedAlternative: string
  readonly unsafeAction: string
  readonly expectedResponse: string
  readonly reassessment: string
  readonly openingFinding: string
  readonly causalChain: readonly string[]
  readonly transferQuestion: string
  readonly clinicalSourceIds: readonly string[]
}

type MutableRuntimeCrrtCase = {
  -readonly [Key in keyof RuntimeCrrtCase]: RuntimeCrrtCase[Key]
}

const sourceById = new Map<string, SourceReference>(
  [...baxterCrrtPilotSourceReferences, ...baxterCrrtSupplementalSourceReferences].map((source) => [
    source.id,
    source,
  ]),
)

const sourceCases = [...baxterCrrtPilotCases, ...baxterCrrtAuthoredCaseTemplates]
const sourceCaseById = new Map(sourceCases.map((definition) => [definition.id, definition]))

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
    Object.freeze(value)
  }
  return value
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function replaceStrings(
  value: unknown,
  replacements: readonly (readonly [string, string])[],
): unknown {
  if (typeof value === 'string') {
    return replacements.reduce(
      (result, [search, replacement]) => result.split(search).join(replacement),
      value,
    )
  }
  if (Array.isArray(value)) return value.map((item) => replaceStrings(item, replacements))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, replaceStrings(nested, replacements)]),
    )
  }
  return value
}

function learnerWording(value: unknown): unknown {
  return replaceStrings(value, [
    ['Reviewer-only', 'Private learning'],
    ['reviewer-only', 'private learning'],
    ['reviewer candidate', 'learning case'],
    ['reviewer Candidate', 'learning case'],
    ['reviewer assessment', 'learner assessment'],
    ['reviewer path', 'learning path'],
    ['reviewer scoring', 'learning scoring'],
    ['reviewer fixture', 'learning fixture'],
    ['reviewer draft', 'SME-review build'],
    ['pending reviewer', 'pending SME'],
    ['pending clinical review', 'clinical-context limitation'],
    ['pending independent review', 'informational SME feedback'],
    ['pending review', 'informational provenance'],
    ['review-pending', 'synthetic educational'],
    ['protected pilot', 'private curriculum'],
    ['Protected pilot', 'Private curriculum'],
    ['three-case pilot', 'v1 curriculum'],
    ['pilot interface', 'learning interface'],
    ['pilot surface', 'learning surface'],
    ['pilot values', 'learning values'],
    ['pilot controls', 'learning controls'],
    ['pilot workflow', 'learning workflow'],
    ['Phase 7', 'v1'],
    ['phase 7', 'v1'],
  ])
}

function mutableClone(definition: RuntimeCrrtCase): MutableRuntimeCrrtCase {
  return learnerWording(JSON.parse(JSON.stringify(definition))) as MutableRuntimeCrrtCase
}

function promoteExistingCase(definition: RuntimeCrrtCase): MutableRuntimeCrrtCase {
  const promoted = mutableClone(definition)
  promoted.compatibleDevices = ['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx']
  promoted.contentVersion = BAXTER_CRRT_CONTENT_VERSION
  promoted.engineModelConfiguration.version = BAXTER_CRRT_CONTENT_VERSION
  promoted.debrief.machineNavigationPoint =
    'Translate the canonical state through the selected device adapter; screen order and vocabulary remain device-specific.'
  return promoted
}

/**
 * Every v1 case includes a deterministic timed observation. Some of the former
 * review fixtures intentionally had no scheduled event; learner cases need the
 * same predict-run-reassess loop even when their source template did not.
 */
function ensureTimedResponse(definition: MutableRuntimeCrrtCase): MutableRuntimeCrrtCase {
  if (definition.timedEvents.length > 0) return definition

  const syntheticSource = definition.sourceBasis.find(({ id }) => id.startsWith('SYNTH-'))
  if (!syntheticSource) {
    throw new Error(`Missing synthetic source for timed response in ${definition.id}.`)
  }

  const compactId = definition.id.toLowerCase().replace('-', '')
  const eventId = `${compactId}-event-reassessment-checkpoint`
  definition.timedEvents = [
    {
      id: eventId,
      atSimulationSeconds: 60,
      jitterSeconds: null,
      eventType: 'state-change',
      label: 'Timed response checkpoint before reassessment',
      effects: [
        {
          target: 'device.deliveryState',
          operation: 'set',
          valueType: 'enum',
          value: 'running',
          sourceId: syntheticSource.id,
        },
      ],
      sourceIds: [syntheticSource.id],
      reviewStatus: definition.hiddenMechanism.reviewStatus,
    },
  ]
  definition.engineFixtureConfiguration.timedEventMappings = [
    ...definition.engineFixtureConfiguration.timedEventMappings,
    {
      timedEventId: eventId,
      action: { type: 'SET_DELIVERY_STATE', deliveryState: 'running' },
    },
  ]
  return definition
}

function updateOption(
  options: RuntimeCrrtCase['goalOptions'],
  id: string,
  label: string,
  description: string,
  sourceIds: readonly string[],
): void {
  const option = options.find((candidate) => candidate.id === id)
  if (!option) throw new Error(`Unable to find CRRT option ${id}.`)
  option.label = label
  option.description = description
  option.sourceIds = [...sourceIds]
}

function buildAdaptedCase(narrative: CaseNarrative): MutableRuntimeCrrtCase {
  const template = sourceCaseById.get(narrative.templateId)
  if (!template) throw new Error(`Missing CRRT case template ${narrative.templateId}.`)

  const oldCompact = narrative.templateId.toLowerCase().replace('-', '')
  const newCompact = narrative.id.toLowerCase().replace('-', '')
  const cloned = replaceStrings(mutableClone(template), [
    [narrative.templateId, narrative.id],
    [oldCompact, newCompact],
  ]) as MutableRuntimeCrrtCase
  const syntheticId = `SYNTH-${narrative.id}`
  const narrativeSourceIds = unique([syntheticId, ...narrative.clinicalSourceIds])

  cloned.id = narrative.id
  cloned.sourceCaseId = narrative.id
  cloned.title = narrative.title
  cloned.stationId = narrative.stationId
  cloned.difficulty = narrative.difficulty
  cloned.compatibleDevices = ['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx']
  cloned.patientDescription = narrative.patientDescription
  cloned.learningObjectives = [...narrative.learningObjectives]
  cloned.visibleFindings = [
    narrative.openingFinding,
    'The displayed values are synthetic teaching calibration, not patient-care targets.',
    'Commit to a prediction before revealing the response and reassessment data.',
  ]
  cloned.contentVersion = BAXTER_CRRT_CONTENT_VERSION
  cloned.engineModelConfiguration.version = BAXTER_CRRT_CONTENT_VERSION

  cloned.hiddenMechanism.summary = narrative.mechanism
  cloned.hiddenMechanism.causalChain = [...narrative.causalChain]
  cloned.hiddenMechanism.sourceIds = [...narrativeSourceIds]

  updateOption(
    cloned.goalOptions,
    cloned.hiddenMechanism.correctGoalOptionId,
    narrative.goal,
    'Frames the whole synthetic scenario before choosing a device or clinical control.',
    narrativeSourceIds,
  )
  const incorrectGoal = cloned.goalOptions.find(
    (option) => option.id !== cloned.hiddenMechanism.correctGoalOptionId,
  )
  if (incorrectGoal) {
    incorrectGoal.label = 'Act on one isolated signal'
    incorrectGoal.description = 'This bypasses the whole-scenario assessment and uncertainty.'
    incorrectGoal.sourceIds = [syntheticId]
  }

  updateOption(
    cloned.mechanismOptions,
    cloned.hiddenMechanism.correctMechanismOptionId,
    'Use the linked causal pattern',
    narrative.mechanism,
    narrativeSourceIds,
  )
  const incorrectMechanism = cloned.mechanismOptions.find(
    (option) => option.id !== cloned.hiddenMechanism.correctMechanismOptionId,
  )
  if (incorrectMechanism) {
    incorrectMechanism.label = 'Assume the device display proves the cause'
    incorrectMechanism.description =
      'A display is one observation and does not replace patient, circuit, and delivery assessment.'
    incorrectMechanism.sourceIds = [syntheticId]
  }

  const safeControlId = cloned.hiddenMechanism.correctControlOptionIds[0]
  updateOption(
    cloned.controlOptions,
    safeControlId,
    narrative.safeAction,
    'Safe educational path with an explicit verification and reassessment endpoint.',
    narrativeSourceIds,
  )
  const alternativeControlIds = cloned.acceptedAlternativePaths.flatMap(
    (path) => path.predictionControlOptionIds,
  )
  for (const alternativeControlId of alternativeControlIds) {
    updateOption(
      cloned.controlOptions,
      alternativeControlId,
      narrative.acceptedAlternative,
      'Accepted alternative that preserves assessment, escalation, and reassessment.',
      narrativeSourceIds,
    )
  }
  const unsafeActionIds = new Set(cloned.unsafeActions.map((unsafe) => unsafe.actionId))
  const unsafeIntervention = cloned.interventions.find((action) => unsafeActionIds.has(action.id))
  const unsafeControl = cloned.controlOptions.find(
    (option) => option.id !== safeControlId && !alternativeControlIds.includes(option.id),
  )
  if (unsafeControl) {
    unsafeControl.label = narrative.unsafeAction
    unsafeControl.description =
      'Unsafe because it bypasses verification or invents an unsupported rule.'
    unsafeControl.sourceIds = [syntheticId]
  }

  updateOption(
    cloned.responseOptions,
    cloned.hiddenMechanism.correctResponseOptionId,
    'Expect a linked response, then verify it',
    narrative.expectedResponse,
    narrativeSourceIds,
  )
  const correctReassessmentId = cloned.hiddenMechanism.correctReassessmentOptionIds[0]
  updateOption(
    cloned.reassessmentOptions,
    correctReassessmentId,
    narrative.reassessment,
    'Required reassessment of patient, circuit, device, delivery, and recurrence as applicable.',
    narrativeSourceIds,
  )

  const requiredSafeAction = cloned.interventions.find(
    (action) =>
      cloned.requiredActionIds.includes(action.id) &&
      action.category !== 'assessment' &&
      action.category !== 'communication',
  )
  if (requiredSafeAction) {
    requiredSafeAction.label = narrative.safeAction
    requiredSafeAction.description =
      'Apply the bounded educational action after assessment; use local policy and supervision in real care.'
    requiredSafeAction.response = narrative.expectedResponse
    requiredSafeAction.sourceIds = [...narrativeSourceIds]
  }
  for (const path of cloned.acceptedAlternativePaths) {
    path.label = narrative.acceptedAlternative
    path.explanation =
      'This accepted alternative preserves the same safety checks, communication, and required reassessment.'
    path.sourceIds = [...narrativeSourceIds]
    const alternativeIntervention = cloned.interventions.find(
      (action) =>
        path.actionIds.includes(action.id) &&
        !cloned.requiredActionIds.includes(action.id) &&
        action.category !== 'assessment' &&
        action.category !== 'communication',
    )
    if (alternativeIntervention) {
      alternativeIntervention.label = narrative.acceptedAlternative
      alternativeIntervention.description =
        'Use this bounded alternative while preserving escalation and reassessment.'
      alternativeIntervention.response = narrative.expectedResponse
      alternativeIntervention.sourceIds = [...narrativeSourceIds]
    }
  }
  if (unsafeIntervention) {
    unsafeIntervention.label = narrative.unsafeAction
    unsafeIntervention.description =
      'This path intentionally bypasses a required safety or verification step for debriefing.'
    unsafeIntervention.response = 'The attempt is stopped and flagged for causal debrief.'
    unsafeIntervention.sourceIds = [syntheticId]
  }
  for (const unsafe of cloned.unsafeActions) {
    unsafe.explanation =
      'The selected action bypasses verification, escalation, or reassessment and is retained only as an educational unsafe path.'
    unsafe.sourceIds = [syntheticId]
  }
  for (const criticalError of cloned.criticalErrors) {
    criticalError.label = 'Critical safety-step omission'
    criticalError.explanation =
      'The action omits a required assessment, verification, or escalation step; no clinical threshold is implied.'
    criticalError.sourceIds = [syntheticId]
  }

  if (cloned.timedEvents[0]) {
    cloned.timedEvents[0].label = `Timed response: ${narrative.expectedResponse}`
    cloned.timedEvents[0].sourceIds = [...narrativeSourceIds]
    cloned.timedEvents[0].effects[0].sourceId = syntheticId
  }
  cloned.hintLadder.forEach((hint, index) => {
    hint.text =
      [
        `State the goal: ${narrative.goal}`,
        `Link the observations before acting: ${narrative.mechanism}`,
        `Name the reassessment endpoint: ${narrative.reassessment}`,
      ][index] ?? narrative.reassessment
    hint.sourceIds = [...narrativeSourceIds]
  })

  cloned.debrief.summary = `${narrative.id}: ${narrative.title}`
  cloned.debrief.statedGoalReview = narrative.goal
  cloned.debrief.predictionReview = narrative.mechanism
  cloned.debrief.actionTimelineReview =
    'Compare prediction, assessment, selected action, timed response, communication, and reassessment in order.'
  cloned.debrief.causalChain = [...narrative.causalChain]
  cloned.debrief.trendReview = narrative.expectedResponse
  cloned.debrief.requiredActionsReview = narrative.safeAction
  cloned.debrief.criticalErrorsReview = narrative.unsafeAction
  cloned.debrief.acceptedAlternativesReview = narrative.acceptedAlternative
  cloned.debrief.machineNavigationPoint =
    'Translate the canonical state through the selected device adapter; screen order and vocabulary remain device-specific.'
  cloned.debrief.transferQuestion = narrative.transferQuestion
  cloned.debrief.sourceIds = [...narrativeSourceIds]

  const existingSourceIds = new Set(cloned.sourceBasis.map((source) => source.id))
  for (const sourceId of narrative.clinicalSourceIds) {
    if (existingSourceIds.has(sourceId)) continue
    const source = sourceById.get(sourceId)
    if (!source) throw new Error(`Missing source ${sourceId} for ${narrative.id}.`)
    cloned.sourceBasis.push(learnerWording({ ...source }) as SourceReference)
    existingSourceIds.add(sourceId)
  }
  const syntheticSource = cloned.sourceBasis.find((source) => source.id === syntheticId)
  if (!syntheticSource) throw new Error(`Missing synthetic source ${syntheticId}.`)
  syntheticSource.claim = `Every patient value, flow, timing, event magnitude, condition, and engine coefficient in ${narrative.id} is synthetic teaching calibration.`
  syntheticSource.value =
    'Not a patient-care target, device limit, alarm threshold, local protocol, or treatment recommendation.'
  syntheticSource.sourceTitle = 'Baxter CRRT v1 synthetic calibration record'
  syntheticSource.documentVersion = BAXTER_CRRT_CONTENT_VERSION
  syntheticSource.pageOrSection = `${narrative.id} private learning fixture`
  syntheticSource.implementationLocation = `content/completeCases.ts · ${narrative.id}`

  const unreferencedSourceIds = new Set(
    collectCrrtCaseSemanticIssues(cloned)
      .filter((issue) => issue.startsWith('Unreferenced source basis ID: '))
      .map((issue) => issue.replace('Unreferenced source basis ID: ', '')),
  )
  cloned.sourceBasis = cloned.sourceBasis.filter((source) => !unreferencedSourceIds.has(source.id))

  return cloned
}

const authoredNarratives: readonly CaseNarrative[] = [
  {
    id: 'CRRT-03',
    templateId: 'CRRT-02',
    title: 'Controlled solute trajectory in acute brain or liver failure',
    stationId: 'define-goal',
    difficulty: 'advanced',
    patientDescription:
      'Synthetic critical illness with AKI and a neurologic vulnerability that makes abrupt solute change an explicit coordination concern.',
    learningObjectives: [
      'Define a controlled trajectory rather than reacting to one isolated result.',
      'Coordinate kidney-support goals with the broader neurocritical or liver-failure plan.',
      'Reassess the patient and serial trends after any change in delivery.',
    ],
    goal: 'Coordinate a controlled solute trajectory with the whole critical-care plan',
    mechanism:
      'Therapy delivery, interruptions, and changing patient production jointly shape the observed trajectory.',
    safeAction:
      'Pause and coordinate the intended trajectory before changing the simulated prescription',
    acceptedAlternative: 'Maintain the bounded setting while escalating multidisciplinary review',
    unsafeAction: 'Chase one value with an abrupt unverified change',
    expectedResponse:
      'The serial synthetic trend changes gradually and remains subject to delivery checks.',
    reassessment: 'Reassess neurologic context, serial solute trends, delivery, and interruptions',
    openingFinding: 'A serial solute trend and a neurologic vulnerability are visible together.',
    causalChain: [
      'The whole clinical context defines the intended trajectory.',
      'The selected modality and actual delivery influence the rate of change.',
      'Serial reassessment determines whether coordination remains appropriate.',
    ],
    transferQuestion:
      'How would you preserve the same controlled-trajectory reasoning while locating delivery and history data on the other device?',
    clinicalSourceIds: ['GUID-NICE-NG148-2024', 'GUID-RRT-ICU-2026'],
  },
  {
    id: 'CRRT-08',
    templateId: 'CRRT-07',
    title: 'Set, bag, solution, line, prime, and review verification',
    stationId: 'setup-start',
    difficulty: 'intermediate',
    patientDescription:
      'Synthetic setup state with a deliberately mismatched verification item before simulated connection.',
    learningObjectives: [
      'Use a deliberate pre-connection verification sequence.',
      'Separate manual-reference workflow from local stock and policy.',
      'Stop and escalate when an exact local expression is unavailable.',
    ],
    goal: 'Verify the complete setup before simulated connection',
    mechanism:
      'A mismatch in set, bag, solution, line, or entered data can propagate into later device behavior and displayed calculations.',
    safeAction:
      'Stop the sequence, identify the mismatched domain, and complete an independent check',
    acceptedAlternative:
      'Keep the setup paused and escalate the unresolved local-configuration item',
    unsafeAction: 'Connect first and plan to correct the mismatch later',
    expectedResponse:
      'The setup remains paused until the mismatch is explicitly resolved or escalated.',
    reassessment: 'Repeat the setup review and verify readiness before simulated connection',
    openingFinding: 'One verification item does not match the authored setup plan.',
    causalChain: [
      'Manual-reference steps define the verification domains.',
      'The unresolved mismatch prevents a safe readiness conclusion.',
      'Independent verification precedes simulated connection.',
    ],
    transferQuestion:
      'Which screen sequence and bag/scale topology change on Prismaflex while the verification domains stay the same?',
    clinicalSourceIds: ['DEV-PM-005', 'DEV-PM-013'],
  },
  {
    id: 'CRRT-09',
    templateId: 'CRRT-07',
    title: 'Anticoagulation protocol selection and verification',
    stationId: 'setup-start',
    difficulty: 'advanced',
    patientDescription:
      'Synthetic setup asks the learner to verify that an authorized, versioned protocol has been selected without displaying medication quantities or adjustment rules.',
    learningObjectives: [
      'Verify protocol identity, version, contraindication review, and responsible team before use.',
      'Recognize when no applicable protocol is available and stop for escalation.',
      'Keep medication-specific instructions outside this general educational module.',
    ],
    goal: 'Verify an applicable authorized protocol before enabling an anticoagulation workflow',
    mechanism:
      'A protocol label alone is insufficient unless its scope, version, patient applicability, and responsible oversight are confirmed.',
    safeAction:
      'Verify protocol identity, applicability, responsible oversight, and independent check',
    acceptedAlternative:
      'Leave anticoagulation unselected and escalate when verification is incomplete',
    unsafeAction: 'Infer a medication plan from a generic device option',
    expectedResponse:
      'The workflow records verification or remains unavailable; it never invents medication instructions.',
    reassessment:
      'Reassess protocol applicability, team communication, and the documented verification state',
    openingFinding: 'A generic device option is visible, but no verified protocol is attached.',
    causalChain: [
      'Clinical and local policy determine whether a protocol applies.',
      'Version and responsibility checks precede any device workflow.',
      'Missing verification leads to stopping and escalation.',
    ],
    transferQuestion:
      'How would you verify the same protocol identity and responsibility boundaries on a device with different setup screens?',
    clinicalSourceIds: ['GUID-RRT-ICU-2026'],
  },
  {
    id: 'CRRT-12',
    templateId: 'CRRT-11',
    title: 'Electrolyte, temperature, medication, and nutrition consequences',
    stationId: 'monitor-dose-fluid',
    difficulty: 'advanced',
    patientDescription:
      'Synthetic longitudinal treatment state with linked electrolyte, temperature, medication-delivery, and nutrition observations.',
    learningObjectives: [
      'Integrate patient trends with actual therapy delivery and interruptions.',
      'Identify when pharmacist, dietitian, nursing, or prescriber coordination is needed.',
      'Avoid treating the device display as the whole patient assessment.',
    ],
    goal: 'Integrate multidisciplinary consequences with actual treatment delivery',
    mechanism:
      'Continuous extracorporeal therapy, critical illness, inputs, and interruptions can influence linked monitoring domains over time.',
    safeAction:
      'Review linked trends and coordinate the appropriate multidisciplinary reassessment',
    acceptedAlternative:
      'Hold the bounded simulation state while escalating incomplete domain information',
    unsafeAction: 'Attribute every change to the filter and act without cross-domain review',
    expectedResponse:
      'The linked trends and delivery timeline become available for coordinated interpretation.',
    reassessment:
      'Reassess electrolytes, temperature, medication exposure, nutrition, and delivered therapy',
    openingFinding:
      'Several linked monitoring domains change during a period of interrupted delivery.',
    causalChain: [
      'Patient inputs and critical illness create a changing baseline.',
      'Therapy delivery and downtime alter exposure over time.',
      'Multidisciplinary reassessment distinguishes plausible contributors.',
    ],
    transferQuestion:
      'Where would you find the device history and delivered-therapy context needed for the same multidisciplinary review on Prismaflex?',
    clinicalSourceIds: ['REVIEW-CKRT-CORE-2025', 'GUID-RRT-ICU-2026'],
  },
  {
    id: 'CRRT-14',
    templateId: 'CRRT-13',
    title: 'High return pressure versus return disconnection',
    stationId: 'pressures-troubleshooting',
    difficulty: 'advanced',
    patientDescription:
      'Synthetic return-path scenario in which obstruction and disconnection produce opposing directional patterns.',
    learningObjectives: [
      'Predict pressure direction before revealing the placed fault.',
      'Inspect the corresponding return-path domain rather than treating every signal alike.',
      'Verify cause correction and patient safety before simulated resumption.',
    ],
    goal: 'Localize the return-path problem from direction, context, and circuit inspection',
    mechanism:
      'Added return-path resistance and a disconnected return path change the return-pressure relationship in different directions.',
    safeAction:
      'Pause, assess patient safety, inspect the return path, and verify the identified cause',
    acceptedAlternative:
      'Keep therapy paused and escalate when the return-path cause cannot be verified',
    unsafeAction: 'Treat opposing return-pressure patterns as the same fault',
    expectedResponse:
      'Correction of the authored fault restores the directional pattern before reassessment.',
    reassessment: 'Reassess patient, return path, pressure trend, delivery, and recurrence',
    openingFinding: 'A return-pressure change appears with an incomplete view of the return path.',
    causalChain: [
      'The placed return-path condition changes resistance or connection state.',
      'The pressure pattern supplies a directional localization clue.',
      'Circuit inspection and reassessment verify the cause.',
    ],
    transferQuestion:
      'How do Prismaflex alarm/help presentation and pressure labels differ while the return-path localization logic remains canonical?',
    clinicalSourceIds: ['DEV-PM-009', 'DEV-PM-010'],
  },
  {
    id: 'CRRT-16',
    templateId: 'CRRT-15',
    title: 'Recurrent filter loss across access, filtration, downtime, and policy domains',
    stationId: 'anticoagulation-complications-liberation',
    difficulty: 'advanced',
    patientDescription:
      'Synthetic recurrent circuit-loss history with multiple plausible contributors and incomplete policy context.',
    learningObjectives: [
      'Use trend history to evaluate mechanical and delivery contributors before assigning one cause.',
      'Separate general causal reasoning from medication or local-policy instructions.',
      'Escalate repeated loss with a structured multidisciplinary summary.',
    ],
    goal: 'Explain recurrent filter loss using the complete access, circuit, delivery, and policy context',
    mechanism:
      'Access dysfunction, concentration effects, interruptions, and other patient or protocol factors can combine rather than act alone.',
    safeAction:
      'Review the complete history, correct verified mechanical contributors, and escalate the residual pattern',
    acceptedAlternative:
      'Preserve the circuit state and escalate before making an unsupported attribution',
    unsafeAction: 'Assume one medication-related cause and bypass mechanical review',
    expectedResponse:
      'The debrief separates verified contributors from unresolved policy-dependent questions.',
    reassessment: 'Reassess access, filter trends, effective delivery, downtime, and recurrence',
    openingFinding:
      'The filter history shows repeated loss with more than one plausible contributor.',
    causalChain: [
      'Multiple patient, access, circuit, and delivery factors influence filter burden.',
      'History and trend localization narrow the verified contributors.',
      'Unresolved protocol questions are escalated without invented instructions.',
    ],
    transferQuestion:
      'Which history, pressure, and delivered-therapy views would you compare on each device before presenting the same causal summary?',
    clinicalSourceIds: ['DEV-PM-009', 'DEV-PM-010', 'REVIEW-CKRT-CORE-2025'],
  },
  {
    id: 'CRRT-17',
    templateId: 'CRRT-11',
    title: 'Conceptual citrate-calcium problem recognition and escalation',
    stationId: 'anticoagulation-complications-liberation',
    difficulty: 'advanced',
    patientDescription:
      'Synthetic monitoring vignette with linked calcium, acid-base, circuit, and delivery trends. No medication quantities or protocol instructions are represented.',
    learningObjectives: [
      'Recognize linked trend directions that warrant a citrate-calcium safety review.',
      'Verify sampling, delivery, circuit, and protocol context before interpretation.',
      'Stop and escalate to the responsible clinical team without generating instructions.',
    ],
    goal: 'Recognize a linked citrate-calcium safety pattern and escalate it',
    mechanism:
      'Calcium, acid-base, circuit, and delivery observations are interpreted together; no single observation establishes the explanation.',
    safeAction:
      'Verify linked observations, pause unsupported inference, and escalate to the responsible team',
    acceptedAlternative:
      'Maintain the safe simulated state while obtaining missing protocol and sampling context',
    unsafeAction: 'Change therapy from one isolated calcium observation',
    expectedResponse:
      'The conceptual dashboard reveals direction and linkage only, followed by escalation.',
    reassessment:
      'Reassess linked trend direction, sampling validity, delivery context, and escalation response',
    openingFinding:
      'Linked calcium and acid-base observations change while delivery context is incomplete.',
    causalChain: [
      'Sampling, patient state, circuit delivery, and protocol context shape the observations.',
      'Linked directions prompt verification rather than a one-value conclusion.',
      'The responsible team receives a structured escalation and reassessment summary.',
    ],
    transferQuestion:
      'How would you communicate the same conceptual trend and escalation boundary when device vocabulary changes?',
    clinicalSourceIds: ['REVIEW-CKRT-CORE-2025', 'GUID-RRT-ICU-2026'],
  },
  {
    id: 'CRRT-18',
    templateId: 'CRRT-11',
    title: 'Renal recovery, discontinuation, and transition',
    stationId: 'anticoagulation-complications-liberation',
    difficulty: 'advanced',
    patientDescription:
      'Synthetic longitudinal recovery state requiring reassessment of ongoing support, transition planning, and device stop/end framing.',
    learningObjectives: [
      'Reassess whether kidney support remains needed using the whole trajectory.',
      'Separate a clinical discontinuation decision from device stop/end workflow.',
      'Communicate transition, monitoring, and escalation responsibilities.',
    ],
    goal: 'Reassess ongoing kidney-support need and coordinate a supervised transition',
    mechanism:
      'Changing kidney function, fluid status, solute control, hemodynamics, and delivered therapy jointly inform the transition discussion.',
    safeAction:
      'Review the recovery trajectory and coordinate the clinical and device transition plans separately',
    acceptedAlternative:
      'Continue bounded support while obtaining missing recovery or transition information',
    unsafeAction: 'End treatment from one favorable observation without a transition plan',
    expectedResponse:
      'The simulation separates the clinical decision, device workflow, disposition, and follow-up reassessment.',
    reassessment:
      'Reassess recovery trajectory, patient status, transition monitoring, and escalation ownership',
    openingFinding: 'Several recovery signals improve, but the transition plan is incomplete.',
    causalChain: [
      'Serial patient and delivery data frame the ongoing need for support.',
      'The clinical transition decision is distinct from device stop/end controls.',
      'Post-transition monitoring and escalation close the loop.',
    ],
    transferQuestion:
      'How do stop/end and disposition controls differ between PrisMax and Prismaflex while the clinical transition decision remains device-neutral?',
    clinicalSourceIds: ['GUID-NICE-NG148-2024', 'GUID-RRT-ICU-2026'],
  },
]

const adaptedCases = authoredNarratives.map(buildAdaptedCase).map(ensureTimedResponse)
const adaptedCaseIds = new Set(adaptedCases.map((definition) => definition.id))
const promotedCases = sourceCases
  .filter((definition) => !adaptedCaseIds.has(definition.id))
  .map(promoteExistingCase)
  .map(ensureTimedResponse)

const parsedCases = runtimeCrrtCaseRegistrySchema.parse(
  [...promotedCases, ...adaptedCases].sort((left, right) => left.id.localeCompare(right.id)),
)
const registryIssues = validateCrrtCaseRegistry(parsedCases, {
  expectedCaseIds: CRRT_ALL_CASE_IDS,
  registryLabel: 'Baxter CRRT v1 learner',
})
for (const [index, expectedId] of CRRT_ALL_CASE_IDS.entries()) {
  if (parsedCases[index]?.id !== expectedId) {
    registryIssues.push(
      `Baxter CRRT v1 case order mismatch at ${index}: expected ${expectedId}, received ${parsedCases[index]?.id ?? 'missing'}`,
    )
  }
}
if (registryIssues.length > 0) {
  throw new Error(`Invalid Baxter CRRT v1 learner registry: ${registryIssues.join('; ')}`)
}

export const baxterCrrtCases: readonly RuntimeCrrtCase[] = deepFreeze(parsedCases)

const caseById = new Map(baxterCrrtCases.map((definition) => [definition.id, definition]))

export function getBaxterCrrtCase(caseId: CrrtCaseId): RuntimeCrrtCase {
  const definition = caseById.get(caseId)
  if (!definition) throw new Error(`Unknown Baxter CRRT case: ${caseId}`)
  return definition
}
