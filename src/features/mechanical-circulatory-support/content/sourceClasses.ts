import { mcsSources } from './sources'

/**
 * What kind of source each record is, and whether anyone has actually read it for this module
 * (F10).
 *
 * A learner saw "Supplied Word document… names no author… OpenAI as the creator" first under an
 * explanation and trusted the explanation less — reasonably. The record was honest about what the
 * document is; what was missing was any statement of what it is *for*. A formal title does not make
 * a synthesis evidence, and a registered guideline nobody opened is not a checked source either.
 *
 * Two facts are therefore kept for every record, separately:
 *
 *  - its class: primary clinical or device evidence, a secondary educational source, the model's
 *    own provenance, or authoring provenance;
 *  - whether it was read first-hand for this module, with the slice that read it, or is only
 *    registered.
 *
 * Neither is a review decision. "Read first-hand" means an authoring assistant opened the document
 * and located the passage; it does not mean a clinician approved the claim. Every clinical, device
 * and source decision remains NOT REVIEWED (OD-05).
 */

export type McsSourceClass =
  | 'primary-clinical-device'
  | 'secondary-educational'
  | 'model-provenance'
  | 'authoring-provenance'

export const MCS_SOURCE_CLASS_ORDER: readonly McsSourceClass[] = [
  'primary-clinical-device',
  'secondary-educational',
  'model-provenance',
  'authoring-provenance',
]

export const MCS_SOURCE_CLASS_LABELS: Readonly<Record<McsSourceClass, string>> = {
  'primary-clinical-device': 'Primary clinical or device source',
  'secondary-educational': 'Secondary educational source',
  'model-provenance': 'Model provenance',
  'authoring-provenance': 'Authoring provenance — not independent clinical evidence',
}

export const MCS_SOURCE_CLASS_MEANING: Readonly<Record<McsSourceClass, string>> = {
  'primary-clinical-device':
    'A society guideline, a manufacturer’s instructions for use or operating instructions, or a regulator’s record.',
  'secondary-educational':
    'A textbook chapter or a manufacturer’s teaching material. Useful for explanation; not a guideline and not device instructions.',
  'model-provenance':
    'The description of this simulation itself. It supports statements about the model, never about patients.',
  'authoring-provenance':
    'A document the module was drafted from. It records where wording came from and is not, by itself, a reason to believe a clinical statement.',
}

export type McsSourceVerification = 'read-first-hand' | 'registered-not-opened'

interface McsSourceClassRecord {
  readonly sourceClass: McsSourceClass
  readonly verification: McsSourceVerification
  /** The slice whose record shows the document being opened. */
  readonly readIn?: string
}

const read = (sourceClass: McsSourceClass, readIn: string): McsSourceClassRecord => ({
  sourceClass,
  verification: 'read-first-hand',
  readIn,
})
const registered = (sourceClass: McsSourceClass): McsSourceClassRecord => ({
  sourceClass,
  verification: 'registered-not-opened',
})

