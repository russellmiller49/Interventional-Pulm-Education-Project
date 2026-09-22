import { GLOSSARY } from '../data/resources'
import { SOURCE_BY_ID } from '../data/sources'
import type { SourceId } from '../types'
import { chainStop, type ChainStopId } from './imagingChain'
import { IMAGING_CONTROL_PANEL } from './controlPanel'
import { IMAGING_GRAMMAR } from './grammar'
import { imagingLearningActivities } from './learningActivities'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { imagingLesson, peripheralImagingSectionIds, type ImagingSectionId } from './pathway'
import { imagingSectionSpec } from './sectionSpecs'
import { imagingSortFor } from './sorts'
import { imagingSectionItems } from './stageItems'
import { teachingDemonstration } from './teachingExamples'

/**
 * The terms a section uses, defined where they are used.
 *
 * Reports CW3, O2, 1.1/6.1, 1.8, 4.4 and 4.6 (fellow walkthrough, PDF pp.4, 7, 10, 13, 34–35, 40):
 * DTS and CBCT were used from the Overview and Section 1 but spelled out in Section 10 and 12
 * headings; "sampling component" was used on the first screen and defined in Section 15; kerma–area
 * product was mentioned in Section 2 and explained in Section 18; binning, anisotropy, regularization
 * and the rest arrived with no gloss; and Help offered navigation only.
 *
 * This registry does not invent definitions. Each entry says where its words come from:
 *
 *  - `course-glossary`: the definition already in `data/resources.ts`, reused by key.
 *  - `section-teaching`: a sentence the named section already teaches, quoted or lightly trimmed.
 *  - `chain-stop` / `control-panel`: the image-formation walk or the control families.
 *  - `implementation`: what the displayed quantity is, read from the code that computes it.
 *  - `registered-source`: the registered study record, for a trial the teaching names.
 *  - `drafted`: no verbatim local support; the basis is named and the entry is for owner review.
 *
 * `termsForSection` finds the terms a section actually uses by scanning its own learner-facing text,
 * so the list is right for a learner who deep-links into Section 10 without reading Section 1.
 */
export type GlossaryProvenance =
  | { readonly kind: 'course-glossary'; readonly entry: string }
  | {
      readonly kind: 'section-teaching'
      readonly sectionId: ImagingSectionId
      readonly block: string
    }
  | { readonly kind: 'chain-stop'; readonly stop: ChainStopId }
  | { readonly kind: 'control-panel'; readonly control: string }
  | { readonly kind: 'implementation'; readonly file: string; readonly symbol: string }
  | { readonly kind: 'registered-source'; readonly sourceId: SourceId }
  | { readonly kind: 'drafted'; readonly basis: string; readonly sourceIds: readonly SourceId[] }

export interface GlossaryTerm {
  readonly id: string
  /** As printed. */
  readonly term: string
  /** Recognises the term in a section's learner-facing text. Never global. */
  readonly pattern: RegExp
  readonly definition: string
  readonly provenance: GlossaryProvenance
  /** The section that teaches the term in full, when one does. */
  readonly taughtIn?: ImagingSectionId
  /** Sections whose suite pane prints the term in a readout the content registries do not carry. */
  readonly alsoUsedIn?: readonly ImagingSectionId[]
  /** `existing` reuses words already in the course; `drafted` is new wording awaiting the owner. */
  readonly status: 'existing' | 'drafted'
}

const glossaryEntry = (term: string): string => {
  const found = GLOSSARY.find(([name]) => name === term)
  if (!found) throw new Error(`No course glossary entry ${term}`)
  return found[1]
}

