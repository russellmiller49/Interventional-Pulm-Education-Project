import type { McsLessonDefinition } from '../engine/types'

export const mcsLessons: readonly McsLessonDefinition[] = [
  /**
   * The two foundation sections carry the common cardiovascular model (M0/M1). Their ids, stage,
   * device, and titles are load-bearing — the titles are shared verbatim with the locked pathway
   * and activity catalog, and the stage drives `mcsFoundationLessonIds`.
   *
   * Every step keeps an `inspect:*` or `device:select:*` target, which are the only action ids the
   * guided-step button can dispatch. A foundation step that reached for a device-specific control
   * would render with no button and be completable only by accident.
   */
  {
    id: 'mcs-foundations-signals',
    version: '1.1.0',
    curriculumStage: 'foundation',
    device: 'shared',
    title: 'Validate the signal before the device',
    summary:
      'Work the questions that come before any device control, and keep pressure, flow, oxygen delivery, and organ response as four separate answers.',
    objectives: [
      'Name the dominant problem, the path blood takes, and what would count as success — before touching a device control.',
      'Read pressure, flow, oxygen delivery, and organ response as four separate levels, and refuse to report a finding from one level as an answer at another.',
      'Keep native contribution, displayed device contribution, and effective systemic delivery as three separate lines rather than one number.',
    ],
    steps: [
      {
        id: 'baseline-arterial',
        title: 'Start at pressure, and stop there',
        instruction:
          'Read the arterial waveform and mean pressure, then say what this does and does not tell you about how much blood is moving.',
        rationale:
          'Pressure is the first level of the model and it answers only its own question. A preserved or augmented pressure can sit on top of a very small forward stroke volume, so the honest answer at this level is that flow is still unknown.',
        targetActionId: 'inspect:arterial',
      },
      {
        id: 'baseline-filling',
        title: 'Ask what is filling each ventricle',
        instruction:
          'Review right atrial pressure, wedge pressure, PAPi, and the relationship between right-sided delivery and left-sided filling.',
        rationale:
          'Every left-sided device inherits the right ventricle: a pump can only move blood that has already crossed the lungs. This is where the model asks which chamber is being relieved, which one may inherit the burden, and what is limiting performance.',
        targetActionId: 'inspect:preload',
      },
      {
        id: 'baseline-device',
        title: 'Separate the three flow lines',
        instruction:
          'Compare the native contribution, the displayed device contribution, and effective systemic delivery — and check whether the displayed number is a measurement or an estimate.',
        rationale:
          'These are three different quantities and only the third is the one the patient experiences. They are not automatically additive: whether two streams sum, compete, or pass through one another depends on the pathway, so the arithmetic has to be argued rather than performed.',
        targetActionId: 'inspect:device',
      },
    ],
    sourceIds: [
      'master-hemodynamics-reference',
      'mcs-bedside-reference-supplied',
      'ishlt-hfsa-acute-mcs-2023',
    ],
  },
  {
    id: 'mcs-foundations-mechanisms',
    version: '1.1.0',
    curriculumStage: 'foundation',
    device: 'shared',
    title: 'Unloading, augmentation, and total flow',
    summary:
      'Trace source, active component, and destination for three mechanisms, and separate a device that changes timing from one that moves blood.',
    objectives: [
      'Trace where blood enters and where it returns for each mechanism, before naming what the device is for.',
      'Say whether a device alters pressure timing, pumps blood directly, or creates an extracorporeal path — and what each of those means for the number on its screen.',
      'Name which chamber each mechanism relieves and which chamber or vascular bed may inherit the burden.',
    ],
    steps: [
      {
        id: 'mechanism-iabp',
        title: 'A mechanism that moves no blood',
        instruction:
          'Select counterpulsation and compare the assisted with the unassisted beat. Notice that no device flow appears anywhere on the display.',
        rationale:
          'This mechanism changes the timing and shape of pressure around a beat the patient is still generating. There is no second stream to add to the native contribution, which is why the flow account for counterpulsation has only one line that carries blood.',
        targetActionId: 'device:select:iabp',
      },
      {
        id: 'mechanism-impella',
        title: 'A mechanism that moves blood across a valve',
        instruction:
          'Select the transvalvular pump and follow the path — left ventricle in, aorta out. Compare left ventricular volume, wedge pressure, the native contribution, and the displayed pump flow.',
        rationale:
          'Here there really is a second stream, and the left ventricle is directly relieved. But the displayed flow is an estimate of blood moved from chamber to artery, not blood arriving at an organ, and the right ventricle still has to deliver everything the pump moves.',
        targetActionId: 'device:select:impella',
      },
      {
        id: 'mechanism-lvad',
        title: 'The same path, a different decision',
        instruction:
          'Select durable continuous flow and inspect flow, speed, power, pulsatility index, and aortic-valve opening as one interdependent set.',
        rationale:
          'The blood follows the same left-ventricle-to-aorta path as the temporary pump, but the decision is different in kind: candidacy, implantation, and an agreed exit strategy are settled before support begins. The displayed flow is computed from power and speed, so it is least trustworthy in exactly the states that disturb that relationship.',
        targetActionId: 'device:select:lvad',
      },
    ],
    sourceIds: [
      'master-hemodynamics-reference',
      'mcs-bedside-reference-supplied',
      'ishlt-hfsa-acute-mcs-2023',
      'ishlt-durable-mcs-2023',
    ],
  },
  {
    id: 'iabp-timing-triggering',
    version: '1.0.0',
    curriculumStage: 'mechanism',
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
    curriculumStage: 'application',
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
    curriculumStage: 'mechanism',
    device: 'impella',
    title: 'Impella unloading and placement signals',
    summary: 'Relate performance level and transvalvular position to flow and unloading.',
    objectives: [
      'Compare CP and 5.5 at the same modeled loading and performance level.',
      'Distinguish device flow from effective systemic flow.',
      'Recognize directional placement-signal patterns.',
    ],
    steps: [
      {
        id: 'impella-left-variant',
        title: 'Compare CP with 5.5',
        instruction:
          'Select CP and then 5.5 at the same performance level and loading; compare left-pump flow, LVEDV, PCWP, and the distinct access descriptions.',
        rationale:
          'The two left-sided pumps share an LV-to-aorta mechanism but have different access pathways and modeled flow references.',
        targetActionId: 'impella:set-left-variant',
      },
      {
        id: 'impella-level',
        title: 'Increase support deliberately',
        instruction:
          'Advance the performance level while tracking LVEDV, PCWP, MAP, and native pulsatility.',
        rationale:
          'More pump flow can improve unloading but also reduce native aortic-valve opening.',
        targetActionId: 'impella:left:set-level',
      },
      {
        id: 'impella-position',
        title: 'Disturb placement',
        instruction: 'Compare correct, too-deep, and too-shallow states.',
        rationale: 'Malposition lowers effective support and can increase hemolysis risk.',
        targetActionId: 'impella:left:set-position',
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
    sourceIds: [
      'master-hemodynamics-reference',
      'fda-impella-cp-labeling',
      'fda-impella-55-labeling',
      'jnj-impella-55-current',
    ],
  },
  {
    id: 'impella-suction-purge-rv',
    version: '1.0.0',
    curriculumStage: 'application',
    device: 'impella',
    title: 'Impella suction, purge, hemolysis, and RV delivery',
    summary:
      'Treat low flow as a patient–position–device problem, not an automatic request for more support.',
    objectives: [
      'Recognize suction from underfilling or RV failure.',
      'Separate placement, purge, and hemolysis signals.',
      'Reconcile RP pulmonary delivery with left-pump flow during BiPella support.',
    ],
    steps: [
      {
        id: 'impella-rp-bipella',
        title: 'Build RP and BiPella support',
        instruction:
          'Enable RP alone, then pair it with CP or 5.5; compare RAP, PCWP, RP flow, left-pump flow, pump balance, and effective systemic flow.',
        rationale:
          'RP bypasses the RV into the pulmonary artery. In BiPella, serial right and left pump flows must be reconciled rather than summed.',
        targetActionId: 'impella:enable-right',
      },
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
        targetActionId: 'impella:left:set-level',
      },
      {
        id: 'impella-purge',
        title: 'Interpret the purge state',
        instruction: 'Compare normal, high-pressure, and low-pressure purge states.',
        rationale:
          'Purge abnormalities require device-specific troubleshooting and expert support.',
        targetActionId: 'impella:left:set-purge',
      },
    ],
    sourceIds: [
      'master-hemodynamics-reference',
      'ishlt-hfsa-acute-mcs-2023',
      'fda-impella-cp-labeling',
      'fda-impella-55-labeling',
      'jnj-impella-55-current',
      'fda-impella-rp-labeling',
      'jnj-impella-rp-current',
    ],
  },
  {
    id: 'lvad-parameters-assessment',
    version: '1.0.0',
    curriculumStage: 'mechanism',
    device: 'lvad',
    title: 'Durable LVAD parameters and ICU review',
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
        title: 'Confirm simulated authorization',
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
    curriculumStage: 'application',
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
  {
    id: 'mcs-device-selection-integration',
    version: '1.0.0',
    curriculumStage: 'integration',
    device: 'shared',
    title: 'Choosing among IABP, Impella, and durable LVAD for a shock phenotype',
    summary:
      'Compare the three mechanisms against one phenotype, and let the limiting problem select the device.',
    objectives: [
      'State the limiting problem — contractility, LV filling pressure, RV delivery, afterload, or duration — before naming a device.',
      'Predict what each mechanism changes and what it leaves unchanged in the same patient.',
      'Recognize the phenotypes in which a device that raises displayed flow does not raise effective systemic flow.',
    ],
    steps: [
      {
        id: 'integration-phenotype',
        title: 'Name the limiting problem first',
        instruction:
          'Rebuild the baseline — rhythm, arterial fidelity, RAP, PCWP, PAPi, native flow, effective systemic flow, perfusion — and state which one is limiting.',
        rationale:
          'Device selection is a statement about which part of the circulation is failing. Naming the device first hides that judgement instead of making it.',
        targetActionId: 'inspect:preload',
      },
      {
        id: 'integration-counterpulsation',
        title: 'Test counterpulsation against the phenotype',
        instruction:
          'Select the IABP mechanism and compare augmented pressure, native ejection, PCWP, and effective systemic flow.',
        rationale:
          'Counterpulsation modifies loading around a native beat. Where contractility is the limiting problem, an improved pressure trace can accompany an unchanged forward flow.',
        targetActionId: 'device:select:iabp',
      },
      {
        id: 'integration-direct-unloading',
        title: 'Test direct LV unloading against the same phenotype',
        instruction:
          'Select the Impella mechanism at the same patient state and compare LV filling, native ejection, pump flow, and effective systemic flow.',
        rationale:
          'Direct unloading moves volume from LV to aorta independently of the native beat, so it addresses LV filling pressure in a way counterpulsation does not — but it still depends on adequate RV delivery.',
        targetActionId: 'device:select:impella',
      },
      {
        id: 'integration-durable',
        title: 'Test durable continuous flow and the RV constraint',
        instruction:
          'Select the durable LVAD mechanism, then vary RV delivery and afterload and watch effective systemic flow rather than the displayed number.',
        rationale:
          'Every left-sided device inherits the right ventricle. A phenotype limited by RV delivery is not converted into an LV problem by adding left-sided support.',
        targetActionId: 'device:select:lvad',
      },
      {
        id: 'integration-commit',
        title: 'Commit to a mechanism and name what would change it',
        instruction:
          'State which mechanism the phenotype selects, what you expect it to change, and the reassessment finding that would reverse the choice.',
        rationale:
          'Selection is provisional. The value of an explicit prediction is that a later reassessment can contradict it.',
        targetActionId: 'inspect:device',
      },
    ],
    sourceIds: [
      'mcs-bedside-reference-supplied',
      'ishlt-hfsa-acute-mcs-2023',
      'ishlt-durable-mcs-2023',
      'getinge-iabp-current',
      'fda-impella-cp-labeling',
      'fda-heartmate3-ifu',
    ],
  },
] as const

export const mcsLessonById = new Map(mcsLessons.map((lesson) => [lesson.id, lesson]))
