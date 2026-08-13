import { createHash } from 'node:crypto'

import { z } from 'zod'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  packageReadinessStateIdentitySha256,
  validateGoldImportV2PackageReadinessState,
  type GoldImportV2PackageReadinessState,
} from './gold-import-v2-package-readiness'
import {
  fixedLocalTargetIdentityFromObservation,
  goldImportV2FixedLocalTargetObservationSchema,
  validateGoldImportV2FixedLocalTargetObservation,
  type GoldImportV2FixedLocalTargetObservation,
} from './gold-import-v2-fixed-local-target'

export const GOLD_IMPORT_V2_DATABASE_PUBLICATION_BRACKET_SCHEMA_VERSION =
  'literature-gold-v2-database-publication-bracket/1.0.0' as const
export const GOLD_IMPORT_V2_DATABASE_PUBLICATION_RESIDUAL_WINDOW =
  'A database commit after the final read-only observation and before the same-filesystem rename cannot be excluded without a cross-system lock; every later consumer must reobserve the database independently.' as const

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const timestampSchema = z.string().datetime({ offset: true })

const publicationObservationBindingBodySchema = z
  .object({
    batchId: z.string().uuid(),
    databaseStateIdentitySha256: sha256Schema,
    finalizedReceiptAuthorityIdentitySha256: sha256Schema,
    migrationLedger: z.object({ v1Occurrence: z.literal(1), v2Occurrence: z.literal(1) }).strict(),
    observedAt: timestampSchema,
    operationCounts: z
      .object({
        actionCount: z.literal(0),
        compensationCount: z.literal(0),
        importCount: z.literal(0),
        operationCount: z.literal(0),
      })
      .strict(),
    stateIdentities: z.record(z.string(), sha256Schema),
    targetIdentitySha256: sha256Schema,
    targetObservation: goldImportV2FixedLocalTargetObservationSchema,
    transaction: z
      .object({ isolationLevel: z.literal('repeatable read'), readOnly: z.literal(true) })
      .strict(),
  })
  .strict()

export const goldImportV2DatabasePublicationObservationBindingSchema =
  publicationObservationBindingBodySchema
    .extend({ observationBindingSha256: sha256Schema })
    .strict()

export type GoldImportV2DatabasePublicationObservationBinding = z.infer<
  typeof goldImportV2DatabasePublicationObservationBindingSchema
>

const publicationBracketBodySchema = z
  .object({
    final: goldImportV2DatabasePublicationObservationBindingSchema,
    initial: goldImportV2DatabasePublicationObservationBindingSchema,
    ordering: z
      .object({
        atomicRenameAfterAuthorization: z.literal(true),
        finalObservationAfterStaging: z.literal(true),
        initialObservationBeforeStaging: z.literal(true),
        laterConsumptionRevalidationRequired: z.literal(true),
      })
      .strict(),
    publicationAuthorizedAt: timestampSchema,
    residualPublicationWindow: z.literal(GOLD_IMPORT_V2_DATABASE_PUBLICATION_RESIDUAL_WINDOW),
    safety: z
      .object({
        compensationAuthorized: z.literal(false),
        heldOutIdentitiesAccessed: z.literal(false),
        importAuthorized: z.literal(false),
        remoteDatabaseAccessed: z.literal(false),
      })
      .strict(),
    schemaVersion: z.literal(GOLD_IMPORT_V2_DATABASE_PUBLICATION_BRACKET_SCHEMA_VERSION),
    stagedAt: timestampSchema,
    stagedPayloadSha256: sha256Schema,
    subject: z.enum(['capture', 'package_readiness', 'production_rehearsal']),
  })
  .strict()

export const goldImportV2DatabasePublicationBracketSchema = publicationBracketBodySchema
  .extend({ bracketIdentitySha256: sha256Schema })
  .strict()

export type GoldImportV2DatabasePublicationBracket = z.infer<
  typeof goldImportV2DatabasePublicationBracketSchema
