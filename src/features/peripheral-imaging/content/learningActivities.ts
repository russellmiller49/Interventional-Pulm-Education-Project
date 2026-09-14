import { imagingLesson, peripheralImagingSectionIds, type ImagingSectionId } from './pathway'
import { teachingDemonstration } from './teachingExamples'

/** Presentation identities are independent of question IDs, progress records and array positions. */
export type ImagingPresentation =
  | 'illustrated'
  | 'comparison'
  | 'acquisition'
  | 'multiplanar'
  | 'record'
export type ImagingActivityTask = 'read' | 'act' | 'observe' | 'check' | 'debrief' | 'transfer'
export type ImagingVisual =
  | 'suite'
  | 'questions'
  | 'signal'
  | 'dose'
  | 'reconstruction'
  | 'provenance'
  | 'case'

export interface ImagingLearningActivity {
  readonly id: string
  readonly sectionId: ImagingSectionId
  readonly task: ImagingActivityTask
  readonly presentation: ImagingPresentation
  readonly title: string
  /** Exact authored block titles, or named content resources. Validated below. */
  readonly content: readonly string[]
  readonly visual: ImagingVisual
  readonly examples?: readonly string[]
  readonly controls?: readonly string[]
  readonly captureGroup?: string
  readonly disclosure: 'teaching' | 'learner-work' | 'independent'
  readonly completion: 'explicit-continue' | 'supported-observations' | 'committed-response'
}

type ActivityInput = Omit<
  ImagingLearningActivity,
  'id' | 'sectionId' | 'disclosure' | 'completion'
> & { readonly id: string }
const read = (
  id: string,
  title: string,
  content: readonly string[],
  visual: ImagingVisual,
  presentation: ImagingPresentation = 'illustrated',
  examples?: readonly string[],
  controls?: readonly string[],
): ActivityInput => ({ id, title, content, visual, presentation, examples, controls, task: 'read' })
const work = (
  title: string,
  presentation: ImagingPresentation,
  visual: ImagingVisual = 'suite',
  controls?: readonly string[],
): ActivityInput => ({
  id: 'guided',
  title,
  presentation,
  visual,
  controls,
  content: [],
  task: 'act',
})
const compare = (
  title: string,
  presentation: ImagingPresentation,
  controls?: readonly string[],
): ActivityInput => ({
  id: 'compare',
  title,
  presentation,
  visual: 'suite',
  controls,
  content: [],
  task: 'observe',
})
const finish = (
  presentation: ImagingPresentation,
  visual: ImagingVisual = 'suite',
): ActivityInput[] => [
  {
    id: 'interpretation',
    task: 'check',
    title: 'Interpret a changed example',
    presentation,
    visual,
    content: [],
  },
  {
    id: 'review',
    task: 'debrief',
    title: 'What the evidence supports',
    presentation: 'record',
    visual: 'case',
    content: ['@summary'],
  },
  {
    id: 'transfer',
    task: 'transfer',
    title: 'Apply it to another situation',
    presentation: 'record',
    visual: 'case',
    content: [],
  },
]

