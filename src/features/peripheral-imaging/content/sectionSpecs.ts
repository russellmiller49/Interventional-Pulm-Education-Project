import { SOURCE_BY_ID } from '../data/sources'
import type { SourceId } from '../types'
import { imagingCaseById, imagingCasesPairedTo } from './cases'
import { chainStopIds, type ChainStopId } from './imagingChain'
import { imagingControlIds, type ControlStrip, type ImagingControlId } from './controlPanel'
import { IMAGING_GRAMMAR } from './grammar'
import { imagingLabGoals } from './labGoals'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { imagingLesson, peripheralImagingSectionIds, type ImagingSectionId } from './pathway'
import { imagingSortFor } from './sorts'

/**
 * The ladder: one record per section, in the pathway's order.
 *
 * A spec carries what the lesson data cannot — the one new concept as a claim, the discrimination
 * the section enables, the increment counted out loud, which stops of the chain it lights, which
 * rows of the one table it highlights, what its Act is, the control strip its Explain step shows,
 * the phrases no pre-commit surface may carry, the model boundary, and the capstone case its idea
 * returns in. The pathway stays the order; this is what a section *is*.
 */
export type ImagingSectionAct =
  | { readonly kind: 'lab' }
  | { readonly kind: 'walk' }
  | { readonly kind: 'sort'; readonly sortId: string }

export interface ImagingSectionSpec {
  readonly id: ImagingSectionId
  /** The Now card title of the first step, in presentation terms — never the answer. */
  readonly recognizeTitle: string
  /** Exactly one. */
  readonly newConcept: string
  /** The discrimination this section enables. Never opens with the action the section ends in. */
  readonly objective: string
  /** "This section adds one idea to the last: …" — counted out loud. */
  readonly incrementSentence: string
  readonly prerequisiteSectionIds: readonly ImagingSectionId[]
  /** The stops the chain map lights while this section runs. */
  readonly chainStops: readonly ChainStopId[]
  readonly grammarRowIds: readonly string[]
  readonly act: ImagingSectionAct
  readonly controlStrip: ControlStrip
  /** Phrases that name this section's keyed answer. No pre-commit surface may carry one. */
  readonly precommitDenyPatterns: readonly RegExp[]
  /**
   * Whether the lit stops' cards may show before the prediction. The walk section hides them: its
   * prediction is answered by the very cards the walk then reveals.
   */
  readonly stopCardsBeforeCommit?: boolean
  /** What the model does not represent, said to the learner under the scene and at Explain. */
  readonly modelBoundary: string
  /** The capstone case in which this section's idea returns, if one does. */
  readonly capstoneCaseId: string | null
  readonly sourceIds: readonly SourceId[]
}

type Strip = Readonly<Record<ImagingControlId, ControlStrip['states'][ImagingControlId]>>

const allMonitoring: Strip = {
  angle: 'monitoring',
  field: 'monitoring',
  time: 'monitoring',
  acquisition: 'monitoring',
  display: 'monitoring',
}

function oneOf(id: ImagingControlId, extra: Partial<Strip> = {}): Strip {
  return {
    angle: 'not-this-one',
    field: 'not-this-one',
    time: 'not-this-one',
    acquisition: 'not-this-one',
    display: 'not-this-one',
    ...extra,
    [id]: 'this-one',
  }
}

const noneOf = (extra: Partial<Strip> = {}): Strip => ({
  angle: 'not-this-one',
  field: 'not-this-one',
  time: 'not-this-one',
  acquisition: 'not-this-one',
  display: 'not-this-one',
  ...extra,
})

const SHARED_BOUNDARY =
  'The CT supplies anatomy; the target, the instrument and every number are authored for teaching and are not equipment settings, patient measurements or dose.'

