/** @jest-environment node */

import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { mkdtemp } from 'node:fs/promises'

import type { ProtectedV2CompleteCatalogObservation } from './gold-import-contract-v2-catalog-audit'
import { reconciliationIdentitySha256 } from './gold-import-compensation-contract-reconciliation'
import {
  committedProtectedV2CatalogExpectedArtifactForValidatedProfile,
  decodeProtectedV2CatalogExpectedInventories,
  expectedObservedAuditIdentityFromArtifact,
  type ProtectedV2CatalogExpectedArtifact,
  type ProtectedV2CatalogObservationForExpectation,
} from './gold-import-contract-v2-catalog-expectations'
import {
  assertProtectedV2CatalogGeneratorEnvironment,
  captureProtectedV2CatalogProfileWithRunnerForTest,
  generateProtectedV2CatalogExpectationProposals,
} from './generate-gold-import-contract-v2-catalog-expectations'
import { PROTECTED_V2_LOCAL_OWNER_PROJECTION_SQL } from './rehearse-gold-import-contract-v2-catalog-drift-matrix'
import type { ExecuteV2DisposableCatalogProbeInput } from './rehearse-gold-import-compensation-db-v2'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function observation(
  artifact: ProtectedV2CatalogExpectedArtifact,
): ProtectedV2CompleteCatalogObservation {
  return {
    identity: expectedObservedAuditIdentityFromArtifact(
      artifact,
    ) as ProtectedV2CompleteCatalogObservation['identity'],
    normalizedInventories: decodeProtectedV2CatalogExpectedInventories(artifact),
    profileId: artifact.profileId,
    target: artifact.target,
  }
}

function driftedObservation(
  base: ProtectedV2CatalogObservationForExpectation,
): ProtectedV2CompleteCatalogObservation {
  const drifted = clone(base) as ProtectedV2CompleteCatalogObservation
  const columns = (
    drifted.normalizedInventories.componentInputs.columns as {
      details: Array<{ not_null: boolean }>
    }
  ).details
  columns[0]!.not_null = !columns[0]!.not_null
  drifted.identity.componentIdentities.columns = reconciliationIdentitySha256(
    drifted.normalizedInventories.componentInputs.columns,
  )
  const identityContent = { ...drifted.identity }
  delete (identityContent as { fullAuditIdentitySha256?: string }).fullAuditIdentitySha256
  drifted.identity.fullAuditIdentitySha256 = reconciliationIdentitySha256(identityContent)
  return drifted
}

const adminArtifact = committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
  'supabase_admin_owner_v1',
  'disposable',
)
const localArtifact = committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
  'local_supabase_postgres_owner_v1',
  'local',
)
const OBSERVATIONS = {
  local_supabase_postgres_owner_v1: observation(localArtifact),
  supabase_admin_owner_v1: observation(adminArtifact),
}

function fakeContext() {
  return {
    batchId: '00000000-0000-4000-8000-000000000001',
    migrationPath: 'fresh' as const,
    migrationSha256: 'a'.repeat(64),
    postV2SeedSnapshot: {},
    psql: jest.fn(async () => ({ stderr: '', stdout: '' })),
    queryJson: jest.fn(async () => ({})),
    schemaOnlyUpgrade: null,
  }
}

function rethrowingRunner(context = fakeContext()) {
  return async (input: ExecuteV2DisposableCatalogProbeInput): Promise<never> => {
    try {
      await input.exactPackageExecutor.execute(context as never)
    } catch (error) {
      throw error
    }
    throw new Error('Expected the catalog capture callback to throw its sentinel.')
  }
}

async function actualRuntimeBytes(path: string): Promise<Uint8Array> {
  return readFile(path)
}