const fromGlossary = (
  id: string,
  term: string,
  pattern: RegExp,
  entry: string,
  taughtIn?: ImagingSectionId,
): GlossaryTerm => ({
  id,
  term,
  pattern,
  definition: glossaryEntry(entry),
  provenance: { kind: 'course-glossary', entry },
  taughtIn,
  status: 'existing',
})

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = Object.freeze([
  fromGlossary(
    'dts',
    'DTS — digital tomosynthesis',
    /\bDTS\b|digital tomosynthesis/i,
    'DTS',
    'dts-acquisition',
  ),
  fromGlossary(
    'cbct',
    'CBCT — cone-beam CT',
    /\bCBCT\b|cone[- ]beam CT/i,
    'CBCT',
    'cbct-acquisition',
  ),
  fromGlossary(
    'kap',
    'Kerma–area product (KAP, also DAP)',
    /kerma[–-]area product|\bKAP\b|\bDAP\b/i,
    'KAP / DAP',
    'dose-reporting',
  ),
  fromGlossary(
    'reference-air-kerma',
    'Reference air kerma (Kₐ,r)',
    /reference air kerma|Kₐ,r/i,
    'Kₐ,r',
    'dose-reporting',
  ),
  fromGlossary(
    'automatic-exposure-regulation',
    'Automatic exposure regulation',
    /automatic exposure regulation/i,
    'Automatic exposure regulation',
    'good-image',
  ),
  fromGlossary(
    'last-image-hold',
    'Last-image hold',
    /last[- ]image[- ]hold/i,
    'Last-image hold',
    'time',
  ),
  fromGlossary('isocenter', 'Isocenter', /isocent(er|re)/i, 'Isocenter', 'cbct-acquisition'),
  fromGlossary(
    'acquisition-magnification',
    'Acquisition magnification',
    /acquisition magnification|magnification mode/i,
    'Acquisition magnification',
    'field',
  ),
  fromGlossary(
    'augmented-fluoroscopy',
    'Augmented fluoroscopy',
    /augmented[- ]fluoroscopy/i,
    'Augmented fluoroscopy',
    'changing-anatomy',
  ),
  fromGlossary('collimation', 'Collimation', /collimat/i, 'Collimation', 'field'),
  fromGlossary(
    'concentric-eccentric',
    'Concentric / eccentric view',
    /\b(concentric|eccentric)\b/i,
    'Concentric / eccentric view',
    'two-dimensional',
  ),
  fromGlossary(
    'ct-to-body-divergence',
    'CT-to-body divergence',
    /CT[- ]to[- ]body divergence/i,
    'CT-to-body divergence',
    'current-anatomy',
  ),
  fromGlossary('display-zoom', 'Display zoom', /display zoom/i, 'Display zoom', 'field'),
  fromGlossary(
    'effective-dose',
    'Effective dose',
    /effective dose/i,
    'Effective dose',
    'dose-reporting',
  ),
  fromGlossary(
    'image-lag',
    'Image lag (frame averaging)',
    /image lag|frame averaging|display lag/i,
    'Image lag',
    'time',
  ),
  fromGlossary(
    'lesion-conspicuity',
    'Lesion conspicuity',
    /conspicuity/i,
    'Lesion conspicuity',
    'signal',
  ),
  fromGlossary(
    'mip',
    'MIP — maximum-intensity projection (thick slab)',
    /\bMIP\b|maximum[- ]intensity projection|thick[- ]slab/i,
    'MIP',
    'tool-confirmation',
  ),
  fromGlossary(
    'mpr',
    'MPR — multiplanar reformation (thin reformats)',
    /\bMPR\b|multiplanar (reformat|review|image|reconstruction|plane)|thin (multiplanar )?(reformat|plane|slice|section)s?/i,
    'MPR',
    'tool-confirmation',
  ),
  fromGlossary('parallax', 'Parallax', /parallax/i, 'Parallax', 'projection'),
  fromGlossary(
    'peak-skin-dose',
    'Peak skin dose',
    /peak skin dose/i,
    'Peak skin dose',
    'dose-reporting',
  ),
  fromGlossary(
    'pulse-rate-width',
    'Pulse rate / pulse width',
    /pulse (rate|width|duration)/i,
    'Pulse rate / pulse width',
    'time',
  ),
  fromGlossary(
    'radial-ebus',
    'Radial EBUS',
    /radial (endobronchial ultrasound|EBUS|probe)|\brEBUS\b|\bRP-EBUS\b/i,
    'Radial EBUS',
    'two-dimensional',
  ),
  fromGlossary(
    'registration',
    'Registration',
    /\bregist(ration|ered)\b/i,
    'Registration',
    'current-anatomy',
  ),
  fromGlossary(
    'superimposition',
    'Superimposition',
    /superimpos/i,
    'Superimposition',
    'projection',
  ),
  fromGlossary(
    'tool-in-lesion',
    'Tool-in-lesion',
    /tool[- ]in[- ]lesion/i,
    'Tool-in-lesion',
    'tool-confirmation',
  ),
  {
    id: 'sampling-component',
    term: 'Sampling component',
    pattern: /sampling (component|part|window)/i,
    definition:
      'The part of the biopsy tool that actually acquires tissue: a needle’s side-cutting window, forceps jaws or a cryoprobe’s active segment, depending on the instrument. The tip is a different point on the tool — a tip can lie beyond a lesion while the part that samples is not in it.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'tool-confirmation',
      block: 'Lesion → tool → relationship → acquisition',
    },
    taughtIn: 'tool-confirmation',
    // Section 1's figure names the component on the course's first screen (report 1.1).
    alsoUsedIn: ['imaging-questions'],
    status: 'existing',
  },
  {
    id: 'side-cutting-window',
    term: 'Side-cutting window',
    pattern: /side[- ]cutting window|side window/i,
    definition:
      'The opening on the side of some biopsy needles through which tissue is cut and taken. It sits behind the tip, so it is the window, not the tip, that has to be in the lesion. Not every tool has one: forceps sample at the jaws and a cryoprobe along its active segment. The window drawn in this course is a teaching shape, not a real needle.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'tool-confirmation',
      block: 'Follow the tool, not the streak',
    },
    taughtIn: 'tool-confirmation',
    status: 'existing',
  },
  {
    id: 'binning',
    term: 'Binning',
    pattern: /\bbinning\b/i,
    definition:
      'Combining adjacent detector pixels into one larger pixel at readout. It is a detector setting that changes sampling and noise, not a display operation; whether a magnification mode bins, crops or both depends on the system.',
    provenance: {
      kind: 'drafted',
      basis:
        'The course glossary entry for acquisition magnification and AAPM TG 272 on detector sampling and magnification modes; no verbatim local definition exists.',
      sourceIds: ['tg272'],
    },
    taughtIn: 'field',
    status: 'drafted',
  },
  {
    id: 'missing-wedge',
    term: 'Missing wedge',
    pattern: /missing wedge|unsampled directions|missing directions/i,
    definition:
      'Limited angular coverage leaves part of the spatial information unmeasured, often described as a missing wedge: the range of directions a limited arc never acquired.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'dts-acquisition',
      block: 'Depth resolution depends on angular coverage',
    },
    taughtIn: 'dts-acquisition',
    status: 'existing',
  },
  {
    id: 'anisotropy',
    term: 'Anisotropy',
    pattern: /anisotrop/i,
    definition:
      'Resolution that differs by direction. In a DTS reconstruction, in-plane edges can look sharp while depth remains elongated or blurred, and small voxels do not repair this anisotropy.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'dts-acquisition',
      block: 'Depth resolution depends on angular coverage',
    },
    taughtIn: 'dts-acquisition',
    status: 'existing',
  },
  {
    id: 'iterative-reconstruction',
    term: 'Iterative reconstruction',
    pattern: /iterative reconstruction/i,
    definition:
      'A reconstruction that compares the acquired projections with projections predicted from an estimated volume.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'dts-interpretation',
      block: 'A prior CT can improve the reconstruction and bias it',
    },
    taughtIn: 'dts-interpretation',
    status: 'existing',
  },
  {
    id: 'regularization',
    term: 'Regularization',
    pattern: /regulari[sz]ation/i,
    definition:
      'An added rule, such as a prior CT, that guides an incomplete reconstruction toward one useful solution. If the anatomy has changed, the same prior can pull the result toward the older anatomy.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'dts-interpretation',
      block: 'A prior CT can improve the reconstruction and bias it',
    },
    taughtIn: 'dts-interpretation',
    status: 'existing',
  },
  {
    id: 'validated-endpoint',
    term: 'Independently validated endpoint',
    pattern: /validated endpoint|technical endpoint/i,
    definition:
      'An outcome measured in its own study, such as diagnostic yield or dose, rather than inferred from how an image looks. Closer resemblance to a reference scan is a technical endpoint; it is not diagnostic yield.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'dts-interpretation',
      block: 'Question the claim, not the brand name',
    },
    taughtIn: 'dts-interpretation',
    status: 'existing',
  },
  {
    id: 'scatter',
    term: 'Scatter',
    pattern: /\bscatter/i,
    definition:
      'Scatter adds unwanted signal that reduces contrast. The irradiated patient is the principal source of scatter radiation, which is what reaches the staff.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'signal',
      block: 'Identify what is limiting conspicuity',
    },
    taughtIn: 'signal',
    status: 'existing',
  },
  {
    id: 'quantum-noise',
    term: 'Quantum noise',
    pattern: /quantum noise|photon statistics/i,
    definition: 'Random variation from too few detected photons.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'signal',
      block: 'Identify what is limiting conspicuity',
    },
    taughtIn: 'signal',
    status: 'existing',
  },
  {
    id: 'tool-plane-spread',
    term: 'Tool-plane spread / target-plane spread',
    pattern: /(tool|target)[- ]plane spread|out-of-plane spread/i,
    definition:
      'How far across the image the model smears each object at the selected plane: the difference between where the object lands at the two ends of the arc once the images are shifted for that depth. It is zero when the plane passes through the object and grows with the object’s distance from the plane and with the width of the arc, so the plane where an object’s spread reaches zero is the plane it lies in.',
    provenance: {
      kind: 'implementation',
      file: 'components/suite/dtsModel.ts',
      symbol: 'smearWidth (from lib/physics.ts dtsShift)',
    },
    taughtIn: 'dts-acquisition',
    alsoUsedIn: ['dts-acquisition', 'dts-interpretation'],
    status: 'existing',
  },
  {
    id: 'obliquity-and-tilt',
    term: 'C-arm obliquity and beam tilt',
    pattern: /obliquity|cranial or caudal angulation|beam tilt|\btilt\b/i,
    definition:
      'Obliquity rotates the C-arm around the patient; cranial or caudal angulation — beam tilt here — tilts it along the body axis. Both are the model’s own signed angles: positive obliquity swings the detector toward the patient’s right, and positive tilt swings it toward the head. They are not a console’s LAO/RAO or cranial/caudal labels, whose conventions vary by system.',
    provenance: {
      kind: 'implementation',
      file: 'components/suite/suiteModel.ts',
      symbol:
        'suiteFrame (beamDirection in lib/physics.ts), with the control-panel wording for angle',
    },
    taughtIn: 'good-image',
    status: 'existing',
  },
  {
    id: 'vespa',
    term: 'VESPA trial',
    pattern: /\bVESPA\b/,
    definition:
      'The Ventilatory Strategy to Prevent Atelectasis trial: a multicenter randomized trial of bronchoscopy under general anesthesia. An endotracheal tube followed by a recruitment maneuver, an inspired oxygen fraction titrated below 1.0 and PEEP of 8 to 10 cm H₂O was compared with a laryngeal mask, full oxygen and no PEEP. The bundle reduced atelectasis on chest CT 20 to 30 minutes after airway placement, with no difference in complications; it does not say which part of the bundle did the work.',
    provenance: { kind: 'registered-source', sourceId: 'vespa' },
    taughtIn: 'changing-anatomy',
    status: 'existing',
  },
  {
    id: 'truncation',
    term: 'Truncation edge',
    pattern: /truncat/i,
    definition:
      'The edge where a CBCT volume stops. Outside the reconstruction volume nothing was acquired, so a lesion off centre is cut off at that edge rather than blurred; a better reconstruction cannot recover it.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'cbct-acquisition',
      block: 'Many projections become one volume',
    },
    taughtIn: 'cbct-acquisition',
    status: 'existing',
  },
  {
    id: 'reconstruction-volume',
    term: 'Reconstruction volume',
    pattern: /reconstruction volume/i,
    definition:
      'The region a CBCT spin actually reconstructs, centred on the isocenter. The lesion, the tool and the safety anatomy have to be placed inside it before the spin; anything outside it is not imaged, however sharp the rest looks.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'cbct-acquisition',
      block: 'Center the lesion in three dimensions',
    },
    taughtIn: 'cbct-acquisition',
    status: 'existing',
  },
  {
    id: 'navigation-target',
    term: 'Navigation target (virtual target)',
    pattern: /navigation target|virtual target/i,
    definition:
      'A target defined on the planning CT. Navigation shows where the catheter is relative to it; it cannot show what lies at that target today.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'imaging-questions',
      block: 'Navigation, localization, confirmation, diagnosis',
    },
    taughtIn: 'imaging-questions',
    status: 'existing',
  },
  {
    id: 'stored-contour',
    term: 'Stored contour',
    pattern: /stored contour|saved contour|stored (augmented )?contour|target contour/i,
    definition:
      'The target contour captured at one acquisition and drawn over later images: the model’s stand-in for an augmented-fluoroscopy overlay. It shows where the target was when it was captured, not where the lesion is now, and turning it off removes the annotation, not the anatomical change.',
    provenance: {
      kind: 'drafted',
      basis:
        'The course glossary entry for augmented fluoroscopy and the Section 4 teaching examples ("Stored contour · acquisition A", "Same current state · contour off").',
      sourceIds: ['pritchett', 'setser'],
    },
    taughtIn: 'current-anatomy',
    status: 'drafted',
  },
  {
    id: 'dose-notification',
    term: 'Dose notification',
    pattern: /dose notification|\bnotification/i,
    definition:
      'A dose notification prompts reassessment of necessity, optimization and the remaining plan; follow local policy for medical-physics review, documentation and patient follow-up.',
    provenance: {
      kind: 'section-teaching',
      sectionId: 'dose-reporting',
      block: 'Respond to notifications through the dose-management program',
    },
    taughtIn: 'dose-reporting',
    status: 'existing',
  },
])

