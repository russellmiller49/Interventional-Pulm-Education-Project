import { criticalCareMeasurementClarificationById } from '@/features/critical-care/content/measurementClarifications'
import { criticalCareSourceConflictById } from '@/features/critical-care/content/sourceConflicts'

import type { McsSupportMechanismClass } from './commonModel'
import { mcsSourceById } from './sources'

/**
 * One card schema, used identically for every support pathway this module names.
 *
 * The point of a single schema is comparability. When each device gets its own bespoke summary,
 * the fields that differ between devices are exactly the fields that get dropped — and those are
 * the ones a learner needs: where blood enters, where it returns, which chamber is relieved,
 * which one inherits the burden, and what the displayed flow is a flow *of*. Every field below is
 * required, and `validateMcsSupportPathways` fails the import if one is missing, so a new pathway
 * cannot be added as a thinner card than the pathways it will be compared against.
 *
 * Product-specific reference flows appear only in `productReferences`, after all of the reasoning
 * fields, each carrying its own measurand — never as a headline number and never as a target.
 */

/** Whether the pathway is interactive here or named only for comparison. */
export type McsPathwayAvailability = 'simulated-in-this-module' | 'comparison-only'

/** Temporary and durable support are different decisions, not two settings of one decision. */
export type McsPathwaySupportRole = 'temporary' | 'durable'

/** What kind of quantity a displayed flow is — or that there is no displayed flow at all. */
export type McsDisplayedFlowValueType = 'measured' | 'estimated' | 'no-device-flow-reported'

export interface McsPathwayConstraints {
  readonly afterload: string
  readonly position: string
  readonly rhythm: string
  readonly obstruction: string
}

export interface McsPathwayLowFlowDifferential {
  /** Causes that live in the patient. */
  readonly patient: string
  /** Causes that live in where the inlet or outlet is sitting. */
  readonly position: string
  /** Causes that live in the device or its circuit. */
  readonly device: string
}

export interface McsPathwayGasExchange {
  readonly provides: boolean
  readonly statement: string
}

export interface McsPathwayDisplayedFlow {
  readonly valueType: McsDisplayedFlowValueType
  readonly statement: string
  /** Whether this pathway's number may be added to another stream, and why not when it may not. */
  readonly additivity: string
}

export interface McsProductFlowReference {
  readonly id: string
  readonly productName: string
  readonly valueText: string
  /** What is being measured. A flow figure without this is uninterpretable. */
  readonly measurand: string
  readonly condition: string
  readonly evidenceIds: readonly string[]
}

export interface McsSupportPathwayCard {
  readonly id: string
  readonly displayName: string
  readonly shortName: string
  readonly availability: McsPathwayAvailability
  /** Where the learner can work with this pathway interactively, when it is not simulated here. */
  readonly comparisonNote?: string

  // ── The required reasoning fields, in the order a learner should read them ──
  readonly bloodEntersFrom: string
  readonly bloodReturnsTo: string
  readonly mechanism: string
  readonly mechanismClass: McsSupportMechanismClass
  readonly flowPattern: string
  readonly chamberPrimarilyUnloaded: string
  readonly chamberOrBedPotentiallyLoaded: string
  readonly preloadRequirements: string
  readonly constraints: McsPathwayConstraints
  readonly gasExchange: McsPathwayGasExchange
  readonly displayedFlow: McsPathwayDisplayedFlow
  readonly lowFlowDifferential: McsPathwayLowFlowDifferential
  readonly firstUnsafeReflex: string
  readonly supportRole: McsPathwaySupportRole
  readonly bridgeExitBoundary: string

  // ── Product numbers, only after everything above ──
  readonly productReferences: readonly McsProductFlowReference[]
  /** Rendered with the product numbers wherever they appear. */
  readonly productReferenceBoundary: string
  /** Authored records that must render alongside this card's numbers, if it has any. */
  readonly measurementClarificationIds: readonly string[]
  readonly sourceConflictIds: readonly string[]

  readonly sourceIds: readonly string[]
  readonly conceptIds: readonly string[]
  readonly reviewStatus: 'draft' | 'sme-review' | 'released'
}

/** The single sentence that travels with every product flow figure in this module. */
export const MCS_PRODUCT_FLOW_BOUNDARY =
  'A product reference flow is a specification for the device, not a treatment target for the patient. It is what the pump can do under stated conditions, not what this patient is receiving, and no part of this module asks a learner to drive a number toward it.'

const NO_PRODUCT_FLOW_BOUNDARY =
  'This pathway publishes no product flow figure here, because it reports no device flow of its own.'

