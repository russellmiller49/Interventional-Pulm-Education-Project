/**
 * One cardiovascular model, authored before any product track.
 *
 * The module's failure mode is that a learner arrives able to recognize product names and leaves
 * still unable to say where blood enters, where it returns, which chamber is unloaded, and whether
 * a larger number on a console means more blood reaching an organ. Everything in this file exists
 * to be answered *before* a device-specific control is touched, and it is deliberately
 * device-neutral: the same seven questions, the same four causal levels, and the same three-line
 * flow account apply to counterpulsation, a microaxial pump, a durable pump, and an
 * extracorporeal circuit.
 *
 * Nothing here carries a numeric threshold. Numbers that belong to a product live on the pathway
 * cards in `supportPathways.ts`, behind their measurand, and interpretive bands for derived values
 * live in `derivedValueGuides.ts` over the shared rule engine.
 */

/** The support pathway a card or live device belongs to, used to keep the flow account honest. */
export type McsSupportMechanismClass =
  /** Changes the timing and shape of pressure around a native beat. Adds no pump flow of its own. */
  | 'timing-and-pressure'
  /** Moves blood from one intravascular location to another with an active pump. */
  | 'direct-blood-pump'
  /** Drains blood out of the body, conditions it, and returns it. */
  | 'extracorporeal-circuit'

export interface McsCommonModelQuestion {
  readonly id: string
  /** Presentation order. Stable, and asserted by test so the sequence cannot silently reshuffle. */
  readonly order: number
  readonly question: string
  /** Why a learner who skips this question misreads the device later. */
  readonly whyItMatters: string
  /** The observations that answer it — patient findings first, device display last. */
  readonly answeredBy: readonly string[]
  readonly conceptIds: readonly string[]
}

/**
 * The seven questions that precede every device-specific control.
 *
 * Ordered so that the failing physiology is named before the pathway, the pathway before the
 * mechanism, the mechanism before its consequences, and the consequences before the definition of
 * success. Naming a device first hides the judgement instead of making it.
 */
