import type { McsLessonDefinition } from '../engine/types'

export const mcsLessons: readonly McsLessonDefinition[] = [
  {
    id: 'mcs-foundations-signals',
    version: '1.0.0',
    device: 'shared',
    title: 'Validate the signal before the device',
    summary:
      'Build a pressure–flow baseline and separate patient, measurement, and device problems.',
    objectives: [
      'Confirm rhythm, arterial waveform fidelity, filling pressures, flow, and perfusion before changing support.',
      'Use trends and internal consistency instead of reacting to one displayed number.',
    ],
    steps: [
      {
        id: 'baseline-arterial',
        title: 'Read pressure and pulsatility',
        instruction: 'Inspect the arterial waveform and MAP before changing a device setting.',
        rationale: 'A preserved peak pressure can coexist with very low forward stroke volume.',
        targetActionId: 'inspect:arterial',
      },
      {
        id: 'baseline-filling',
        title: 'Read both ventricles',
        instruction:
          'Review RAP, PCWP, PAPi, and the relationship between RV delivery and LV filling.',
        rationale: 'Most LV support devices depend on adequate right-sided delivery.',
        targetActionId: 'inspect:preload',
      },
      {
        id: 'baseline-device',
        title: 'Separate native and device flow',
        instruction:
          'Compare native flow, device flow, effective systemic flow, and recirculation.',
        rationale:
          'A larger displayed device flow is not automatically a larger effective systemic flow.',
        targetActionId: 'inspect:device',
      },
    ],
    sourceIds: ['master-hemodynamics-reference', 'ishlt-hfsa-acute-mcs-2023'],
  },
  {
    id: 'mcs-foundations-mechanisms',
    version: '1.0.0',
    device: 'shared',
    title: 'Unloading, augmentation, and total flow',
    summary:
      'Compare counterpulsation, transvalvular unloading, and durable continuous-flow support.',
    objectives: [
      'Explain where each device takes blood from and where it returns it.',
      'Predict changes in LVEDV/LVEDP, pulsatility, MAP, and oxygen demand.',
    ],
    steps: [
      {
        id: 'mechanism-iabp',
        title: 'Counterpulsation',
        instruction: 'Select IABP and observe the assisted versus unassisted arterial beats.',
        rationale:
          'IABP changes timing and impedance rather than providing a continuous pump flow.',
        targetActionId: 'device:select:iabp',
      },
      {
        id: 'mechanism-impella',
        title: 'Direct LV unloading',
        instruction: 'Select Impella and compare LV volume, PCWP, native flow, and device flow.',
        rationale:
          'Continuous LV-to-aorta flow can unload the LV while reducing native aortic-valve flow.',
        targetActionId: 'device:select:impella',
      },
      {
        id: 'mechanism-lvad',
        title: 'Durable continuous flow',
        instruction:
          'Select LVAD and inspect flow, speed, power, PI, and aortic-valve opening together.',
        rationale: 'Controller estimates require patient and hemodynamic context.',
        targetActionId: 'device:select:lvad',
      },
    ],
    sourceIds: [
      'master-hemodynamics-reference',
      'ishlt-hfsa-acute-mcs-2023',
      'ishlt-durable-mcs-2023',
    ],
  },
  {
    id: 'iabp-timing-triggering',
    version: '1.0.0',
    device: 'iabp',
    title: 'IABP timing and triggering',
    summary:
      'Match inflation to aortic-valve closure and complete deflation before the next ejection.',
    objectives: [
      'Recognize early inflation, late inflation, early deflation, and late deflation.',
      'Relate timing errors to the assisted waveform.',
    ],
    steps: [
      {
        id: 'iabp-inflate',
        title: 'Place inflation at the notch',
        instruction: 'Adjust inflation toward 0 ms relative to the dicrotic notch.',
        rationale:
          'Inflation before valve closure raises impedance; late inflation loses augmentation.',
        targetActionId: 'iabp:set-inflation',
      },
      {
        id: 'iabp-deflate',
        title: 'Deflate before ejection',
        instruction: 'Adjust deflation toward 0 ms before the next systolic upstroke.',
        rationale: 'Late deflation makes the LV eject against an inflated balloon.',
        targetActionId: 'iabp:set-deflation',
      },
      {
        id: 'iabp-trigger',
        title: 'Match trigger to signal quality',
        instruction: 'Compare ECG and pressure triggering while rhythm regularity changes.',
        rationale: 'Trigger reliability depends on rhythm and signal fidelity.',
        targetActionId: 'iabp:set-trigger',
      },
    ],
    sourceIds: ['master-hemodynamics-reference', 'getinge-iabp-current'],
  },
  {
    id: 'iabp-efficacy-limits',
    version: '1.0.0',
    device: 'iabp',
    title: 'IABP efficacy, limits, and escalation',
    summary:
      'Recognize when technically correct counterpulsation cannot rescue the underlying physiology.',
    objectives: [
      'Assess augmentation and assisted end-diastolic pressure.',
      'Recognize low-output, tachycardic, low-SVR, RV-limited, and aortic-insufficiency limitations.',
    ],
    steps: [
      {
        id: 'iabp-ratio',
        title: 'Compare assisted beats',
        instruction: 'Change 1:1, 1:2, and 1:3 support and compare assisted with unassisted beats.',
        rationale: 'Weaning ratios expose the native waveform and the incremental device effect.',
        targetActionId: 'iabp:set-ratio',
      },
      {
        id: 'iabp-whole-patient',
        title: 'Check the whole circulation',
        instruction:
          'Lower RV contractility or SVR and observe why a well-timed balloon may remain ineffective.',
        rationale: 'IABP needs native ejection and does not replace absent RV delivery.',
        targetActionId: 'patient:adjust',
      },
      {
        id: 'iabp-escalate',
        title: 'Recognize the support ceiling',
        instruction:
          'Escalate to the MCS team when perfusion remains inadequate despite correct timing.',
        rationale: 'Persistent low flow requires reassessment of phenotype and support strategy.',
        targetActionId: 'team:escalate',
      },
    ],
    sourceIds: ['master-hemodynamics-reference', 'ishlt-hfsa-acute-mcs-2023'],
  },
  {
    id: 'impella-unloading-placement',
    version: '1.0.0',
    device: 'impella',
    title: 'Impella unloading and placement signals',
    summary: 'Relate performance level and transvalvular position to flow and unloading.',
    objectives: [
      'Distinguish device flow from effective systemic flow.',
      'Recognize directional placement-signal patterns.',
    ],
    steps: [
      {
        id: 'impella-level',
        title: 'Increase support deliberately',
        instruction:
          'Advance the performance level while tracking LVEDV, PCWP, MAP, and native pulsatility.',
        rationale:
          'More pump flow can improve unloading but also reduce native aortic-valve opening.',
        targetActionId: 'impella:set-level',
      },
      {
        id: 'impella-position',
        title: 'Disturb placement',
        instruction: 'Compare correct, too-deep, and too-shallow states.',
        rationale: 'Malposition lowers effective support and can increase hemolysis risk.',
        targetActionId: 'impella:set-position',
      },
      {
        id: 'impella-flow',
        title: 'Read flow in context',
        instruction:
          'Raise afterload and observe the fall in estimated pump flow despite the same setting.',
        rationale: 'Microaxial flow is pressure-gradient and preload dependent.',
        targetActionId: 'patient:adjust',
      },
    ],
    sourceIds: ['master-hemodynamics-reference', 'fda-impella-cp-labeling'],
  },
  {
    id: 'impella-suction-purge-rv',
    version: '1.0.0',
    device: 'impella',
    title: 'Impella suction, purge, hemolysis, and RV delivery',
    summary:
      'Treat low flow as a patient–position–device problem, not an automatic request for more support.',
    objectives: [
      'Recognize suction from underfilling or RV failure.',
      'Separate placement, purge, and hemolysis signals.',
    ],
    steps: [
      {
        id: 'impella-suction',
        title: 'Create a preload-limited state',
        instruction: 'Lower preload or RV contractility at a high performance level.',
        rationale: 'Inadequate LV filling limits support and can trigger suction.',
        targetActionId: 'patient:adjust',
      },
      {
        id: 'impella-unload-safely',
        title: 'Respond to suction',
        instruction:
          'Reduce support temporarily, reassess preload/RV delivery, and correct the cause.',
        rationale: 'Escalating through active suction can worsen blood trauma and instability.',
        targetActionId: 'impella:set-level',
      },
      {
        id: 'impella-purge',
        title: 'Interpret the purge state',
        instruction: 'Compare normal, high-pressure, and low-pressure purge states.',
        rationale:
          'Purge abnormalities require device-specific troubleshooting and expert support.',
        targetActionId: 'impella:set-purge',
      },
    ],
    sourceIds: [
      'master-hemodynamics-reference',
      'ishlt-hfsa-acute-mcs-2023',
      'fda-impella-cp-labeling',
    ],
  },
  {
    id: 'lvad-parameters-assessment',
    version: '1.0.0',
    device: 'lvad',
    title: 'Durable LVAD parameters and ICU assessment',
    summary: 'Interpret flow, speed, power, PI, MAP, pulsatility, and RV filling as one system.',
    objectives: [
      'Explain why displayed flow is an estimate.',
      'Recognize afterload and preload effects without reflexive speed changes.',
    ],
    steps: [
      {
        id: 'lvad-baseline',
        title: 'Build the LVAD vital-sign set',
        instruction: 'Inspect controller parameters, MAP, RAP, PCWP, and aortic-valve opening.',
        rationale: 'No single controller value identifies the cause of instability.',
        targetActionId: 'inspect:device',
      },
      {
        id: 'lvad-afterload',
        title: 'Raise afterload',
        instruction: 'Increase SVR and observe lower flow at unchanged speed.',
        rationale: 'Continuous-flow pumps are sensitive to the pressure gradient across the pump.',
        targetActionId: 'patient:adjust',
      },
      {
        id: 'lvad-authority',
        title: 'Use the authorized setting gate',
        instruction:
          'Enable the simulated authorized-personnel order before exploring a speed change.',
        rationale: 'Real settings changes require the prescribing team and current instructions.',
        targetActionId: 'lvad:authorize-speed',
      },
    ],
    sourceIds: ['ishlt-durable-mcs-2023', 'fda-heartmate3-ifu'],
  },
  {
    id: 'lvad-alarms-emergencies',
    version: '1.0.0',
    device: 'lvad',
    title: 'Durable LVAD low flow, high power, and power emergencies',
    summary:
      'Use competing diagnoses and immediate safety checks before treating a controller number.',
    objectives: [
      'Differentiate common low-flow mechanisms.',
      'Recognize power and high-power patterns that need urgent MCS-team action.',
    ],
    steps: [
      {
        id: 'lvad-low-flow',
        title: 'Compare low-flow causes',
        instruction:
          'Test hypovolemia, RV failure, tamponade, hypertension, and aortic insufficiency.',
        rationale: 'The same low-flow display can arise from opposite loading conditions.',
        targetActionId: 'patient:adjust',
      },
      {
        id: 'lvad-high-power',
        title: 'Recognize high power',
        instruction: 'Activate suspected pump thrombosis and compare power with effective flow.',
        rationale:
          'High power with hemocompatibility concerns needs urgent device-team evaluation.',
        targetActionId: 'lvad:set-thrombosis',
      },
      {
        id: 'lvad-power',
        title: 'Preserve power',
        instruction:
          'Disconnect then restore simulated power while observing pump flow and alarms.',
        rationale: 'A stopped continuous-flow pump is a time-critical emergency.',
        targetActionId: 'lvad:set-power',
      },
    ],
    sourceIds: ['ishlt-durable-mcs-2023', 'fda-heartmate3-ifu'],
  },
] as const

export const mcsLessonById = new Map(mcsLessons.map((lesson) => [lesson.id, lesson]))