const termById = new Map(GLOSSARY_TERMS.map((term) => [term.id, term] as const))

export function glossaryTerm(id: string): GlossaryTerm {
  const term = termById.get(id)
  if (!term) throw new Error(`Unknown glossary term ${id}`)
  return term
}

/**
 * Everything a learner reads in a section, joined, so a term's presence is decided by the section's
 * own words: its lesson, its spec, its items, the stops it lights, its demonstrations, the grammar
 * rows it highlights, its sort and its activity titles. Identifiers and citations are not included.
 */
export function sectionTextCorpus(sectionId: ImagingSectionId): string {
  const lesson = imagingLesson(sectionId)
  const spec = imagingSectionSpec(sectionId)
  const items = imagingSectionItems(sectionId)
  const parts: string[] = [
    lesson.title,
    lesson.outcome,
    lesson.why,
    lesson.recall.prompt,
    lesson.recall.answer,
    lesson.worked.scenario,
    lesson.worked.reasoning,
    lesson.labTask ?? '',
    ...lesson.takeaway,
    ...lesson.blocks.flatMap((block) => [
      block.title,
      block.body,
      ...(block.points ?? []),
      block.detail?.title ?? '',
      block.detail?.body ?? '',
    ]),
    spec.newConcept,
    spec.objective,
    spec.incrementSentence,
    spec.modelBoundary,
    spec.controlStrip.sentence,
    ...[items.prediction, items.transfer].flatMap((item) => [
      item.stem,
      item.explanation,
      ...item.choices.flatMap((choice) => [choice.label, choice.rationale]),
    ]),
    ...spec.chainStops.flatMap((stopId) => {
      const stop = chainStop(stopId)
      return [
        stop.title,
        stop.plainName,
        stop.precise,
        ...stop.checklist,
        stop.acoustic?.precise ?? '',
      ]
    }),
    ...(teachingDemonstration(sectionId)?.examples.flatMap((example) => [
      example.title,
      example.look,
    ]) ?? []),
    ...IMAGING_GRAMMAR.filter((row) => spec.grammarRowIds.includes(row.id)).flatMap((row) => [
      row.see,
      row.livesPlain,
      ...row.shortlist,
    ]),
    ...imagingLearningActivities(sectionId).map((activity) => activity.title),
  ]
  const sort = imagingSortFor(sectionId)
  if (sort) {
    parts.push(
      sort.prompt,
      ...sort.origins.flatMap((origin) => [origin.label, origin.definition]),
      ...sort.rows.flatMap((row) => [row.statement, row.rationale]),
    )
  }
  if (sectionId === 'good-image') {
    parts.push(
      IMAGING_CONTROL_PANEL.sentence,
      ...IMAGING_CONTROL_PANEL.controls.flatMap((control) => [
        control.plainName,
        control.changes,
        control.doesNotChange,
      ]),
      ...IMAGING_CONTROL_PANEL.monitoring.map((item) => item.sentence),
    )
  }
  return parts.join('\n')
}