export const mcsCommonModelQuestions: readonly McsCommonModelQuestion[] = Object.freeze([
  {
    id: 'mcs.model.q1-dominant-problem',
    order: 1,
    question:
      'What is the dominant problem — left ventricular failure, right ventricular failure, biventricular failure, inadequate gas exchange, or a combination?',
    whyItMatters:
      'Support is a statement about which part of the circulation is failing. A left-sided pump added to a right-sided problem does not convert one into the other, and a circulatory device does not treat a gas-exchange problem.',
    answeredBy: [
      'Examination and the clinical trajectory that brought the patient here',
      'Filling pressures on both sides and the relationship between them',
      'Whether oxygenation and carbon dioxide clearance are adequate on current respiratory support',
    ],
    conceptIds: ['cc.flow.rv-lv-coupling', 'cc.perfusion.oxygen-delivery-extraction'],
  },
  {
    id: 'mcs.model.q2-source-and-destination',
    order: 2,
    question: 'Where does blood enter the device, and where does it return?',
    whyItMatters:
      'The source and the destination define what the device can and cannot reach. A pathway drawn correctly answers most troubleshooting questions before any alarm is read.',
    answeredBy: [
      'The authored pathway card for this device',
      'Imaging or a position signal confirming where the inlet and outlet actually sit',
      'The direction of flow, which is not the direction the cannula or catheter was advanced',
    ],
    conceptIds: [
      'cc.device.source-active-component-destination',
      'cc.device.normal-patient-device-state',
    ],
  },
  {
    id: 'mcs.model.q3-mechanism-class',
    order: 3,
    question:
      'Does the device alter pressure timing, directly pump blood, or create an extracorporeal pathway?',
    whyItMatters:
      'These are three different things, and only one of them puts a flow number on a screen that represents blood the device itself moved. Reading all three as though they were the same quantity is the most common error in this module.',
    answeredBy: [
      'The mechanism field on the pathway card',
      'Whether the display reports a flow at all, and which stream that flow describes',
      'Whether the arterial trace changes shape, changes size, or loses pulsatility',
    ],
    conceptIds: [
      'cc.device.native-device-effective-flow',
      'cc.device.source-active-component-destination',
    ],
  },
  {
    id: 'mcs.model.q4-chamber-unloaded',
    order: 4,
    question: 'Which chamber is unloaded?',
    whyItMatters:
      'Unloading is the effect most often claimed and least often located. Naming the chamber makes the claim checkable against a filling pressure and a volume.',
    answeredBy: [
      'The chamber the device draws from, if it draws from a chamber at all',
      'The filling pressure belonging to that chamber, read over time rather than once',
      'Ventricular volume and the behaviour of the aortic valve where those are observable',
    ],
    conceptIds: ['cc.flow.transmural-pressure', 'cc.device.patient-device-coupling'],
  },
  {
    id: 'mcs.model.q5-chamber-or-bed-loaded',
    order: 5,
    question: 'Which chamber or vascular bed may be loaded?',
    whyItMatters:
      'Every support pathway moves a burden somewhere. Support that unloads one chamber can raise the load on another chamber, on the pulmonary bed, or on the ventricle ejecting against the returned flow.',
    answeredBy: [
      'The destination compartment on the pathway card',
      'The filling pressure and pulsatility on the side that receives the returned flow',
      'Signs of congestion in the bed downstream of the return',
    ],
    conceptIds: ['cc.flow.rv-lv-coupling', 'cc.device.patient-device-coupling'],
  },
  {
    id: 'mcs.model.q6-what-limits-performance',
    order: 6,
    question:
      'What limits performance — preload, afterload, rhythm, position, obstruction, ventricular interaction, or gas exchange?',
    whyItMatters:
      'A device delivering less than its setting is reporting a constraint, not requesting a higher setting. Localizing the constraint before or after the active component decides whether raising support helps or harms.',
    answeredBy: [
      'Inflow conditions: volume state, venous return, and the pressure filling the source compartment',
      'Outflow conditions: the pressure the device has to eject against',
      'Position, rhythm, and any mechanical obstruction along the path',
      'Whether the limitation is circulatory at all, or a gas-exchange problem wearing circulatory clothes',
    ],
    conceptIds: [
      'cc.device.preload-afterload-dependence',
      'cc.troubleshooting.localize-before-intervene',
    ],
  },
  {
    id: 'mcs.model.q7-what-defines-success',
    order: 7,
    question: 'What patient findings would define success, stated before the setting is changed?',
    whyItMatters:
      'Named in advance, a reassessment can contradict the plan. Named afterwards, the display supplies its own evidence and the prediction can never be contradicted.',
    answeredBy: [
      'Organ-level findings: mentation, urine output, skin and capillary refill, lactate trajectory',
      'Whether the improvement appears in more than one signal that does not share a sensor',
      'The finding that, if it appeared instead, would reverse the decision',
    ],
    conceptIds: [
      'cc.perfusion.macro-micro-coherence',
      'cc.troubleshooting.reassess-convergent-signals',
    ],
  },
])

export interface McsCausalLevel {
  readonly id: string
  /** 1 = pressure … 4 = organ response. */
  readonly order: number
  readonly label: string
  /** The question this level, and only this level, answers. */
  readonly question: string
  /** What a favourable reading at this level does establish. */
  readonly whatItEstablishes: string
  /** What a favourable reading at this level does *not* establish. This is the teaching. */
  readonly whatItCannotEstablish: string
  /** Live signals in this simulation that sit at this level. */
  readonly liveSignalLabels: readonly string[]
  readonly conceptIds: readonly string[]
}

/**
 * Pressure → flow → oxygen delivery → organ response.
 *
 * A permanent display rather than a lesson aside: nearly every wrong conclusion in mechanical
 * support is a reading taken at one level and asserted at a higher one. Improved pressure is not
 * improved flow, improved flow is not improved delivery, and improved delivery is not a recovered
 * organ.
 */
