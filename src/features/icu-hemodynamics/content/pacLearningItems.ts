import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import type { PacGuidedSkillId } from './pacGuidedSkills'

const placementEvidence = [
  'pac-waveforms-part-1-2021',
  'monitor-workflow-supplied',
  'cvp-measurement-2017',
]
const pressureEvidence = ['arterial-pressure-five-step-2020', 'monitor-workflow-supplied']
const measurementEvidence = [
  'pac-derived-part-2-2021',
  'master-hemodynamics-reference',
  'papi-rvmi-2012',
  'cpo-acute-cardiac-2007',
  'ppv-sepsis-2000',
  'pa-compliance-outcomes-2026',
]
const waveformEvidence = ['pac-waveforms-part-1-2021', 'clinical-hemodynamics-waveforms']

function item(input: unknown): ClinicalLearningItem {
  return clinicalLearningItemSchema.parse(input)
}

export const pacGuidedLearningItems: Readonly<
  Record<
    PacGuidedSkillId,
    {
      prediction: ClinicalLearningItem
      transfer: ClinicalLearningItem
      /**
       * An optional commitment made *before* the section's reasoning is revealed. H0/H1 added one
       * for `pressure-system`: the validity sequence is only worth teaching if the learner has to
       * commit to what each step does and does not license.
       */
      validityCommitment?: ClinicalLearningItem
    }
  >