const termsCache = new Map<ImagingSectionId, readonly GlossaryTerm[]>()

/** The terms a section uses, in registry order. Decided from the section's own text. */
export function termsForSection(sectionId: ImagingSectionId): readonly GlossaryTerm[] {
  const cached = termsCache.get(sectionId)
  if (cached) return cached
  const corpus = sectionTextCorpus(sectionId)
  const terms = GLOSSARY_TERMS.filter(
    (term) => term.pattern.test(corpus) || term.alsoUsedIn?.includes(sectionId),
  )
  termsCache.set(sectionId, terms)
  return terms
}

/** The first section on the pathway whose text uses the term. */
export function firstSectionUsing(termId: string): ImagingSectionId | null {
  const term = glossaryTerm(termId)
  return (
    peripheralImagingSectionIds.find(
      (sectionId) =>
        term.pattern.test(sectionTextCorpus(sectionId)) || term.alsoUsedIn?.includes(sectionId),
    ) ?? null
  )
}

/** A short statement of where a definition's words come from, for the learner. */
export function glossaryProvenanceLabel(term: GlossaryTerm): string {
  const provenance = term.provenance
  switch (provenance.kind) {
    case 'course-glossary':
      return 'Course glossary'
    case 'section-teaching': {
      const number = peripheralImagingSectionIds.indexOf(provenance.sectionId) + 1
      return `From Section ${number}, ${imagingLesson(provenance.sectionId).title}`
    }
    case 'chain-stop':
      return `From the image-formation walk: ${chainStop(provenance.stop).title}`
    case 'control-panel':
      return 'From the control families'
    case 'implementation':
      return 'How this course’s model computes it'
    case 'registered-source': {
      const source = SOURCE_BY_ID.get(provenance.sourceId)
      return source
        ? `From the registered study record: ${source.publication} ${source.year}`
        : 'From the registered study record'
    }
    case 'drafted':
      return 'Drafted from the course’s sources, awaiting the owner’s review'
    default:
      return ''
  }
}