export const mcsCausalLadder: readonly McsCausalLevel[] = Object.freeze([
  {
    id: 'mcs.causal.pressure',
    order: 1,
    label: 'Pressure',
    question: 'What pressure exists, and where in the circulation is it being measured?',
    whatItEstablishes:
      'That a driving pressure exists at the measured site, and the shape of the pulse there.',
    whatItCannotEstablish:
      'How much blood is moving. A preserved or augmented pressure can sit on top of a very small forward stroke volume, and a device that raises pressure has not thereby moved blood.',
    liveSignalLabels: [
      'Arterial pressure and pulse pressure',
      'Right atrial pressure',
      'Pulmonary artery and wedge pressure',
      'Left ventricular end-diastolic pressure',
    ],
    conceptIds: ['cc.flow.pressure-gradient', 'cc.measurement.signal-validity'],
  },
  {
    id: 'mcs.causal.flow',
    order: 2,
    label: 'Flow',
    question: 'How much blood is moving forward, and by which of the available routes?',
    whatItEstablishes:
      'A volume per unit time along a named path — native ejection, device output, or the two combined into what actually reaches the systemic circulation.',
    whatItCannotEstablish:
      'How much oxygen is being delivered. Flow carrying poorly oxygenated or severely anaemic blood delivers little, and flow that recirculates or regurgitates never reaches a tissue bed at all.',
    liveSignalLabels: [
      'Native cardiac output',
      'Displayed device flow',
      'Effective systemic flow',
      'Recirculating or regurgitant flow',
    ],
    conceptIds: ['cc.perfusion.cardiac-output', 'cc.device.native-device-effective-flow'],
  },
  {
    id: 'mcs.causal.oxygen-delivery',
    order: 3,
    label: 'Oxygen delivery',
    question: 'How much oxygen reaches the tissues per unit time?',
    whatItEstablishes:
      'The product of effective flow and arterial oxygen content — flow, haemoglobin, and saturation together, not any one of them alone.',
    whatItCannotEstablish:
      'Whether an individual organ is using that oxygen. Delivery can be adequate globally while distribution, extraction, or a regional bed remains abnormal.',
    liveSignalLabels: [
      'Effective systemic flow',
      'Mixed venous saturation',
      'Cardiac power output as a combined pressure–flow summary',
    ],
    conceptIds: ['cc.perfusion.oxygen-delivery-extraction', 'cc.perfusion.oxygen-content'],
  },
  {
    id: 'mcs.causal.organ-response',
    order: 4,
    label: 'Organ response',
    question: 'Are the organs behaving as though they are being perfused?',
    whatItEstablishes:
      'The only level at which the goal of support is stated. Mentation, urine output, skin perfusion, and the lactate trajectory answer here and nowhere else.',
    whatItCannotEstablish:
      'Nothing above it — this is the top of the ladder. What it cannot do is respond instantly: an organ answers on its own timescale, so an unchanged organ finding shortly after a setting change is not yet evidence of failure.',
    liveSignalLabels: [
      'The bedside examination, which this simulation represents only in part',
      'Convergent signals that do not share a sensor',
    ],
    conceptIds: [
      'cc.perfusion.macro-micro-coherence',
      'cc.troubleshooting.reassess-convergent-signals',
    ],
  },
])

/** Which of the three lines of the flow account a quantity belongs to. */
export type McsFlowAccountLineId = 'native' | 'device-displayed' | 'effective-systemic'

export interface McsFlowAccountLine {
  readonly id: McsFlowAccountLineId
  readonly order: number
  readonly label: string
  readonly definition: string
  /** Whether this line is read from a sensor, produced by an algorithm, or reasoned to. */
  readonly valueType: 'measured' | 'estimated' | 'inferred'
  readonly valueTypeStatement: string
  /** One concrete way this line misleads at the bedside. */
  readonly howItMisleads: string
  readonly conceptIds: readonly string[]
}

/**
 * The three lines that must be kept apart, and the reason the module exists.
 *
 * Rendered beside the causal ladder rather than inside it: the ladder says which *question* a
 * signal answers, and the account says which *stream* a flow number describes.
 */