export const mcsSupportPathwayCards: readonly McsSupportPathwayCard[] = Object.freeze([
  {
    id: 'iabp-counterpulsation',
    displayName: 'Intra-aortic balloon pump',
    shortName: 'IABP',
    availability: 'simulated-in-this-module',
    bloodEntersFrom:
      'Nothing. No blood enters the balloon. It sits inside the descending thoracic aorta and displaces blood that is already there.',
    bloodReturnsTo:
      'Nothing. The balloon returns no blood to the circulation. It moves aortic blood within the aorta by taking up and giving back space.',
    mechanism:
      'Counterpulsation. Helium inflates the balloon in diastole, after the aortic valve closes, raising diastolic aortic pressure; it deflates immediately before the next systole, lowering the pressure the left ventricle has to open against.',
    mechanismClass: 'timing-and-pressure',
    flowPattern:
      'Entirely native and pulsatile. The balloon adds no stream of its own — it redistributes pressure within a cardiac cycle the patient is still generating.',
    chamberPrimarilyUnloaded:
      'The left ventricle, indirectly: by lowering the aortic pressure present at the start of ejection, not by removing blood from the chamber.',
    chamberOrBedPotentiallyLoaded:
      'The left ventricle itself, when the timing is off. Inflation before aortic-valve closure raises the impedance to ejection, and deflation that comes late means the next ejection begins against an inflated balloon.',
    preloadRequirements:
      'Requires a native ejection to work on. Counterpulsation scales with the beat it is timed to, so profoundly limited native output limits what perfect timing can achieve.',
    constraints: {
      afterload:
        'The effect is itself a change in afterload. In a low-resistance, vasoplegic circulation there is less diastolic pressure to augment and less afterload to remove.',
      position:
        'The balloon belongs in the descending thoracic aorta with its cranial tip distal to the left subclavian artery and its caudal end above the renal arteries. Migration threatens those branches.',
      rhythm:
        'Timing depends on a reliable trigger. Irregular rhythm degrades trigger reliability, and tachycardia shortens the diastolic window the balloon is trying to occupy.',
      obstruction:
        'Significant aortic insufficiency sends augmented diastolic pressure back into the left ventricle rather than forwards into the circulation.',
    },
    gasExchange: {
      provides: false,
      statement:
        'None. Counterpulsation does not touch gas exchange. A patient whose limiting problem is oxygenation or carbon dioxide clearance is not helped by better timing.',
    },
    displayedFlow: {
      valueType: 'no-device-flow-reported',
      statement:
        'The console reports augmented and assisted pressures, trigger, timing, and assist ratio. It reports no device flow, because the balloon moves no blood along a pathway of its own.',
      additivity:
        'There is nothing to add. Any improvement in forward flow is native flow responding to changed loading, and it belongs on the native line of the flow account.',
    },
    lowFlowDifferential: {
      patient:
        'Limited native ejection, tachycardia or irregular rhythm shortening diastole, low systemic resistance leaving little to augment, aortic insufficiency, or a right-sided problem limiting left-heart filling.',
      position:
        'Balloon migration away from the descending thoracic aorta, or a size relationship to the aorta that limits displacement.',
      device:
        'Inflation or deflation mistimed against the cardiac cycle, an unreliable trigger source for the current rhythm, an assist ratio below 1:1, or a helium-system problem.',
    },
    firstUnsafeReflex:
      'Reading a well-augmented arterial trace as proof of adequate forward flow — stopping at the pressure level of the causal ladder and reporting the answer as though it came from the organ level.',
    supportRole: 'temporary',
    bridgeExitBoundary:
      'A temporary measure held while the limiting problem is treated or while a decision about escalation is made. It has no implant pathway and no destination role, so the exit question is which of recovery, escalation, or a different pathway is being waited for.',
    productReferences: [],
    productReferenceBoundary: NO_PRODUCT_FLOW_BOUNDARY,
    measurementClarificationIds: [],
    sourceConflictIds: [],
    sourceIds: [
      'master-hemodynamics-reference',
      'mcs-bedside-reference-supplied',
      'ishlt-hfsa-acute-mcs-2023',
      'getinge-iabp-current',
      'getinge-iabp-placement-training',
    ],
    conceptIds: [
      'cc.device.source-active-component-destination',
      'cc.device.native-device-effective-flow',
      'cc.flow.pressure-gradient',
    ],
    reviewStatus: 'sme-review',
  },
  {
    id: 'impella-left-transvalvular',
    displayName: 'Left-sided microaxial pump (Impella CP / 5.5 concept)',
    shortName: 'Left Impella',
    availability: 'simulated-in-this-module',
    bloodEntersFrom:
      'The left ventricle, through an inlet sitting below the aortic valve inside the chamber.',
    bloodReturnsTo: 'The ascending aorta, through an outlet sitting above the aortic valve.',
    mechanism:
      'A microaxial pump positioned across the aortic valve moves blood continuously from the left ventricle into the aorta, independently of whether the native ventricle ejects on any given beat.',
    mechanismClass: 'direct-blood-pump',
    flowPattern:
      'Continuous. As pump flow rises, less volume leaves through the native aortic valve, so arterial pulsatility falls — a fall in pulsatility here is a sign of successful unloading, not of deterioration.',
    chamberPrimarilyUnloaded:
      'The left ventricle, directly, by removing volume from it. This shows in left ventricular volume, in left-sided filling pressure, and in reduced native aortic-valve opening.',
    chamberOrBedPotentiallyLoaded:
      'The right ventricle inherits the whole requirement: a left-sided pump can only move blood the right heart has already delivered through the lungs. The aorta receives the returned flow, so the pump ejects against systemic pressure.',
    preloadRequirements:
      'Depends on adequate left ventricular filling, which depends on right ventricular delivery through the pulmonary circulation. An unfilled ventricle cannot supply the pump regardless of the performance level selected.',
    constraints: {
      afterload:
        'Flow falls as the pressure gradient across the pump rises. Raising systemic resistance lowers delivered flow at an unchanged performance level, which is a property of the pump rather than a fault.',
      position:
        'The inlet must sit in the ventricle and the outlet in the aorta. Too deep or too shallow reduces effective support and raises blood-trauma risk; position is confirmed by imaging and the placement signal, not assumed.',
      rhythm:
        'Continuous flow needs no trigger, but arrhythmia changes ventricular filling and therefore changes what the pump has available to move.',
      obstruction:
        'An underfilled or restricted ventricle produces suction, which limits flow and damages blood. Aortic valve pathology and mechanical valves are device-selection questions before they are settings questions.',
    },
    gasExchange: {
      provides: false,
      statement:
        'None. The pump moves blood the lungs have already oxygenated. A patient limited by gas exchange is not helped by moving that blood faster.',
    },
    displayedFlow: {
      valueType: 'estimated',
      statement:
        'An algorithmic estimate derived from pump behaviour and assumed loading conditions, not a reading from a flow probe in the blood. It describes blood moved from ventricle to aorta.',
      additivity:
        'Partly additive with native output, and only to the extent the native ventricle is still ejecting forward. Regurgitation across an incompetent aortic valve returns some of the pumped volume to the ventricle it came from, so it is counted out of effective systemic flow.',
    },
    lowFlowDifferential: {
      patient:
        'Hypovolaemia, right ventricular failure limiting left-heart filling, tamponade, arrhythmia, or a rise in systemic vascular resistance.',
      position:
        'Inlet or outlet displaced across the aortic valve — too deep into the ventricle or withdrawn toward the aorta — changing what the pump is drawing from and returning to.',
      device:
        'A purge-system abnormality, a hemolysis or suspected-thrombus pattern, a performance level lower than intended, or a controller problem.',
    },
    firstUnsafeReflex:
      'Raising the performance level because the displayed flow is low, when the low flow is caused by inadequate filling — escalating through suction rather than correcting what is limiting it.',
    supportRole: 'temporary',
    bridgeExitBoundary:
      'Temporary support that carries an exit question from the moment it starts: recovery, escalation to a pathway that also supports the right heart or gas exchange, durable support, or transplant evaluation. Duration of support is itself a selection criterion, not an afterthought.',
    productReferences: [
      {
        id: 'mcs.pathway.impella-cp.maximum-mean-flow',
        productName: 'Impella CP with SmartAssist',
        valueText: '3.7 L/min',
        measurand: 'Maximum mean flow',
        condition: 'Device specification for this labeling revision',
        evidenceIds: ['fda-impella-cp-labeling', 'jnj-impella-cp-current'],
      },
      {
        id: 'mcs.pathway.impella-cp.peak-systolic-flow',
        productName: 'Impella CP with SmartAssist',
        valueText: 'Up to 4.3 L/min',
        measurand: 'Peak flow rate at systole',
        condition: 'At performance level P-9; explicitly not a maximum mean flow',
        evidenceIds: ['fda-impella-cp-labeling', 'jnj-impella-cp-current'],
      },
      {
        id: 'mcs.pathway.impella-cp.observed-average-flow',
        productName: 'Impella CP with SmartAssist',
        valueText: '3.8 ± 0.6 L/min',
        measurand: 'Average flow observed during support',
        condition:
          'Reported in the supporting clinical evidence; an observation in a studied population, not a device specification',
        evidenceIds: ['fda-impella-cp-labeling'],
      },
      {
        id: 'mcs.pathway.impella-55.maximum-flow',
        productName: 'Impella 5.5 with SmartAssist',
        valueText: '5.5 L/min',
        measurand: 'Product-reported maximum flow',
        condition: 'Device specification for this labeling revision; not a guaranteed patient flow',
        evidenceIds: ['fda-impella-55-labeling', 'jnj-impella-55-current'],
      },
    ],
    productReferenceBoundary: MCS_PRODUCT_FLOW_BOUNDARY,
    measurementClarificationIds: ['clarification.mcs.impella-cp-flow-measurands'],
    sourceConflictIds: ['conflict.mcs.impella-cp-textbook-flow'],
    sourceIds: [
      'master-hemodynamics-reference',
      'mcs-bedside-reference-supplied',
      'ishlt-hfsa-acute-mcs-2023',
      'fda-impella-cp-labeling',
      'jnj-impella-cp-current',
      'impella-cp-smartassist-insertion',
      'fda-impella-55-labeling',
      'jnj-impella-55-current',
    ],
    conceptIds: [
      'cc.device.source-active-component-destination',
      'cc.device.preload-afterload-dependence',
      'cc.measurement.measurand',
    ],
    reviewStatus: 'sme-review',
  },
  {
    id: 'impella-right-caval-to-pa',
    displayName: 'Right-sided microaxial pump (Impella RP concept)',
    shortName: 'Right Impella',
    availability: 'simulated-in-this-module',
    bloodEntersFrom: 'The inferior vena cava and right atrium, through a venous inlet.',
    bloodReturnsTo: 'The pulmonary artery, through an outlet beyond the pulmonic valve.',
    mechanism:
      'A microaxial pump crossing the tricuspid and pulmonic valves moves systemic venous blood from a caval or atrial inlet directly into the pulmonary artery, bypassing the right ventricle rather than assisting it.',
    mechanismClass: 'direct-blood-pump',
    flowPattern:
      'Continuous, and confined to the right side of the circulation. Nothing this pump moves has reached the systemic circulation yet.',
    chamberPrimarilyUnloaded:
      'The right ventricle, directly, by taking systemic venous return past it. Right atrial pressure is the signal that answers here.',
    chamberOrBedPotentiallyLoaded:
      'The pulmonary vascular bed, and through it the left heart. Delivering more blood into a pulmonary circulation that a failing left ventricle cannot accept raises left-sided filling pressure and can produce pulmonary congestion.',
    preloadRequirements:
      'Depends on adequate systemic venous return reaching the caval inlet. A hypovolaemic patient starves this pump from the inflow side.',
    constraints: {
      afterload:
        'Pulmonary vascular resistance is the load this pump ejects against. A high pulmonary load limits delivery at an unchanged setting.',
      position:
        'The inlet belongs in the inferior vena cava or right atrium and the outlet in the pulmonary artery. An inlet too high, an outlet too proximal, or a device too distal all change what is being drawn from and delivered to.',
      rhythm:
        'Continuous flow needs no trigger, but rhythm still governs the right-sided filling this pump draws on and the left-sided handling of what it delivers.',
      obstruction:
        'Suction at an underfilled caval inlet limits flow. Pulmonary embolism or other obstruction between the outlet and the left heart limits what the delivered blood can do.',
    },
    gasExchange: {
      provides: false,
      statement:
        'None. It delivers venous blood to the pulmonary artery so that the patient’s own lungs can oxygenate it. That is a delivery pathway *to* gas exchange, not gas exchange — if the lungs cannot oxygenate, this pathway does not fix it.',
    },
    displayedFlow: {
      valueType: 'estimated',
      statement:
        'An algorithmic estimate of blood delivered into the pulmonary artery. It is a pulmonary delivery, not a systemic flow, and it has not yet travelled through the lungs or the left heart.',
      additivity:
        'Never add this to a left-sided pump flow. The two pumps are serial: this pump delivers blood into the lungs, the left pump moves that same blood onward after it returns. Adding them counts one stream twice and can double the apparent support.',
    },
    lowFlowDifferential: {
      patient:
        'Hypovolaemia or inadequate venous return, a rise in pulmonary vascular resistance, or a left heart unable to accept what is being delivered.',
      position:
        'Inlet or outlet displaced from the caval-to-pulmonary-artery relationship the pump depends on.',
      device: 'A purge-system abnormality, a pressure-sensor problem, or a controller problem.',
    },
    firstUnsafeReflex:
      'Adding the right-sided flow to the left-sided flow and reporting the total as systemic support, then escalating on the basis of a number that describes one stream counted twice.',
    supportRole: 'temporary',
    bridgeExitBoundary:
      'Temporary right-sided support, most often paired with left-sided support or with a plan for the pulmonary problem underneath it. Its exit question is whether the right ventricle is recovering or whether the strategy needs to change.',
    productReferences: [
      {
        id: 'mcs.pathway.impella-rp.product-flow',
        productName: 'Impella RP',
        valueText: 'Up to 4.0 L/min',
        measurand: 'Product-framed flow',
        condition:
          'Product information framing for the device family; delivered flow remains loading-dependent',
        evidenceIds: ['fda-impella-rp-labeling', 'jnj-impella-rp-current'],
      },
    ],
    productReferenceBoundary: MCS_PRODUCT_FLOW_BOUNDARY,
    measurementClarificationIds: [],
    sourceConflictIds: [],
    sourceIds: [
      'mcs-bedside-reference-supplied',
      'ishlt-hfsa-acute-mcs-2023',
      'fda-impella-rp-labeling',
      'jnj-impella-rp-current',
    ],
    conceptIds: [
      'cc.flow.rv-lv-coupling',
      'cc.device.native-device-effective-flow',
      'cc.device.source-active-component-destination',
    ],
    reviewStatus: 'sme-review',
  },
  {
    id: 'durable-continuous-flow-lvad',
    displayName: 'Durable continuous-flow LVAD',
    shortName: 'Durable LVAD',
    availability: 'simulated-in-this-module',
    bloodEntersFrom: 'The left ventricle, through an inflow cannula implanted at the apex.',
    bloodReturnsTo: 'The ascending aorta, through an implanted outflow graft.',
    mechanism:
      'An implanted continuous-flow pump moves blood from the left ventricular apex to the ascending aorta at a set speed, taking over most of the left ventricle’s ejection work.',
    mechanismClass: 'direct-blood-pump',
    flowPattern:
      'Continuous, with pulsatility contributed by whatever the native ventricle still does. The aortic valve may open only intermittently or not at all, which is an expected state rather than a fault.',
    chamberPrimarilyUnloaded:
      'The left ventricle, directly and continuously, by removing volume at the apex.',
    chamberOrBedPotentiallyLoaded:
      'The right ventricle, which must now deliver enough blood through the lungs to fill a pump that never stops asking. Unloading the left ventricle also shifts the septum, which changes right ventricular geometry and can worsen its function.',
    preloadRequirements:
      'Depends on continuous, adequate right ventricular output and on volume status. This is the single most important dependency of a left-sided durable pump, and it is why right ventricular evaluation precedes implantation.',
    constraints: {
      afterload:
        'Flow falls as aortic pressure rises at a fixed speed. Uncontrolled hypertension is a flow problem, not only a blood-pressure problem.',
      position:
        'The inflow cannula orientation is fixed at implantation and is not adjustable at the bedside. Malposition or septal contact is an imaging and surgical question, not a settings question.',
      rhythm:
        'Continuous flow tolerates arrhythmia better than a native circulation does, but sustained ventricular arrhythmia still degrades filling and is not benign.',
      obstruction:
        'Pump thrombosis, inflow or outflow graft obstruction, and suction events all reduce delivered flow and change the relationship between power, speed, and flow.',
    },
    gasExchange: {
      provides: false,
      statement:
        'None. This is a circulatory pump. Gas exchange remains entirely the patient’s own lungs.',
    },
    displayedFlow: {
      valueType: 'estimated',
      statement:
        'Derived from pump power and speed against an assumed blood viscosity, not measured in the bloodstream. The estimate becomes least reliable in exactly the states that disturb the power–flow relationship, such as a suspected thrombus.',
      additivity:
        'Partly additive with whatever the native ventricle still ejects, minus any volume returning through an incompetent aortic valve. Because the estimate and the native contribution are both uncertain, the sum is an argument rather than an arithmetic result.',
    },
    lowFlowDifferential: {
      patient:
        'Hypovolaemia, right ventricular failure, tamponade, hypertension, arrhythmia, and aortic insufficiency — several of which are opposite loading states producing the same low number.',
      position:
        'Inflow cannula malposition or ventricular suction pulling the septum or free wall against the inlet.',
      device:
        'Pump thrombosis with a rising power signature, outflow graft obstruction, a controller fault, or an interrupted power path.',
    },
    firstUnsafeReflex:
      'Changing pump speed in response to a displayed number. Speed is prescribed, and a change belongs to the responsible team working from current instructions — the low-flow differential has to be worked through first.',
    supportRole: 'durable',
    bridgeExitBoundary:
      'Durable support is a different decision from temporary support, not a longer version of it. Candidacy evaluation, implantation, anticoagulation, driveline care, and an agreed strategy — bridge to transplant, bridge to candidacy, or destination therapy — are settled before implantation. A patient arriving in the intensive-care unit with a durable pump already carries that strategy with them.',
    productReferences: [],
    productReferenceBoundary:
      'Speed and flow ranges for a durable pump are prescribed per patient by the implanting programme. This module publishes no reference flow for it, because a number without that patient’s prescription is not usable.',
    measurementClarificationIds: [],
    sourceConflictIds: [],
    sourceIds: [
      'ishlt-durable-mcs-2023',
      'fda-heartmate3-ifu',
      'fda-heartmate3-pma-current',
      'mcs-bedside-reference-supplied',
    ],
    conceptIds: [
      'cc.device.selected-vs-delivered-support',
      'cc.measurement.measured-estimated-inferred',
      'cc.flow.rv-lv-coupling',
    ],
    reviewStatus: 'sme-review',
  },
  {
    id: 'vv-ecmo-comparison',
    displayName: 'Venovenous ECMO',
    shortName: 'VV ECMO',
    availability: 'comparison-only',
    comparisonNote:
      'Named here so its pathway can be compared against the circulatory devices. The interactive circuit, console, and troubleshooting live in the CARDIOHELP module.',
    bloodEntersFrom:
      'The systemic venous circulation, through a drainage cannula in a central vein or the right atrium.',
    bloodReturnsTo:
      'The systemic venous circulation, near the right atrium — the same side of the heart it was drained from.',
    mechanism:
      'An extracorporeal circuit draws venous blood out of the body, passes it through a membrane lung that adds oxygen and removes carbon dioxide, and returns it to the venous side. The heart then circulates the conditioned blood.',
    mechanismClass: 'extracorporeal-circuit',
    flowPattern:
      'Continuous through the circuit. Systemic flow remains whatever the native heart ejects — the circuit changes what the blood contains, not how much of it moves around the body.',
    chamberPrimarilyUnloaded:
      'No chamber. Venovenous support changes the content of the blood the right heart receives, not the volume of work it does.',
    chamberOrBedPotentiallyLoaded:
      'None directly. Correcting hypoxaemia and hypercapnia may lower pulmonary vascular resistance and so help the right ventricle, but that is a downstream consequence of gas exchange rather than added flow.',
    preloadRequirements:
      'Depends on adequate venous volume for drainage. Hypovolaemia is felt immediately at the drainage cannula as inadequate flow and chatter.',
    constraints: {
      afterload:
        'The relevant load is circuit and membrane resistance rather than a patient afterload, since the circuit returns to a low-pressure venous compartment.',
      position:
        'Drainage and return openings must be far enough apart. When they are not, oxygenated return blood is drawn straight back into the drainage cannula — recirculation, which raises drainage saturation while systemic oxygenation falls.',
      rhythm:
        'The circuit does not depend on rhythm, but the native heart still has to move the conditioned blood, so rhythm governs whether the patient benefits from it.',
      obstruction:
        'Inadequate drainage, cannula obstruction, and membrane-lung failure each limit the circuit; none of them is a circulatory problem.',
    },
    gasExchange: {
      provides: true,
      statement:
        'Yes, and it is the whole point of the pathway. This is the only entry in this set whose primary product is gas exchange rather than flow.',
    },
    displayedFlow: {
      valueType: 'measured',
      statement:
        'Circuit flow is measured on the circuit itself. It reports blood passing through the membrane lung — not blood added to the systemic circulation.',
      additivity:
        'Not additive with cardiac output at all. Venovenous support adds no systemic flow, so a rising circuit flow can never be reported as rising circulatory support. Part of the circuit flow may not even reach the patient’s tissues, if it is recirculating.',
    },
    lowFlowDifferential: {
      patient: 'Hypovolaemia, raised intrathoracic pressure, or a change in venous return.',
      position:
        'Drainage cannula position, and the separation between drainage and return, which governs recirculation.',
      device: 'Circuit or cannula obstruction, pump problems, or membrane-lung deterioration.',
    },
    firstUnsafeReflex:
      'Treating circuit flow as circulatory support, and expecting a higher venovenous flow to fix a low cardiac output or a low blood pressure.',
    supportRole: 'temporary',
    bridgeExitBoundary:
      'Temporary support for a lung problem, held to recovery, to transplantation, or to a decision that neither is achievable. It does not become durable support by continuing.',
    productReferences: [],
    productReferenceBoundary:
      'Circuit flows are set per patient against the oxygen requirement and the drainage available. This module publishes no reference figure for a comparison pathway.',
    measurementClarificationIds: [],
    sourceConflictIds: [],
    sourceIds: ['elso-vv-ecmo-guideline', 'mcs-bedside-reference-supplied'],
    conceptIds: [
      'cc.membrane.gas-exchange',
      'cc.circuit.recirculation',
      'cc.device.native-device-effective-flow',
    ],
    reviewStatus: 'sme-review',
  },
  {
    id: 'va-ecmo-comparison',
    displayName: 'Venoarterial ECMO',
    shortName: 'VA ECMO',
    availability: 'comparison-only',
    comparisonNote:
      'Named here so its pathway can be compared against the circulatory devices. The interactive circuit, console, and troubleshooting live in the CARDIOHELP module.',
    bloodEntersFrom:
      'The systemic venous circulation, through a drainage cannula in a central vein or the right atrium.',
    bloodReturnsTo:
      'A systemic artery — retrograde up the aorta from a peripheral arterial cannula, or directly into the aorta when cannulated centrally.',
    mechanism:
      'An extracorporeal circuit drains systemic venous blood, oxygenates it and removes carbon dioxide through a membrane lung, and returns it to the arterial side. It is the only pathway here that supplies both gas exchange and systemic flow.',
    mechanismClass: 'extracorporeal-circuit',
    flowPattern:
      'Continuous, and in a peripheral configuration it runs opposite to native ejection. The two streams meet somewhere in the aorta, and where they meet moves as the balance between them changes.',
    chamberPrimarilyUnloaded:
      'The right ventricle, by draining systemic venous return before it arrives. The left ventricle is not unloaded by this pathway.',
    chamberOrBedPotentiallyLoaded:
      'The left ventricle. Retrograde arterial return raises the pressure the left ventricle must open against, and a ventricle that cannot open the aortic valve distends — which is why left ventricular unloading is a separate question that VA support raises rather than answers.',
    preloadRequirements:
      'Depends on adequate venous volume for drainage, the same inflow dependency as any drainage circuit.',
    constraints: {
      afterload:
        'The circuit returns against systemic arterial pressure, and that same return pressure is the afterload the native left ventricle meets. Raising circuit flow raises both.',
      position:
        'Drainage and arterial return positions determine which territories each stream perfuses. A recovering heart ejecting poorly oxygenated blood while the circuit supplies well-oxygenated blood from below produces differential hypoxaemia, seen as a right-arm-versus-lower-body saturation difference.',
      rhythm:
        'The circuit runs without a rhythm, but rhythm and native ejection determine whether the ventricle can open against the return.',
      obstruction:
        'Drainage insufficiency, cannula or circuit obstruction, and membrane-lung failure limit the circuit; arterial cannula sizing and limb perfusion are their own problems.',
    },
    gasExchange: {
      provides: true,
      statement:
        'Yes, alongside systemic flow. Both are supplied by the same circuit, which is what makes this pathway different in kind from the pumps above.',
    },
    displayedFlow: {
      valueType: 'measured',
      statement:
        'Circuit flow is measured on the circuit. Unlike the venovenous configuration, this flow really is a systemic contribution — it enters the arterial circulation.',
      additivity:
        'Not simply additive with native output. Two streams meeting in the aorta from opposite directions do not sum to a single number; their balance sets the watershed between them, and each perfuses a different territory. Where the native heart is ejecting poorly oxygenated blood, adding the two also averages away a difference that matters.',
    },
    lowFlowDifferential: {
      patient: 'Hypovolaemia, raised intrathoracic pressure, or tamponade limiting drainage.',
      position: 'Drainage cannula position and adequacy; arterial cannula position and sizing.',
      device: 'Circuit obstruction, pump problems, or membrane-lung deterioration.',
    },
    firstUnsafeReflex:
      'Raising circuit flow to lift a low output without asking whether the left ventricle can still eject against the return, and so trading a flow number for a distending ventricle.',
    supportRole: 'temporary',
    bridgeExitBoundary:
      'Temporary support held to recovery, to a durable device, to transplantation, or to a decision that none of those is achievable. The exit strategy is agreed early because the pathway itself imposes a time limit.',
    productReferences: [],
    productReferenceBoundary:
      'Circuit flows are set per patient against the perfusion requirement and the drainage available. This module publishes no reference figure for a comparison pathway.',
    measurementClarificationIds: [],
    sourceConflictIds: [],
    sourceIds: ['elso-va-ecmo-guideline', 'mcs-bedside-reference-supplied'],
    conceptIds: [
      'cc.device.native-device-effective-flow',
      'cc.membrane.gas-exchange',
      'cc.device.patient-device-coupling',
    ],
    reviewStatus: 'sme-review',
  },
  {
    id: 'ra-to-pa-temporary-rv-support',
    displayName: 'Temporary right-sided support, right atrium to pulmonary artery',
    shortName: 'RA → PA',
    availability: 'comparison-only',
    comparisonNote:
      'Named as a comparison pathway when diagnosing right-ventricle-limited flow through a left-sided device. Insertion, cannulation, and operational controls are out of scope for this release.',
    bloodEntersFrom: 'The right atrium, through a drainage cannula.',
    bloodReturnsTo: 'The pulmonary artery.',
    mechanism:
      'An external centrifugal pump carries blood from the right atrium to the pulmonary artery, bypassing the failing right ventricle. An oxygenator can be placed in the circuit, which changes what the pathway is for.',
    mechanismClass: 'extracorporeal-circuit',
    flowPattern:
      'Continuous, and confined to the right side. Like any right-sided pathway, what it moves has not reached the systemic circulation yet.',
    chamberPrimarilyUnloaded: 'The right ventricle, by taking venous return past it.',
    chamberOrBedPotentiallyLoaded:
      'The pulmonary vascular bed, and through it the left heart, which now has to accept everything the pump delivers.',
    preloadRequirements: 'Depends on adequate systemic venous return reaching the atrial drainage.',
    constraints: {
      afterload: 'Pulmonary vascular resistance is the load, as for any pulmonary-artery return.',
      position:
        'Drainage in the right atrium and return in the pulmonary artery. A dual-lumen configuration puts both relationships on one cannula, so a single position change disturbs both.',
      rhythm:
        'The pump runs without a rhythm, but rhythm governs right-sided filling and left-sided handling.',
      obstruction:
        'Drainage insufficiency at the atrial inlet, circuit obstruction, and pulmonary obstruction downstream of the return.',
    },
    gasExchange: {
      provides: false,
      statement:
        'Not inherently — the pathway moves blood to the lungs so they can do the exchanging. Adding an oxygenator to the circuit changes the answer, and changes what the pathway is being used for.',
    },
    displayedFlow: {
      valueType: 'measured',
      statement:
        'Circuit flow is measured on the circuit. It describes blood delivered into the pulmonary artery, which is a pulmonary delivery rather than a systemic flow.',
      additivity:
        'Never add this to a left-sided device flow. As with any right-then-left arrangement, the two pumps handle the same blood in sequence, so summing them counts one stream twice.',
    },
    lowFlowDifferential: {
      patient:
        'Hypovolaemia or inadequate venous return, raised pulmonary vascular resistance, or a left heart that cannot accept the delivery.',
      position: 'Drainage or return position, particularly in a dual-lumen configuration.',
      device: 'Circuit obstruction, pump problems, or oxygenator deterioration when one is in use.',
    },
    firstUnsafeReflex:
      'Adding the right-sided circuit flow to a left-sided device flow and calling the total systemic support.',
    supportRole: 'temporary',
    bridgeExitBoundary:
      'Temporary support for a failing right ventricle, held to recovery, to a change of strategy, or to a decision about durable support or transplantation.',
    productReferences: [],
    productReferenceBoundary:
      'Circuit flows are set per patient. This module publishes no reference figure for a comparison pathway.',
    measurementClarificationIds: [],
    sourceConflictIds: [],
    sourceIds: ['ishlt-hfsa-acute-mcs-2023', 'mcs-bedside-reference-supplied'],
    conceptIds: [
      'cc.flow.rv-lv-coupling',
      'cc.device.source-active-component-destination',
      'cc.device.native-device-effective-flow',
    ],
    reviewStatus: 'sme-review',
  },
  {
    id: 'la-to-arterial-transseptal-support',
    displayName: 'Transseptal left-atrial support, left atrium to systemic artery',
    shortName: 'LA → arterial',
    availability: 'comparison-only',
    comparisonNote:
      'Named as a comparison pathway for left-sided unloading that does not cross the aortic valve. Insertion, cannulation, and operational controls are out of scope for this release.',
    bloodEntersFrom: 'The left atrium, through a cannula placed across the interatrial septum.',
    bloodReturnsTo: 'A systemic artery, most often the femoral artery.',
    mechanism:
      'An external centrifugal pump draws already-oxygenated blood from the left atrium and returns it to the systemic arterial circulation, unloading the left atrium and, behind it, the left ventricle.',
    mechanismClass: 'extracorporeal-circuit',
    flowPattern:
      'Continuous, entering the systemic arterial circulation. In a femoral return this runs retrograde against native ejection, as a peripheral venoarterial circuit does.',
    chamberPrimarilyUnloaded:
      'The left atrium directly, and the left ventricle indirectly by reducing the volume that reaches it.',
    chamberOrBedPotentiallyLoaded:
      'The left ventricle meets a raised arterial pressure it has to eject against, as with any arterial return. The interatrial septum also carries an iatrogenic communication for as long as the cannula crosses it.',
    preloadRequirements:
      'Depends on adequate left atrial filling, which requires the right ventricle to keep delivering blood through the lungs. A left-sided drainage pathway inherits the right heart just as a transvalvular pump does.',
    constraints: {
      afterload:
        'Arterial return pressure is both the load on the pump and the afterload the native left ventricle meets.',
      position:
        'The drainage cannula must remain across the septum in the left atrium. Displacement back into the right atrium turns a left-sided unloading pathway into a right-to-arterial shunt of deoxygenated blood.',
      rhythm: 'Rhythm governs left atrial filling and native ejection against the return.',
      obstruction:
        'Drainage insufficiency at the atrial cannula, circuit obstruction, and arterial cannula sizing and limb perfusion.',
    },
    gasExchange: {
      provides: false,
      statement:
        'None inherently. The blood drawn has already been oxygenated by the patient’s own lungs, so a lung that cannot oxygenate is not addressed by this pathway.',
    },
    displayedFlow: {
      valueType: 'measured',
      statement:
        'Circuit flow is measured on the circuit, and it is a genuine systemic contribution because the return is arterial.',
      additivity:
        'Not simply additive with native output. As with any arterial return, two streams meet in the aorta and the balance between them sets what each perfuses. Where the drainage cannula has slipped across the septum, part of the returned flow is deoxygenated and is not the support it appears to be.',
    },
    lowFlowDifferential: {
      patient:
        'Hypovolaemia, right ventricular failure limiting pulmonary transit and so left atrial filling, or tamponade.',
      position: 'Transseptal cannula displacement; arterial cannula position and sizing.',
      device: 'Circuit obstruction or pump problems.',
    },
    firstUnsafeReflex:
      'Reading a preserved circuit flow as preserved support without asking where the drainage cannula is sitting and whether the blood being returned is oxygenated.',
    supportRole: 'temporary',
    bridgeExitBoundary:
      'Temporary support held to recovery, to a durable device, or to transplantation. The transseptal communication is itself part of the exit plan.',
    productReferences: [],
    productReferenceBoundary:
      'Circuit flows are set per patient. This module publishes no reference figure for a comparison pathway.',
    measurementClarificationIds: [],
    sourceConflictIds: [],
    sourceIds: ['ishlt-hfsa-acute-mcs-2023', 'mcs-bedside-reference-supplied'],
    conceptIds: [
      'cc.device.source-active-component-destination',
      'cc.device.preload-afterload-dependence',
      'cc.flow.rv-lv-coupling',
    ],
    reviewStatus: 'sme-review',
  },
])