> = {
  'pressure-system': {
    validityCommitment: item({
      id: 'pac-pressure-validity-commit-1',
      activityId: 'hemodynamics:learn:pressure-system',
      phase: 'recognize',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'pac-pressure-system-validity-sequence',
      visualAssetIds: ['fast-flush-trace'],
      stem: 'A pulmonary-artery tracing is handed to you. The transducer is level and zeroed, the circuit and stopcocks are intact, and the scale fits the signal — but the fast-flush release rings for several beats before settling. The displayed mean pressure looks entirely plausible for this patient. What is the most defensible reading of this signal?',
      choices: [
        {
          id: 'mean-only-withhold-systolic',
          label:
            'Read the mean with caution, and withhold systolic, diastolic, and pulse pressure until the ringing is resolved.',
          rationale:
            'A resonating system exaggerates rapid pressure change, so systolic reads high and diastolic reads low while the mean stays relatively preserved.',
          plausibility: 'best',
        },
        {
          id: 'accept-because-earlier-steps-clean',
          label:
            'Accept the whole tracing, because level, zero, the circuit, and the scale were all confirmed.',
          rationale:
            'Those steps establish the reference, the fluid path, and the display. None of them describes how the system responds to rapid pressure change.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'report-widened-pulse-pressure',
          label:
            'Report a widened pulse pressure, since the systolic and diastolic separation is clearly visible.',
          rationale:
            'The separation is a property of the tubing rather than the circulation; resonance widens pulse pressure independently of the patient.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['mean-only-withhold-systolic'],
      explanation:
        'The sequence has an order for a reason. Level, zero, the fluid path, and the scale establish the reference, the connection, and the display; only the dynamic-response step describes whether rapid pressure change survives the journey. A plausible mean is the usual reason that step gets skipped.',
      evidenceIds: pressureEvidence,
      reviewStatus: 'sme-review',
    }),
    prediction: item({
      id: 'pac-pressure-predict-1',
      activityId: 'hemodynamics:learn:pressure-system',
      phase: 'predict',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'pac-pressure-system-initial',
      visualAssetIds: ['pressure-level-diagram', 'fast-flush-trace'],
      stem: 'The transducer is 10 cm above the phlebostatic axis, atmospheric zero has not been established, and the release trace oscillates repeatedly. Which interpretation best accounts for the measurement problem?',
      choices: [
        {
          id: 'level-zero-underdamped',
          label:
            'The system is off level, not zeroed, and underdamped; repair and verify each problem separately.',
          rationale:
            'The height causes a hydrostatic offset, zero establishes the reference, and persistent oscillation identifies an underdamped response.',
          plausibility: 'best',
        },
        {
          id: 'zero-only',
          label: 'Atmospheric zero alone will repair the height and the oscillatory response.',
          rationale:
            'Zero does not physically move the transducer or repair dynamic-response distortion.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'physiology-wide-pulse',
          label: 'The oscillations prove that the patient has a genuinely widened pulse pressure.',
          rationale:
            'A resonant monitoring system can exaggerate systolic pressure and pulse pressure independently of the patient.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['level-zero-underdamped'],
      explanation:
        'Level, atmospheric zero, and dynamic response are distinct checks. A plausible mean does not validate distorted systolic and diastolic morphology.',
      evidenceIds: pressureEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'pac-pressure-transfer-1',
      activityId: 'hemodynamics:learn:pressure-system',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'technical',
      clinicalContextId: 'pac-pressure-system-overdamped',
      visualAssetIds: ['pressure-level-diagram', 'fast-flush-trace'],
      transferVariantId: 'pressure-overdamped-after-reposition',
      stem: 'After a patient-position change, the transducer is 6 cm below the phlebostatic axis. The release trace returns slowly with almost no oscillation. What must be corrected before interpreting pulse pressure?',
      choices: [
        {
          id: 'relevel-and-overdamping',
          label: 'Re-level the transducer and restore the overdamped measurement response.',
          rationale:
            'The new height creates hydrostatic error and the sluggish response attenuates rapid pressure changes.',
          plausibility: 'best',
        },
        {
          id: 'relevel-only',
          label: 'Re-level only; morphology is reliable once the hydrostatic offset is removed.',
          rationale:
            'Leveling corrects the pressure offset but does not restore an overdamped waveform.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'accept-mean',
          label: 'Use the mean pressure because damping cannot affect clinical interpretation.',
          rationale:
            'Mean pressure may be less distorted than systolic pressure, but the signal still requires validation before use.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['relevel-and-overdamping'],
      explanation:
        'Position changes require re-leveling, and a sluggish fast-flush release requires measurement-system troubleshooting before waveform interpretation.',
      evidenceIds: pressureEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  'catheter-advancement': {
    prediction: item({
      id: 'pac-advance-predict-1',
      activityId: 'hemodynamics:learn:catheter-advancement',
      phase: 'predict',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'pac-advancement-pa-to-wedge-transition',
      visualAssetIds: ['pac-live-waveform', 'hemodynamic-heart-3d'],
      stem: 'After reviewing the full sequence, which change supports a true wedge tracing after brief balloon occlusion from a confirmed PA position?',
      choices: [
        {
          id: 'pa-to-true-wedge',
          label:
            'PA pulsatility and the dicrotic notch disappear, and a lower-pressure atrial waveform with delayed a and v waves appears.',
          rationale:
            'A true wedge replaces the PA contour with delayed atrial morphology sampled through the occluded pulmonary circulation.',
          plausibility: 'best',
        },
        {
          id: 'persistent-pa-pulsatility',
          label:
            'The pulmonary-artery systolic pulse and dicrotic notch remain fully visible after inflation.',
          rationale:
            'Persistent PA pulsatility means the distal branch is not completely occluded and the tracing is not a true wedge.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'overwedged-drift',
          label: 'The pressure drifts upward without identifiable a or v waves.',
          rationale:
            'Loss of recognizable atrial waves with upward drift suggests an over-wedged false tracing, not a valid PAWP.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['pa-to-true-wedge'],
      explanation:
        'The ordered waveform sequence is introducer → RA → RV → PA → PAWP. A true wedge has delayed atrial morphology at the existing PA depth; prompt deflation must restore the PA waveform.',
      evidenceIds: placementEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'pac-advance-transfer-1',
      activityId: 'hemodynamics:learn:catheter-advancement',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'technical',
      clinicalContextId: 'pac-advancement-pa-transfer',
      visualAssetIds: ['pac-live-waveform', 'hemodynamic-heart-3d'],
      transferVariantId: 'advance-from-ra-to-pa',
      stem: 'Starting from a confirmed RA tracing, the next stable waveform has a ventricular systolic contour and then changes to a pressure with sustained diastolic runoff and a dicrotic notch. What sequence was observed?',
      choices: [
        {
          id: 'ra-rv-pa',
          label: 'RA → RV → PA',
          rationale:
            'The ventricular contour identifies RV and the sustained diastolic pressure with notch identifies PA.',
          plausibility: 'best',
        },
        {
          id: 'ra-pa-rv',
          label: 'RA → PA → RV',
          rationale: 'This reverses the anatomic path and misidentifies the valve-closure notch.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'ra-wedge-pa',
          label: 'RA → wedge → PA',
          rationale:
            'A wedge trace is atrial in morphology and should not appear during ordinary forward advancement without transient occlusion.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['ra-rv-pa'],
      explanation:
        'Confirm each transition by the observed waveform rather than insertion depth alone.',
      evidenceIds: placementEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  'waveform-interpretation': {
    prediction: item({
      id: 'pac-waveform-predict-1',
      activityId: 'hemodynamics:learn:waveform-interpretation',
      phase: 'predict',
      itemType: 'mechanism-interpretation',
      contextRequirement: 'technical',
      clinicalContextId: 'pac-waveform-morphology',
      visualAssetIds: ['pac-waveform-recognition-drill'],
      stem: 'A right-sided tracing shows a broad systolic c-v wave with loss of the normal x descent. Which mechanism best explains the morphology?',
      choices: [
        {
          id: 'tricuspid-regurgitation',
          label: 'Systolic right-atrial filling from tricuspid regurgitation',
          rationale:
            'Regurgitant systolic flow produces a prominent c-v wave and blunts or reverses the x descent.',
          plausibility: 'best',
        },
        {
          id: 'tamponade',
          label: 'Pericardial constraint with a blunted y descent',
          rationale:
            'Tamponade classically alters the y descent rather than producing this systolic c-v morphology.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'mitral-regurgitation',
          label: 'A giant wedge v wave from mitral regurgitation',
          rationale:
            'That mechanism applies to a wedge/left-atrial tracing, not a confirmed right-atrial trace.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['tricuspid-regurgitation'],
      explanation:
        'Wave timing and chamber identity matter together; the same letter label does not imply the same valve lesion in every trace.',
      evidenceIds: waveformEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'pac-waveform-transfer-1',
      activityId: 'hemodynamics:learn:waveform-interpretation',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'technical',
      clinicalContextId: 'pac-waveform-transfer',
      visualAssetIds: ['pac-waveform-recognition-drill'],
      transferVariantId: 'waveform-atlas-new-sequence',
      stem: 'A new tracing has an atrial contour, but its a wave follows the QRS later than the right-atrial a wave and the v wave peaks after the T wave. Which signal is most consistent?',
      choices: [
        {
          id: 'wedge',
          label: 'Pulmonary artery occlusion (wedge) tracing',
          rationale:
            'The delayed atrial morphology reflects transmission from the left atrium through the pulmonary bed.',
          plausibility: 'best',
        },
        {
          id: 'right-atrium',
          label: 'Right-atrial tracing',
          rationale: 'The right-atrial a wave occurs earlier relative to the QRS complex.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'right-ventricle',
          label: 'Right-ventricular tracing',
          rationale:
            'A ventricular tracing has a steep systolic contour rather than delayed atrial waves.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['wedge'],
      explanation:
        'The delayed timing and atrial morphology help distinguish a wedge tracing from the right atrium.',
      evidenceIds: waveformEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  'pawp-capture': {
    prediction: item({
      id: 'pac-pawp-predict-1',
      activityId: 'hemodynamics:learn:pawp-capture',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'technical',
      clinicalContextId: 'pac-pawp-capture',
      visualAssetIds: ['pac-live-waveform', 'wedge-respiratory-cursor'],
      stem: 'From a confirmed PA position, a transient occlusion tracing has been sampled for one respiratory cycle. Which sequence produces the most interpretable and safest modeled PAWP?',
      choices: [
        {
          id: 'end-exp-store-deflate',
          label:
            'Place the cursor at end expiration, store the value, then deflate and confirm PA return.',
          rationale:
            'End expiration minimizes respiratory pressure contribution, and prompt deflation restores pulmonary blood flow and the PA waveform.',
          plausibility: 'best',
        },
        {
          id: 'mean-anywhere-deflate',
          label:
            'Store the respiratory mean, then deflate without checking the returning waveform.',
          rationale:
            'A respiratory mean can obscure the end-expiratory reference and omits confirmation of safe PA return.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'hold-longer',
          label: 'Keep the balloon inflated until the waveform becomes completely flat.',
          rationale:
            'Prolonged inflation is unsafe and a flat trace does not establish an interpretable occlusion pressure.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['end-exp-store-deflate'],
      explanation:
        'An interpretable PAWP requires a confirmed PA start, brief occlusion, end-expiratory sampling, prompt deflation, and return of the PA waveform.',
      evidenceIds: [...placementEvidence, 'edwards-swan-ganz-ifu-2023'],
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'pac-pawp-transfer-1',
      activityId: 'hemodynamics:learn:pawp-capture',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'pac-pawp-ventilated-transfer',
      visualAssetIds: ['pac-live-waveform', 'wedge-respiratory-cursor'],
      transferVariantId: 'pawp-higher-peep-respiratory-variation',
      stem: 'In a mechanically ventilated patient with greater respiratory pressure variation, the occlusion trace varies across the breath. Which sample and next action remain appropriate?',
      choices: [
        {
          id: 'end-exp-then-deflate',
          label: 'Use the end-expiratory point, then deflate and verify return of the PA waveform.',
          rationale:
            'The respiratory variation makes timing more important, not prolonged occlusion.',
          plausibility: 'best',
        },
        {
          id: 'highest-value',
          label:
            'Use the highest value because positive pressure always reveals the true filling pressure.',
          rationale:
            'The inspiratory maximum includes airway-pressure transmission and can overstate the vascular pressure of interest.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'average-and-hold',
          label: 'Average the whole breath and keep the balloon inflated for confirmation.',
          rationale: 'This loses the end-expiratory reference and adds avoidable occlusion time.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['end-exp-then-deflate'],
      explanation:
        'Interpret respiratory timing explicitly and close the safety loop by promptly restoring and confirming the PA waveform.',
      evidenceIds: [...placementEvidence, 'edwards-swan-ganz-ifu-2023'],
      reviewStatus: 'sme-review',
    }),
  },
  'thermodilution-series': {
    prediction: item({
      id: 'pac-td-predict-1',
      activityId: 'hemodynamics:learn:thermodilution-series',
      phase: 'predict',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'pac-thermodilution-series',
      visualAssetIds: ['thermodilution-curve-series'],
      stem: 'Three curves were generated with consistent injectate volume and timing. Two are smooth and similar; one has an irregular double peak after a prolonged injection. Which trials belong in the average?',
      choices: [
        {
          id: 'accept-two-repeat-one',
          label:
            'Accept the two technically valid curves and repeat the irregular prolonged-injection trial.',
          rationale:
            'Curve quality must be reviewed before averaging, and an invalid trial should be replaced rather than forced into agreement.',
          plausibility: 'best',
        },
        {
          id: 'average-all',
          label: 'Average all three because a larger sample automatically reduces technique error.',
          rationale:
            'Including a technically invalid curve can bias the result instead of reducing error.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'accept-highest',
          label:
            'Accept only the highest output because it is least affected by low-flow physiology.',
          rationale:
            'Choosing by desired value rather than curve quality introduces selection bias.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['accept-two-repeat-one'],
      explanation:
        'Standardize injection technique, inspect every temperature-time curve, and average an adequate set of technically valid accepted trials.',
      evidenceIds: measurementEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'pac-td-transfer-1',
      activityId: 'hemodynamics:learn:thermodilution-series',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'pac-thermodilution-low-flow-transfer',
      visualAssetIds: ['thermodilution-curve-series'],
      transferVariantId: 'thermodilution-low-flow-variable-technique',
      stem: 'A low-flow patient has two concordant valid curves and a third curve generated during inspiration with a slow, irregular injection. What is the best next step?',
      choices: [
        {
          id: 'reject-repeat-standardized',
          label:
            'Reject the poor curve and repeat with the configured volume, consistent timing, and respiratory phase.',
          rationale:
            'Technique and curve quality must be standardized before the value can be accepted.',
          plausibility: 'best',
        },
        {
          id: 'accept-because-low-flow',
          label: 'Accept it because low flow is expected to produce any curve shape.',
          rationale:
            'Low flow changes curve area but does not make a technically poor injection acceptable.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'discard-concordant',
          label: 'Discard the two concordant curves and retain the outlier as the new baseline.',
          rationale:
            'This privileges the least reliable trial without a technical or physiologic basis.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['reject-repeat-standardized'],
      explanation:
        'A questionable curve should be repeated with standardized technique; do not average technical error into false precision.',
      evidenceIds: measurementEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  'derived-hemodynamics': {
    prediction: item({
      id: 'pac-derived-predict-1',
      activityId: 'hemodynamics:learn:derived-hemodynamics',
      phase: 'predict',
      itemType: 'mechanism-interpretation',
      contextRequirement: 'technical',
      clinicalContextId: 'pac-derived-validity',
      visualAssetIds: ['derived-formula-panel'],
      stem: 'SVR is calculated from MAP, RAP, and cardiac output. The transducer is off level and atmospheric zero has not been established. How should the displayed SVR be interpreted?',
      choices: [
        {
          id: 'withhold-svr',
          label:
            'Withhold precise SVR interpretation until the invasive-pressure inputs are valid.',
          rationale: 'A derived value inherits the validity limits of every required input.',
          plausibility: 'best',
        },
        {
          id: 'use-map-only',
          label: 'Interpret SVR from MAP alone because RAP and flow contribute little.',
          rationale:
            'SVR is a pressure-gradient-to-flow relationship and cannot be established from MAP alone.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'assume-normal-flow',
          label: 'Substitute a normal cardiac output so the resistance can still be trended.',
          rationale: 'An assumed denominator produces a precise-looking but unsupported result.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['withhold-svr'],
      explanation:
        'Derived hemodynamics are not independent measurements; stale, missing, or invalid inputs make the result non-interpretable.',
      evidenceIds: measurementEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'pac-derived-transfer-1',
      activityId: 'hemodynamics:learn:derived-hemodynamics',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'pac-derived-ppv-transfer',
      visualAssetIds: ['derived-formula-panel'],
      transferVariantId: 'derived-ppv-irregular-rhythm',
      stem: 'A new patient has controlled ventilation but an irregular rhythm and visible spontaneous effort. The monitor can calculate PPV. Is the result interpretable in this context?',
      choices: [
        {
          id: 'ppv-not-interpretable',
          label:
            'No; irregular rhythm and spontaneous effort violate the modeled PPV validity conditions.',
          rationale:
            'PPV requires the relevant rhythm, ventilation, effort, waveform, and right-heart conditions to be satisfied.',
          plausibility: 'best',
        },
        {
          id: 'ppv-controlled-ventilation',
          label: 'Yes; controlled ventilation is the only condition that determines PPV validity.',
          rationale:
            'Ventilation is necessary but does not override irregular rhythm or spontaneous effort.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'ppv-number-valid',
          label: 'Yes; a calculated number is valid whenever it is displayed.',
          rationale:
            'Availability of a calculation does not establish physiologic interpretability.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['ppv-not-interpretable'],
      explanation:
        'Use the explicit validity screen rather than treating a computed value as self-validating.',
      evidenceIds: measurementEvidence,
      reviewStatus: 'sme-review',
    }),
  },
}
