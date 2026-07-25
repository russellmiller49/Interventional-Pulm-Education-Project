import type {
  ScenarioExpertTraceStep,
  ScenarioFeedback,
} from '@/features/learning-module/scenarioFeedback'

import type { HemodynamicCaseDefinition, HemodynamicInterventionDefinition } from '../engine'

export interface HemodynamicTeachingArtifact {
  readonly caseId: string
  readonly expertTrace: readonly ScenarioExpertTraceStep[]
  readonly conceptIds: readonly string[]
}

const traceStep = (
  id: string,
  moment: string,
  cue: string,
  reasoning: string,
  commitment: string,
): ScenarioExpertTraceStep => ({ id, moment, cue, reasoning, commitment })

export const hemodynamicTeachingArtifacts: readonly HemodynamicTeachingArtifact[] = [
  {
    caseId: 'HD-01',
    expertTrace: [
      traceStep(
        'hd01-orient',
        'Orient',
        'Narrow pulse pressure, low filling pressures, cool extremities, and acute volume loss.',
        'The pattern suggests low effective preload, but a static pressure cannot establish responsiveness.',
        'Probe the model with a reversible preload perturbation before giving fluid.',
      ),
      traceStep(
        'hd01-perturb',
        'Perturb',
        'Flow rises during passive leg raise without a new congestion signal.',
        'The directional change supports preload responsiveness more strongly than the baseline RAP or PAWP.',
        'Use one bounded volume step, then stop and reassess.',
      ),
      traceStep(
        'hd01-reassess',
        'Reassess',
        'Cardiac output and pressure move together after the intervention.',
        'A useful response is convergent across flow, pressure, and bedside perfusion—not a single display.',
        'Continue only while benefit remains visible and congestion remains absent.',
      ),
    ],
    conceptIds: [
      'cc.measurement.trends-and-perturbations',
      'cc.flow.venous-return',
      'cc.troubleshooting.reassess-convergent-signals',
    ],
  },
  {
    caseId: 'HD-02',
    expertTrace: [
      traceStep(
        'hd02-orient',
        'Orient',
        'Warm extremities, a bounding pulse, and low diastolic pressure coexist with preserved flow.',
        'The pressure-flow combination localizes the dominant problem to vascular tone rather than pump output alone.',
        'Confirm the signal and look for conditional evidence of preload responsiveness.',
      ),
      traceStep(
        'hd02-act',
        'Commit',
        'Hypotension persists without a strong dynamic flow response.',
        'More volume is unlikely to fix the dominant loss of vascular tone and may add burden.',
        'Use the modeled vascular-tone tier while watching flow and perfusion.',
      ),
      traceStep(
        'hd02-reassess',
        'Reassess',
        'MAP rises, but the patient-level perfusion picture remains the endpoint.',
        'Pressure recovery is useful only when forward flow and organ-level signs remain coherent.',
        'Recheck pressure, flow, and the simulated bedside together.',
      ),
    ],
    conceptIds: [
      'cc.flow.resistance-and-impedance',
      'cc.perfusion.cardiac-output',
      'cc.perfusion.macro-micro-coherence',
    ],
  },
  {
    caseId: 'HD-03',
    expertTrace: [
      traceStep(
        'hd03-orient',
        'Orient',
        'Low cardiac index and pulmonary congestion coexist with high filling pressure.',
        'The circulation has insufficient forward flow despite abundant upstream pressure.',
        'Treat congestion and pump performance as linked but distinct problems.',
      ),
      traceStep(
        'hd03-act',
        'Commit',
        'The flow signal is low while PAWP is already elevated.',
        'Additional volume cannot be inferred to improve flow and can worsen pulmonary congestion.',
        'Use a bounded flow-support tier and begin decongestion.',
      ),
      traceStep(
        'hd03-reassess',
        'Reassess',
        'Flow rises while filling pressure trends downward.',
        'The paired response supports the working model better than either number alone.',
        'Check systemic pressure and simulated perfusion before carrying the model forward.',
      ),
    ],
    conceptIds: [
      'cc.perfusion.cardiac-output',
      'cc.flow.pressure-gradient',
      'cc.troubleshooting.reassess-convergent-signals',
    ],
  },
  {
    caseId: 'HD-04',
    expertTrace: [
      traceStep(
        'hd04-orient',
        'Orient',
        'RAP and PAP are high, PAWP is relatively low, and systemic flow is falling.',
        'The pressure pattern and hypoxemia localize the load to the right ventricle and pulmonary circulation.',
        'Avoid actions that further reduce venous return or increase RV impedance.',
      ),
      traceStep(
        'hd04-bridge',
        'Bridge',
        'The RV is pressure loaded while systemic pressure is fragile.',
        'Selective pulmonary vasodilation can model temporary afterload relief without solving the obstruction.',
        'Use the selective bridge and activate the case-specific definitive pathway.',
      ),
      traceStep(
        'hd04-reassess',
        'Reassess',
        'PAP falls and forward flow begins to recover after a delay.',
        'A delayed paired pressure-flow response is consistent with relief of the obstructive load.',
        'Reassess oxygenation and systemic perfusion rather than chasing PAP alone.',
      ),
    ],
    conceptIds: [
      'cc.flow.rv-lv-coupling',
      'cc.flow.venous-return',
      'cc.device.preload-afterload-dependence',
    ],
  },
  {
    caseId: 'HD-05',
    expertTrace: [
      traceStep(
        'hd05-orient',
        'Orient',
        'High PAP and RAP, low output, and PAWP at or below the pre-capillary boundary.',
        'The dominant load is pulmonary vascular, with secondary right-heart failure.',
        'Preserve systemic pressure while testing selective RV afterload relief.',
      ),
      traceStep(
        'hd05-act',
        'Commit',
        'Systemic pressure is vulnerable to nonselective vasodilation.',
        'A selective pulmonary effect changes RV load with less modeled systemic vasodilation.',
        'Use the selective tier before adding bounded inotropic support.',
      ),
      traceStep(
        'hd05-reassess',
        'Reassess',
        'Flow and RAP change after RV load and contractility are addressed.',
        'The direction of multiple signals matters more than merely crossing a diagnostic threshold.',
        'Recheck systemic pressure, output, and right-sided congestion together.',
      ),
    ],
    conceptIds: [
      'cc.flow.resistance-and-impedance',
      'cc.flow.rv-lv-coupling',
      'cc.perfusion.cardiac-output',
    ],
  },
  {
    caseId: 'HD-06',
    expertTrace: [
      traceStep(
        'hd06-orient',
        'Orient',
        'RAP and PAWP are high in an intubated patient receiving substantial PEEP.',
        'Measured intravascular pressure includes transmitted surrounding pressure as well as vascular loading.',
        'Read filling pressure and ventilator context together.',
      ),
      traceStep(
        'hd06-act',
        'Commit',
        'Congestion and reduced flow coexist without evidence that more volume will help.',
        'A small respiratory-context adjustment can alter both true loading and the displayed pressure.',
        'Begin decongestion and try one bounded PEEP reduction after respiratory review.',
      ),
      traceStep(
        'hd06-reassess',
        'Reassess',
        'Filling pressure, flow, and oxygenation respond on different timescales.',
        'The hemodynamic response cannot be interpreted without ensuring respiratory support remains acceptable.',
        'Reassess oxygenation, recruitment, flow, and congestion together.',
      ),
    ],
    conceptIds: [
      'cc.flow.transmural-pressure',
      'cc.flow.venous-return',
      'cc.troubleshooting.reassess-convergent-signals',
    ],
  },
  {
    caseId: 'HD-07',
    expertTrace: [
      traceStep(
        'hd07-orient',
        'Orient',
        'Diastolic filling pressures converge while pulse pressure and flow fall.',
        'The pattern suggests a shared external constraint rather than isolated ventricular failure.',
        'Seek urgent clinical confirmation and avoid increasing intrathoracic pressure.',
      ),
      traceStep(
        'hd07-escalate',
        'Commit',
        'The circulation remains constrained despite compensatory vascular tone.',
        'Normalizing a pressure cannot remove the mechanical constraint.',
        'Activate the modeled definitive escalation pathway.',
      ),
      traceStep(
        'hd07-reassess',
        'Reassess',
        'Constraint falls and biventricular filling and flow begin to recover.',
        'The coordinated change supports the mechanism, while real diagnosis still requires bedside imaging.',
        'Recheck flow, pressure, and simulated bedside perfusion.',
      ),
    ],
    conceptIds: [
      'cc.flow.transmural-pressure',
      'cc.flow.rv-lv-coupling',
      'cc.perfusion.cardiac-output',
    ],
  },
  {
    caseId: 'HD-08',
    expertTrace: [
      traceStep(
        'hd08-orient',
        'Orient',
        'Displayed pressures, catheter morphology, and thermodilution curves disagree with a stable bedside picture.',
        'Internal inconsistency makes signal validity the first problem; physiology cannot yet be inferred from the numbers.',
        'Pause treatment decisions and localize the measurement chain.',
      ),
      traceStep(
        'hd08-localize',
        'Localize',
        'The transducer is off level, dynamic response is abnormal, and the catheter is not in a confirmed PA position.',
        'Independent faults can compound, so fixing one display value does not validate the system.',
        'Restore level and zero, classify dynamic response, then restore catheter position.',
      ),
      traceStep(
        'hd08-remeasure',
        'Remeasure',
        'A valid waveform returns before a standardized thermodilution series is accepted.',
        'A repeat measurement becomes interpretable only after the chain producing it is valid.',
        'Acquire internally consistent curves, then reconnect the number to the patient.',
      ),
    ],
    conceptIds: [
      'cc.measurement.reference-and-zero',
      'cc.measurement.signal-validity',
      'cc.troubleshooting.measurement-sensor',
      'cc.troubleshooting.localize-before-intervene',
    ],
  },
]