export const mcsSupportPathwayCardById: ReadonlyMap<string, McsSupportPathwayCard> = new Map(
  mcsSupportPathwayCards.map((card) => [card.id, card]),
)

export interface McsRequiredDistinction {
  readonly id: string
  /** The claim, stated as the learner should be able to state it. */
  readonly claim: string
  /** The confusion it exists to prevent. */
  readonly confusedWith: string
  /** Cards a learner should hold side by side to see it. */
  readonly pathwayIds: readonly string[]
  readonly conceptIds: readonly string[]
}

/**
 * Seven distinctions that must survive contact with a device track.
 *
 * These are the claims a learner most often gets wrong when they meet the products before the
 * pathways, so they are authored as first-class content rather than left implicit in card prose,
 * and each names the pathway cards that have to be read together to see it.
 */
export const mcsRequiredDistinctions: readonly McsRequiredDistinction[] = Object.freeze([
  {
    id: 'mcs.distinction.iabp-is-not-a-pump',
    claim:
      'The intra-aortic balloon pump changes timing and pressure. It is not a chamber-to-artery pump, and it reports no device flow because it moves no blood along a pathway of its own.',
    confusedWith:
      'Being read as a small pump, so that its augmented pressure trace is carried up the causal ladder and reported as added flow.',
    pathwayIds: ['iabp-counterpulsation', 'impella-left-transvalvular'],
    conceptIds: ['cc.device.native-device-effective-flow', 'cc.flow.pressure-gradient'],
  },
  {
    id: 'mcs.distinction.left-versus-right-microaxial',
    claim:
      'Left-sided and right-sided microaxial pumps support different pathways. The left pump runs from the left ventricle to the aorta; the right pump runs from the vena cava to the pulmonary artery. They relieve different chambers and load different beds.',
    confusedWith:
      'Being treated as one family of devices differing only in size, so that a right-sided pump is expected to raise systemic pressure.',
    pathwayIds: ['impella-left-transvalvular', 'impella-right-caval-to-pa'],
    conceptIds: ['cc.flow.rv-lv-coupling', 'cc.device.source-active-component-destination'],
  },
  {
    id: 'mcs.distinction.serial-pumps-are-not-additive',
    claim:
      'A right-sided and a left-sided pump running together are serial. The right pump delivers blood into the lungs, and the left pump moves that same blood onward after it returns. Their displayed flows describe one stream measured in two places and must never be added.',
    confusedWith:
      'Adding the two displayed numbers into a single support figure, which counts the same blood twice and can double the apparent support.',
    pathwayIds: ['impella-right-caval-to-pa', 'impella-left-transvalvular'],
    conceptIds: ['cc.device.native-device-effective-flow', 'cc.perfusion.cardiac-output'],
  },
  {
    id: 'mcs.distinction.durable-is-not-more-temporary',
    claim:
      'A durable left ventricular assist device is not simply more temporary support. Candidacy evaluation, implantation, anticoagulation, driveline care, monitoring, and an agreed exit strategy are all different, and they are settled before implantation rather than during support.',
    confusedWith:
      'Being placed at the far end of a single escalation ladder, as though a temporary pump running long enough becomes a durable one.',
    pathwayIds: ['durable-continuous-flow-lvad', 'impella-left-transvalvular'],
    conceptIds: ['cc.device.selected-vs-delivered-support'],
  },
  {
    id: 'mcs.distinction.vv-ecmo-adds-no-systemic-flow',
    claim:
      'Venovenous ECMO supports gas exchange. It drains from and returns to the venous side, so it adds no systemic circulatory flow — the patient’s own heart still has to move the blood.',
    confusedWith:
      'Reading circuit flow as circulatory support, and expecting a higher venovenous flow to fix a low cardiac output.',
    pathwayIds: ['vv-ecmo-comparison', 'va-ecmo-comparison'],
    conceptIds: ['cc.membrane.gas-exchange', 'cc.device.native-device-effective-flow'],
  },
  {
    id: 'mcs.distinction.va-ecmo-loads-the-lv',
    claim:
      'Venoarterial ECMO adds extracorporeal systemic flow and gas exchange together, and the arterial return raises the pressure the left ventricle must eject against. It can distend a ventricle that cannot open the aortic valve, which is why left ventricular unloading is a separate question it raises rather than answers.',
    confusedWith:
      'Being treated as the maximal form of support with no cost, so that raising circuit flow is read as unambiguously better.',
    pathwayIds: ['va-ecmo-comparison', 'impella-left-transvalvular'],
    conceptIds: ['cc.device.patient-device-coupling', 'cc.flow.pressure-gradient'],
  },
  {
    id: 'mcs.distinction.insertion-direction-is-not-flow-direction',
    claim:
      'The direction a cannula or catheter was advanced is not the direction blood flows through it. A left-sided pump advanced retrograde up the aorta moves blood from the ventricle out to the aorta, and a peripheral arterial cannula inserted upward returns blood that then travels retrograde down the aorta.',
    confusedWith:
      'Inferring the flow path from the insertion approach, which reverses the source and destination and therefore reverses the whole pathway.',
    pathwayIds: ['impella-left-transvalvular', 'va-ecmo-comparison', 'impella-right-caval-to-pa'],
    conceptIds: [
      'cc.device.source-active-component-destination',
      'cc.device.normal-patient-device-state',
    ],
  },
])