export const imagingSectionSpecs: readonly ImagingSectionSpec[] = Object.freeze([
  {
    id: 'imaging-questions',
    recognizeTitle: 'Four displays, one procedure',
    newConcept:
      'A navigation screen, an image, an ultrasound signal and a specimen answer four different questions.',
    objective:
      'Distinguish the question each display in the suite answers from the questions it only appears to answer.',
    incrementSentence:
      'This course asks one question first: what does this image establish? Everything after it is a different way of answering.',
    prerequisiteSectionIds: [],
    chainStops: ['display'],
    grammarRowIds: [],
    act: { kind: 'sort', sortId: 'four-questions' },
    controlStrip: {
      verdict: 'no-control-change-the-question',
      states: allMonitoring,
      sentence:
        'No control here. This section is about what each display can say before anything is changed.',
    },
    precommitDenyPatterns: [/map-relative/i, /hardware location/i],
    modelBoundary:
      'The displays in this section are authored descriptions of what each technology reports, not device output. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['setser', 'confirm'],
  },
  {
    id: 'chain-walk',
    recognizeTitle: 'The suite, running',
    newConcept:
      'An X-ray image is made along a chain of six stops, and each stop answers for one part of it.',
    objective:
      'Name the six stops between the tube and the decision, and say which stop each imaging term belongs to.',
    incrementSentence:
      'This section adds one idea to the last: the image is made along a chain of six stops, and each stop answers for one part of it.',
    prerequisiteSectionIds: ['imaging-questions'],
    chainStops: ['source', 'beam', 'patient', 'detector', 'reconstruction', 'display'],
    grammarRowIds: ['overlap-depth'],
    act: { kind: 'walk' },
    controlStrip: {
      verdict: 'this-control',
      states: oneOf('angle'),
      sentence:
        'This control: the aim, moved once at the beam stop. The others wait for their sections.',
    },
    precommitDenyPatterns: [/one ray,? one pixel/i, /along (that|the) ray/i],
    stopCardsBeforeCommit: false,
    modelBoundary:
      'The suite is a teaching scene: a generic gantry over a CT-derived thorax, with cone geometry shared with the projection you see. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['tg272', 'setser'],
  },
  {
    id: 'good-image',
    recognizeTitle: 'The console, before the first fault',
    newConcept:
      'Five things change the acquisition; the machine sets the exposure and the rest is monitoring.',
    objective:
      'Distinguish the five things you can change at the C-arm from the things the machine changes for you and the things that only change the display.',
    incrementSentence:
      'This section adds one idea: of everything on the console, five things change the acquisition, and the rest is monitoring.',
    prerequisiteSectionIds: ['chain-walk'],
    chainStops: ['source', 'beam', 'detector', 'display'],
    grammarRowIds: ['hidden-by-anatomy', 'small-on-screen'],
    act: { kind: 'sort', sortId: 'five-things' },
    controlStrip: {
      verdict: 'this-control',
      states: {
        angle: 'this-one',
        field: 'this-one',
        time: 'this-one',
        acquisition: 'this-one',
        display: 'this-one',
      },
      sentence: 'All five are yours. Everything else on the console is monitoring.',
    },
    precommitDenyPatterns: [/acquisition field/i, /adds no exposure/i],
    modelBoundary:
      'The console controls in this section are named generically; button labels, readout modes and exposure regulation differ by system. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['tg272', 'tg125', 'wabip'],
  },
  {
    id: 'current-anatomy',
    recognizeTitle: 'The map and the lung today',
    newConcept:
      'The map was drawn at one moment; the lung has a timestamp of its own, and tracking can be exact while the map is stale.',
    objective:
      'Distinguish a planning-map mismatch from loss of tracking or inadequate target coverage.',
    incrementSentence:
      'This section adds one idea: the map was drawn at one moment, and the lung has a timestamp of its own.',
    prerequisiteSectionIds: ['imaging-questions', 'chain-walk'],
    chainStops: ['patient', 'reconstruction'],
    grammarRowIds: ['target-vanished'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'no-control-change-the-measurement',
      states: noneOf(),
      sentence:
        'No control on the C-arm moves a lung back. A new measurement of the current anatomy does.',
    },
    precommitDenyPatterns: [/aeration, coverage and target identity/i, /assess current aeration/i],
    modelBoundary:
      'The CT is translated rigidly by the learner, not deformed by a model of ventilation, recruitment or a clinical intervention. The field generator and the sensor are schematic; no tracking error or vendor registration is modelled. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['setser', 'ilocate', 'vespa', 'pritchett'],
  },
  {
    id: 'projection',
    recognizeTitle: 'A needle that looks on target',
    newConcept:
      'Each pixel is one ray, so a single image cannot say how far apart two things on that ray are.',
    objective:
      'Distinguish projected overlap from a resolved three-dimensional tool–target relationship.',
    incrementSentence:
      'This section adds one idea to the walk: each pixel is one ray, so a single image cannot say how far apart two things on that ray are.',
    prerequisiteSectionIds: ['imaging-questions', 'current-anatomy', 'good-image'],
    chainStops: ['beam', 'detector'],
    grammarRowIds: ['hidden-by-anatomy', 'overlap-depth'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'this-control',
      states: oneOf('angle', { display: 'harmful-reflex' }),
      sentence:
        'This control: the aim. The harmful reflex: enlarging the display, which shows the same ray larger.',
    },
    precommitDenyPatterns: [
      /parallax/i,
      /exposes a component/i,
      /view change (did|does) not move/i,
    ],
    modelBoundary:
      'The volume renderer sums through a quantised CT to make a projection; this is not acquired fluoroscopy. The tool moves along the initial source–target ray so that frontal overlap can hide depth. Model axes are patient left, anterior and superior; verify real console orientation conventions. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['setser', 'tg272', 'pritchett'],
  },
  {
    id: 'signal',
    recognizeTitle: 'A crisp needle, a faint nodule',
    newConcept:
      'A target can be hard to see for three different reasons, and only one of them is fixed by more photons.',
    objective: 'Distinguish quantum noise from scatter and overlapping anatomy.',
    incrementSentence:
      'This section adds one idea: a target can be hard to see for three different reasons, and only one of them is fixed by more photons.',
    prerequisiteSectionIds: ['projection', 'good-image'],
    chainStops: ['source', 'patient'],
    grammarRowIds: ['hidden-by-anatomy', 'grainy'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'this-control',
      states: oneOf('angle', { display: 'not-this-one' }),
      sentence:
        'This control: the aim, when anatomy is the limit. Not this one: the display. More photons are not a control you hold.',
    },
    precommitDenyPatterns: [/useful projection/i, /different beam path/i, /superimposed heart/i],
    modelBoundary:
      'The tissue along the ray is read from the quantised CT as a relative attenuation proxy, not exposure or dose. Scatter and automatic exposure regulation are described, not simulated. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['tg125', 'tg272', 'wabip', 'setser'],
  },
  {
    id: 'field',
    recognizeTitle: 'A smaller picture',
    newConcept:
      'What was acquired and what is displayed are different things, and only one of them costs radiation.',
    objective:
      'Distinguish physical beam restriction and acquisition changes from display-only operations.',
    incrementSentence:
      'This section adds one idea: what was acquired and what is displayed are different things, and only one of them costs radiation.',
    prerequisiteSectionIds: ['signal', 'projection'],
    chainStops: ['beam', 'display'],
    grammarRowIds: ['grainy', 'small-on-screen'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'this-control',
      states: oneOf('field', { display: 'harmful-reflex' }),
      sentence:
        'This control: the width. The harmful reflex: cropping the display and believing the beam followed.',
    },
    precommitDenyPatterns: [/does not change/i, /visible image only/i],
    modelBoundary:
      'The area ratio assumes a square field with both sides scaled equally. Scatter, automatic exposure response, detector readout and clinical image quality are not calculated. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: 'case-2',
    sourceIds: ['wabip', 'tg125', 'tg272', 'setser'],
  },
  {
    id: 'time',
    recognizeTitle: 'A moving needle',
    newConcept: 'A moving image has three clocks, and only two of them measure anything.',
    objective: 'Distinguish within-frame blur, between-frame movement, and display lag.',
    incrementSentence:
      'This section adds one idea: a moving image has three clocks, and only two of them measure anything.',
    prerequisiteSectionIds: ['signal', 'field'],
    chainStops: ['detector'],
    grammarRowIds: ['blur-or-lag'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'this-control',
      states: oneOf('time'),
      sentence:
        'This control: the time sampling. Not this one: the display refresh, which measures nothing.',
    },
    precommitDenyPatterns: [/remains constant/i, /same mAs/i, /unchanged in this simplified/i],
    modelBoundary:
      'Authored rate, pulse width, current and speed values illustrate arithmetic, not recommended presets. Tube load is not patient dose; voltage, filtration, geometry, attenuation and controller behaviour are outside this model, and monitor refresh and processing lag are not simulated. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['tg272', 'tg125', 'wabip'],
  },
  {
    id: 'two-dimensional',
    recognizeTitle: 'Still no target',
    newConcept:
      'The order of adjustments follows the chain, and when the chain is right the question changes.',
    objective:
      'Select the next useful adjustment when fluoroscopy does not answer the procedural question.',
    incrementSentence:
      'This section adds nothing new. It puts the last five ideas in the order you use them in.',
    prerequisiteSectionIds: ['current-anatomy', 'projection', 'signal', 'field', 'time'],
    chainStops: ['beam', 'patient', 'detector', 'display'],
    grammarRowIds: ['probe-pattern'],
    act: { kind: 'sort', sortId: 'next-adjustment' },
    controlStrip: {
      verdict: 'no-control-change-the-measurement',
      states: noneOf(),
      sentence:
        'When the aim, the width and the timing are right and the question is still open, no knob answers it. Ask for a different measurement.',
    },
    precommitDenyPatterns: [
      /current localization/i,
      /additional (current )?imaging/i,
      /additional modality/i,
    ],
    modelBoundary:
      'The findings in this section are authored situations. The sequence is a proposed workflow informed by published practice, not a validated bundle. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: 'case-1',
    sourceIds: ['setser', 'tg272', 'wabip', 'mobile', 'ilocate'],
  },
  {
    id: 'dts-acquisition',
    recognizeTitle: 'Depth from a sweep',
    newConcept: 'Sample one ray from a fan of angles and depth comes back, unevenly.',
    objective:
      'Explain what a limited angular acquisition adds to one projection and what remains incompletely sampled.',
    incrementSentence:
      'This section adds one idea to the ray: sample it from a fan of angles and depth comes back, unevenly.',
    prerequisiteSectionIds: ['projection', 'two-dimensional'],
    chainStops: ['beam', 'reconstruction'],
    grammarRowIds: ['overlap-depth', 'elongated-depth'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'this-control',
      states: oneOf('acquisition', { display: 'not-this-one' }),
      sentence:
        'This control: the acquisition, a sweep instead of one image. Not this one: the display; finer pixels do not measure the missing directions.',
    },
    precommitDenyPatterns: [
      /angular coverage/i,
      /missing wedge/i,
      /direction-dependent/i,
      /missing directions/i,
    ],
    modelBoundary:
      'These are parallel projections of the teaching CT with an added target and instrument. A horizontal filter suppresses slowly varying background, then the browser combines thirteen views by shift-and-add at the selected depth under one fixed display window. Limited-angle blur remains; this is not a clinical tomosynthesis reconstruction, a vendor algorithm or a dose comparison. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['saad', 'frontier'],
  },
  {
    id: 'dts-interpretation',
    recognizeTitle: 'Where did this image come from',
    newConcept: 'A reconstruction has ingredients, and one of them may be an older scan.',
    objective:
      'Distinguish current projection evidence, prior-informed anatomy and navigation updates.',
    incrementSentence:
      'This section adds one idea: a reconstruction has ingredients, and one of them may be an older scan.',
    prerequisiteSectionIds: ['dts-acquisition', 'current-anatomy'],
    chainStops: ['reconstruction', 'display'],
    grammarRowIds: ['elongated-depth'],
    act: { kind: 'sort', sortId: 'three-uses' },
    controlStrip: {
      verdict: 'no-control-change-the-question',
      states: allMonitoring,
      sentence: 'No control here. The question is what went into the picture, not what to turn.',
    },
    precommitDenyPatterns: [/technical evidence/i, /closer agreement/i],
    modelBoundary:
      'The prior layer in this section is the planning CT blended for illustration, not an iterative prior-aided algorithm; the study it refers to evaluated reconstruction, not diagnostic yield. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: 'case-3',
    sourceIds: ['saad', 'frontier', 'pritchett'],
  },
  {
    id: 'cbct-acquisition',
    recognizeTitle: 'Before the spin',
    newConcept: 'A full orbit measures every direction, and every direction has to be clear.',
    objective:
      'Distinguish an acquisition-ready setup from one with unresolved coverage, motion or clearance problems.',
    incrementSentence:
      'This section adds one idea to the sweep: a full orbit measures every direction, and every direction has to be clear.',
    prerequisiteSectionIds: ['current-anatomy', 'dts-acquisition', 'time'],
    chainStops: ['source', 'beam', 'patient', 'detector', 'reconstruction'],
    grammarRowIds: [],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'this-control',
      states: oneOf('acquisition'),
      sentence:
        'This control: the acquisition, once the target is centred and the orbit is clear. Not this one: any of the others, until it is.',
    },
    precommitDenyPatterns: [
      /centering method/i,
      /recheck (coverage and )?clearance/i,
      /anterior\/posterior offset/i,
    ],
    modelBoundary:
      'Scouts are CT-derived projections in the same geometry as the centering controls. The gantry is a generic motion reference; choosing a workflow does not make it an equipment-specific clearance model, and the centering tolerance is authored for this exercise. No collision detection, clinical reconstruction or breath-hold tolerance is calculated. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: 'case-4',
    sourceIds: ['setser', 'mobile', 'wabip'],
  },
  {
    id: 'fixed-suite',
    recognizeTitle: 'The installed room',
    newConcept: 'An installed room can track its own equipment, and the patient is not equipment.',
    objective: 'Adapt shared acquisition requirements to an integrated fixed-room workflow.',
    incrementSentence:
      'This section adds one idea: an installed room can track its own equipment, and the patient is not equipment.',
    prerequisiteSectionIds: ['cbct-acquisition', 'field'],
    chainStops: ['patient', 'reconstruction'],
    grammarRowIds: ['target-vanished'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'no-control-change-the-question',
      states: allMonitoring,
      sentence:
        'No control tracks a lung. The overlay followed the table; the anatomy did not promise to follow the overlay.',
    },
    precommitDenyPatterns: [
      /prior segmentation/i,
      /requir(es|ing) reassessment/i,
      /anatomical tracking/i,
    ],
    modelBoundary:
      'The fixed workflow changes guidance and readiness; it does not represent a manufacturer model, a mounted gantry’s envelope or a room’s shielding. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['setser', 'wabip', 'pritchett', 'verhoeven', 'tg272'],
  },
  {
    id: 'mobile-suite',
    recognizeTitle: 'A scanner in the bronch suite',
    newConcept: 'A volume that can be exported is not a map that has been updated.',
    objective:
      'Adapt shared acquisition requirements to a mobile scanner and an existing procedure room.',
    incrementSentence:
      'This section adds one idea: a volume that can be exported is not a map that has been updated.',
    prerequisiteSectionIds: ['cbct-acquisition', 'fixed-suite'],
    chainStops: ['patient', 'reconstruction'],
    grammarRowIds: [],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'no-control-change-the-question',
      states: allMonitoring,
      sentence:
        'No control here. Export, review, map update and overlay are separate capabilities to check, not settings to turn.',
    },
    precommitDenyPatterns: [
      /receiving display/i,
      /separate capabilities/i,
      /separately supported workflows/i,
    ],
    modelBoundary:
      'The mobile workflow changes guidance, readiness and the drawn field; it does not represent a manufacturer model, an export pathway or a validated integration. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['mobile', 'setser', 'wabip', 'tg272', 'pritchett'],
  },
  {
    id: 'tool-confirmation',
    recognizeTitle: 'Where the tissue comes from',
    newConcept:
      'The thing that samples is a shape in three dimensions, and its tip is only one point of it.',
    objective:
      'Distinguish projected hardware overlap, tip position and sampling-region intersection on multiplanar views.',
    incrementSentence:
      'This section adds one idea: the thing that samples is a shape in three dimensions, and its tip is only one point of it.',
    prerequisiteSectionIds: ['cbct-acquisition', 'projection', 'two-dimensional'],
    chainStops: ['reconstruction', 'display'],
    grammarRowIds: ['probe-pattern'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'this-control',
      states: oneOf('display', { acquisition: 'not-this-one' }),
      sentence:
        'This control: the display, thin planes over a slab. Not this one: the acquisition; another spin does not move the window.',
    },
    precommitDenyPatterns: [/different depths/i, /combined structures/i],
    modelBoundary:
      'CT-derived lung context is combined with analytic sections of an authored sphere and a fictional side window behind the tip; the slab is a maximum-intensity projection over an authored depth. This is not a clinical reconstruction or a specification for a real needle, and it omits vessels, pleura, tool deformation, metal artifact and tissue acquisition. Geometric intersection does not establish safe or diagnostic sampling. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: 'case-5',
    sourceIds: ['setser', 'pritchett', 'mobile', 'tg272'],
  },
  {
    id: 'changing-anatomy',
    recognizeTitle: 'The image and the procedure part ways',
    newConcept: 'Every image is a snapshot of a state, and validity ends when the state changes.',
    objective:
      'Distinguish a correctable acquisition artifact from an anatomical or physiological change requiring reassessment.',
    incrementSentence:
      'This section adds one idea: every image is a snapshot of a state, and validity ends when the state changes.',
    prerequisiteSectionIds: ['current-anatomy', 'tool-confirmation', 'time', 'dts-interpretation'],
    chainStops: ['patient', 'reconstruction'],
    grammarRowIds: ['target-vanished'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'no-control-change-the-measurement',
      states: noneOf({ acquisition: 'harmful-reflex' }),
      sentence:
        'No control repairs a moved lung. The harmful reflex: repeating the same acquisition and hoping.',
    },
    precommitDenyPatterns: [
      /stability and (respiratory )?coordination/i,
      /coordinated acquisition state/i,
      /tolerable coordinated/i,
    ],
    modelBoundary:
      'The stored contour and the current anatomy differ by a rigid translation the learner sets; no ventilation, recruitment, motion artifact or vendor registration is simulated, and ground truth is visible only for teaching. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: 'case-6',
    sourceIds: ['setser', 'tg272', 'ilocate', 'vespa', 'pritchett'],
  },
  {
    id: 'staff-protection',
    recognizeTitle: 'The people around the beam',
    newConcept: 'The patient is the source of what reaches the staff.',
    objective:
      'Select staff protection based on the irradiated patient, equipment geometry and effective barriers.',
    incrementSentence:
      'This section adds one idea: the patient is the source of what reaches the staff.',
    prerequisiteSectionIds: ['field', 'cbct-acquisition'],
    chainStops: ['patient'],
    grammarRowIds: ['dose-number'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'no-control-change-the-question',
      states: allMonitoring,
      sentence:
        'None of the five protects a colleague. Distance, the barrier and which side the tube sits on do.',
    },
    precommitDenyPatterns: [
      /hands? out(side)? (of )?the (primary )?beam/i,
      /outside the (irradiated )?field/i,
      /supported stabilization/i,
    ],
    modelBoundary:
      'The patient is an extended, nonuniform scatter source. The inverse-square trend at fixed output, with an authored tube-side weighting, is not a staff-dose calculator, a room survey or a safe-distance rule, and the barrier has no validated material or protection rating. Follow the radiation safety officer’s verified positions and shielding plan. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: 'case-7',
    sourceIds: ['wabip', 'icrp', 'tg125'],
  },
  {
    id: 'dose-reporting',
    recognizeTitle: 'Two numbers on the report',
    newConcept: 'A dose report holds several quantities, and each answers a different question.',
    objective:
      'Distinguish dose indices, their units, and the information needed for whole-procedure review.',
    incrementSentence:
      'This section adds one idea: a dose report holds several quantities, and each answers a different question.',
    prerequisiteSectionIds: ['staff-protection', 'time', 'field'],
    chainStops: ['beam', 'detector'],
    grammarRowIds: ['dose-number'],
    act: { kind: 'lab' },
    controlStrip: {
      verdict: 'no-control-change-the-question',
      states: allMonitoring,
      sentence:
        'No control here. Read the quantity, its units and the modes before comparing any number.',
    },
    precommitDenyPatterns: [/smaller (exposed )?area/i, /outweigh/i, /can coexist/i],
    modelBoundary:
      'All exposure values are authored for arithmetic. No controller, patient attenuation, skin backscatter, organ dose or clinical action threshold is modelled. Keep different dose quantities and acquisition totals distinct. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: 'case-8',
    sourceIds: ['wabip', 'aapm12', 'skin', 'tg125', 'icrp'],
  },
  {
    id: 'suite-cases',
    recognizeTitle: 'One suite, every row',
    newConcept:
      'Every finding in the suite lives at one stop of the chain, and naming the stop decides the next move.',
    objective: 'Apply the imaging and protection principles to new suite decisions.',
    incrementSentence:
      'This section adds nothing new. Every row of the table, in the order the suite hands them to you.',
    prerequisiteSectionIds: [
      'two-dimensional',
      'dts-interpretation',
      'fixed-suite',
      'mobile-suite',
      'tool-confirmation',
      'changing-anatomy',
      'staff-protection',
      'dose-reporting',
    ],
    chainStops: ['source', 'beam', 'patient', 'detector', 'reconstruction', 'display'],
    grammarRowIds: [],
    act: { kind: 'sort', sortId: 'where-it-lives' },
    controlStrip: {
      verdict: 'no-control-change-the-question',
      states: allMonitoring,
      sentence: 'Every row of the table. Name the stop before naming a knob.',
    },
    precommitDenyPatterns: [
      /lives in the patient/i,
      /what the ray crosses/i,
      /anatomy on the ray/i,
    ],
    modelBoundary:
      'The findings in this section are the imaging guide’s rows, authored for teaching; the eight case decisions that follow on the Assess page are authored scenarios, not patient records. ' +
      SHARED_BOUNDARY,
    capstoneCaseId: null,
    sourceIds: ['setser', 'wabip', 'aapm12'],
  },
])

