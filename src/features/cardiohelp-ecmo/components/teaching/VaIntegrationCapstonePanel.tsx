import {
  ECMO_BASELINE_DISPLAY_DEADBANDS,
  ecmoDerivedValueGuides,
} from '../../content/ecmoValueGuides'
import type { EcmoChannelReadout, EcmoSimulationState } from '../../engine/types'
import type { EcmoFoundationSnapshot } from '../../session/foundationSession'
import {
  AwaitingCircuit,
  GuidedValue,
  ModelBoundary,
  TextEquivalent,
  direction,
  directionWord,
  round,
  styles,
  VA_CONFIGURATION_BOUNDARY,
  VaConfigurationLabel,
} from './shared'

/**
 * One VA presentation, five explanations, and the two reassuring numbers that settle none of them.
 *
 * The VA mirror of the VV capstone, carrying one extra trap: beside displayed circuit flow the
 * console offers an arterial pressure the circuit itself is generating, so there are two
 * comfortable numbers to act from rather than one. The matrix is directional for the same reason
 * as its VV counterpart — what separates these five is which finding moves and in which direction,
 * not any cut point — and every cell carries the finding that discriminates it and, where this
 * simulation cannot show the mechanism honestly, the limitation that applies.
 *
 * Four of those limitations are load-bearing and were read off the modeled states rather than
 * assumed:
 *
 *   - none of the VA states this lesson loads carries vasoplegia, and the modeled mean arterial
 *     pressure follows circuit flow, so the whole vasoplegia column is authored teaching;
 *   - none of them moves the cannulated limb either — distal perfusion reads normal and the NIRS
 *     value is fixed across every one of them — so the one explanation found only by examining the
 *     limb is the one the model cannot show;
 *   - the VA membrane preview couples resistance to flow, so its displayed flow falls, and it
 *     leaves both arterial saturations and the carbon dioxide value where they were;
 *   - the differential-oxygenation state authors the two arterial saturations directly instead of
 *     computing a watershed position from native ejection.
 *
 * The presenting case and the differential-oxygenation state settle to the same state, so the
 * presenting case *is* that mechanism. There is deliberately no separate preview for it, and the
 * panel says so rather than offering a redundant one. It says it about the presenting case by name:
 * this panel also renders behind the loading, membrane and gas previews, and a sentence about "the
 * case in front of you" would be false in four of the five states the lesson can load.
 */

type HypothesisId =
  | 'differential-oxygenation'
  | 'lv-distension'
  | 'membrane-dysfunction'
  | 'gas-side-interruption'
  | 'vasoplegia'

const hypotheses: readonly {
  readonly id: HypothesisId
  readonly label: string
  /** The mechanism in a sentence, so a column heading is never the whole claim. */
  readonly mechanism: string
}[] = [
  {
    id: 'differential-oxygenation',
    label: 'Native ejection has moved the mixing point',
    mechanism:
      'Native ejection has recovered and moved the point where native and circuit blood meet more distally, away from the aortic root, so blood from the native lung is filling the arch branches and reaching the upper body and the brain. Where that point sits relative to the root also decides what the coronary arteries receive.',
  },
  {
    id: 'lv-distension',
    label: 'The left ventricle has distended',
    mechanism:
      'The left ventricle has distended against the arterial return it has to eject into, so it ejects less and the lungs congest behind it.',
  },
  {
    id: 'membrane-dysfunction',
    label: 'The membrane is failing',
    mechanism:
      'The membrane is no longer transferring gas the way it was, and its resistance is rising as it goes.',
  },
  {
    id: 'gas-side-interruption',
    label: 'The gas side is interrupted',
    mechanism:
      'Gas is no longer reaching the membrane, whatever the sweep control on the front of the device reads.',
  },
  {
    id: 'vasoplegia',
    label: 'Systemic vascular resistance has fallen',
    mechanism:
      'Vascular tone has fallen, so the same circuit flow generates a lower pressure — and the reflex it invites is to raise the pump speed.',
  },
]

interface MatrixCell {
  /** Expected direction, stated as a direction rather than a value. */
  readonly direction: string
  /** What makes this row useful for telling this explanation from the others. */
  readonly discriminator: string
  /** Where this simulation, or the supplied sources, cannot support the expectation. */
  readonly limitation?: string
}

interface MatrixRow {
  readonly id: string
  readonly label: string
  readonly read: (state: EcmoSimulationState) => {
    readonly text: string
    /** Reason-specific text when a channel reports no number. */
    readonly reason?: string
  }
  readonly cells: Readonly<Record<HypothesisId, MatrixCell>>
}

function channelText(readout: EcmoChannelReadout, unit: string, precision = 0) {
  return readout.displayed === null
    ? { text: '--', reason: readout.reason }
    : { text: `${readout.displayed.toFixed(precision)}${unit ? ` ${unit}` : ''}` }
}

/**
 * The same channel as a sentence, for the text equivalent.
 *
 * Carries the reason a number is absent as well as the number, so a reader of the equivalent is
 * never told less than the table beside it says.
 */
function channelSentence(readout: EcmoChannelReadout, unit: string, precision = 0): string {
  return readout.displayed === null
    ? `not available, ${readout.reason}`
    : `${readout.displayed.toFixed(precision)}${unit ? ` ${unit}` : ''}`
}

/** The same words the other VA panels use, so one finding does not read two ways across a track. */
const congestionWord: Readonly<Record<'none' | 'mild' | 'marked', string>> = {
  none: 'no congestion',
  mild: 'mild congestion',
  marked: 'marked congestion',
}

const limbPerfusionWord: Readonly<Record<'normal' | 'threatened' | 'critical', string>> = {
  normal: 'normal',
  threatened: 'threatened',
  critical: 'critical',
}

