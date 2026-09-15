import { waveformAtlasById, type WaveformAtlasEntry } from './waveformAtlas'

/** Local teaching copy; the registered PAC references and existing atlas remain authoritative. */
export const measurementOrigins = [
  {
    label: 'Arterial line · ART',
    text: 'A separate arterial catheter and transducer display systemic arterial pressure. This is not the distal PAC pressure channel.',
  },
  {
    label: 'PAC pressure channel',
    text: 'Pressure at the distal opening changes as the tip moves through the right atrium, right ventricle and pulmonary artery. During a valid brief occlusion, PAWP reflects pressure transmitted from the pulmonary venous side. The proximal port can measure right-atrial pressure when correctly positioned.',
  },
  {
    label: 'Thermodilution cardiac output',
    text: 'The thermistor senses temperature. The monitor uses the temperature–time curve and injection information to derive cardiac output. Clinically this is a cardiac output measurement; the catheter does not directly sense a flow waveform.',
  },
  {
    label: 'Distal blood sample',
    text: 'A sample drawn from the distal port in the pulmonary artery is analyzed for mixed venous oxygen saturation. Sampling, laboratory measurement of saturation, and calculation of oxygen content are separate steps. Oxygen content also depends on hemoglobin and the relevant oxygen measurements.',
  },
] as const

export const componentNames = {
  a: 'a wave',
  c: 'c wave',
  x: 'x descent',
  v: 'v wave',
  y: 'y descent',
} as const
export type AtrialComponentId = keyof typeof componentNames
export const componentOrder: readonly AtrialComponentId[] = ['a', 'c', 'x', 'v', 'y']
export type ComponentMode = 'guided' | 'independent'

export const componentRegionDescriptions: Readonly<Record<AtrialComponentId, string>> = {
  a: 'Small pressure peak following the ECG P wave',
  c: 'Small pressure peak just after the QRS complex',
  x: 'Pressure fall during ventricular systole, before the late systolic peak',
  v: 'Late systolic pressure peak near the end of the T wave',
  y: 'Pressure fall after the late systolic peak, during early diastole',
}

/** Numbering is deliberately different in the new example; grading uses authored landmarks. */
export function componentRegions(mode: ComponentMode) {
  const ids: readonly AtrialComponentId[] =
    mode === 'guided' ? ['a', 'c', 'x', 'v', 'y'] : ['v', 'a', 'y', 'c', 'x']
  const source = waveformAtlasById.get('ra-normal')!
  return ids.map((component, index) => ({
    component,
    number: index + 1,
    annotation: source.annotations.find((annotation) => annotation.id === component)!,
    description: componentRegionDescriptions[component],
  }))
}

/** How far the renumbered repeat moves the reference right atrium up. Its only change of trace. */
export const RENUMBERED_MEAN_SHIFT_MMHG = 2

export function componentExample(mode: ComponentMode): WaveformAtlasEntry {
  const source = waveformAtlasById.get('ra-normal')!
  return {
    ...source,
    // A baseline translation of the same authored normal model, not a new disease shape or a new
    // patient: the learner sees it labelled a model variant (HD-02).
    trace:
      source.trace.kind === 'atrial' && mode === 'independent'
        ? { ...source.trace, meanMmHg: source.trace.meanMmHg + RENUMBERED_MEAN_SHIFT_MMHG }
        : source.trace,
    normalRange: null,
    insertionDepth: null,
    label:
      mode === 'guided'
        ? 'Numbered in order · right atrium'
        : 'Model variant · right atrium, renumbered',
    annotations: componentRegions(mode).map((region) => ({
      ...region.annotation,
      id: `region-${region.number}`,
      label: String(region.number),
      description: region.description,
    })),
  }
}

/**
 * The region a learner checked for a component, in this session. HD-01 dropped the first-region,
 * attempt count and "assisted" flag: the activity no longer keeps an account of first responses
 * versus retries, and a retry simply replaces the checked region.
 */
export interface ComponentSelection {
  readonly component: AtrialComponentId
  readonly selectedRegion: number | null
}

export function componentSelectionCorrect(selection: ComponentSelection, mode: ComponentMode) {
  return (
    componentRegions(mode).find((region) => region.number === selection.selectedRegion)
      ?.component === selection.component
  )
}

/** Equivalent observable descriptions: no identifying chamber or mechanism in an attempt. */
export function unidentifiedTraceDescription(entry: WaveformAtlasEntry) {
  switch (entry.id) {
    case 'rv-normal':
      return 'PAC pressure and synchronized ECG. Tall systolic peaks alternate with low early diastolic pressure that rises during filling. There is no valve-closure notch.'
    case 'pa-normal':
      return 'PAC pressure and synchronized ECG. Systolic peaks descend through a notch; pressure stays above the near-zero baseline between beats.'
    case 'wedge-normal':
      return 'PAC pressure and synchronized ECG. Low-amplitude waves and descents have delayed timing relative to the P wave and QRS complex.'
    case 'ra-normal':
      return 'PAC pressure and synchronized ECG. Small peaks follow the P wave and QRS, with a late systolic peak and two intervening descents.'
    case 'ra-tricuspid-regurgitation':
      return 'Confirmed right-atrial question trace and synchronized ECG. A broad systolic pressure wave obscures the systolic descent; pressure falls in early diastole.'
    case 'ra-tamponade':
      return 'Confirmed right-atrial question trace and synchronized ECG. The systolic descent remains visible, while the early diastolic descent is markedly attenuated.'
    case 'wedge-large-v-wave':
      return 'Pressure trace and synchronized ECG. A broad, delayed systolic peak dominates the tracing, with smaller intervening atrial components.'
    case 'ra-atrial-fibrillation':
      return 'Pressure trace aligned with a reference ECG timing strip. The early atrial pressure peak is absent; the peak just after QRS and the systolic descent persist. The reference ECG does not model the patient’s rhythm.'
    case 'wedge-overwedged':
      return 'Pressure trace and synchronized ECG. The pressure wavers and drifts upward without identifiable atrial components.'
    case 'ra-cannon-a-wave':
      return 'Pressure trace and synchronized ECG. A tall, narrow peak around atrial contraction dominates smaller pressure waves.'
    case 'rv-prominent-a-wave':
      return 'Pressure trace and synchronized ECG. Tall systolic peaks and a lower diastolic pressure include an additional late diastolic peak before the next upstroke.'
    case 'wedge-hybrid':
      return 'Pressure trace and synchronized ECG. Smaller delayed atrial waves are superimposed with taller systolic pulsations.'
    default:
      return 'Unidentified pressure trace with synchronized ECG. Pressure is plotted against time on the labeled millimeter-of-mercury axis.'
  }
}