export const hemodynamicTeachingArtifactByCaseId = new Map(
  hemodynamicTeachingArtifacts.map((artifact) => [artifact.caseId, artifact]),
)

const baseFeedbackByActionId: Readonly<Record<string, ScenarioFeedback>> = {
  'passive-leg-raise': {
    whatHappened:
      'A reversible preload challenge began, allowing the modeled flow response to emerge before a lasting volume change.',
    whyItHappened:
      'Passive leg raise transiently recruits venous blood. The directional change in stroke volume or output tests the current circulation rather than relying on one filling pressure.',
    likelyFrame:
      'If you were using low RAP or PAWP as proof that fluid would help, that is understandable because those values describe filling pressure—but not responsiveness.',
    theCue: 'Watch the flow trend during the perturbation and whether congestion signals change.',
    conceptIds: ['cc.measurement.trends-and-perturbations', 'cc.flow.venous-return'],
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  'fluid-250': {
    whatHappened:
      'The modeled volume compartment increased gradually; pressure, flow, and congestion can now move in different directions.',
    whyItHappened:
      'A volume step increases stressed venous volume, but forward-flow benefit depends on the patient-device state and ventricular response.',
    likelyFrame:
      'If you were responding to hypotension or a low filling pressure, that is a familiar cue—but neither establishes that additional volume will improve effective flow.',
    theCue:
      'The prior dynamic response and the paired change in output and congestion distinguish benefit from burden.',
    conceptIds: [
      'cc.flow.venous-return',
      'cc.measurement.trends-and-perturbations',
      'cc.troubleshooting.reassess-convergent-signals',
    ],
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  'norepinephrine-up': {
    whatHappened:
      'Systemic vascular tone rose over several model seconds; pressure changed according to both resistance and flow.',
    whyItHappened:
      'Arterial pressure reflects the interaction of effective flow, vascular resistance, and compliance. A vascular-tone change does not guarantee improved perfusion.',
    likelyFrame:
      'If you were treating the low MAP directly, that is a reasonable first signal to notice; the mechanism still determines whether pressure and flow improve together.',
    theCue:
      'Compare the diastolic-pressure pattern, cardiac output, and simulated perfusion after the change.',
    conceptIds: ['cc.flow.resistance-and-impedance', 'cc.perfusion.macro-micro-coherence'],
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  'vasopressin-add': {
    whatHappened:
      'A second modeled vascular-tone effect raised resistance without directly repairing a low-flow mechanism.',
    whyItHappened:
      'The adjunct changes vascular tone; the resulting pressure depends on the circulation still producing effective forward flow.',
    likelyFrame:
      'If persistent hypotension led you to add another tone-support tier, that is coherent when vasodilation remains dominant.',
    theCue: 'Confirm that flow and bedside perfusion do not deteriorate as pressure rises.',
    conceptIds: ['cc.flow.resistance-and-impedance', 'cc.perfusion.cardiac-output'],
    evidenceIds: ['ssc-sepsis-2026', 'icu-hemodynamics-model-v1'],
  },
  'dobutamine-up': {
    whatHappened:
      'Modeled ventricular contractility and forward flow rose, with a smaller concurrent change in vascular tone and rate.',
    whyItHappened:
      'The educational tier adds inotropic effect, so its usefulness depends on pump limitation and the pressure context.',
    likelyFrame:
      'If you were responding to a low cardiac index, that cue fits—but low flow can also arise from inadequate preload or excessive afterload.',
    theCue:
      'Use the filling-pressure pattern and the paired MAP response to distinguish those mechanisms.',
    conceptIds: ['cc.perfusion.cardiac-output', 'cc.flow.rv-lv-coupling'],
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  'milrinone-up': {
    whatHappened:
      'Modeled contractility rose while pulmonary and systemic vascular resistance fell.',
    whyItHappened:
      'The combined inotropic and vasodilating effects can improve RV flow while also making systemic pressure more vulnerable.',
    likelyFrame:
      'If the high pulmonary pressure suggested RV afterload as the target, that is a reasonable frame; systemic reserve decides whether a nonselective effect is tolerated.',
    theCue:
      'Watch cardiac output and MAP together rather than treating PAP as an isolated endpoint.',
    conceptIds: ['cc.flow.rv-lv-coupling', 'cc.flow.resistance-and-impedance'],
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  'diuresis-step': {
    whatHappened:
      'Modeled filling volume and right- and left-sided filling pressures began to fall gradually.',
    whyItHappened:
      'Decongestion reduces upstream pressure, while forward flow depends on whether the circulation was volume burdened or preload limited.',
    likelyFrame:
      'If a high filling pressure led you directly to decongestion, that is understandable; surrounding pressure and signal validity still shape what that number means.',
    theCue: 'Follow output, pressure, and congestion together as the delayed effect appears.',
    conceptIds: ['cc.flow.transmural-pressure', 'cc.troubleshooting.reassess-convergent-signals'],
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  'systemic-pulmonary-vasodilator': {
    whatHappened: 'Pulmonary resistance fell, but systemic vascular tone and MAP also declined.',
    whyItHappened:
      'A nonselective vasodilating effect changes both sides of the circulation, so RV afterload relief can trade against systemic perfusion pressure.',
    likelyFrame:
      'If the high PAP made pulmonary vasodilation feel directly targeted, that is reasonable; delivery selectivity is the missing distinction.',
    theCue:
      'The simultaneous MAP decline distinguishes a systemic from a selective pulmonary effect.',
    conceptIds: ['cc.flow.resistance-and-impedance', 'cc.flow.rv-lv-coupling'],
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  'inhaled-pulmonary-vasodilator': {
    whatHappened:
      'Modeled pulmonary resistance fell with little direct systemic vasodilation, allowing RV flow to respond.',
    whyItHappened:
      'The model treats the inhaled tier as a selective bridge that reduces RV afterload without resolving the underlying cause.',
    likelyFrame:
      'If the pulmonary pressure itself drew your attention, that is reasonable; the useful target is the RV load-flow relationship, not normalization of PAP in isolation.',
    theCue:
      'Look for paired improvement in RV loading and systemic flow while definitive treatment remains pending.',
    conceptIds: ['cc.flow.rv-lv-coupling', 'cc.device.preload-afterload-dependence'],
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  'peep-down': {
    whatHappened:
      'Pleural-pressure transmission and modeled RV impedance fell after the bounded PEEP change.',
    whyItHappened:
      'Intrathoracic pressure changes transmural loading, venous return, and the pressure reported inside thoracic vessels.',
    likelyFrame:
      'If the high measured filling pressure looked like pure volume burden, that is reasonable; part of it may be surrounding-pressure transmission.',
    theCue:
      'Reassess oxygenation and recruitment alongside flow and filling pressure after the change.',
    conceptIds: ['cc.flow.transmural-pressure', 'cc.flow.venous-return'],
    evidenceIds: ['pac-derived-part-2-2021', 'icu-hemodynamics-model-v1'],
  },
  'peep-up-unsafe': {
    whatHappened:
      'The action was stopped before the model applied it. The scenario remains at the pre-action state so you can choose again.',
    whyItHappened:
      'In this phenotype, an unsupported rise in intrathoracic pressure can reduce venous return and worsen RV output when the circulation is already unstable.',
    likelyFrame:
      'If hypoxemia or a low pressure made another ventilator adjustment feel urgent, that is reasonable—but this case provides no respiratory indication for the increase.',
    theCue:
      'The combination of fragile flow, RV load, and absent respiratory indication marks this as a hard interrupt.',
    conceptIds: ['cc.flow.transmural-pressure', 'cc.flow.venous-return', 'cc.flow.rv-lv-coupling'],
    evidenceIds: ['pac-derived-part-2-2021', 'icu-hemodynamics-model-v1'],
  },
  'pe-reperfusion': {
    whatHappened:
      'The modeled obstructive load began to resolve after a delay; PAP and RV loading then moved toward recovery.',
    whyItHappened:
      'Definitive relief changes the pulmonary vascular load rather than only supporting the failing RV around it.',
    likelyFrame:
      'If supportive RV treatment felt safer than committing to cause-specific therapy, that is understandable; a bridge cannot remove the obstructive load.',
    theCue:
      'The delayed paired fall in RV load and rise in effective flow distinguishes cause treatment from a temporary bridge.',
    conceptIds: ['cc.flow.rv-lv-coupling', 'cc.flow.resistance-and-impedance'],
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  'pericardial-drainage': {
    whatHappened:
      'Modeled pericardial constraint fell and biventricular filling and forward flow began to recover.',
    whyItHappened:
      'Removing the shared external constraint restores the transmural pressure available for both ventricles to fill.',
    likelyFrame:
      'If pressure support or volume seemed like the fastest response to hypotension, that is understandable; neither removes the shared external constraint.',
    theCue:
      'Coordinated separation of filling pressures with a rising pulse pressure and output supports the mechanism.',
    conceptIds: ['cc.flow.transmural-pressure', 'cc.flow.rv-lv-coupling'],
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  'correct-measurement-system': {
    whatHappened:
      'The pressure chain was re-leveled and re-zeroed, and its modeled dynamic response returned to a usable range.',
    whyItHappened:
      'Hydrostatic offset and poor dynamic response distort the displayed pressure independently of the patient.',
    likelyFrame:
      'If the precise monitor values initially felt trustworthy, that is reasonable; precision does not establish signal validity.',
    theCue:
      'The off-level transducer and abnormal fast-flush release distinguish measurement error from physiology.',
    conceptIds: ['cc.measurement.reference-and-zero', 'cc.measurement.signal-validity'],
    evidenceIds: ['arterial-pressure-five-step-2020', 'monitor-workflow-supplied'],
  },
  'reposition-catheter': {
    whatHappened:
      'The catheter returned to a confirmed PA position and a pulsatile PA morphology reappeared.',
    whyItHappened:
      'Catheter position determines the pressure compartment and waveform being measured; wall contact or false wedge invalidates the interpretation.',
    likelyFrame:
      'If the displayed PAWP looked like a direct filling-pressure measurement, that is reasonable until morphology and position contradict it.',
    theCue:
      'The waveform shape and position state do not agree with a valid occlusion measurement.',
    conceptIds: ['cc.measurement.measurand', 'cc.troubleshooting.access-position'],
    evidenceIds: ['pac-waveforms-part-1-2021', 'monitor-workflow-supplied'],
  },
  'repeat-valid-thermodilution': {
    whatHappened:
      'The system was prepared for a standardized thermodilution series after the pressure and catheter checks.',
    whyItHappened:
      'Averaging cannot repair invalid technique or a faulty measurement chain; repeatability becomes meaningful only after validity.',
    likelyFrame:
      'If repeating the cardiac output immediately seemed like the fastest confirmation, that is reasonable—but it would reproduce the same unresolved sources of error.',
    theCue:
      'Curve quality, consistency, catheter position, and signal validation must converge before acceptance.',
    conceptIds: ['cc.measurement.signal-validity', 'cc.measurement.measured-estimated-inferred'],
    evidenceIds: ['pac-derived-part-2-2021', 'monitor-workflow-supplied'],
  },
}

export function feedbackForHemodynamicAction(
  definition: HemodynamicCaseDefinition,
  intervention: HemodynamicInterventionDefinition,
  hardInterrupt: boolean,
): ScenarioFeedback {
  const authored = baseFeedbackByActionId[intervention.id]
  if (!authored) {
    throw new Error(`Missing five-part hemodynamics feedback for ${intervention.id}`)
  }

  if (hardInterrupt) return authored
  if (!definition.unsafeInterventionIds.includes(intervention.id)) return authored

  return {
    ...authored,
    whyItHappened: `${authored.whyItHappened} In ${definition.shortTitle}, the current cue pattern makes that tradeoff especially unfavorable.`,
    likelyFrame:
      authored.likelyFrame ??
      'If you were responding to the most abnormal displayed value, that is a reasonable starting frame; the rest of the cue pattern suggests another mechanism.',
  }
}

export function feedbackTimingForHemodynamicAction(
  intervention: HemodynamicInterventionDefinition,
  hardInterrupt: boolean,
): 'immediate' | 'after-consequence' {
  if (hardInterrupt || intervention.category === 'assessment') return 'immediate'
  return 'after-consequence'
}