const specById = new Map(imagingSectionSpecs.map((spec) => [spec.id, spec] as const))

export function imagingSectionSpec(sectionId: ImagingSectionId): ImagingSectionSpec {
  const spec = specById.get(sectionId)
  if (!spec) throw new Error(`No section spec for ${sectionId}`)
  return spec
}

export const objectiveActionVerbPattern =
  /^(reduce|increase|restore|use|escalate|isolate|give|raise|lower|advance|rotate|collimate|center|centre|move|acquire|capture|repeat|reposition)\b/i

export function validateImagingSectionSpecs(
  specs: readonly ImagingSectionSpec[] = imagingSectionSpecs,
): readonly string[] {
  const errors: string[] = []
  if (specs.map((spec) => spec.id).join('|') !== peripheralImagingSectionIds.join('|')) {
    errors.push('Section specs are not one per pathway section, in pathway order.')
  }
  specs.forEach((spec, index) => {
    const where = `Section ${spec.id}`
    const lesson = imagingLesson(spec.id)
    errors.push(
      ...imagingLearnerCopyErrors(`${where} recognize title`, spec.recognizeTitle, {
        allowDigits: false,
      }),
      ...imagingLearnerCopyErrors(`${where} new concept`, spec.newConcept),
      ...imagingLearnerCopyErrors(`${where} objective`, spec.objective),
      ...imagingLearnerCopyErrors(`${where} increment`, spec.incrementSentence),
      ...imagingLearnerCopyErrors(`${where} boundary`, spec.modelBoundary),
      ...imagingLearnerCopyErrors(`${where} control strip`, spec.controlStrip.sentence),
    )
    if (spec.objective.split(/[.!?](\s|$)/).filter((part) => part.trim()).length > 2) {
      errors.push(`${where} objective runs past two sentences.`)
    }
    if (objectiveActionVerbPattern.test(spec.objective)) {
      errors.push(`${where} objective opens with an action verb; it must name a discrimination.`)
    }
    if (!/\b(one idea|nothing new|one question)\b/i.test(spec.incrementSentence)) {
      errors.push(`${where} increment sentence must count its new ideas out loud.`)
    }
    if (spec.prerequisiteSectionIds.join('|') !== lesson.prerequisites.join('|')) {
      errors.push(`${where} prerequisites differ from the lesson data.`)
    }
    if (
      index === 0
        ? spec.prerequisiteSectionIds.length > 0
        : spec.prerequisiteSectionIds.length === 0
    ) {
      errors.push(`${where} prerequisites: only the first section may assume nothing.`)
    }
    for (const prerequisite of spec.prerequisiteSectionIds) {
      const prerequisiteIndex = peripheralImagingSectionIds.indexOf(prerequisite)
      if (prerequisiteIndex < 0) errors.push(`${where} assumes an unknown section ${prerequisite}.`)
      else if (prerequisiteIndex >= index)
        errors.push(`${where} assumes ${prerequisite}, which is not earlier on the pathway.`)
    }
    if (spec.chainStops.length === 0) errors.push(`${where} lights no stop on the chain.`)
    for (const stop of spec.chainStops) {
      if (!chainStopIds.includes(stop)) errors.push(`${where} lights an unknown stop ${stop}.`)
    }
    for (const rowId of spec.grammarRowIds) {
      const row = IMAGING_GRAMMAR.find((candidate) => candidate.id === rowId)
      if (!row) errors.push(`${where} highlights an unknown grammar row ${rowId}.`)
      else if (!row.litIn.includes(spec.id))
        errors.push(`${where} highlights ${rowId}, which is not lit there.`)
    }
    for (const row of IMAGING_GRAMMAR) {
      if (row.litIn.includes(spec.id) && !spec.grammarRowIds.includes(row.id)) {
        errors.push(`${where} is named by grammar row ${row.id} but does not highlight it.`)
      }
    }
    if (spec.act.kind === 'lab') {
      if (!lesson.lab) errors.push(`${where} acts on a lab but the lesson has none.`)
      if (!imagingLabGoals(spec.id)) errors.push(`${where} acts on a lab but has no goals.`)
    }
    if (spec.act.kind === 'walk' && !imagingLabGoals(spec.id))
      errors.push(`${where} walks without a goal.`)
    if (spec.act.kind === 'sort') {
      const sort = imagingSortFor(spec.id)
      if (!sort || sort.id !== spec.act.sortId)
        errors.push(`${where} names a sort that is not its own.`)
    }
    for (const controlId of imagingControlIds) {
      if (!(controlId in spec.controlStrip.states))
        errors.push(`${where} control strip omits ${controlId}.`)
    }
    const thisOnes = Object.values(spec.controlStrip.states).filter((state) => state === 'this-one')
    if (spec.controlStrip.verdict === 'this-control' && thisOnes.length === 0) {
      errors.push(`${where} says a control answers, but marks none as the one.`)
    }
    if (spec.controlStrip.verdict !== 'this-control' && thisOnes.length > 0) {
      errors.push(`${where} says no control answers, but marks one as the one.`)
    }
    if (spec.precommitDenyPatterns.length === 0) {
      errors.push(`${where} has no deny patterns; the pre-commit scan would check nothing.`)
    }
    for (const pattern of spec.precommitDenyPatterns) {
      if (!pattern.flags.includes('i'))
        errors.push(`${where} deny pattern ${pattern} is case-sensitive.`)
      if (pattern.flags.includes('g'))
        errors.push(`${where} deny pattern ${pattern} is global (stateful).`)
    }
    if (spec.capstoneCaseId !== null) {
      const imagingCase = imagingCaseById.get(spec.capstoneCaseId)
      if (!imagingCase) errors.push(`${where} names an unknown capstone case.`)
      else if (imagingCase.pairedSectionId !== spec.id)
        errors.push(`${where} claims a case paired elsewhere.`)
    } else if (imagingCasesPairedTo(spec.id).length > 0) {
      errors.push(`${where} is paired by a capstone case it does not name.`)
    }
    if (spec.sourceIds.length === 0) errors.push(`${where} cites nothing.`)
    for (const sourceId of spec.sourceIds) {
      if (!SOURCE_BY_ID.has(sourceId))
        errors.push(`${where} cites an unregistered source ${sourceId}.`)
    }
  })
  return errors
}

const sectionSpecErrors = validateImagingSectionSpecs()
if (sectionSpecErrors.length > 0) {
  throw new Error(`The imaging section specs are invalid:\n${sectionSpecErrors.join('\n')}`)
}
