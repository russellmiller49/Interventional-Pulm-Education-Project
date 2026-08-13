/** @jest-environment node */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET,
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_SQL,
  buildGoldImportV2FixedLocalTargetObservation,
  fixedLocalTargetIdentityFromObservation,
  validateGoldImportV2FixedLocalTargetIdentity,
  validateGoldImportV2FixedLocalTargetObservation,
} from './gold-import-v2-fixed-local-target'
import {
  buildTestGoldImportV2RawTargetObservation,
  TEST_GOLD_IMPORT_V2_CONTAINER_ID,
} from './gold-import-v2-lifecycle-test-fixture'
import {
  PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS,
  PROTECTED_V2_RECOVERY_DOCKER_COMMAND,
  assertProtectedV2RecoveryEvidenceSqlReadOnly,
  executeProtectedV2FixedLocalReadOnlyPsql,
} from './protected-gold-import-contract-v2-recovery-evidence-adapter'
import { collectGoldImportV2PreimportFixedLocalState } from './gold-import-v2-package-readiness'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

function raw() {
  return clone(buildTestGoldImportV2RawTargetObservation())
}

describe('observed fixed-local Docker/database target', () => {
  it('accepts one exact mutually consistent local observation', () => {
    const observation = buildGoldImportV2FixedLocalTargetObservation(raw())
    expect(validateGoldImportV2FixedLocalTargetObservation(observation)).toEqual(observation)
    expect(observation).toMatchObject({
      classification: {
        callerSuppliedTargetFactsAccepted: false,
        expectedProfile: 'local_supabase_postgres_owner_v1',
        expectedProfileDirectlyObserved: false,
        linkedProjectTargetDetected: false,
        remoteDatabaseTargetDetected: false,
        remoteDockerEndpointDetected: false,
      },
      database: {
        connectionTransport: 'unix_socket_inside_exact_container',
        database: 'postgres',
        socketDirectory: '/var/run/postgresql',
        transactionReadOnly: true,
      },
      dockerAfter: {
        containerId: TEST_GOLD_IMPORT_V2_CONTAINER_ID,
        endpoint: 'unix:///var/run/docker.sock',
        imageId: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.imageId,
      },
    })
  })

  it.each([
    [
      'expected name with wrong container ID',
      (input: ReturnType<typeof raw>) => {
        input.dockerAfter.containerInspect.Id = '1'.repeat(64)
        input.dockerBefore.containerInspect.Id = '1'.repeat(64)
      },
    ],
    [
      'wrong image',
      (input: ReturnType<typeof raw>) => {
        input.dockerAfter.containerInspect.Image = `sha256:${'1'.repeat(64)}`
        input.dockerBefore.containerInspect.Image = `sha256:${'1'.repeat(64)}`
      },
    ],
    [
      'wrong project label',
      (input: ReturnType<typeof raw>) => {
        input.dockerAfter.containerInspect.Config.Labels['com.docker.compose.project'] = 'other'
        input.dockerBefore.containerInspect.Config.Labels['com.docker.compose.project'] = 'other'
      },
    ],
    [
      'wrong database',
      (input: ReturnType<typeof raw>) => {
        ;(input.database as { database: string }).database = 'other'
      },
    ],
    [
      'wrong configured server port',
      (input: ReturnType<typeof raw>) => {
        ;(input.database as { configuredPort: number }).configuredPort = 5433
      },
    ],
    [
      'wrong socket transport',
      (input: ReturnType<typeof raw>) => {
        ;(input.database as { socketDirectories: string }).socketDirectories = '/tmp'
      },
    ],
    [
      'remote Docker context',
      (input: ReturnType<typeof raw>) => {
        ;(input.dockerAfter.contextInspect.Endpoints.docker as { Host: string }).Host =
          'tcp://remote.example:2376'
        ;(input.dockerBefore.contextInspect.Endpoints.docker as { Host: string }).Host =
          'tcp://remote.example:2376'
      },
    ],
    [
      'database/Docker lifecycle disagreement',
      (input: ReturnType<typeof raw>) => {
        input.database.postmasterStartedAt = '2026-08-10T04:00:00.000Z'
      },
    ],
  ])('rejects %s', (_label, mutate) => {
    const input = raw()
    mutate(input)
    expect(() => buildGoldImportV2FixedLocalTargetObservation(input)).toThrow()
  })

  it('rejects stale/reordered Docker inspection and a container replacement between probes', () => {
    const stale = raw()
    stale.observationCompletedAt = '2026-08-11T05:10:00.000Z'
    expect(() => buildGoldImportV2FixedLocalTargetObservation(stale)).toThrow('stale')

    const replaced = raw()
    replaced.dockerAfter.containerInspect.Id = '2'.repeat(64)
    replaced.dockerAfter.containerInspect.Config.Hostname = '2'.repeat(12)
    replaced.dockerAfter.hostnameStdout = '2'.repeat(12)
    expect(() => buildGoldImportV2FixedLocalTargetObservation(replaced)).toThrow()
  })

  it('does not accept fixed constants without authoritative observations', () => {
    expect(() =>
      validateGoldImportV2FixedLocalTargetObservation(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET),
    ).toThrow()
  })

  it('recomputes persisted identity hashes and rejects a substituted container continuity anchor', () => {
    const observation = buildGoldImportV2FixedLocalTargetObservation(raw())
    const staleIdentity = clone(fixedLocalTargetIdentityFromObservation(observation))
    staleIdentity.docker.startedAt = '2026-08-11T03:59:00.000Z'
    expect(() => validateGoldImportV2FixedLocalTargetIdentity(staleIdentity)).toThrow(
      'identity hash',
    )

    const identity = clone(fixedLocalTargetIdentityFromObservation(observation))
    const docker = identity.docker as { containerHostname: string; containerId: string }
    docker.containerId = '1'.repeat(64)
    docker.containerHostname = '1'.repeat(12)

    expect(() => validateGoldImportV2FixedLocalTargetIdentity(identity)).toThrow()

    const { targetIdentitySha256: _staleHash, ...body } = identity
    void _staleHash
    identity.targetIdentitySha256 = sha256(canonicalJson(body))
    expect(() => validateGoldImportV2FixedLocalTargetIdentity(identity)).toThrow()
  })

  it('owns the production target and rejects a caller-cloned psql argument vector', async () => {
    expect(collectGoldImportV2PreimportFixedLocalState).toHaveLength(0)
    const clonedArguments = [...PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS]
    await expect(
      executeProtectedV2FixedLocalReadOnlyPsql({
        arguments: clonedArguments as unknown as typeof PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS,
        command: PROTECTED_V2_RECOVERY_DOCKER_COMMAND,
        sql: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_SQL,
      }),
    ).rejects.toThrow('not the fixed local psql')

    const source = readFileSync(
      resolve('scripts/literature/gold-import-v2-package-readiness.ts'),
      'utf8',
    )
    expect(source).toContain('collectProtectedV2FixedLocalDockerTargetSnapshot()')
    expect(source).not.toMatch(/collectGoldImportV2PreimportFixedLocalState\([^)]/u)
  })

  it('keeps the database identity probe inside one repeatable-read/read-only bracket', () => {
    expect(() =>
      assertProtectedV2RecoveryEvidenceSqlReadOnly(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_SQL),
    ).not.toThrow()
  })
})
