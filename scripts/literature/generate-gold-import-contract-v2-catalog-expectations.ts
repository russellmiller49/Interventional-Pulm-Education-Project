import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  collectProtectedV2CompleteCatalogExpectationProposalObservation,
  type ProtectedV2CompleteCatalogObservation,
} from './gold-import-contract-v2-catalog-audit'
import {
  PROTECTED_V2_EXPECTED_CATALOG_PROFILE_IDS,
  PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY,
  PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY,
  buildProtectedV2CatalogExpectedArtifact,
  compareProtectedV2CatalogObservationToExpectedArtifact,
  rawCommittedProtectedV2CatalogExpectedArtifact,
  type ProtectedV2CatalogExpectedArtifact,
  type ProtectedV2ExpectedCatalogProfileId,
} from './gold-import-contract-v2-catalog-expectations'
import {
  PROTECTED_V2_LOCAL_OWNER_PROJECTION_SQL,
  withTrustedLocalRoleInventoryProjection,
} from './rehearse-gold-import-contract-v2-catalog-drift-matrix'
import {
  executeV2DisposableCatalogExpectationProposalPath,
  type ExecuteV2DisposableCatalogProbeInput,
} from './rehearse-gold-import-compensation-db-v2'
import {
  DEVELOPMENT_DATABASE_SEED_SCHEMA_VERSION,
  type DevelopmentDatabaseSeed,
} from './rehearse-exact-gold-import-compensation-package-v1'
import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'
import {
  assertExclusiveOutputDirectoryIdentity,
  assertSafeOutputPathArgument,
  createExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
} from './lib/exclusive-output'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CONTRACT_DIRECTORY = resolve(
  REPOSITORY_ROOT,
  'scripts/literature/contracts/protected-v2-complete-catalog',
)
const PROFILE_FILENAMES: Record<ProtectedV2ExpectedCatalogProfileId, string> = {
  local_supabase_postgres_owner_v1: 'local_supabase_postgres_owner_v1.json',
  supabase_admin_owner_v1: 'supabase_admin_owner_v1.json',
}
const CLI_ARGUMENTS = ['help', 'output', 'output-root'] as const
const DATABASE_TARGET_ENVIRONMENT_KEYS = ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_DB_URL'] as const
const CATALOG_OBSERVATION_CAPTURE_COMPLETE = Object.freeze({})
const SYNTHETIC_CATALOG_DISPOSABLE_SEED: DevelopmentDatabaseSeed = {
  batchId: '00000000-0000-4000-8000-000000000001',
  datasetSplit: 'development',
  heldOutIdentitiesIncluded: false,
  schemaVersion: DEVELOPMENT_DATABASE_SEED_SCHEMA_VERSION,
  tables: {
    literature_articles: [
      {
        abstract: null,
        abstract_display_policy: 'snippet_only',
        affiliations: [],
        article_number: null,
        author_keywords: [],
        authors: [],
        citation_source: null,
        classifier_payload: null,
        classifier_version: null,
        collective_authors: [],
        conflict_of_interest: null,
        created_at: '2030-01-01T00:00:00.000Z',
        curation_reason: null,
        doi: null,
        is_conference_abstract: false,
        is_correction: false,
        is_landmark: false,
        is_retracted: false,
        issn_values: [],
        issue: null,
        journal_abbreviation: null,
        journal_id: null,
        journal_title: null,
        languages: [],
        manual_override: false,
        mesh_terms: [],
        metadata_hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        nlm_journal_id: null,
        normalized_title: 'synthetic catalog expectation article',
        normalized_title_hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        pages: null,
        place_of_publication: null,
        pmcid: null,
        pmid: '1',
        publication_date_precision: 'unknown',
        publication_date_raw: null,
        publication_day: null,
        publication_month: null,
        publication_types: [],
        publication_year: null,
        pubmed_created_at: null,
        pubmed_last_revised_at: null,
        pubmed_status: null,
        raw_nbib_tags: {},
        relevance_state: 'unreviewed',
        search_vector: null,
        title: 'Synthetic catalog expectation article',
        updated_at: '2030-01-01T00:00:00.000Z',
        visibility_state: 'draft',
        volume: null,
      },
    ],
    literature_gold_set_batches: [
      {
        created_at: '2030-01-01T00:00:00.000Z',
        created_by_email: 'catalog-expectation@example.invalid',
        created_by_user_id: null,
        frozen_at: null,
        id: '00000000-0000-4000-8000-000000000001',
        kind: 'pilot',
        label_schema_version: 'synthetic',
        name: 'catalog-expectation-synthetic',
        relevance_definition_version: 'synthetic',
        requested_size: 1,
        sampling_algorithm_version: 'synthetic',
        sampling_report: { exclusionSources: [] },
        sampling_seed: 1,
        status: 'active',
        taxonomy_version: 'synthetic',
        test_percent: 0,
        test_unlock_reason: null,
        test_unlocked_at: null,
        test_unlocked_by_email: null,
        test_unlocked_by_user_id: null,
        updated_at: '2030-01-01T00:00:00.000Z',
      },
    ],
    literature_gold_set_events: [],
    literature_gold_set_items: [
      {
        automated_signals_revealed_at: null,
        batch_id: '00000000-0000-4000-8000-000000000001',
        completed_at: null,
        created_at: '2030-01-01T00:00:00.000Z',
        current_review_id: null,
        dataset_split: 'development',
        display_order: 1,
        id: '00000000-0000-4000-8000-000000000002',
        pmid: '1',
        review_status: 'pending',
        sample_stratum: 'strong_likely_ip',
        sampling_metadata: {},
        sampling_reason: 'Synthetic source-free catalog expectation fixture.',
        started_at: null,
        supplemental_metadata_revealed_at: null,
        updated_at: '2030-01-01T00:00:00.000Z',
      },
    ],
    literature_gold_set_review_drafts: [],
    literature_gold_set_reviews: [],
  },
}