export const mcsFlowAccount: readonly McsFlowAccountLine[] = Object.freeze([
  {
    id: 'native',
    order: 1,
    label: 'Native cardiac contribution',
    definition:
      'Blood the patient’s own heart ejects through its own outflow tract, independent of any device.',
    valueType: 'inferred',
    valueTypeStatement:
      'In this simulation the native contribution is reasoned from the modelled circulation. At the bedside it is rarely measured directly while a device is running.',
    howItMisleads:
      'It is easy to forget the native contribution entirely once a device display exists, and then to attribute the whole of the patient’s circulation to the device — or to miss that a falling native contribution is being masked by a steady device number.',
    conceptIds: ['cc.perfusion.cardiac-output', 'cc.device.native-device-effective-flow'],
  },
  {
    id: 'device-displayed',
    order: 2,
    label: 'Displayed device contribution',
    definition:
      'The number the device reports for the blood it is moving. Some pathways report no flow at all, because they move no blood of their own.',
    valueType: 'estimated',
    valueTypeStatement:
      'On the pumps modelled here the displayed flow is an algorithmic estimate derived from pump behaviour and assumed loading, not a flow probe on the outflow. Keep the label visible so an estimate is not read as a direct measurement.',
    howItMisleads:
      'It is the largest and most legible number on the screen, it responds to a setting change immediately, and it can rise while the blood it describes is going somewhere other than a tissue bed.',
    conceptIds: [
      'cc.measurement.measured-estimated-inferred',
      'cc.device.selected-vs-delivered-support',
    ],
  },
  {
    id: 'effective-systemic',
    order: 3,
    label: 'Effective systemic delivery',
    definition:
      'The blood that actually reaches the systemic circulation once competition, regurgitation, recirculation, and pathway topology have been accounted for.',
    valueType: 'inferred',
    valueTypeStatement:
      'This is a reasoned quantity, not a reading. It is the one the patient experiences, and it is the one no console displays.',
    howItMisleads:
      'It is the least visible of the three and the only one that matters, so it is the line most often replaced by whichever of the other two is easier to see.',
    conceptIds: [
      'cc.device.native-device-effective-flow',
      'cc.perfusion.oxygen-delivery-extraction',
    ],
  },
])

/**
 * The warning that must accompany the flow account wherever it is rendered.
 *
 * Stated as a prohibition on an operation rather than as a fact about one device, because the
 * arithmetic error is what transfers between devices — a learner who adds a right-sided pump flow
 * to a left-sided pump flow will also add a VA ECMO flow to a native cardiac output.
 */
export const MCS_FLOW_ADDITIVITY_WARNING = Object.freeze({
  id: 'mcs.model.flows-are-not-additive',
  headline: 'Displayed flows are not automatically additive.',
  statement:
    'Adding a device flow to a native cardiac output, or one pump’s flow to another’s, is an arithmetic operation the circulation has not agreed to. Whether two streams sum, compete, or travel through one another depends on whether the pathways are serial or parallel, on how much the native ventricle is still ejecting, on regurgitation and recirculation, on catheter or cannula position, and on the loading conditions at both ends of the pump.',
  worked: Object.freeze([
    'Serial pathways — a right-sided pump delivering into the pulmonary circulation and a left-sided pump drawing from the left ventricle handle the *same* blood one after the other. Their displayed flows describe one stream measured twice, so summing them counts that stream twice.',
    'Parallel pathways — a device returning blood to the aorta while the native ventricle also ejects into the aorta produces two streams meeting in one vessel. They may add, but only to the extent that both are truly moving forward and neither is meeting the other head-on.',
    'A pathway that moves no blood of its own — counterpulsation changes the pressure the ventricle meets and the pressure the coronary bed sees. It contributes no separate stream, so there is nothing to add.',
  ]),
  conceptIds: Object.freeze([
    'cc.device.native-device-effective-flow',
    'cc.perfusion.cardiac-output',
  ]),
})

export interface McsFirstUseTerm {
  readonly id: string
  readonly term: string
  /** Plain learner-facing definition, given at first use. */
  readonly definition: string
  /** The bedside question the term exists to answer. */
  readonly clinicalQuestion: string
  /** One specific way a value carrying this label can mislead. */
  readonly howItMisleads: string
  readonly conceptIds: readonly string[]
}

/**
 * Every term this module uses before it has earned the right to assume it.
 *
 * Each entry is required to carry all three of definition, the clinical question it answers, and
 * one way it misleads. A definition without the second and third parts is a glossary; with them it
 * is a reasoning tool, which is what a first-year fellow is missing.
 */