function valveWord(state: EcmoSimulationState): string {
  return state.patient.aorticValveOpening ? 'opening' : 'not opening'
}

/**
 * The difference below which the two arterial sites are reported as agreeing.
 *
 * A display aid for this simulation and nothing else: not a clinical tolerance, and no boundary of
 * anything. The raw difference is printed beside every word it produces. Read from the authored
 * record rather than declared here, so it cannot drift from the guide that documents it.
 */
const SATURATION_GAP_DEADBAND = ECMO_BASELINE_DISPLAY_DEADBANDS.upperToLowerSaturationGap

const rows: readonly MatrixRow[] = [
  {
    id: 'displayed-circuit-flow',
    label: 'Displayed circuit flow',
    read: (state) => ({ text: `${state.circuit.bloodFlow.toFixed(2)} L/min` }),
    cells: {
      'differential-oxygenation': {
        direction:
          'Unchanged. The pump delivers what it was asked for regardless of where its blood meets the native output.',
        discriminator:
          'Every explanation on this list is compatible with this number, which is why the differential exists at all.',
      },
      'lv-distension': {
        direction:
          'Unchanged. In this simulation the loading preview leaves the circuit flow and every circuit pressure identical to the presenting case.',
        discriminator:
          'Identical circuit numbers beside a changed patient is the pattern that moves attention off the console.',
        limitation:
          'This simulation authors loading as a patient-side state and does not feed it back into circuit flow. At the bedside a ventricle distending against the return changes what the return side is working against.',
      },
      'membrane-dysfunction': {
        direction:
          'Falls in this simulation, because the membrane resistance also constrains flow.',
        discriminator:
          'Read the gradient rather than the flow: the gradient rises here even though the flow carrying it has fallen.',
        limitation:
          'A membrane can lose gas transfer at the bedside without its resistance having risen enough to constrain flow. This simulation couples the two, so do not take an unchanged flow here as ruling a membrane problem out.',
      },
      'gas-side-interruption': {
        direction: 'Unchanged. The pump keeps moving blood through a membrane receiving no gas.',
        discriminator:
          'This is the failure the flow display is completely silent about, in this simulation and at the bedside.',
      },
      vasoplegia: {
        direction:
          'Little changed in a speed-controlled circuit, and if anything slightly easier as the pump works against less resistance.',
        discriminator:
          'Maintained circuit flow beside a falling pressure is the whole of this explanation, and the reason raising the speed is the wrong reflex.',
        limitation:
          'None of the VA states this lesson loads carries vasoplegia, so nothing here will show you this row.',
      },
    },
  },
  {
    id: 'pVen',
    label: 'pVen (drainage)',
    read: (state) => channelText(state.circuit.readouts.pVen, 'mmHg'),
    cells: {
      'differential-oxygenation': {
        direction: 'Unchanged. Drainage is not what has changed.',
        discriminator:
          'An undisturbed drainage pressure moves attention away from the drainage side and the volume state.',
      },
      'lv-distension': {
        direction: 'Unchanged in this simulation.',
        discriminator:
          'A drainage pressure standing still while the patient side changes is what keeps this a patient-side explanation.',
        limitation:
          'A congested circulation changes what a drainage cannula sees at the bedside. This simulation does not couple loading back to the drainage pressure.',
      },
      'membrane-dysfunction': {
        direction:
          'Little changed, and moves only as far as the lower flow moves it. The problem sits downstream of the pump.',
        discriminator: 'A drainage pressure that has not moved points away from the drainage side.',
      },
      'gas-side-interruption': {
        direction: 'Unchanged. The gas path has no pressure channel in it at all.',
        discriminator:
          'Every circuit pressure staying still while gas exchange collapses is itself the finding.',
      },
      vasoplegia: {
        direction:
          'Unchanged, unless the vasodilated patient is also under-filled, which drainage would then report.',
        discriminator:
          'Drainage is where a coexisting volume problem would appear, and it is worth reading before tone is blamed for everything.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
  {
    id: 'pInt-and-pArt',
    label: 'pInt and pArt',
    read: (state) => {
      const pInt = channelText(state.circuit.readouts.pInt, 'mmHg')
      const pArt = channelText(state.circuit.readouts.pArt, 'mmHg')
      return {
        text: `pInt ${pInt.text} · pArt ${pArt.text}`,
        ...(pInt.reason || pArt.reason
          ? { reason: [pInt.reason, pArt.reason].filter(Boolean).join(' ') }
          : {}),
      }
    },
    cells: {
      'differential-oxygenation': {
        direction: 'Unchanged, both of them.',
        discriminator:
          'The blood path is undisturbed. What has changed is where the blood it returns ends up.',
      },
      'lv-distension': {
        direction: 'Unchanged in this simulation.',
        discriminator:
          'Return-side pressure holding still while pulsatility disappears separates the ventricle from the circuit.',
        limitation:
          'At the bedside the return side works against the arterial pressure, so a rising load can raise pArt. This simulation does not model that coupling.',
      },
      'membrane-dysfunction': {
        direction:
          'They separate: pInt rises steeply while pArt does not follow, and in this simulation pArt falls as the flow falls.',
        discriminator:
          'Separation between the two is the membrane signature; rising together is a return-side one.',
      },
      'gas-side-interruption': {
        direction: 'Unchanged, both of them.',
        discriminator: 'Gas transfer has failed with the blood path entirely undisturbed.',
      },
      vasoplegia: {
        direction:
          'pArt would be expected to fall with the arterial pressure the circuit returns against, carrying pInt down with it and leaving the difference between them alone.',
        discriminator:
          'Both falling together while the gradient stays put is what separates a tone problem from a membrane one.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
  {
    id: 'deltaP-trend',
    label: 'ΔP across the membrane, over time',
    read: (state) => channelText(state.circuit.readouts.deltaP, 'mmHg'),
    cells: {
      'differential-oxygenation': {
        direction: 'Unchanged.',
        discriminator:
          'The gradient belongs to the device and the flow through it, not to where that flow ends up.',
      },
      'lv-distension': {
        direction: 'Unchanged.',
        discriminator:
          'A gradient that has not moved while the ventricle has is what keeps the explanation on the patient side.',
      },
      'membrane-dysfunction': {
        direction:
          'Rises, and rises even though the flow carrying it has fallen — the opposite of what a flow change alone would do.',
        discriminator:
          'This is the single most useful row for this explanation, provided the flow it was measured at is known.',
      },
      'gas-side-interruption': {
        direction: 'Unchanged.',
        discriminator: 'The membrane is intact; nothing is reaching its gas side.',
      },
      vasoplegia: {
        direction: 'Little changed.',
        discriminator:
          'The gradient is a resistance multiplied by a flow, and this explanation changes neither.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
  {
    id: 'drainage-saturation',
    label: 'Drainage-limb saturation (device-displayed)',
    read: (state) => channelText(state.circuit.readouts.venousLineSaturation, '', 1),
    cells: {
      'differential-oxygenation': {
        direction:
          'Not the row this explanation turns on. It reports the oxygen balance of the blood the circuit drains, not where native and circuit blood meet.',
        discriminator:
          'It cannot separate a distribution problem from anything else, which is why two arterial sites have to be sampled instead. In VA this simulation carries no recirculation term, so this value does not hold the trap it holds in VV.',
      },
      'lv-distension': {
        direction: 'Falls, as native output drops and more is extracted from what is delivered.',
        discriminator:
          'A falling drainage saturation beside identical circuit pressures points at the patient’s own circulation rather than at the device.',
      },
      'membrane-dysfunction': {
        direction: 'Falls as well.',
        discriminator:
          'It falls here for a different reason, so it cannot separate the two on its own — the gradient does that.',
      },
      'gas-side-interruption': {
        direction: 'Falls, following the systemic value down.',
        discriminator: 'It moves with the systemic value rather than away from it.',
      },
      vasoplegia: {
        direction: 'Can rise: a vasodilated circulation extracts less from the same delivery.',
        discriminator:
          'A drainage saturation that has risen while the pressure has fallen is the pattern that suggests tone rather than flow.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
  {
    id: 'post-oxygenator-saturation',
    label: 'Post-oxygenator saturation',
    read: (state) => ({ text: state.circuit.postOxygenatorSaturation.toFixed(1) }),
    cells: {
      'differential-oxygenation': {
        direction: 'Unchanged and high. The membrane is fully saturating the blood it returns.',
        discriminator:
          'A fully saturated membrane output beside a poorly saturated arm is the finding: the blood reaching that arm is not circuit blood.',
      },
      'lv-distension': {
        direction: 'Unchanged.',
        discriminator: 'The membrane and its gas supply are untouched.',
      },
      'membrane-dysfunction': {
        direction: 'Falls. Blood is crossing a device that is no longer transferring gas properly.',
        discriminator:
          'Comparing this value with the drainage value is the most direct look at whether the membrane is working.',
      },
      'gas-side-interruption': {
        direction: 'Falls, and falls further — there is no gradient for the membrane to work with.',
        discriminator:
          'It falls here for the same reason it falls in membrane failure, so the gradient and the gas connection are what separate them.',
      },
      vasoplegia: {
        direction: 'Unchanged.',
        discriminator: 'Vascular tone does not change what the membrane returns.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
  {
    id: 'right-radial-saturation',
    label: 'Right radial saturation (upper body)',
    read: (state) => ({ text: state.patient.rightRadialSpo2.toFixed(1) }),
    cells: {
      'differential-oxygenation': {
        direction:
          'Falls. This is the sample the mechanism predicts, because the right arm is supplied from the part of the aorta closest to the native output.',
        discriminator:
          'It falls while the femoral value stays high, and nothing else on this list does that.',
      },
      'lv-distension': {
        direction:
          'Stays high in this simulation: with the valve not opening, the upper body is supplied almost entirely by circuit blood.',
        discriminator:
          'A well-saturated arm beside a flat pulse pressure is loading without a distribution problem.',
        limitation:
          'The two coexist at the bedside — a ventricle ejecting poorly oxygenated blood while it distends — and this simulation authors them as separate states.',
      },
      'membrane-dysfunction': {
        direction: 'Unchanged in this simulation, even though the post-membrane value has fallen.',
        discriminator:
          'Read the post-membrane value and the gradient here rather than waiting for the arm to report a membrane problem.',
        limitation:
          'This simulation authors the VA arterial saturations from whether gas is reaching the membrane and from whether the differential-oxygenation state is active, so the membrane preview leaves both arterial sites where they were. At the bedside a failing membrane does lower what it returns to the patient.',
      },
      'gas-side-interruption': {
        direction: 'Falls, together with the femoral value.',
        discriminator:
          'Both arterial sites falling together, and quickly, is the gas-side pattern.',
      },
      vasoplegia: {
        direction:
          'Little changed. The saturation of what is delivered is not what has gone wrong.',
        discriminator:
          'A normal-looking upper-body saturation beside a low pressure keeps attention on tone rather than on gas exchange.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
  {
    id: 'femoral-arterial-saturation',
    label: 'Femoral arterial saturation (lower body)',
    read: (state) => ({ text: state.patient.femoralArterialSpo2.toFixed(1) }),
    cells: {
      'differential-oxygenation': {
        direction: 'Stays high. This is circuit blood sampled where the circuit returns it.',
        discriminator:
          'On its own it is reassurance about the wrong end of the patient, and it is the value most likely to be the only one drawn.',
      },
      'lv-distension': {
        direction: 'Stays high.',
        discriminator: 'Loading shows itself in pulsatility, the valve and the lungs, not here.',
      },
      'membrane-dysfunction': {
        direction: 'Unchanged in this simulation.',
        discriminator:
          'Same reason as the row above: both arterial sites are authored rather than derived from what the membrane returns.',
        limitation: 'Authored in this simulation, not derived from the post-membrane value.',
      },
      'gas-side-interruption': {
        direction: 'Falls, and falls until it meets the upper-body value.',
        discriminator: 'Two sites converging low is the gas-side pattern; a widening gap is not.',
      },
      vasoplegia: {
        direction: 'Little changed.',
        discriminator: 'It reports oxygenation, not the pressure that oxygen is delivered at.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
  {
    id: 'saturation-gap',
    label: 'Gap between the two arterial saturations',
    read: (state) => {
      const gap = state.patient.femoralArterialSpo2 - state.patient.rightRadialSpo2
      const sense = direction(gap, SATURATION_GAP_DEADBAND)
      if (sense === 'flat') {
        return { text: `${Math.abs(gap).toFixed(1)} — the two sites read about the same` }
      }
      return {
        text: `${Math.abs(gap).toFixed(1)} — the right radial site reads ${
          directionWord[sense === 'up' ? 'down' : 'up']
        } than the femoral site`,
      }
    },
    cells: {
      'differential-oxygenation': {
        direction: 'Wide, and the gap rather than either value alone is the measurement.',
        discriminator:
          'Only this explanation puts a wide gap between two arterial sites. Sampling one site cannot produce it, and cannot exclude it either.',
      },
      'lv-distension': {
        direction: 'Narrow.',
        discriminator:
          'A narrow gap does not exclude loading. It excludes the watershed as the explanation for the upper-body value.',
      },
      'membrane-dysfunction': {
        direction: 'Narrow in this simulation, because both sites are held where they were.',
        discriminator: 'A narrow gap here says the two sites agree, not that the membrane is well.',
        limitation:
          'Both arterial sites are authored in this simulation, so this row cannot demonstrate a membrane problem in either direction.',
      },
      'gas-side-interruption': {
        direction: 'Narrow: both values fall together.',
        discriminator: 'Falling together is the discriminator; falling apart is the watershed one.',
      },
      vasoplegia: {
        direction: 'Narrow.',
        discriminator:
          'Tone changes the pressure the two sites are perfused at, not the difference between their saturations.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
  {
    id: 'pulse-pressure',
    label: 'Pulse pressure',
    read: (state) => ({ text: `${state.patient.pulsePressure.toFixed(0)} mmHg` }),
    cells: {
      'differential-oxygenation': {
        direction:
          'Present, and wider than it was — recovering native ejection is the mechanism itself.',
        discriminator:
          'A pulse pressure that has recovered is the reason to sample the right arm at all. The two findings belong together.',
        limitation:
          'This simulation authors pulsatility from whether the loading state is active, so it never shows a pulse pressure recovering as native function returns. Read this row here as pulsatility being present, not as pulsatility having risen.',
      },
      'lv-distension': {
        direction: 'Narrows toward flat as the ventricle stops ejecting.',
        discriminator:
          'It moves in the opposite direction to the row above, which is what separates these two patient-side explanations from one another.',
      },
      'membrane-dysfunction': {
        direction:
          'Not what this explanation predicts. The membrane sits between the pump and the patient and does not change how the ventricle ejects.',
        discriminator: 'Pulsatility that has not moved keeps the ventricle out of the explanation.',
      },
      'gas-side-interruption': {
        direction: 'Unchanged.',
        discriminator: 'The gas path does not touch ejection.',
      },
      vasoplegia: {
        direction:
          'Can widen while the mean pressure falls, because the same stroke meets less resistance.',
        discriminator:
          'A wide pulse pressure with a low mean is the tone pattern, and it is the mirror image of the loading picture.',
        limitation:
          'Not demonstrable in the states this lesson loads. This simulation authors pulsatility from whether the loading state is active, not from vascular tone.',
      },
    },
  },
  {
    id: 'aortic-valve-opening',
    label: 'Aortic valve opening',
    read: (state) => ({ text: valveWord(state) }),
    cells: {
      'differential-oxygenation': {
        direction:
          'Opening. Native blood is being ejected into the aorta, which is what makes a watershed exist at all.',
        discriminator:
          'An opening valve beside a poorly saturated arm is this mechanism stated in two findings.',
      },
      'lv-distension': {
        direction: 'Not opening. The ventricle cannot overcome the pressure it has to eject into.',
        discriminator: 'This is the finding the explanation is named for.',
      },
      'membrane-dysfunction': {
        direction: 'Unchanged.',
        discriminator: 'Nothing about the membrane changes whether the valve opens.',
      },
      'gas-side-interruption': {
        direction: 'Unchanged.',
        discriminator: 'Nothing about the gas path changes whether the valve opens.',
      },
      vasoplegia: {
        direction: 'Opens more readily, as the load the ventricle ejects against has fallen.',
        discriminator:
          'A valve opening more freely alongside a falling pressure points at tone rather than at loading.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
  {
    id: 'pulmonary-congestion',
    label: 'Pulmonary congestion',
    read: (state) => ({ text: congestionWord[state.patient.pulmonaryCongestion] }),
    cells: {
      'differential-oxygenation': {
        direction: 'May be present, but it is not the finding this explanation turns on.',
        discriminator:
          'Congestion cannot separate a distribution problem from the rest of the list on its own.',
      },
      'lv-distension': {
        direction:
          'Marked, and it is the consequence of the distension rather than a second problem.',
        discriminator:
          'Congestion together with a flat pulse pressure and a valve that is not opening is the loading picture in three findings.',
      },
      'membrane-dysfunction': {
        direction: 'Unchanged.',
        discriminator:
          'In VA the membrane returns to the aorta, so the lungs do not sit downstream of it.',
      },
      'gas-side-interruption': {
        direction: 'Unchanged.',
        discriminator: 'The gas path does not load the left side of the heart.',
      },
      vasoplegia: {
        direction: 'Unchanged, or less than it was as filling pressures fall.',
        discriminator: 'Congestion moving the other way argues against loading.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
  {
    id: 'mean-arterial-pressure',
    label: 'Mean arterial pressure',
    read: (state) => ({ text: `${state.patient.meanArterialPressure.toFixed(0)} mmHg` }),
    cells: {
      'differential-oxygenation': {
        direction:
          'Maintained. In this simulation it follows circuit flow, so the circuit is generating it.',
        discriminator:
          'A maintained pressure is the second reassurance in VA, and it separates nothing on this list.',
      },
      'lv-distension': {
        direction: 'Maintained.',
        discriminator:
          'A pressure the circuit is generating stays where it was while the ventricle behind it distends, which is exactly why loading gets missed.',
      },
      'membrane-dysfunction': {
        direction: 'Moves only as far as the flow the membrane resistance allows moves it.',
        discriminator:
          'Read it as a consequence of the flow rather than as an independent finding.',
      },
      'gas-side-interruption': {
        direction: 'Unchanged.',
        discriminator: 'Gas exchange has failed with perfusion pressure untouched.',
      },
      vasoplegia: {
        direction: 'Falls, and the fall is the finding.',
        discriminator:
          'A falling mean pressure with circuit flow maintained is what makes tone the explanation rather than flow.',
        limitation:
          'None of the VA states this lesson loads carries vasoplegia, and in this simulation the modeled mean arterial pressure is generated from circuit flow, so it barely moves across those states. This column is authored teaching the states here cannot demonstrate.',
      },
    },
  },
  {
    id: 'gas-source-status',
    label: 'Gas-source connection and sweep setting',
    read: (state) => ({
      text: state.gas.sourceConnected
        ? `connected · sweep ${state.gas.sweepLpm.toFixed(1)} L/min`
        : `interrupted · sweep set to ${state.gas.sweepLpm.toFixed(1)} L/min`,
    }),
    cells: {
      'differential-oxygenation': {
        direction: 'Intact.',
        discriminator: 'Checking it costs nothing and removes one explanation from the list.',
      },
      'lv-distension': {
        direction: 'Intact.',
        discriminator: 'Same reasoning: the cheap, fast, reversible path first.',
      },
      'membrane-dysfunction': {
        direction: 'Intact.',
        discriminator:
          'A membrane cannot be blamed for not exchanging until gas has been shown to reach it.',
      },
      'gas-side-interruption': {
        direction: 'Interrupted — this is the finding itself.',
        discriminator:
          'A sweep setting on a control does not establish that gas is arriving at the membrane. The connection has to be looked at.',
      },
      vasoplegia: {
        direction: 'Intact.',
        discriminator: 'One look, one explanation off the list.',
      },
    },
  },
  {
    id: 'cannulated-limb',
    label: 'Cannulated-limb perfusion and NIRS',
    read: (state) => ({
      text: `${limbPerfusionWord[state.patient.distalLimbPerfusion]} · NIRS ${state.patient.distalLimbNirs.toFixed(0)}`,
    }),
    cells: {
      'differential-oxygenation': {
        direction:
          'Normal, unless the arterial cannula is obstructing the limb as well — a separate problem that can sit alongside this one.',
        discriminator:
          'The limb is the one VA finding that appears nowhere on the console. It is found by going and looking at it.',
        limitation:
          'None of the VA states this lesson loads moves the limb: distal perfusion reads normal and the NIRS value is fixed across every one of them. Limb ischemia is a real and important VA explanation, and it is the one this simulation cannot show you.',
      },
      'lv-distension': {
        direction: 'Normal in this simulation.',
        discriminator:
          'The limb is checked on its own account, not as evidence about the ventricle.',
        limitation: 'Fixed across every VA state this lesson loads.',
      },
      'membrane-dysfunction': {
        direction: 'Normal in this simulation.',
        discriminator:
          'A device problem and a limb problem are separate findings on separate paths.',
        limitation: 'Fixed across every VA state this lesson loads.',
      },
      'gas-side-interruption': {
        direction: 'Normal in this simulation.',
        discriminator: 'Nothing about the gas path reaches the limb.',
        limitation: 'Fixed across every VA state this lesson loads.',
      },
      vasoplegia: {
        direction:
          'A vasodilated limb can look and feel well perfused while the mean pressure is low.',
        discriminator:
          'Warm, well-perfused extremities beside a low pressure is the tone pattern rather than a flow one.',
        limitation:
          'Fixed across every VA state this lesson loads, and vasoplegia is not among those states.',
      },
    },
  },
  {
    id: 'paco2-and-ph',
    label: 'PaCO₂ and pH',
    read: (state) => ({
      text: `${state.patient.paCO2.toFixed(1)} mmHg · pH ${state.patient.pH.toFixed(2)}`,
    }),
    cells: {
      'differential-oxygenation': {
        direction:
          'Little changed. Clearance is governed by the gas side, which this has not touched.',
        discriminator:
          'A settled carbon dioxide value beside a poorly saturated arm points at distribution rather than at exchange.',
      },
      'lv-distension': {
        direction: 'Little changed in this simulation.',
        discriminator: 'Loading is a pressure and volume problem before it is a gas-exchange one.',
      },
      'membrane-dysfunction': {
        direction: 'Would be expected to rise as transfer is lost.',
        discriminator: 'A rise here alongside a rising gradient points firmly at the device.',
        limitation:
          'In this simulation the carbon dioxide value follows the sweep setting and whether gas is reaching the membrane, so the membrane preview leaves it where it was. This row cannot be demonstrated with that preview.',
      },
      'gas-side-interruption': {
        direction: 'Rises quickly, with the pH following it down.',
        discriminator:
          'Speed is the discriminator. Nothing else on this list moves carbon dioxide this fast.',
      },
      vasoplegia: {
        direction:
          'Little changed until perfusion has been poor for long enough for lactate to appear.',
        discriminator:
          'The acid–base change of shock arrives late and does not separate tone from the rest of the list on its own.',
        limitation: 'Not demonstrable in the states this lesson loads.',
      },
    },
  },
]

/**
 * Where the VA differential runs out of what this simulation can show.
 *
 * Kept as content rather than as a comment so it is rendered to the learner rather than only to a
 * reviewer. All four were established by reading the modeled states, not by assumption.
 */
const modelLimitations: readonly { readonly id: string; readonly text: string }[] = [
  {
    id: 'no-vasoplegia-state',
    text: 'None of the VA states this lesson loads carries vasoplegia. The modeled mean arterial pressure here is generated from circuit flow, so it barely moves across those states, and nothing you can load will show you a pressure falling while circuit flow is maintained. The vasoplegia column is authored teaching supported by the sources rather than a preview you can open — which also means the reflex it warns against, reaching for pump speed when the pressure falls, cannot be played out here.',
  },
  {
    id: 'limb-fixed-across-states',
    text: 'None of the VA states this lesson loads moves the cannulated limb either: distal limb perfusion reads normal and the NIRS value is fixed across every one of them. Ischemia of the limb distal to an arterial cannula is a real and important VA explanation, and it is one of the few that is found only by examining the limb rather than by reading anything on the console. The row is in the matrix so that it is looked for; this simulation cannot demonstrate it.',
  },
  {
    id: 'membrane-preview-also-constrains-flow',
    text: 'The VA membrane preview couples resistance to flow, so its displayed flow falls rather than staying where it was. It also leaves both arterial saturations and the carbon dioxide value untouched, because this simulation authors those from whether gas is reaching the membrane rather than deriving them from what the membrane returns. Read that preview for the gradient it produces — the gradient rises while the flow carrying it falls, which is the pattern worth taking away.',
  },
  {
    id: 'watershed-position-is-authored',
    text: 'The differential-oxygenation state authors the upper-body and lower-body saturations directly. This simulation does not compute where native and circuit blood meet, so the watershed does not move here with native ejection, with pump speed, or with where the cannulae sit. The mechanism is real and the two-site measurement is what finds it; its dependence on those things is described in this panel rather than modeled by it.',
  },
]

function signed(value: number, precision: number): string {
  const rendered = Math.abs(value).toFixed(precision)
  if (Number(rendered) === 0) return `0${precision > 0 ? `.${'0'.repeat(precision)}` : ''}`
  return `${value > 0 ? '+' : '−'}${rendered}`
}

/** The comparative form of the shared direction words, for a sentence that names what it compares. */
const comparisonWord: Readonly<Record<'up' | 'down' | 'flat', string>> = {
  up: 'higher than',
  down: 'lower than',
  flat: 'unchanged from',
}

/**
 * The earlier gradient this circuit can be compared with, and the flow it was carrying at the time.
 *
 * The learner's captured snapshot when there is one, and otherwise the earliest sample the circuit
 * has retained. Both belong to this same circuit; a value from any other circuit is never offered,
 * because the quantity that is interpretable is a change measured against a circuit's own history.
 *
 * The retained sample at time zero is a caveat rather than a measurement: this simulation writes it
 * as the state is constructed, before the loaded condition has taken effect, so for a preview that
 * opens with its mechanism already active it reports the undisturbed circuit. The section's model
 * boundary says so to the learner rather than leaving it here.
 */
function earlierGradient(
  state: EcmoSimulationState,
  snapshot: EcmoFoundationSnapshot | null | undefined,
): {
  readonly label: string
  readonly seconds: number
  readonly deltaP: number | null
  readonly bloodFlow: number
} | null {
  if (snapshot) {
    return {
      label: 'the snapshot captured in this session',
      seconds: Math.max(0, state.simulationTime - snapshot.simulationTime),
      deltaP: snapshot.deltaP,
      bloodFlow: snapshot.bloodFlow,
    }
  }
  const first = state.trends[0]
  if (!first) return null
  return {
    label: 'the earliest sample this circuit has retained',
    seconds: Math.max(0, state.simulationTime - first.time),
    deltaP: first.deltaP,
    bloodFlow: first.flow,
  }
}

export function VaIntegrationCapstonePanel({
  state,
  snapshot,
}: {
  readonly state: EcmoSimulationState
  readonly snapshot?: EcmoFoundationSnapshot | null
}) {
  const { circuit, patient, gas } = state
  const gradientNow = circuit.readouts.deltaP.displayed
  const earlier = earlierGradient(state, snapshot)

  return (
    <div className={styles.panel} data-teaching-panel="va-integration-capstone">
      <VaConfigurationLabel />
      <ModelBoundary>{VA_CONFIGURATION_BOUNDARY}</ModelBoundary>
      <section className={styles.section} aria-labelledby="va-capstone-flow-heading">
        <h3 id="va-capstone-flow-heading" className={styles.heading}>
          The two signals that cannot settle this
        </h3>
        <p className="mt-2 text-sm leading-6" data-flow-cannot-discriminate>
          Displayed circuit flow is {circuit.bloodFlow.toFixed(2)} L/min. Every explanation on this
          page is compatible with that number, which is exactly why it is the wrong place to act
          from. Work instead from what each explanation predicts somewhere else.
        </p>
        <p className="mt-2 text-sm leading-6" data-circuit-generated-pressure>
          In VA a second comfortable number sits beside it. The mean arterial pressure reads{' '}
          {patient.meanArterialPressure.toFixed(0)} mmHg, and in this simulation that pressure is
          generated from circuit flow — so it is the pump reporting on itself rather than the
          patient reporting on their circulation. A circuit-generated pressure discriminates nothing
          on this list, and the same is true at the bedside of a pressure carried by a circuit that
          has not changed.
        </p>
        <p className="mt-2 text-sm leading-6">
          Name what is actually in front of you before choosing between explanations. The right
          radial saturation is {patient.rightRadialSpo2.toFixed(1)} and the femoral arterial
          saturation is {patient.femoralArterialSpo2.toFixed(1)}. Native cardiac output is modeled
          at {patient.nativeCardiacOutputLpm.toFixed(2)} L/min, the pulse pressure is{' '}
          {patient.pulsePressure.toFixed(0)} mmHg, and the aortic valve is {valveWord(state)}. The
          lungs show {congestionWord[patient.pulmonaryCongestion]}. The arterial carbon dioxide
          value is {patient.paCO2.toFixed(1)} mmHg with a pH of {patient.pH.toFixed(2)}, and the gas
          source is {gas.sourceConnected ? 'connected' : 'interrupted'}.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="va-hypothesis-matrix-heading">
        <h3 id="va-hypothesis-matrix-heading" className={styles.heading}>
          What each explanation predicts, and what this case shows
        </h3>
        <p className="mt-2 text-sm leading-6">
          Directions, not numbers. A hypothesis is not excluded because one modeled value is absent
          or because one row does not separate it — a row that discriminates nothing is reported as
          discriminating nothing.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[76rem] text-left text-sm" data-hypothesis-matrix>
            <caption className="sr-only">
              Each observed signal with its live value in the case currently loaded, and the
              direction each of the five explanations predicts for it, together with what makes that
              row useful and any limitation that applies.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 pr-3 align-bottom font-semibold">
                  Signal
                </th>
                <th scope="col" className="pb-1 pr-3 align-bottom font-semibold">
                  In this case now
                </th>
                {hypotheses.map((hypothesis) => (
                  <th
                    key={hypothesis.id}
                    scope="col"
                    className="pb-1 pr-3 align-bottom font-semibold"
                    data-hypothesis-column={hypothesis.id}
                  >
                    <span className="block">{hypothesis.label}</span>
                    <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                      {hypothesis.mechanism}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const live = row.read(state)
                return (
                  <tr key={row.id} data-matrix-row={row.id} className="align-top">
                    <th scope="row" className="py-2 pr-3 font-medium">
                      {row.label}
                    </th>
                    <td className="py-2 pr-3" data-live-finding={row.id}>
                      {live.text}
                      {live.reason ? (
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {live.reason}
                        </span>
                      ) : null}
                    </td>
                    {hypotheses.map((hypothesis) => {
                      const cell = row.cells[hypothesis.id]
                      return (
                        <td
                          key={hypothesis.id}
                          className="py-2 pr-3"
                          data-matrix-cell={`${row.id}:${hypothesis.id}`}
                        >
                          <span className="block">{cell.direction}</span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                            {cell.discriminator}
                          </span>
                          {cell.limitation ? (
                            <span className="mt-1 block text-xs leading-5" data-cell-limitation>
                              <span className="font-semibold">Limitation. </span>
                              {cell.limitation}
                            </span>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {hypotheses.map((hypothesis) => (
          <TextEquivalent key={hypothesis.id}>
            <span className="font-semibold">{hypothesis.label}. </span>
            {hypothesis.mechanism}{' '}
            {rows.map((row) => `${row.label}: ${row.cells[hypothesis.id].direction}`).join(' ')}{' '}
            {rows
              .filter((row) => row.cells[hypothesis.id].limitation)
              .map((row) => `Limitation for ${row.label}: ${row.cells[hypothesis.id].limitation}`)
              .join(' ')}
          </TextEquivalent>
        ))}

        <TextEquivalent>
          The live column reads, in the same order: displayed circuit flow{' '}
          {circuit.bloodFlow.toFixed(2)} L/min; pVen{' '}
          {channelSentence(circuit.readouts.pVen, 'mmHg')}; pInt{' '}
          {channelSentence(circuit.readouts.pInt, 'mmHg')} and pArt{' '}
          {channelSentence(circuit.readouts.pArt, 'mmHg')}; the gradient{' '}
          {channelSentence(circuit.readouts.deltaP, 'mmHg')}; drainage-limb saturation{' '}
          {channelSentence(circuit.readouts.venousLineSaturation, '', 1)}; post-oxygenator
          saturation {circuit.postOxygenatorSaturation.toFixed(1)}; right radial{' '}
          {patient.rightRadialSpo2.toFixed(1)}; femoral {patient.femoralArterialSpo2.toFixed(1)};
          the gap between the two arterial sites{' '}
          {Math.abs(patient.femoralArterialSpo2 - patient.rightRadialSpo2).toFixed(1)}; pulse
          pressure {patient.pulsePressure.toFixed(0)} mmHg; aortic valve {valveWord(state)}; the
          lungs {congestionWord[patient.pulmonaryCongestion]}; mean arterial pressure{' '}
          {patient.meanArterialPressure.toFixed(0)} mmHg; gas source{' '}
          {gas.sourceConnected ? 'connected' : 'interrupted'} with sweep {gas.sweepLpm.toFixed(1)}{' '}
          L/min; cannulated limb {limbPerfusionWord[patient.distalLimbPerfusion]} with NIRS{' '}
          {patient.distalLimbNirs.toFixed(0)}; and the arterial carbon dioxide value{' '}
          {patient.paCO2.toFixed(1)} mmHg with a pH of {patient.pH.toFixed(2)}.
        </TextEquivalent>

        <ModelBoundary>
          The directions in the matrix are what these mechanisms do. The magnitudes, and the speed
          at which the modeled values reach them, belong to this simulation — and one whole column,
          vasoplegia, cannot be shown live here at all, while the cannulated-limb row never moves in
          any state this lesson can load. The limitations below say why. One further display
          convention: the two arterial sites are reported as agreeing whenever they differ by no
          more than {SATURATION_GAP_DEADBAND} saturation points, so that a value moving in its last
          decimal does not read as a gap. The difference itself is printed beside the words.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="va-presenting-case-heading">
        <h3 id="va-presenting-case-heading" className={styles.heading}>
          Why there is no separate differential-oxygenation preview
        </h3>
        <div className="mt-3 rounded-xl border border-dashed p-3" data-presenting-case-mechanism>
          <p className="text-sm leading-6">
            The presenting case and the differential-oxygenation state settle to the same state in
            this simulation, so the presenting case already is that mechanism. Loading a second copy
            of it would put an identical circuit on screen and teach nothing. This section is about
            the presenting case whichever state you have loaded at the moment; the live column above
            always reports the state actually on screen.
          </p>
          <p className="mt-2 text-sm leading-6">
            What separates these five explanations is therefore not another state to load. It is the
            findings you go and look at: two arterial sites rather than one, the pulse pressure and
            whether the valve is opening, pInt and pArt and the gradient read as a set, the gas
            connection at the panel and at the membrane, and the limb distal to the arterial
            cannula. Every one of those sits away from the flow display, and the arterial pressure
            beside that display is generated by the circuit here rather than measured against the
            patient.
          </p>
          <p className="mt-2 text-sm leading-6">
            The three explanations with previews — loading, the membrane, the gas side — are worth
            loading one at a time and reading against the presenting case. The two without previews
            are still full members of the differential. Reaching one of them by ruling everything
            else out is a different, and weaker, piece of reasoning than reaching it by finding what
            it predicts.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="va-gradient-window-heading">
        <h3 id="va-gradient-window-heading" className={styles.heading}>
          The gradient, read against this circuit&rsquo;s own earlier value
        </h3>
        {gradientNow === null ? (
          <AwaitingCircuit label="membrane gradient" />
        ) : earlier === null || earlier.deltaP === null ? (
          <p className="mt-2 text-sm leading-6" data-gradient-window="no-earlier-value">
            The gradient reads {gradientNow.toFixed(0)} mmHg at a circuit flow of{' '}
            {circuit.bloodFlow.toFixed(2)} L/min. No earlier value from this same circuit is
            available yet, and a gradient carries no meaning without one measured at a comparable
            flow — so this row is not yet evidence for or against the membrane.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6" data-gradient-window="compared">
              The gradient reads {gradientNow.toFixed(0)} mmHg now, at a circuit flow of{' '}
              {circuit.bloodFlow.toFixed(2)} L/min, against {earlier.deltaP.toFixed(0)} mmHg at{' '}
              {earlier.bloodFlow.toFixed(2)} L/min taken from {earlier.label}
              {earlier.seconds > 0
                ? `, ${earlier.seconds.toFixed(0)} modeled seconds ago`
                : ', captured at this same moment'}
              . That is{' '}
              {
                comparisonWord[
                  direction(gradientNow - earlier.deltaP, ECMO_BASELINE_DISPLAY_DEADBANDS.deltaP)
                ]
              }{' '}
              the earlier value, a raw change of {signed(gradientNow - earlier.deltaP, 0)} mmHg,
              with the flow{' '}
              {
                comparisonWord[
                  direction(
                    circuit.bloodFlow - earlier.bloodFlow,
                    ECMO_BASELINE_DISPLAY_DEADBANDS.bloodFlow,
                  )
                ]
              }{' '}
              what it was then, a raw change of {signed(circuit.bloodFlow - earlier.bloodFlow, 2)}{' '}
              L/min.
            </p>
            <p className="mt-2 text-sm leading-6">
              Both halves of that sentence are the reading. A gradient that has risen while the flow
              carrying it has fallen is the membrane pattern; a gradient that has risen along with
              its flow may be reporting nothing but the flow.
            </p>
          </>
        )}
        <ModelBoundary>
          The words higher, lower and unchanged come from a display deadband this simulation applies
          so a value moving in its last decimal does not read as movement. The raw change is printed
          beside every one of them. When you have captured no snapshot, the earlier value comes from
          the first sample in this circuit&rsquo;s retained trend, which this simulation writes as
          the state is built rather than after the loaded condition has taken effect — so a preview
          that opens with its mechanism already active is being compared with a frame that circuit
          was never actually in. Read that particular comparison as the difference between an
          undisturbed circuit and this one, not as a deterioration you watched happen. Neither the
          deadband nor the observed window is a clinical tolerance, and a window of modeled seconds
          is not the window over which a real circuit is trended.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="va-capstone-limitations-heading">
        <h3 id="va-capstone-limitations-heading" className={styles.heading}>
          Where this simulation stops
        </h3>
        <ul className="mt-3 grid gap-2" data-model-limitations>
          {modelLimitations.map((limitation) => (
            <li
              key={limitation.id}
              className="rounded-xl border px-3 py-2 text-sm leading-6"
              data-model-limitation={limitation.id}
            >
              {limitation.text}
            </li>
          ))}
        </ul>
      </section>

      <GuidedValue
        guide={ecmoDerivedValueGuides.transmembraneDeltaP}
        value={circuit.readouts.deltaP.displayed}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.venousLineSaturation}
        value={circuit.readouts.venousLineSaturation.displayed}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.recirculationAdjustedCircuitFlow}
        value={round(circuit.recirculationAdjustedCircuitFlowLpm, 2)}
        headingLevel={3}
      />
    </div>
  )
}
