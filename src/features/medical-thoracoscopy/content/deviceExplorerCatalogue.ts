import { deviceExplorerCatalogue } from './data/generated/deviceExplorerCatalogue'

/**
 * The device explorer's catalogue, as pages load it: models, hotspots and the evidence each
 * hotspot shows, already resolved from the device definitions (see
 * `scripts/medical-thoracoscopy/build-device-explorer-catalogue.ts`). Every value keeps its kind
 * of claim; nothing here restates or rounds a number the definitions hold.
 *
 * The presentation keeps four kinds apart: a sourced device fact, a derived measurement, authored
 * geometry, and a detail the manufacturer has yet to settle.
 */
export type ClaimKind = 'sourced' | 'derived' | 'authored' | 'unresolved'
export type QualityClass = 'A' | 'B' | 'C'
export type ExplorerGroup = 'Telescope' | 'Access' | 'Instruments' | 'Tower'

export interface EvidenceRow {
  readonly kind: ClaimKind
  readonly label: string
  readonly value: string | null
  readonly detail: string | null
  readonly basis: string | null
}

export interface HotspotSpec {
  readonly id: string
  readonly title: string
  /** The anchor the hotspot sits on (`anchor:<name>` in the model, checked against the kit). */
  readonly anchor?: string
  /** Or a labelled node of the model, for a part without anchors (`label:<name>`). */
  readonly node?: string
  readonly description: string
  readonly evidence: readonly EvidenceRow[]
  /** How much to show around it when the camera goes to it, in millimetres. */
  readonly focusRadiusMm: number
}

export interface ExplorerDevice {
  /** The showcase model's id. */
  readonly id: string
  readonly title: string
  readonly group: ExplorerGroup
  readonly productNumber: string | null
  /** How the file's frame stands: an instrument lies along its shaft; the tower stands on +Z. */
  readonly frame: 'instrument' | 'tower'
  readonly jaws: 'measured' | 'not measured' | null
  /** The other model of a normal/cutaway pair. */
  readonly pair?: { readonly id: string; readonly view: 'normal' | 'cutaway' }
  /** A plain-language caveat to be said wherever the model is shown. */
  readonly presentationNote: string | null
  readonly qualityClass: QualityClass
  readonly configuration: string
  /** The short status line under the model's name. */
  readonly status: string
  /** The runtime-kit model whose anchors this model carries, or null for a blockout. */
  readonly kitModel: string | null
  readonly hotspots: readonly HotspotSpec[]
}

export interface KitAnchor {
  readonly position: readonly [number, number, number]
  readonly direction: readonly [number, number, number]
}

export interface KitModel {
  readonly anchors: Readonly<Record<string, KitAnchor>>
  readonly extras: Readonly<Record<string, unknown>>
}

type Catalogue = {
  readonly provenance: Readonly<Record<string, string>>
  readonly label: string
  readonly groups: readonly ExplorerGroup[]
  readonly devices: readonly ExplorerDevice[]
  readonly assemblyHotspots: readonly {
    readonly part: 'telescope' | 'sleeve' | 'forceps'
    readonly spot: HotspotSpec
  }[]
  readonly kit: Readonly<Record<string, KitModel>>
  readonly values: {
    readonly sleeveSeatMm: { readonly value: number; readonly category: string }
    readonly channelLengthMm: { readonly value: number; readonly category: string }
    readonly sheathLengthMm: { readonly value: number; readonly category: string }
  }
}

export const catalogue = deviceExplorerCatalogue as unknown as Catalogue

export const EXPLORER_DEVICES: readonly ExplorerDevice[] = catalogue.devices
export const EXPLORER_GROUPS: readonly ExplorerGroup[] = catalogue.groups
export const ASSEMBLY_HOTSPOTS = catalogue.assemblyHotspots

export function explorerDevice(id: string): ExplorerDevice {
  const device = EXPLORER_DEVICES.find((entry) => entry.id === id)
  if (!device) throw new Error(`The explorer has no model ${id}`)
  return device
}

/** A kit model's anchors and extras, as the committed kit manifest records them. */
export function kitModel(id: string): KitModel {
  const model = catalogue.kit[id]
  if (!model) throw new Error(`The catalogue has no kit model ${id}`)
  return model
}

// ——— Presentation words ———

export const CLAIM_KINDS: Record<
  ClaimKind,
  { readonly title: string; readonly description: string }
> = {
  sourced: {
    title: 'Sourced device fact',
    description:
      'Published in a manufacturer document or the US FDA device database. Awaiting the manufacturer’s fact-check.',
  },
  derived: {
    title: 'Derived measurement',
    description:
      'Measured by this project on the manufacturer’s reference images, with the tolerance shown.',
  },
  authored: {
    title: 'Authored geometry',
    description: 'Drawn or chosen to build the model. Illustrative, not a device fact.',
  },
  unresolved: {
    title: 'Unresolved manufacturer detail',
    description: 'Not documented, or the manufacturer’s documents differ.',
  },
}