describe('protected V2 catalog expectation proposal generator', () => {
  it('accepts the private sentinel only by exact reference after observation capture', async () => {
    const collector = async () => OBSERVATIONS.supabase_admin_owner_v1
    await expect(
      captureProtectedV2CatalogProfileWithRunnerForTest(
        'supabase_admin_owner_v1',
        rethrowingRunner(),
        collector,
      ),
    ).resolves.toEqual(OBSERVATIONS.supabase_admin_owner_v1)

    const forgedSentinel = Object.freeze({})
    const forgedRunner = async (input: ExecuteV2DisposableCatalogProbeInput): Promise<never> => {
      try {
        await input.exactPackageExecutor.execute(fakeContext() as never)
      } catch {
        throw forgedSentinel
      }
      throw new Error('Expected capture sentinel.')
    }
    await expect(
      captureProtectedV2CatalogProfileWithRunnerForTest(
        'supabase_admin_owner_v1',
        forgedRunner,
        collector,
      ),
    ).rejects.toBe(forgedSentinel)
  })

  it('rejects cleanup AggregateError wrapping the private sentinel', async () => {
    const cleanupFailureRunner = async (
      input: ExecuteV2DisposableCatalogProbeInput,
    ): Promise<never> => {
      try {
        await input.exactPackageExecutor.execute(fakeContext() as never)
      } catch (error) {
        throw new AggregateError([error, new Error('cleanup failed')], 'cleanup failed')
      }
      throw new Error('Expected capture sentinel.')
    }
    await expect(
      captureProtectedV2CatalogProfileWithRunnerForTest(
        'supabase_admin_owner_v1',
        cleanupFailureRunner,
        async () => OBSERVATIONS.supabase_admin_owner_v1,
      ),
    ).rejects.toThrow('cleanup failed')
  })

  it('applies local owner projection only inside the exact fresh disposable callback', async () => {
    const context = fakeContext()
    let enteredCallback = false
    const runner = async (input: ExecuteV2DisposableCatalogProbeInput): Promise<never> => {
      expect(context.psql).not.toHaveBeenCalled()
      enteredCallback = true
      try {
        await input.exactPackageExecutor.execute(context as never)
      } catch (error) {
        throw error
      }
      throw new Error('Expected capture sentinel.')
    }
    await expect(
      captureProtectedV2CatalogProfileWithRunnerForTest(
        'local_supabase_postgres_owner_v1',
        runner,
        async () => OBSERVATIONS.local_supabase_postgres_owner_v1,
      ),
    ).resolves.toEqual(OBSERVATIONS.local_supabase_postgres_owner_v1)
    expect(enteredCallback).toBe(true)
    expect(context.psql).toHaveBeenCalledTimes(1)
    expect(context.psql).toHaveBeenCalledWith(PROTECTED_V2_LOCAL_OWNER_PROJECTION_SQL)
  })

  it('runs exactly two independent captures per profile and writes exact committed proposals', async () => {
    const root = await mkdtemp(join(tmpdir(), 'protected-v2-catalog-generator-'))
    const calls: string[] = []
    const result = await generateProtectedV2CatalogExpectationProposals({
      dependencies: {
        captureProfile: async (profileId) => {
          calls.push(profileId)
          return clone(OBSERVATIONS[profileId])
        },
        environment: { NODE_ENV: 'test' },
        readRuntimeFile: actualRuntimeBytes,
      },
      output: resolve(root, 'proposal'),
      outputRoot: root,
    })
    expect(calls).toEqual([
      'local_supabase_postgres_owner_v1',
      'local_supabase_postgres_owner_v1',
      'supabase_admin_owner_v1',
      'supabase_admin_owner_v1',
    ])
    expect(result.committedExpectationsExact).toBe(true)
  })

  it('rejects nondeterministic repeated observations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'protected-v2-catalog-drift-'))
    let localCall = 0
    await expect(
      generateProtectedV2CatalogExpectationProposals({
        dependencies: {
          captureProfile: async (profileId) => {
            if (profileId === 'supabase_admin_owner_v1') {
              return clone(OBSERVATIONS.supabase_admin_owner_v1)
            }
            localCall += 1
            return localCall === 1
              ? clone(OBSERVATIONS.local_supabase_postgres_owner_v1)
              : driftedObservation(OBSERVATIONS.local_supabase_postgres_owner_v1)
          },
          environment: { NODE_ENV: 'test' },
          readRuntimeFile: actualRuntimeBytes,
        },
        output: resolve(root, 'proposal'),
        outputRoot: root,
      }),
    ).rejects.toThrow('were not byte-identical')
  })

  it('rejects unpinned runtime bytes before any disposable capture', async () => {
    const root = await mkdtemp(join(tmpdir(), 'protected-v2-catalog-pins-'))
    const captureProfile = jest.fn()
    await expect(
      generateProtectedV2CatalogExpectationProposals({
        dependencies: {
          captureProfile,
          environment: { NODE_ENV: 'test' },
          readRuntimeFile: async () => Buffer.from('tampered'),
        },
        output: resolve(root, 'proposal'),
        outputRoot: root,
      }),
    ).rejects.toThrow('unpinned migration or verifier bytes')
    expect(captureProfile).not.toHaveBeenCalled()
  })

  it('rejects programmatic dependency injection outside tests', async () => {
    const originalNodeEnvironment = process.env.NODE_ENV
    Reflect.set(process.env, 'NODE_ENV', 'production')
    try {
      await expect(
        generateProtectedV2CatalogExpectationProposals({
          dependencies: {
            captureProfile: async () => clone(OBSERVATIONS.supabase_admin_owner_v1),
            environment: { NODE_ENV: 'test' },
            readRuntimeFile: actualRuntimeBytes,
          },
          output: '/tmp/not-created-catalog-proposal',
          outputRoot: '/tmp',
        }),
      ).rejects.toThrow('dependency injection is restricted to tests')
    } finally {
      Reflect.set(process.env, 'NODE_ENV', originalNodeEnvironment)
    }
  })

  it.each([
    ['DATABASE_URL', 'postgres://forbidden.invalid/db'],
    ['PGHOST', 'forbidden.invalid'],
    ['PGPASSWORD', 'forbidden'],
    ['DOCKER_HOST', 'unix:///caller-supplied.sock'],
    ['DOCKER_CONTEXT', 'caller-supplied'],
    ['GOLD_HELD_OUT_IDENTITIES', 'forbidden'],
  ])('rejects inherited target environment %s', (name, value) => {
    expect(() =>
      assertProtectedV2CatalogGeneratorEnvironment({
        NODE_ENV: 'test',
        [name]: value,
      } as NodeJS.ProcessEnv),
    ).toThrow('rejects')
  })

  it('never lets readiness import or execute the maintainer generator', async () => {
    const auditSource = await readFile(
      resolve(__dirname, 'gold-import-contract-v2-catalog-audit.ts'),
      'utf8',
    )
    expect(auditSource).not.toContain('generate-gold-import-contract-v2-catalog-expectations')
  })
})