const HELP = `Generate review-only exact protected V2 catalog expectation proposals.

This maintainer command always executes four independent exact fresh disposable paths: twice for
supabase_admin_owner_v1 and twice for a disposable local-postgres owner projection. It accepts no
database URL, host, SQL, Docker endpoint, split, artifact path, or contract-update option. It never
contacts the real local Supabase stack and never overwrites committed expectations.

Usage:
  tsx scripts/literature/generate-gold-import-contract-v2-catalog-expectations.ts \\
    --output-root <existing-local-root> --output <fresh-proposal-directory>`

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function prettyCanonical(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`, 'utf8')
}

function pathIsWithin(parent: string, candidate: string): boolean {
  const relativePath = relative(parent, candidate)
  return relativePath === '' || (!relativePath.startsWith('..') && !relativePath.startsWith('/'))
}

export function assertProtectedV2CatalogGeneratorEnvironment(environment: NodeJS.ProcessEnv): void {
  const databaseKey = DATABASE_TARGET_ENVIRONMENT_KEYS.find(
    (name) => typeof environment[name] === 'string' && environment[name]!.trim().length > 0,
  )
  if (databaseKey) {
    throw new Error(
      `Catalog expectation generation rejects database target environment ${databaseKey}.`,
    )
  }
  const inheritedTargetKey = Object.keys(environment)
    .sort()
    .find(
      (name) =>
        (/^PG[A-Z0-9_]*$/u.test(name) ||
          /^DOCKER_[A-Z0-9_]+$/u.test(name) ||
          /(?:^|_)HELD_?OUT(?:_|$)/u.test(name)) &&
        typeof environment[name] === 'string' &&
        environment[name]!.trim().length > 0,
    )
  if (inheritedTargetKey) {
    throw new Error(
      `Catalog expectation generation rejects inherited target environment ${inheritedTargetKey}.`,
    )
  }
}

async function verifyPinnedRuntimeBytes(
  read: (path: string) => Promise<Uint8Array>,
): Promise<{ migrationSha256: string; verifierSha256: string }> {
  const migrationPath = resolve(
    REPOSITORY_ROOT,
    'supabase/migrations',
    PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY.filename,
  )
  const verifierPath = resolve(
    REPOSITORY_ROOT,
    'supabase/verification',
    PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY.filename,
  )
  const [migration, verifier] = await Promise.all([read(migrationPath), read(verifierPath)])
  const migrationSha256 = sha256(migration)
  const verifierSha256 = sha256(verifier)
  if (
    migrationSha256 !== PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY.sha256 ||
    verifierSha256 !== PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY.sha256
  ) {
    throw new Error('Catalog expectation generator refused unpinned migration or verifier bytes.')
  }
  return { migrationSha256, verifierSha256 }
}

type DisposablePathRunner = (
  input: ExecuteV2DisposableCatalogProbeInput,
) => ReturnType<typeof executeV2DisposableCatalogExpectationProposalPath>
type ProposalCollector = typeof collectProtectedV2CompleteCatalogExpectationProposalObservation

async function captureFreshDisposableProfileWithRunner(
  profileId: ProtectedV2ExpectedCatalogProfileId,
  runDisposablePath: DisposablePathRunner,
  collectObservation: ProposalCollector,
): Promise<ProtectedV2CompleteCatalogObservation> {
  let observation: ProtectedV2CompleteCatalogObservation | undefined
  try {
    await runDisposablePath({
      exactPackageExecutor: {
        async execute(context) {
          if (context.migrationPath !== 'fresh') {
            throw new Error('Catalog expectation generation accepts only the exact fresh path.')
          }
          if (profileId === 'local_supabase_postgres_owner_v1') {
            await context.psql(PROTECTED_V2_LOCAL_OWNER_PROJECTION_SQL)
            observation = await collectObservation({
              context: withTrustedLocalRoleInventoryProjection(context),
              profile: 'local',
            })
          } else if (profileId === 'supabase_admin_owner_v1') {
            observation = await collectObservation({
              context,
              profile: 'disposable_clone',
            })
          } else {
            const exhaustive: never = profileId
            throw new Error(`Unsupported catalog expectation profile: ${String(exhaustive)}.`)
          }
          throw CATALOG_OBSERVATION_CAPTURE_COMPLETE
        },
      },
      migrationPath: 'fresh',
      seed: SYNTHETIC_CATALOG_DISPOSABLE_SEED,
    })
    throw new Error('Catalog expectation disposable runner swallowed the capture sentinel.')
  } catch (error) {
    if (error !== CATALOG_OBSERVATION_CAPTURE_COMPLETE) throw error
  }
  if (!observation) throw new Error('Catalog-expectation disposable path captured no observation.')
  return observation
}

async function captureFreshDisposableProfile(
  profileId: ProtectedV2ExpectedCatalogProfileId,
): Promise<ProtectedV2CompleteCatalogObservation> {
  return captureFreshDisposableProfileWithRunner(
    profileId,
    executeV2DisposableCatalogExpectationProposalPath,
    collectProtectedV2CompleteCatalogExpectationProposalObservation,
  )
}

export async function captureProtectedV2CatalogProfileWithRunnerForTest(
  profileId: ProtectedV2ExpectedCatalogProfileId,
  runDisposablePath: DisposablePathRunner,
  collectObservation: ProposalCollector,
): Promise<ProtectedV2CompleteCatalogObservation> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Catalog expectation disposable-runner injection is test-only.')
  }
  return captureFreshDisposableProfileWithRunner(profileId, runDisposablePath, collectObservation)
}

export interface ProtectedV2CatalogExpectationGeneratorDependencies {
  captureProfile(
    profileId: ProtectedV2ExpectedCatalogProfileId,
  ): Promise<ProtectedV2CompleteCatalogObservation>
  environment: NodeJS.ProcessEnv
  readRuntimeFile(path: string): Promise<Uint8Array>
}

const PRODUCTION_DEPENDENCIES: ProtectedV2CatalogExpectationGeneratorDependencies = {
  captureProfile: captureFreshDisposableProfile,
  environment: process.env,
  readRuntimeFile: readFile,
}

function summarizedCommittedComparison(
  observation: ProtectedV2CompleteCatalogObservation,
  proposal: ProtectedV2CatalogExpectedArtifact,
) {
  try {
    const comparison = compareProtectedV2CatalogObservationToExpectedArtifact(
      observation,
      rawCommittedProtectedV2CatalogExpectedArtifact(proposal.profileId),
    )
    const exactArtifactBytes =
      canonicalJson(rawCommittedProtectedV2CatalogExpectedArtifact(proposal.profileId)) ===
      canonicalJson(proposal)
    return {
      differences: comparison.differences.map(
        ({ component, firstDifferingField, kind, recordKey, source }) => ({
          component,
          firstDifferingField,
          kind,
          recordKey,
          source,
        }),
      ),
      exactArtifactBytes,
      passed: comparison.passed && exactArtifactBytes,
    }
  } catch (error) {
    return {
      differences: [],
      error: error instanceof Error ? error.message : String(error),
      exactArtifactBytes: false,
      passed: false,
    }
  }
}

export async function generateProtectedV2CatalogExpectationProposals(input: {
  dependencies?: ProtectedV2CatalogExpectationGeneratorDependencies
  output: string
  outputRoot: string
}): Promise<{
  committedExpectationsExact: boolean
  outputDirectory: string
  profiles: Record<
    ProtectedV2ExpectedCatalogProfileId,
    { artifactContentSha256: string; fullAuditIdentitySha256: string }
  >
}> {
  if (input.dependencies && process.env.NODE_ENV !== 'test') {
    throw new Error('Catalog expectation dependency injection is restricted to tests.')
  }
  const dependencies = input.dependencies ?? PRODUCTION_DEPENDENCIES
  assertProtectedV2CatalogGeneratorEnvironment(dependencies.environment)
  assertSafeOutputPathArgument(input.outputRoot, '--output-root')
  assertSafeOutputPathArgument(input.output, '--output')
  const outputRoot = resolve(input.outputRoot)
  const outputDirectory = resolve(input.output)
  if (pathIsWithin(CONTRACT_DIRECTORY, outputDirectory)) {
    throw new Error('Catalog expectation proposals cannot be written into the contract directory.')
  }
  const output = await createExclusiveOutputDirectory({ outputDirectory, outputRoot })
  const pinned = await verifyPinnedRuntimeBytes(dependencies.readRuntimeFile)
  const proposals = new Map<
    ProtectedV2ExpectedCatalogProfileId,
    ProtectedV2CatalogExpectedArtifact
  >()
  const comparisons: Record<string, unknown> = {}
  for (const profileId of PROTECTED_V2_EXPECTED_CATALOG_PROFILE_IDS) {
    const firstObservation = await dependencies.captureProfile(profileId)
    const secondObservation = await dependencies.captureProfile(profileId)
    if (
      firstObservation.profileId !== profileId ||
      secondObservation.profileId !== profileId ||
      firstObservation.target !== secondObservation.target ||
      firstObservation.identity.environmentInvariantIdentitySha256 !==
        secondObservation.identity.environmentInvariantIdentitySha256
    ) {
      throw new Error(`Repeated ${profileId} catalog observations used inconsistent profiles.`)
    }
    const first = buildProtectedV2CatalogExpectedArtifact({
      ...pinned,
      observation: firstObservation,
    })
    const second = buildProtectedV2CatalogExpectedArtifact({
      ...pinned,
      observation: secondObservation,
    })
    if (canonicalJson(first) !== canonicalJson(second)) {
      throw new Error(
        `Repeated ${profileId} catalog expectation proposals were not byte-identical.`,
      )
    }
    proposals.set(profileId, first)
    comparisons[profileId] = summarizedCommittedComparison(firstObservation, first)
  }
  if (proposals.size !== PROTECTED_V2_EXPECTED_CATALOG_PROFILE_IDS.length) {
    throw new Error('Catalog expectation proposal profile inventory is incomplete.')
  }
  const committedExpectationsExact = Object.values(comparisons).every(
    (comparison) =>
      comparison &&
      typeof comparison === 'object' &&
      !Array.isArray(comparison) &&
      (comparison as Record<string, unknown>).passed === true,
  )
  const report = {
    committedExpectationsExact,
    comparisons,
    generator: {
      acceptedCallerDatabaseTarget: false,
      acceptedCallerDockerEndpoint: false,
      acceptedCallerSql: false,
      acceptedHeldOutInput: false,
      freshDisposableRunCount: 4,
      overwriteModeAvailable: false,
      profileRunCounts: {
        local_supabase_postgres_owner_v1: 2,
        supabase_admin_owner_v1: 2,
      },
      remoteAccess: false,
    },
    profiles: Object.fromEntries(
      [...proposals].map(([profileId, artifact]) => [
        profileId,
        {
          artifactContentSha256: artifact.artifactContentSha256,
          componentIdentities: artifact.componentIdentities,
          expectedDeploymentProfileIdentitySha256: artifact.expectedDeploymentProfileIdentitySha256,
          fullAuditIdentitySha256: artifact.fullAuditIdentitySha256,
          fullEnvironmentInventoryIdentitySha256: artifact.fullEnvironmentInventoryIdentitySha256,
          fullEnvironmentInventoryRecordCount: artifact.fullEnvironmentInventoryRecordCount,
          normalizedInventorySha256: artifact.normalizedInventory.canonicalJsonSha256,
        },
      ]),
    ),
    runtime: {
      migration: PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY,
      verifier: PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY,
    },
    schemaVersion: 'literature-gold-protected-v2-catalog-expectation-proposal/1.0.0',
  }
  writeExclusiveOutputFiles(output, [
    ...[...proposals].map(([profileId, artifact]) => ({
      bytes: prettyCanonical(artifact),
      name: PROFILE_FILENAMES[profileId],
    })),
    { bytes: prettyCanonical(report), name: 'comparison-report.json' },
  ])
  await assertExclusiveOutputDirectoryIdentity(output)
  return {
    committedExpectationsExact,
    outputDirectory,
    profiles: Object.fromEntries(
      [...proposals].map(([profileId, artifact]) => [
        profileId,
        {
          artifactContentSha256: artifact.artifactContentSha256,
          fullAuditIdentitySha256: artifact.fullAuditIdentitySha256,
        },
      ]),
    ) as Record<
      ProtectedV2ExpectedCatalogProfileId,
      { artifactContentSha256: string; fullAuditIdentitySha256: string }
    >,
  }
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

export async function runProtectedV2CatalogExpectationGeneratorCli(argv: readonly string[]) {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, CLI_ARGUMENTS)
  if (arguments_.flags.has('help')) return { help: HELP }
  return generateProtectedV2CatalogExpectationProposals({
    output: requiredArgument(arguments_, 'output'),
    outputRoot: requiredArgument(arguments_, 'output-root'),
  })
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runProtectedV2CatalogExpectationGeneratorCli(process.argv.slice(2))
    .then((result) => console.log(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