>

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function buildGoldImportV2DatabasePublicationObservationBinding(input: {
  packageReadiness: GoldImportV2PackageReadinessState
  targetObservation: GoldImportV2FixedLocalTargetObservation
}): GoldImportV2DatabasePublicationObservationBinding {
  const readiness = validateGoldImportV2PackageReadinessState(input.packageReadiness)
  const target = validateGoldImportV2FixedLocalTargetObservation(input.targetObservation)
  const targetIdentity = fixedLocalTargetIdentityFromObservation(target)
  if (canonicalJson(readiness.database.observedTarget) !== canonicalJson(targetIdentity)) {
    throw new Error('Package readiness and live target observation identify different targets.')
  }
  const body = publicationObservationBindingBodySchema.parse({
    batchId: readiness.batch.id,
    databaseStateIdentitySha256: packageReadinessStateIdentitySha256(readiness),
    finalizedReceiptAuthorityIdentitySha256: readiness.receipt.authorityIdentitySha256,
    migrationLedger: {
      v1Occurrence: readiness.migrationLedger.v1.occurrence,
      v2Occurrence: readiness.migrationLedger.v2.occurrence,
    },
    observedAt: target.observationCompletedAt,
    operationCounts: readiness.operationCounts,
    stateIdentities: readiness.stateIdentities,
    targetIdentitySha256: target.targetIdentitySha256,
    targetObservation: target,
    transaction: {
      isolationLevel: target.database.isolationLevel,
      readOnly: target.database.transactionReadOnly,
    },
  })
  return goldImportV2DatabasePublicationObservationBindingSchema.parse({
    ...body,
    observationBindingSha256: sha256(canonicalJson(body)),
  })
}

export function validateGoldImportV2DatabasePublicationObservationBinding(
  input: unknown,
): GoldImportV2DatabasePublicationObservationBinding {
  const binding = goldImportV2DatabasePublicationObservationBindingSchema.parse(input)
  const targetObservation = validateGoldImportV2FixedLocalTargetObservation(
    binding.targetObservation,
  )
  const targetIdentity = fixedLocalTargetIdentityFromObservation(targetObservation)
  const { observationBindingSha256, ...body } = binding
  if (
    sha256(canonicalJson(body)) !== observationBindingSha256 ||
    targetIdentity.targetIdentitySha256 !== binding.targetIdentitySha256
  ) {
    throw new Error('Database publication observation binding is invalid.')
  }
  return Object.freeze({ ...binding, targetObservation })
}

export function assertGoldImportV2DatabasePublicationObservationBindingsMatch(
  expectedInput: unknown,
  observedInput: unknown,
): void {
  const expected = validateGoldImportV2DatabasePublicationObservationBinding(expectedInput)
  const observed = validateGoldImportV2DatabasePublicationObservationBinding(observedInput)
  const {
    observationBindingSha256: _expectedBindingSha256,
    observedAt: _expectedObservedAt,
    targetObservation: _expectedTargetObservation,
    ...expectedStable
  } = expected
  const {
    observationBindingSha256: _observedBindingSha256,
    observedAt: _observedObservedAt,
    targetObservation: _observedTargetObservation,
    ...observedStable
  } = observed
  void _expectedBindingSha256
  void _expectedObservedAt
  void _expectedTargetObservation
  void _observedBindingSha256
  void _observedObservedAt
  void _observedTargetObservation
  const expectedTargetIdentity = fixedLocalTargetIdentityFromObservation(expected.targetObservation)
  const observedTargetIdentity = fixedLocalTargetIdentityFromObservation(observed.targetObservation)
  if (
    canonicalJson(expectedStable) !== canonicalJson(observedStable) ||
    canonicalJson(expectedTargetIdentity) !== canonicalJson(observedTargetIdentity)
  ) {
    throw new Error('Database publication observations identify different protected states.')
  }
}

