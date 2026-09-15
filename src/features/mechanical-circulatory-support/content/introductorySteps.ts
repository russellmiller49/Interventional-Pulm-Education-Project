import type { McsAction, McsSimulationState } from '../engine/types'
import type { McsLearnControlId } from './learnControls'

/** Extra teaching steps in the existing five section contracts, not a second curriculum. */
export interface McsIntroduction {
  readonly id: string
  readonly title: string
  readonly instruction: string
  readonly paragraphs: readonly string[]
  readonly visual: 'signals' | 'pathways' | 'timing' | 'impella' | 'lvad'
  readonly setupActions?: readonly McsAction[]
  readonly allowedControls?: readonly McsLearnControlId[]
  readonly isSatisfied?: (state: McsSimulationState) => boolean
}

const inspected = (id: string) => (state: McsSimulationState) =>
  state.actionIds.includes(`inspect:${id}`)
const timingExample = (
  id: string,
  title: string,
  inflation: number,
  deflation: number,
  explanation: string,
): McsIntroduction => ({
  id,
  title,
  visual: 'timing',
  instruction:
    'Compare the balloon band with valve closure and the next ejection on the Timing reference. This is a demonstrated condition; Continue opens the next example.',
  paragraphs: [
    explanation,
    'The colored band follows the same timing source as the waveform and 3D balloon. The pressure trace is schematic: it does not reproduce every clinical contour of early or late deflation. Use the event relationship here; confirm clinical timing on the actual device and arterial trace.',
  ],
  setupActions: [
    { type: 'SET_IABP_CONTROL', control: 'assistRatio', value: 2 },
    { type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value: inflation },
    { type: 'SET_IABP_CONTROL', control: 'deflationOffsetMs', value: deflation },
  ],
})