export const mcsFirstUseTerms: readonly McsFirstUseTerm[] = Object.freeze([
  {
    id: 'mcs.term.native-output',
    term: 'Native output',
    definition:
      'The blood the patient’s own heart ejects per minute through its own outflow tract, with no device contribution counted.',
    clinicalQuestion: 'How much of this circulation still belongs to the patient?',
    howItMisleads:
      'While a device is running, native output is usually reasoned rather than measured — so a confident number for it is carrying an assumption that should be stated out loud.',
    conceptIds: ['cc.perfusion.cardiac-output'],
  },
  {
    id: 'mcs.term.device-flow',
    term: 'Device flow',
    definition:
      'The blood the device itself moves per minute along its own pathway, as the device reports it.',
    clinicalQuestion: 'How much blood is this pump moving from its source to its destination?',
    howItMisleads:
      'It describes movement along the device pathway, not arrival in a tissue bed. Blood that returns to the chamber it came from is still device flow, and a device that alters pressure without pumping has no device flow to report.',
    conceptIds: ['cc.device.selected-vs-delivered-support'],
  },
  {
    id: 'mcs.term.effective-systemic-flow',
    term: 'Effective systemic flow',
    definition:
      'The blood that actually reaches the systemic circulation, after competition, regurgitation, recirculation, and where each stream travels have been taken into account.',
    clinicalQuestion: 'How much blood is reaching the organs?',
    howItMisleads:
      'No console displays it. Because it must be reasoned to, it is quietly replaced by whichever displayed number is nearest to hand.',
    conceptIds: ['cc.device.native-device-effective-flow'],
  },
  {
    id: 'mcs.term.unloading',
    term: 'Unloading',
    definition:
      'Reducing the volume or pressure work a named chamber has to do, usually by removing blood it would otherwise have to eject or accommodate.',
    clinicalQuestion: 'Which chamber is being relieved, and by how much?',
    howItMisleads:
      'Used without naming the chamber it becomes a general claim of benefit. Unloading one chamber can load another, and the word carries no information about where the burden went.',
    conceptIds: ['cc.flow.transmural-pressure', 'cc.device.patient-device-coupling'],
  },
  {
    id: 'mcs.term.augmentation',
    term: 'Augmentation',
    definition:
      'Raising pressure during a particular part of the cardiac cycle — classically diastolic pressure — by changing the timing and shape of the pressure wave rather than by adding a stream of blood.',
    clinicalQuestion: 'Has the pressure the coronary and systemic beds see during diastole risen?',
    howItMisleads:
      'It reads as an improvement on the arterial trace at the pressure level of the causal ladder, and it is easy to carry that impression up to the flow and delivery levels where it was never established.',
    conceptIds: ['cc.flow.pressure-gradient', 'cc.perfusion.macro-micro-coherence'],
  },
  {
    id: 'mcs.term.support',
    term: 'Support',
    definition:
      'An umbrella word covering any of these: changing pressure timing, moving blood, exchanging gas, or some combination. It names a category, not a quantity.',
    clinicalQuestion: 'What, specifically, is this device doing for this patient?',
    howItMisleads:
      '“More support” sounds like a single dial. It is not: escalating a setting, adding a second pump, and changing to a different pathway are three different decisions with different failure modes.',
    conceptIds: ['cc.device.selected-vs-delivered-support'],
  },
  {
    id: 'mcs.term.estimated-versus-measured-flow',
    term: 'Estimated versus measured flow',
    definition:
      'A measured flow comes from a sensor in the path of the blood. An estimated flow is computed from something else — pump behaviour, power, speed, and assumed loading — and inherits every assumption in that computation.',
    clinicalQuestion: 'Where did this number come from, and what has to be true for it to hold?',
    howItMisleads:
      'The two look identical on a display. An estimate drifts when its assumptions stop holding, which is exactly when the patient is changing and the number is most likely to be believed.',
    conceptIds: ['cc.measurement.measured-estimated-inferred', 'cc.measurement.measurand'],
  },
  {
    id: 'mcs.term.pressure-versus-perfusion-improvement',
    term: 'Pressure improvement versus perfusion improvement',
    definition:
      'A pressure improvement is a change at the first level of the causal ladder. A perfusion improvement is a change at the fourth, in the organs.',
    clinicalQuestion: 'Did the thing I was trying to fix actually change?',
    howItMisleads:
      'A pressure improvement arrives within seconds and is easy to see; an organ response arrives later and is easy to miss. The mismatch in timing makes the pressure change feel like the whole answer.',
    conceptIds: ['cc.perfusion.macro-micro-coherence', 'cc.flow.pressure-gradient'],
  },
])