/** The pathways that are interactive in this module, in the order the device tracks meet them. */
export const mcsSimulatedPathwayCards = mcsSupportPathwayCards.filter(
  (card) => card.availability === 'simulated-in-this-module',
)

/** The pathways named only for comparison. */
export const mcsComparisonPathwayCards = mcsSupportPathwayCards.filter(
  (card) => card.availability === 'comparison-only',
)

export function validateMcsSupportPathways(
  cards: readonly McsSupportPathwayCard[] = mcsSupportPathwayCards,
): readonly string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const card of cards) {
    if (seen.has(card.id)) errors.push(`duplicate pathway card id: ${card.id}`)
    seen.add(card.id)

    // Every card answers every question. A thinner card is not comparable, and a card that is not
    // comparable is worse than no card at all.
    const requiredText: readonly (readonly [string, string])[] = [
      ['bloodEntersFrom', card.bloodEntersFrom],
      ['bloodReturnsTo', card.bloodReturnsTo],
      ['mechanism', card.mechanism],
      ['flowPattern', card.flowPattern],
      ['chamberPrimarilyUnloaded', card.chamberPrimarilyUnloaded],
      ['chamberOrBedPotentiallyLoaded', card.chamberOrBedPotentiallyLoaded],
      ['preloadRequirements', card.preloadRequirements],
      ['constraints.afterload', card.constraints.afterload],
      ['constraints.position', card.constraints.position],
      ['constraints.rhythm', card.constraints.rhythm],
      ['constraints.obstruction', card.constraints.obstruction],
      ['gasExchange.statement', card.gasExchange.statement],
      ['displayedFlow.statement', card.displayedFlow.statement],
      ['displayedFlow.additivity', card.displayedFlow.additivity],
      ['lowFlowDifferential.patient', card.lowFlowDifferential.patient],
      ['lowFlowDifferential.position', card.lowFlowDifferential.position],
      ['lowFlowDifferential.device', card.lowFlowDifferential.device],
      ['firstUnsafeReflex', card.firstUnsafeReflex],
      ['bridgeExitBoundary', card.bridgeExitBoundary],
      ['productReferenceBoundary', card.productReferenceBoundary],
    ]
    for (const [field, value] of requiredText) {
      if (!value.trim()) errors.push(`${card.id}: missing ${field}`)
    }

    if (card.sourceIds.length === 0) errors.push(`${card.id}: no source ids`)
    for (const sourceId of card.sourceIds) {
      if (!mcsSourceById.has(sourceId)) errors.push(`${card.id}: unknown source id ${sourceId}`)
    }
    if (card.conceptIds.length === 0) errors.push(`${card.id}: no concept ids`)

    // A pathway that reports no device flow cannot publish a product flow figure for it.
    if (
      card.displayedFlow.valueType === 'no-device-flow-reported' &&
      card.productReferences.length > 0
    ) {
      errors.push(`${card.id}: reports no device flow but publishes a product flow figure`)
    }
    for (const reference of card.productReferences) {
      if (!reference.measurand.trim()) {
        errors.push(`${card.id}: product reference ${reference.id} names no measurand`)
      }
      if (!reference.condition.trim()) {
        errors.push(`${card.id}: product reference ${reference.id} states no condition`)
      }
      if (reference.evidenceIds.length === 0) {
        errors.push(`${card.id}: product reference ${reference.id} has no evidence ids`)
      }
    }
    if (
      card.productReferences.length > 0 &&
      card.productReferenceBoundary !== MCS_PRODUCT_FLOW_BOUNDARY
    ) {
      errors.push(`${card.id}: publishes product figures without the shared not-a-target boundary`)
    }

    for (const clarificationId of card.measurementClarificationIds) {
      if (!criticalCareMeasurementClarificationById.has(clarificationId)) {
        errors.push(`${card.id}: unknown measurement clarification ${clarificationId}`)
      }
    }
    for (const conflictId of card.sourceConflictIds) {
      if (!criticalCareSourceConflictById.has(conflictId)) {
        errors.push(`${card.id}: unknown source conflict ${conflictId}`)
      }
    }
    if (card.availability === 'comparison-only' && !card.comparisonNote?.trim()) {
      errors.push(`${card.id}: a comparison pathway must say where it is actually taught`)
    }
  }

  const cardIds = new Set(cards.map((card) => card.id))
  for (const distinction of mcsRequiredDistinctions) {
    if (distinction.pathwayIds.length < 2) {
      errors.push(`${distinction.id}: a distinction needs at least two pathways to hold apart`)
    }
    for (const pathwayId of distinction.pathwayIds) {
      if (!cardIds.has(pathwayId)) {
        errors.push(`${distinction.id}: unknown pathway id ${pathwayId}`)
      }
    }
  }

  return errors
}

const pathwayErrors = validateMcsSupportPathways()
if (pathwayErrors.length > 0) {
  throw new Error(`Invalid MCS support pathway cards:\n- ${pathwayErrors.join('\n- ')}`)
}