export function validateImagingGlossary(): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const term of GLOSSARY_TERMS) {
    const where = `Glossary term ${term.id}`
    if (ids.has(term.id)) errors.push(`${where} is declared twice.`)
    ids.add(term.id)
    if (term.pattern.flags.includes('g')) errors.push(`${where} pattern is global (stateful).`)
    errors.push(
      ...imagingLearnerCopyErrors(`${where} name`, term.term),
      ...imagingLearnerCopyErrors(`${where} definition`, term.definition),
    )
    if (term.status === 'existing' && term.provenance.kind === 'drafted')
      errors.push(`${where} claims existing wording but is drafted.`)
    if (term.status === 'drafted' && term.provenance.kind !== 'drafted')
      errors.push(`${where} is drafted but names verbatim provenance.`)
    const provenance = term.provenance
    if (provenance.kind === 'section-teaching') {
      const lesson = imagingLesson(provenance.sectionId)
      if (!lesson.blocks.some((block) => block.title === provenance.block))
        errors.push(
          `${where} names a block ${provenance.block} that ${provenance.sectionId} does not have.`,
        )
    }
    if (
      provenance.kind === 'course-glossary' &&
      !GLOSSARY.some(([name]) => name === provenance.entry)
    )
      errors.push(`${where} names a course glossary entry that does not exist.`)
    if (provenance.kind === 'registered-source' && !SOURCE_BY_ID.has(provenance.sourceId))
      errors.push(`${where} cites an unregistered source.`)
    if (provenance.kind === 'drafted') {
      if (provenance.sourceIds.length === 0)
        errors.push(`${where} is drafted with no source basis.`)
      for (const sourceId of provenance.sourceIds)
        if (!SOURCE_BY_ID.has(sourceId)) errors.push(`${where} cites an unregistered source.`)
    }
    if (firstSectionUsing(term.id) === null) errors.push(`${where} is used by no section.`)
  }
  return errors
}

const glossaryErrors = validateImagingGlossary()
if (glossaryErrors.length > 0) {
  throw new Error(`The imaging glossary is invalid:\n${glossaryErrors.join('\n')}`)
}