/** The recommended entry point, stated without gating any other section's URL. */
export const MCS_RECOMMENDED_FIRST_SECTION_ID = 'mcs-foundations-signals'

/**
 * What working through this module does and does not establish.
 *
 * Kept as authored content rather than inline copy so that every surface that makes a completion
 * claim makes the same one, and so a test can assert that no surface makes a stronger one.
 *
 * The wording deliberately avoids the noun the roadmap used for this requirement: the shared
 * learner-copy lint in `critical-care/__tests__/learner-copy.test.ts` bans that word from every
 * critical-care component with no override, on the grounds that a module has no business using
 * credentialing vocabulary at all. Saying "not ready to operate these devices" makes the same
 * claim in language a first-year fellow can act on.
 */
export const MCS_COMPLETION_BOUNDARY = Object.freeze({
  id: 'mcs.model.completion-boundary',
  headline:
    'Working through this module does not establish that you are ready to operate these devices.',
  statement:
    'These sections record educational participation, and nothing more. Running a balloon pump, a microaxial pump, a durable pump, or an extracorporeal circuit safely requires device-specific training on the equipment in use, the current manufacturer instructions for that equipment, local protocol, and supervision by the responsible shock or mechanical-support team.',
})

function validateCommonModel(): readonly string[] {
  const errors: string[] = []

  const questionOrders = mcsCommonModelQuestions.map((entry) => entry.order)
  if (questionOrders.join(',') !== [1, 2, 3, 4, 5, 6, 7].join(',')) {
    errors.push('the common model must ask exactly seven questions in order 1–7')
  }
  const ladderOrders = mcsCausalLadder.map((level) => level.order)
  if (ladderOrders.join(',') !== [1, 2, 3, 4].join(',')) {
    errors.push('the causal ladder must have exactly four levels in order 1–4')
  }
  const accountOrder = mcsFlowAccount.map((line) => line.id)
  if (accountOrder.join(',') !== ['native', 'device-displayed', 'effective-systemic'].join(',')) {
    errors.push(
      'the flow account must read native → displayed device → effective systemic, in that order',
    )
  }

  const ids = [
    ...mcsCommonModelQuestions.map((entry) => entry.id),
    ...mcsCausalLadder.map((entry) => entry.id),
    ...mcsFirstUseTerms.map((entry) => entry.id),
  ]
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) errors.push(`duplicate common-model id: ${id}`)
    seen.add(id)
  }

  for (const entry of mcsCommonModelQuestions) {
    if (entry.answeredBy.length === 0) errors.push(`${entry.id}: no observation answers it`)
    if (entry.conceptIds.length === 0) errors.push(`${entry.id}: no concept ids`)
  }
  for (const level of mcsCausalLadder) {
    if (!level.whatItCannotEstablish.trim()) {
      errors.push(`${level.id}: a causal level must state what it cannot establish`)
    }
    if (level.liveSignalLabels.length === 0) errors.push(`${level.id}: no live signals`)
  }
  for (const line of mcsFlowAccount) {
    if (!line.howItMisleads.trim()) errors.push(`${line.id}: no misleading case stated`)
    if (!line.valueTypeStatement.trim()) errors.push(`${line.id}: no value-type statement`)
  }
  for (const term of mcsFirstUseTerms) {
    if (!term.clinicalQuestion.trim()) errors.push(`${term.id}: no clinical question`)
    if (!term.howItMisleads.trim()) errors.push(`${term.id}: no misleading case stated`)
  }

  return errors
}

const commonModelErrors = validateCommonModel()
if (commonModelErrors.length > 0) {
  throw new Error(`Invalid MCS common model:\n- ${commonModelErrors.join('\n- ')}`)
}