/** Each section authors its own sequence. Content lives in the existing lesson/example registries. */
const ACTIVITIES: Readonly<Record<ImagingSectionId, readonly ActivityInput[]>> = {
  'imaging-questions': [
    read(
      'arrival',
      'Navigation indicates arrival. What is confirmed?',
      ['@purpose', 'Navigation, localization, confirmation, diagnosis'],
      'questions',
    ),
    read(
      'evidence',
      'Choose evidence for the next question',
      ['Match the modality to the question', '@worked'],
      'questions',
    ),
    work('Match each claim to its evidence', 'record', 'case'),
    ...finish('record', 'case'),
  ],
  'chain-walk': [
    read(
      'formation',
      'Follow an X-ray from source to image',
      ['@purpose', 'Six components, one image', 'Walk it on a working suite'],
      'suite',
      'acquisition',
      ['Baseline · frontal overlap'],
      [],
    ),
    work('Follow each component of image formation', 'acquisition', 'suite', ['orbit']),
    read(
      'depth',
      'See how a projection collapses depth',
      ['A single projection collapses depth', '@worked'],
      'suite',
      'comparison',
      ['Baseline · frontal overlap', 'Change projection only'],
      ['orbit'],
    ),
    ...finish('comparison'),
  ],
  'good-image': [
    read(
      'projection',
      'Change the image by changing the projection',
      ['@purpose', 'The baseline image'],
      'suite',
      'comparison',
      ['Baseline · frontal overlap', 'Change projection only'],
      ['orbit'],
    ),
    read(
      'display',
      'Compare acquisition controls with stored display',
      ['Main fluoroscopy control families', '@controls'],
      'suite',
      'comparison',
      ['Crop the baseline stored frame', 'Zoom the baseline stored frame'],
      ['crop', 'cropWidth', 'zoom'],
    ),
    read(
      'exposure',
      'Recognize what the system selects',
      ['Automatic exposure regulation sets the exposure', '@worked'],
      'suite',
      'comparison',
      ['Baseline · frontal overlap'],
      [],
    ),
    work('Choose a projection and inspect the stored image', 'comparison'),
    ...finish('comparison'),
  ],
  'current-anatomy': [
    read(
      'planning',
      'Identify the planning study and current evidence',
      [
        '@purpose',
        'Read the planning CT for the airway and the hazards',
        'The planning CT is one acquisition',
      ],
      'suite',
      'comparison',
      ['Planning / initial current state', 'Saved contour · acquisition A'],
      ['overlay'],
    ),
    read(
      'mismatch',
      'Compare a saved contour after anatomy changes',
      ['When the lesion is not where it was expected', '@worked'],
      'suite',
      'comparison',
      ['Subsequent change · contour on', 'Same current state · contour off'],
      ['overlay'],
    ),
    work('Inspect a mismatch with the planning target', 'comparison'),
    compare('Capture new localization evidence', 'comparison'),
    ...finish('comparison'),
  ],
  projection: [
    read(
      'parallax',
      'Compare projections of fixed tool and lesion geometry',
      ['@purpose', 'Superimposition and parallax'],
      'suite',
      'comparison',
      ['Baseline · frontal overlap', 'Change projection only'],
      ['orbit'],
    ),
    read(
      'alignment',
      'Choose a view for alignment or advancement',
      ['Alignment view versus advancement view', 'Two projections still have limits', '@worked'],
      'suite',
      'comparison',
      ['Change projection only'],
      ['orbit'],
    ),
    work('Try a different projection', 'comparison', 'suite', ['orbit', 'tilt']),
    compare('Compare the stored images', 'comparison', ['orbit', 'tilt']),
    ...finish('comparison'),
  ],
  signal: [
    read(
      'conspicuity',
      'Compare three causes of poor conspicuity',
      ['@purpose', 'Identify what is limiting conspicuity'],
      'signal',
      'comparison',
    ),
    read(
      'output',
      'Separate image appearance from exposure',
      ['Beam energy and photon output are different', 'Brightness can hide an increase in output'],
      'signal',
      'comparison',
    ),
    read(
      'superimposition',
      'Inspect superimposition on CT-derived projections',
      ['@worked'],
      'suite',
      'comparison',
      ['CT superimposition · baseline', 'CT superimposition · changed view'],
      ['orbit'],
    ),
    work('Change the projection and compare silhouettes', 'comparison'),
    ...finish('comparison', 'signal'),
  ],
  field: [
    read(
      'collimation',
      'Keep the information the task requires',
      ['@purpose', 'Collimate to the task'],
      'suite',
      'comparison',
      ['Baseline · full acquisition field', 'Physical collimation'],
      ['field'],
    ),
    read(
      'display',
      'Compare physical field, crop and zoom',
      [
        'Display zoom versus acquisition magnification',
        'Geometry changes magnification and blur',
        '@worked',
      ],
      'suite',
      'comparison',
      [
        'Baseline · full acquisition field',
        'Crop the baseline stored frame',
        'Zoom the baseline stored frame',
      ],
      ['crop', 'cropWidth', 'zoom'],
    ),
    work('Collimate while retaining the planned excursion', 'comparison', 'suite', ['field']),
    compare('Inspect the acquisition through crop and zoom', 'comparison', [
      'crop',
      'cropWidth',
      'zoom',
    ]),
    ...finish('comparison'),
  ],
  time: [
    read(
      'width',
      'Compare motion during a pulse',
      ['@purpose', 'Pulse width and pulse rate'],
      'suite',
      'comparison',
      ['Baseline · moving tool', 'Pulse width alone'],
      ['width'],
    ),
    read(
      'rate',
      'Compare motion between acquired frames',
      ['Match temporal settings to the task'],
      'suite',
      'comparison',
      ['Baseline · moving tool', 'Pulse rate alone', 'Combined example', 'Static localization'],
      ['rate'],
    ),
    read(
      'processing',
      'Distinguish acquired information from processing',
      ['Image processing cannot create acquired information', '@worked'],
      'suite',
      'comparison',
      ['Baseline · moving tool'],
      [],
    ),
    work('Change pulse width with rate and speed fixed', 'comparison', 'suite', ['width']),
    compare('Restore width, then change pulse rate', 'comparison', ['width', 'rate']),
    ...finish('comparison'),
  ],
  'two-dimensional': [
    read(
      'case',
      'The tool is visible. What is still uncertain?',
      ['@purpose', 'A two-axis fluoroscopy technique', '@worked'],
      'suite',
      'comparison',
      [
        'Coached problem · locate before sampling',
        'Change the view, retain context',
        'Inspect the stored image',
      ],
    ),
    read(
      'additional-evidence',
      'Decide what additional imaging could establish',
      [
        'Radial EBUS is a different kind of evidence',
        'Change modality when the projection stops answering',
      ],
      'suite',
      'comparison',
      ['Inspect the stored image'],
      ['zoom'],
    ),
    work('Adjust the image for this procedural question', 'comparison'),
    ...finish('comparison'),
  ],
  'dts-acquisition': [
    read(
      'reconstruction',
      'Build a plane from acquired projections',
      ['@purpose', 'Reconstructing planes from a DTS acquisition'],
      'reconstruction',
      'illustrated',
    ),
    read(
      'arc',
      'Prepare and inspect the acquisition arc',
      ['Prepare the DTS acquisition'],
      'suite',
      'acquisition',
      ['Acquisition arc'],
      ['sweep'],
    ),
    read(
      'planes',
      'Review the tool and lesion through depth',
      ['Depth resolution depends on angular coverage', '@worked'],
      'suite',
      'multiplanar',
      ['Scroll through the fictional tool', 'Scroll through the fictional lesion'],
      ['plane'],
    ),
    work('Review the reconstructed planes', 'multiplanar'),
    compare('Compare limited-angle depth behavior', 'multiplanar'),
    ...finish('multiplanar'),
  ],
  'dts-interpretation': [
    read(
      'information',
      'Identify the source of each displayed result',
      ['@purpose', 'Three uses of a DTS reconstruction'],
      'provenance',
    ),
    read(
      'prior',
      'Examine the contribution of a prior CT',
      [
        'A prior CT can improve the reconstruction and bias it',
        'Question the claim, not the brand name',
        '@worked',
      ],
      'suite',
      'multiplanar',
      [
        'Acquisition arc',
        'Scroll through the fictional tool',
        'Scroll through the fictional lesion',
      ],
      ['sweep', 'plane'],
    ),
    work('Distinguish reconstruction, target update and overlay', 'record', 'case'),
    ...finish('record', 'case'),
  ],
  'cbct-acquisition': [
    read(
      'volume',
      'Understand what a rotational acquisition produces',
      ['@purpose', 'Many projections become one volume'],
      'reconstruction',
    ),
    read(
      'scouts',
      'Check coverage in both scout views',
      ['Center the lesion in three dimensions', 'Make readiness a team check', '@worked'],
      'suite',
      'acquisition',
      ['Two scouts · one centered', 'Both scouts centered'],
      ['offsetX', 'offsetDepth'],
    ),
    work('Center, check and acquire the modeled volume', 'acquisition'),
    compare('Reassess after a setup change', 'acquisition'),
    ...finish('acquisition'),
  ],
  'fixed-suite': [
    read(
      'room',
      'Plan a task in the installed room',
      ['@purpose', 'Plan around the installed room', 'Choose the protocol for the question'],
      'suite',
      'acquisition',
      ['Both scouts centered'],
      ['acquisitionOrbit'],
    ),
    read(
      'tracking',
      'Separate equipment tracking from current anatomy',
      ['Use integration deliberately', '@worked'],
      'suite',
      'acquisition',
      ['Movement requires rechecking'],
      ['offsetX'],
    ),
    work('Inspect the fixed-room setup after movement', 'acquisition'),
    ...finish('record', 'case'),
  ],
  'mobile-suite': [
    read(
      'commission',
      'Prepare the scanner, table and room combination',
      ['@purpose', 'Commission the combination', 'Compare capabilities individually'],
      'suite',
      'acquisition',
      ['Two scouts · one centered'],
      ['offsetX', 'offsetDepth', 'acquisitionOrbit'],
    ),
    read(
      'coordinates',
      'Distinguish a useful volume from an integrated target update',
      ['Preserve orientation and registration', '@worked'],
      'provenance',
    ),
    work('Inspect the mobile scanner path with a centered setup', 'acquisition'),
    ...finish('record', 'case'),
  ],
  'tool-confirmation': [
    read(
      'component',
      'Trace the lesion and actual sampling component',
      ['@purpose', 'Lesion → tool → relationship → acquisition', 'Follow the tool, not the streak'],
      'suite',
      'multiplanar',
      ['Trace the actual sampling component', 'Tip and window differ'],
      ['axial', 'coronal', 'sagittal'],
    ),
    read(
      'thin-planes',
      'Compare a thick slab with thin planes',
      ['A slab helps tracking but can conceal depth', '@worked'],
      'suite',
      'multiplanar',
      ['Thick slab', 'Same tool · thin planes'],
      ['axial', 'coronal', 'sagittal', 'slab'],
    ),
    work('Inspect the sampling component across linked planes', 'multiplanar'),
    compare('Review thin planes and the geometric explanation', 'multiplanar'),
    ...finish('multiplanar'),
  ],
  'changing-anatomy': [
    read(
      'timeline',
      'Identify which acquisition remains current',
      ['@purpose', 'Match the artifact to its cause', '@worked'],
      'suite',
      'comparison',
      [
        'Saved contour · acquisition A',
        'Subsequent change · contour on',
        'Same current state · contour off',
      ],
      ['overlay'],
    ),
    read(
      'reassessment',
      'Separate physiological care from imaging reassessment',
      [
        'Plan the breath hold with anesthesia',
        'Treat atelectasis as anatomy, not an image-quality problem',
      ],
      'suite',
      'comparison',
      ['Reassessment · acquisition B'],
      [],
    ),
    work('Capture a contour, then change the anatomy', 'comparison'),
    compare('Review current evidence without the old annotation', 'comparison'),
    ...finish('comparison'),
  ],
  'staff-protection': [
    read(
      'scatter',
      'Locate the source, patient and staff exposure path',
      ['@purpose', 'Time, distance and shielding', 'Geometry shapes occupational exposure'],
      'suite',
      'acquisition',
      ['Patient, source and exposure path', 'Distance and barrier'],
      ['distance', 'shield'],
    ),
    read(
      'access',
      'Maintain protection and patient access',
      ['Keep hands out of the primary beam', '@worked'],
      'suite',
      'acquisition',
      ['Distance and barrier'],
      ['orbit'],
    ),
    work('Compare distance in the idealized model', 'acquisition'),
    compare('Inspect a changed projection with a barrier', 'acquisition'),
    ...finish('acquisition'),
  ],
  'dose-reporting': [
    read(
      'record',
      'Read quantities, units and included acquisition modes',
      [
        '@purpose',
        'Know the quantity before comparing the number',
        'Record the whole procedure once',
      ],
      'dose',
      'record',
    ),
    read(
      'arithmetic',
      'Work through the kerma–area product',
      ['A smaller field and a higher local index can coexist'],
      'suite',
      'record',
      ['Worked KAP arithmetic', 'Same kerma · different area'],
      ['area'],
    ),
    work('Compare area at fixed air kerma', 'record'),
    read(
      'notifications',
      'Interpret the record in its clinical context',
      ['Respond to notifications through the dose-management program', '@worked'],
      'dose',
      'record',
    ),
    ...finish('record', 'dose'),
  ],
  'suite-cases': [
    read(
      'worked-case',
      'Follow the evidence through a peripheral-lesion case',
      ['@purpose', 'Apply the same reasoning to new situations', '@worked'],
      'questions',
      'record',
    ),
    work('Match the finding to the next useful decision', 'record', 'case'),
    ...finish('record', 'case'),
  ],
}