export function buildGoldImportV2DatabasePublicationBracket(input: {
  final: GoldImportV2DatabasePublicationObservationBinding
  initial: GoldImportV2DatabasePublicationObservationBinding
  publicationAuthorizedAt: string
  stagedAt: string
  stagedPayloadSha256: string
  subject: 'capture' | 'package_readiness' | 'production_rehearsal'
}): GoldImportV2DatabasePublicationBracket {
  const initial = validateGoldImportV2DatabasePublicationObservationBinding(input.initial)
  const final = validateGoldImportV2DatabasePublicationObservationBinding(input.final)
  assertGoldImportV2DatabasePublicationObservationBindingsMatch(initial, final)
  const initialCompletedAtMs = Date.parse(initial.targetObservation.observationCompletedAt)
  const stagedAtMs = Date.parse(input.stagedAt)
  const finalStartedAtMs = Date.parse(final.targetObservation.observationStartedAt)
  const finalCompletedAtMs = Date.parse(final.targetObservation.observationCompletedAt)
  const authorizedAtMs = Date.parse(input.publicationAuthorizedAt)
  if (
    initialCompletedAtMs > stagedAtMs ||
    stagedAtMs > finalStartedAtMs ||
    finalCompletedAtMs > authorizedAtMs
  ) {
    throw new Error('Final database publication observation drifted or was not correctly ordered.')
  }
  const body = publicationBracketBodySchema.parse({
    final,
    initial,
    ordering: {
      atomicRenameAfterAuthorization: true,
      finalObservationAfterStaging: true,
      initialObservationBeforeStaging: true,
      laterConsumptionRevalidationRequired: true,
    },
    publicationAuthorizedAt: input.publicationAuthorizedAt,
    residualPublicationWindow: GOLD_IMPORT_V2_DATABASE_PUBLICATION_RESIDUAL_WINDOW,
    safety: {
      compensationAuthorized: false,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      remoteDatabaseAccessed: false,
    },
    schemaVersion: GOLD_IMPORT_V2_DATABASE_PUBLICATION_BRACKET_SCHEMA_VERSION,
    stagedAt: input.stagedAt,
    stagedPayloadSha256: input.stagedPayloadSha256,
    subject: input.subject,
  })
  return goldImportV2DatabasePublicationBracketSchema.parse({
    ...body,
    bracketIdentitySha256: sha256(canonicalJson(body)),
  })
}

export function validateGoldImportV2DatabasePublicationBracket(
  input: unknown,
): GoldImportV2DatabasePublicationBracket {
  const bracket = goldImportV2DatabasePublicationBracketSchema.parse(input)
  const rebuilt = buildGoldImportV2DatabasePublicationBracket(bracket)
  if (canonicalJson(rebuilt) !== canonicalJson(bracket)) {
    throw new Error('Database publication bracket content or identity is invalid.')
  }
  return Object.freeze(rebuilt)
}

interface PublicationStage<Staged> {
  staged: Staged
  stagedAt: string
  stagedPayloadSha256: string
}

export async function runGoldImportV2DatabasePublicationProtocol<Staged, Published>(input: {
  afterStageForTest?: () => Promise<void> | void
  beforeFinalObservationForTest?: () => Promise<void> | void
  discard(staged: Staged): Promise<void>
  finalize(staged: Staged, bracket: GoldImportV2DatabasePublicationBracket): Promise<void>
  initial: GoldImportV2DatabasePublicationObservationBinding
  now(): Date
  observeFinal(): Promise<GoldImportV2DatabasePublicationObservationBinding>
  prior?: GoldImportV2DatabasePublicationObservationBinding
  publish(staged: Staged): Promise<Published>
  stage(): Promise<PublicationStage<Staged>>
  subject: 'capture' | 'package_readiness' | 'production_rehearsal'
}): Promise<{ bracket: GoldImportV2DatabasePublicationBracket; published: Published }> {
  let stage: PublicationStage<Staged> | undefined
  let published = false
  try {
    if (input.prior) {
      assertGoldImportV2DatabasePublicationObservationBindingsMatch(input.prior, input.initial)
    }
    stage = await input.stage()
    await input.afterStageForTest?.()
    await input.beforeFinalObservationForTest?.()
    const final = await input.observeFinal()
    const bracket = buildGoldImportV2DatabasePublicationBracket({
      final,
      initial: input.initial,
      publicationAuthorizedAt: input.now().toISOString(),
      stagedAt: stage.stagedAt,
      stagedPayloadSha256: stage.stagedPayloadSha256,
      subject: input.subject,
    })
    await input.finalize(stage.staged, bracket)
    const publishedValue = await input.publish(stage.staged)
    published = true
    return { bracket, published: publishedValue }
  } finally {
    if (stage && !published) await input.discard(stage.staged)
  }
}