const RECORDS: Readonly<Record<string, McsSourceClassRecord>> = {
  'case-based-device-therapy-hf': read('secondary-educational', 'MCS-03'),
  'mcs-bedside-reference-supplied': read('authoring-provenance', 'MCS-03'),
  'master-hemodynamics-reference': read('authoring-provenance', 'MCS-03'),
  'ishlt-hfsa-acute-mcs-2023': registered('primary-clinical-device'),
  'ishlt-durable-mcs-2023': registered('primary-clinical-device'),
  'getinge-iabp-current': registered('secondary-educational'),
  'getinge-iabp-placement-training': registered('secondary-educational'),
  'getinge-cardiosave-hybrid-operating-instructions': read('primary-clinical-device', 'MCS-03'),
  'getinge-cardiosave-troubleshooting-strategies': read('secondary-educational', 'MCS-03'),
  'getinge-iabp-numbers-game': read('secondary-educational', 'MCS-PRE-REVIEW-02'),
  'guide-mcs-vad-clinicians-2022': read('secondary-educational', 'MCS-PRE-REVIEW-04'),
  'impella-cp-ifu-rev-v-supplied': read('primary-clinical-device', 'MCS-03 and MCS-PRE-REVIEW-04'),
  'impella-55-ifu-rev-l-supplied': read('primary-clinical-device', 'MCS-03 and MCS-PRE-REVIEW-04'),
  'impella-rp-ifu-rev-n-supplied': read('primary-clinical-device', 'MCS-03 and MCS-PRE-REVIEW-04'),
  'fda-impella-cp-labeling': registered('primary-clinical-device'),
  'impella-cp-smartassist-insertion': registered('secondary-educational'),
  'jnj-impella-cp-current': registered('secondary-educational'),
  'fda-impella-55-labeling': registered('primary-clinical-device'),
  'jnj-impella-55-current': registered('secondary-educational'),
  'elso-vv-ecmo-guideline': registered('primary-clinical-device'),
  'elso-va-ecmo-guideline': registered('primary-clinical-device'),
  'fda-impella-rp-labeling': registered('primary-clinical-device'),
  'jnj-impella-rp-current': registered('secondary-educational'),
  'fda-impella-rp-2026-recall': registered('primary-clinical-device'),
  'fda-impella-cp-2026-recall': registered('primary-clinical-device'),
  'fda-impella-controller-2025-recall': registered('primary-clinical-device'),
  'fda-heartmate3-ifu': registered('primary-clinical-device'),
  'abbott-heartmate3-pump-parameters-card': read('secondary-educational', 'MCS-PRE-REVIEW-01'),
  'fda-heartmate3-pma-current': registered('primary-clinical-device'),
  'fda-heartmate-mpu-2025-recall': registered('primary-clinical-device'),
  'fda-heartmate-power-cord-2025-recall': registered('primary-clinical-device'),
  'mcs-educational-model-v1': read('model-provenance', 'the module itself'),
}

export function mcsSourceClass(sourceId: string): McsSourceClass {
  const record = RECORDS[sourceId]
  if (!record) throw new Error(`No source class for ${sourceId}`)
  return record.sourceClass
}

export function mcsSourceVerification(sourceId: string): McsSourceVerification {
  const record = RECORDS[sourceId]
  if (!record) throw new Error(`No source class for ${sourceId}`)
  return record.verification
}

/** One short phrase a learner can read beside a source. */
export function mcsSourceVerificationLabel(sourceId: string): string {
  const record = RECORDS[sourceId]
  if (!record) throw new Error(`No source class for ${sourceId}`)
  return record.verification === 'read-first-hand'
    ? `Opened and read for this module (${record.readIn}); not clinically reviewed`
    : 'Registered, not opened for this module'
}

export const MCS_AUTHORING_PROVENANCE_SOURCE_IDS: readonly string[] = Object.keys(RECORDS).filter(
  (id) => RECORDS[id].sourceClass === 'authoring-provenance',
)

/** Source ids in class order, each class in the order it was given. */
export function mcsSourceIdsByClass(sourceIds: readonly string[]): readonly string[] {
  return MCS_SOURCE_CLASS_ORDER.flatMap((sourceClass) =>
    sourceIds.filter((id) => RECORDS[id]?.sourceClass === sourceClass),
  )
}

function validateSourceClasses(): readonly string[] {
  const errors: string[] = []
  for (const source of mcsSources) {
    if (!RECORDS[source.id]) errors.push(`${source.id}: no source class`)
  }
  for (const id of Object.keys(RECORDS)) {
    if (!mcsSources.some((source) => source.id === id))
      errors.push(`${id}: classed but not in the source registry`)
  }
  if (MCS_AUTHORING_PROVENANCE_SOURCE_IDS.length !== 2)
    errors.push('exactly the two supplied syntheses are authoring provenance')
  return errors
}

const sourceClassErrors = validateSourceClasses()
if (sourceClassErrors.length > 0) {
  throw new Error(`Invalid MCS source classes:\n- ${sourceClassErrors.join('\n- ')}`)
}