export function imagingLearningActivities(
  sectionId: ImagingSectionId,
): readonly ImagingLearningActivity[] {
  return ACTIVITIES[sectionId].map((activity) => ({
    ...activity,
    id: `${sectionId}:${activity.id}`,
    sectionId,
    // These activities compare one acquisition across different display/temporal explanations.
    captureGroup:
      ['field', 'time', 'projection'].includes(sectionId) && activity.task === 'read'
        ? `${sectionId}:worked-acquisition`
        : activity.id,
    disclosure:
      activity.task === 'check' || activity.task === 'transfer'
        ? 'independent'
        : activity.task === 'read'
          ? 'teaching'
          : 'learner-work',
    completion:
      activity.task === 'check' || activity.task === 'transfer'
        ? 'committed-response'
        : activity.task === 'act' || activity.task === 'observe'
          ? 'supported-observations'
          : 'explicit-continue',
  }))
}

export function validateImagingLearningActivities(): string[] {
  const errors: string[] = []
  for (const id of peripheralImagingSectionIds) {
    const activities = imagingLearningActivities(id)
    const lesson = imagingLesson(id)
    const content = activities.flatMap((activity) => activity.content)
    if (new Set(activities.map((activity) => activity.id)).size !== activities.length)
      errors.push(`${id}: duplicate activity identity`)
    for (const block of lesson.blocks) {
      if (content.filter((ref) => ref === block.title).length !== 1)
        errors.push(`${id}: ${block.title} must have exactly one essential destination`)
    }
    for (const ref of content) {
      if (
        !['@purpose', '@worked', '@summary', '@controls'].includes(ref) &&
        !lesson.blocks.some((block) => block.title === ref)
      )
        errors.push(`${id}: unknown content ${ref}`)
    }
    for (const activity of activities) {
      for (const example of activity.examples ?? []) {
        if (!teachingDemonstration(id)?.examples.some((entry) => entry.title === example))
          errors.push(`${activity.id}: missing example ${example}`)
      }
    }
    const check = activities.findIndex((activity) => activity.task === 'check')
    if (activities.slice(check).some((activity) => activity.task === 'read'))
      errors.push(`${id}: essential teaching after independent interpretation`)
  }
  return errors
}