export const mcsIntroductions: Readonly<Record<string, readonly McsIntroduction[]>> = {
  'mcs-foundations-signals': [
    {
      id: 'orientation',
      title: 'Meet the circulation and the balloon',
      visual: 'signals',
      instruction:
        'Read the four measurement groups beside the Circulation map. The balloon is already running; no adjustment is needed.',
      paragraphs: [
        'The native circulation runs from the veins through the right heart, lungs and left heart to the aorta. The intra-aortic balloon pump (IABP) sits in the descending aorta. Inflation in diastole augments aortic pressure; deflation before ejection reduces the load on the native left ventricle.',
        'IABP has no separate pump-flow stream. Any effect on forward output belongs to the native contribution during support. That contribution is different from native output measured before support began.',
      ],
    },
    {
      id: 'measurements',
      title: 'Read each quantity at its source',
      visual: 'signals',
      instruction:
        'Open the arterial, filling-pressure and device readings with the three Read buttons below. These are guided observations, not treatment actions.',
      paragraphs: [
        'RAP means right atrial pressure. PAWP, also called PCWP or wedge pressure, is pulmonary artery wedge pressure used to assess left-sided filling pressure with the appropriate measurement conditions. Neither is a direct volume measurement.',
        'SvO2 is mixed venous oxygen saturation, sampled clinically from pulmonary arterial blood. It reflects the balance between oxygen delivery and consumption, and is not a direct oxygen-delivery measurement. PAPi is the pulmonary artery pulsatility index: pulmonary artery pulse pressure divided by RAP. It is a derived right-heart assessment variable, not a flow or a universal treatment target.',
      ],
      allowedControls: [
        'control:inspect-arterial',
        'control:inspect-preload',
        'control:inspect-device',
      ],
      isSatisfied: (state) => ['arterial', 'preload', 'device'].every((id) => inspected(id)(state)),
    },
  ],
  'mcs-foundations-mechanisms': [
    {
      id: 'pathway-reference',
      title: 'Follow three support pathways',
      visual: 'pathways',
      instruction:
        'Study one conceptual support pathway at a time; locate where the device acts. Then read the current device account below.',
      paragraphs: [
        'The native aortic-valve route and a left-pump route run in parallel. Concurrent forward flow through those routes combines, after subtracting any represented regurgitant return. The pump changes native ejection, so adding native output from before support to a later pump estimate can be misleading.',
        'Right and left pumps work in series across the lungs. Adding their outputs would count the same throughput twice. None of these pumps oxygenates blood; the patient’s lungs provide gas exchange.',
        'Each selection in the comparison rebuilds the same reference patient, then advances the existing model for eight simulated seconds. You may choose any order. Nominal settings are not equivalent doses, and this comparison cannot rank clinical device choice.',
      ],
      allowedControls: ['control:inspect-device'],
      isSatisfied: inspected('device'),
    },
  ],
  'iabp-timing-triggering': [
    {
      ...timingExample(
        'normal-beat',
        'A normal assisted beat',
        0,
        0,
        'Find the systolic upstroke (U), then aortic-valve closure at the dicrotic-notch reference (N). Inflation (I) begins at closure; deflation (D) completes before the next ejection. A 1:2 teaching setting makes assisted and unassisted beats visible; it is not a clinical recommendation.',
      ),
      instruction:
        'Inspect the Timing reference, then read the arterial trace using the button below. Follow U → N/I → D → next U.',
      allowedControls: ['control:inspect-arterial'],
      isSatisfied: inspected('arterial'),
    },
    timingExample(
      'early-inflation-example',
      'Demonstration: early inflation',
      -120,
      0,
      'Inflation begins before the valve-closure reference, while ejection is still occurring. This can oppose LV ejection. Deflation remains at its reference; only inflation has changed.',
    ),
    timingExample(
      'late-inflation-example',
      'Demonstration: late inflation',
      120,
      0,
      'Inflation begins after the valve-closure reference. The opportunity for diastolic augmentation is shortened. Deflation remains at its reference.',
    ),
    timingExample(
      'early-deflation-example',
      'Demonstration: early deflation',
      0,
      -120,
      'Inflation remains aligned. The balloon band ends earlier in diastole, shortening augmentation. The exact clinical arterial contour is not faithfully reproduced by this model.',
    ),
    timingExample(
      'late-deflation-example',
      'Demonstration: late deflation',
      0,
      120,
      'Inflation remains aligned. The balloon can remain inflated into the next ejection, adding an outflow load. This model shows the timing band and an early-systolic pressure penalty, not a diagnostic clinical waveform.',
    ),
  ],
  'impella-unloading-placement': [
    {
      id: 'inlet-outlet',
      title: 'An aligned LV-to-aorta pump',
      visual: 'impella',
      instruction:
        'Find the inlet in the LV and the outlet above the aortic valve on the Circulation map. Read the device account below; optional 3D shows the same relationship.',
      paragraphs: [
        'The inlet receives blood inside the left ventricle (LV); the outlet returns it toward the ascending aorta. This blood-flow direction differs from retrograde catheter insertion from the arterial side. This module does not teach catheter manipulation.',
        'Performance level is a setting. Estimated pump flow depends on configuration, filling, outlet pressure and position. CP and 5.5 use different device models; the same level is not an equivalent clinical dose. Native ejection continues through a parallel route when the aortic valve opens.',
      ],
      allowedControls: ['control:inspect-device'],
      isSatisfied: inspected('device'),
    },
    {
      id: 'unloading-example',
      title: 'Guided example: ventricular unloading',
      visual: 'impella',
      instruction:
        'Compare the filled and underfilled examples below at matched times. Read the explanation, replay the comparison, try P8, or Continue. No answer or model action is required.',
      setupActions: [{ type: 'SET_IMPELLA_CONTROL', control: 'performanceLevel', value: 5 }],
      paragraphs: [
        'Unloading reduces the volume and pressure burden on the LV by removing blood through the pump route. In this model, the size of the response depends on filling and support. Read volume and pressure separately; neither must fall at every setting change.',
        'The next exercise resets this aligned baseline and introduces a simulated too-deep condition separately. A flow change alone cannot diagnose position. Clinical position requires appropriate imaging and device-specific interpretation.',
      ],
    },
  ],
  'lvad-parameters-assessment': [
    {
      id: 'controller-tour',
      title: 'The durable LVAD controller and the patient',
      visual: 'lvad',
      instruction:
        'Study the controller quantities one at a time, then open the device reading below. All values on this screen are simulated.',
      paragraphs: [
        'An implanted inflow cannula draws from the LV apex; an outflow graft returns blood to the ascending aorta. The controller describes pump operation. Independent patient assessment supplies pressure, filling, imaging and perfusion information.',
        'This simplified model generates flow from speed and loading, then derives power and pulsatility index (PI). It does not implement a manufacturer’s power-and-speed flow estimator; PI is not an input to its flow calculation.',
      ],
      allowedControls: ['control:inspect-device'],
      isSatisfied: inspected('device'),
    },
    {
      id: 'afterload-example',
      title: 'Guided example: change afterload at fixed speed',
      visual: 'lvad',
      instruction:
        'Set simulated SVR to 1400 using the SVR control. Compare the captured controller values after eight simulated seconds; pump speed stays fixed.',
      setupActions: [
        {
          type: 'SET_PATIENT_CONTROL',
          control: 'systemicVascularResistanceDynSecCm5',
          value: 1000,
        },
      ],
      paragraphs: [
        'Systemic vascular resistance (SVR) is a simulated patient condition here. Raising it is expected to reduce pump flow at unchanged speed. Compare this run’s direction and magnitude, including unchanged values.',
        'The model derives electrical power partly from modeled flow. Its power response is not a universal diagnostic rule for durable pumps or obstruction. Speed changes require the prescribing team and current device instructions; they are unavailable in this task.',
      ],
      allowedControls: ['control:patient-svr'],
      isSatisfied: (state) =>
        state.patient.systemicVascularResistanceDynSecCm5 === 1400 &&
        state.actionIds.includes('patient:set-svr'),
    },
  ],
}

export const isMcsIntroductorySection = (id: string) => Boolean(mcsIntroductions[id])