export const CLAIM_KIND_ORDER: readonly ClaimKind[] = [
  'sourced',
  'derived',
  'authored',
  'unresolved',
]

export const QUALITY_CLASS_WORDS: Record<
  QualityClass,
  { readonly title: string; readonly description: string }
> = {
  A: {
    title: 'Showcase quality',
    description: 'Every visible dimension is published or measured with a stated tolerance.',
  },
  B: {
    title: 'Presentation quality',
    description:
      'At least one visible form is authored, drawn without measurement, or differs between sources.',
  },
  C: {
    title: 'Blockout',
    description: 'The form stands in for a design that has not been documented.',
  },
}

export const MODEL_STATUS = 'Parametric educational model — awaiting manufacturer fact-check'

export const EXPLORER_WORDS = {
  title: 'Thoracoscopy equipment explorer',
  subtitle:
    'The operative telescope, access sleeves and instruments, built from published dimensions.',
  label: catalogue.label,
  footer: [
    catalogue.label,
    'Not yet reviewed by the manufacturer',
    'Private preview',
    'A dimensional fit is not a statement of compatibility',
  ],
  assembly: {
    title: 'Assembled system',
    subtitle: 'Flexible sleeve, operative telescope and double-spoon forceps',
    together:
      'Shown together because the set lists these instruments together. Positions follow published and measured dimensions; a dimensional fit is not a statement of compatibility.',
  },
} as const

// ——— The assembly sequence, in words ———

/** The numbers the step captions quote, each computed from the anchors and definitions. */
export interface AssemblyStepValues {
  /** Derived: where the sleeve sat on the telescope in a reference image. */
  readonly sleeveSeatMm: number
  /** Derived: the channel's length, entry to exit. */
  readonly channelLengthMm: number
  /** Sourced: the forceps' sheath length. */
  readonly sheathLengthMm: number
  /** Derived: the sheath end beyond the distal face, fully inserted. */
  readonly sheathBeyondMm: number
  /** Derived: both jaws together, fully open. */
  readonly jawOpeningDeg: number
}

export type AssemblyStepWordId =
  | 'sleeve'
  | 'telescope-aligns'
  | 'telescope-advances'
  | 'to-distal-end'
  | 'cutaway'
  | 'forceps-aligns'
  | 'forceps-advances'
  | 'forceps-exits'
  | 'jaws'
  | 'assembled'

const mm = (value: number) => `${Number(value.toFixed(1))} mm`

export const ASSEMBLY_STEP_WORDS: Record<
  AssemblyStepWordId,
  { readonly title: string; readonly caption: (values: AssemblyStepValues) => string }
> = {
  sleeve: {
    title: 'The flexible sleeve',
    caption: () => 'The sleeve is placed first. The telescope passes along its lumen.',
  },
  'telescope-aligns': {
    title: 'Telescope aligns with the sleeve',
    caption: () => 'The telescope’s shaft axis is brought onto the sleeve’s lumen axis.',
  },
  'telescope-advances': {
    title: 'Telescope advances through the sleeve',
    caption: (v) =>
      `The distal face travels through the cap and out of the sleeve’s distal end. The sleeve is shown where it sat in a reference image, ${mm(v.sleeveSeatMm)} from the distal face.`,
  },
  'to-distal-end': {
    title: 'The distal end',
    caption: () => 'At the distal face: the optic above, the working channel’s exit below.',
  },
  cutaway: {
    title: 'Cutaway view',
    caption: () =>
      'The shell is drawn see-through. The optical path and the channel’s course inside are illustrative.',
  },
  'forceps-aligns': {
    title: 'Forceps aligns with the channel entry',
    caption: () =>
      'The forceps sheath is brought onto the working channel’s axis, behind the sealing cap.',
  },
  'forceps-advances': {
    title: 'Forceps advances through the working channel',
    caption: (v) =>
      `The jaws travel the length of the working channel, ${mm(v.channelLengthMm)} as measured.`,
  },
  'forceps-exits': {
    title: 'Jaws leave the channel exit',
    caption: (v) =>
      `Fully inserted, the front of the handle meets the channel entry and the sheath end stands ${mm(v.sheathBeyondMm)} beyond the distal face: the ${mm(v.sheathLengthMm)} published sheath less the ${mm(v.channelLengthMm)} measured channel.`,
  },
  jaws: {
    title: 'Jaws open and close',
    caption: (v) =>
      `Both jaws turn about the hinge. Fully open they stand ${Number(v.jawOpeningDeg.toFixed(1))}° apart, as measured on a reference image.`,
  },
  assembled: {
    title: 'The assembled system',
    caption: () => 'Sleeve, telescope and forceps together.',
  },
}
