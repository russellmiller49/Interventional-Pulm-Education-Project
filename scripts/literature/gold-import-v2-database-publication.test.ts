/** @jest-environment node */

import { createHash } from 'node:crypto'
import { lstat, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  assertGoldImportV2DatabasePublicationObservationBindingsMatch,
  buildGoldImportV2DatabasePublicationBracket,
  goldImportV2DatabasePublicationObservationBindingSchema,
  runGoldImportV2DatabasePublicationProtocol,
  validateGoldImportV2DatabasePublicationBracket,
  type GoldImportV2DatabasePublicationObservationBinding,
} from './gold-import-v2-database-publication'
import { buildTestGoldImportV2FixedLocalTargetObservation } from './gold-import-v2-lifecycle-test-fixture'
import {
  createStagedExclusiveOutputDirectory,
  discardStagedExclusiveOutputDirectory,
  publishStagedExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
  type StagedExclusiveOutputDirectory,
} from './lib/exclusive-output'

const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function binding(input: {
  databaseStateIdentitySha256?: string
  observationStartedAt: string
}): GoldImportV2DatabasePublicationObservationBinding {
  const targetObservation = buildTestGoldImportV2FixedLocalTargetObservation({
    observationStartedAt: input.observationStartedAt,
  })
  const body = {
    batchId: '10000000-0000-4000-8000-000000000001',
    databaseStateIdentitySha256: input.databaseStateIdentitySha256 ?? 'a'.repeat(64),
    finalizedReceiptAuthorityIdentitySha256: 'b'.repeat(64),
    migrationLedger: { v1Occurrence: 1 as const, v2Occurrence: 1 as const },
    observedAt: targetObservation.observationCompletedAt,
    operationCounts: {
      actionCount: 0 as const,
      compensationCount: 0 as const,
      importCount: 0 as const,
      operationCount: 0 as const,
    },
    stateIdentities: { effectiveStateSha256: 'c'.repeat(64) },
    targetIdentitySha256: targetObservation.targetIdentitySha256,
    targetObservation,
    transaction: { isolationLevel: 'repeatable read' as const, readOnly: true as const },
  }
  return goldImportV2DatabasePublicationObservationBindingSchema.parse({
    ...body,
    observationBindingSha256: sha256(canonicalJson(body)),
  })
}

describe('database-evidence publication protocol', () => {
  const initial = binding({ observationStartedAt: '2026-08-11T04:59:50.000Z' })
  const final = binding({ observationStartedAt: '2026-08-11T04:59:55.000Z' })

  it('binds initial observation, staging, final observation, and atomic publication order', async () => {
    const events: string[] = []
    const result = await runGoldImportV2DatabasePublicationProtocol<string, string>({
      discard: async () => {
        events.push('discard')
      },
      finalize: async (_staged, bracket) => {
        events.push('finalize')
        expect(validateGoldImportV2DatabasePublicationBracket(bracket)).toEqual(bracket)
      },
      initial,
      now: () => new Date('2026-08-11T04:59:59.000Z'),
      observeFinal: async () => {
        events.push('observe-final')
        return final
      },
      publish: async () => {
        events.push('publish')
        return 'published'
      },
      stage: async () => {
        events.push('stage')
        return {
          staged: 'staged',
          stagedAt: '2026-08-11T04:59:54.000Z',
          stagedPayloadSha256: 'd'.repeat(64),
        }
      },
      subject: 'capture',
    })
    expect(result.published).toBe('published')
    expect(events).toEqual(['stage', 'observe-final', 'finalize', 'publish'])
    expect(result.bracket.ordering).toEqual({
      atomicRenameAfterAuthorization: true,
      finalObservationAfterStaging: true,
      initialObservationBeforeStaging: true,
      laterConsumptionRevalidationRequired: true,
    })
  })

  it('is deterministic for unchanged observation content and exact timestamps', () => {
    const input = {
      final,
      initial,
      publicationAuthorizedAt: '2026-08-11T04:59:59.000Z',
      stagedAt: '2026-08-11T04:59:54.000Z',
      stagedPayloadSha256: 'd'.repeat(64),
      subject: 'capture' as const,
    }
    expect(buildGoldImportV2DatabasePublicationBracket(input)).toEqual(
      buildGoldImportV2DatabasePublicationBracket(input),
    )
  })

  it('rejects substituted nested target observations even when outer hashes are recomputed', () => {
    const attacked = clone(
      buildGoldImportV2DatabasePublicationBracket({
        final,
        initial,
        publicationAuthorizedAt: '2026-08-11T04:59:59.000Z',
        stagedAt: '2026-08-11T04:59:54.000Z',
        stagedPayloadSha256: 'd'.repeat(64),
        subject: 'capture',
      }),
    )
    for (const observationBinding of [attacked.initial, attacked.final]) {
      for (const docker of [
        observationBinding.targetObservation.dockerBefore,
        observationBinding.targetObservation.dockerAfter,
      ]) {
        const mutableDocker = docker as { containerHostname: string; containerId: string }
        mutableDocker.containerId = '1'.repeat(64)
        mutableDocker.containerHostname = '1'.repeat(12)
      }
      const { observationBindingSha256: _oldBindingHash, ...bindingBody } = observationBinding
      void _oldBindingHash
      observationBinding.observationBindingSha256 = sha256(canonicalJson(bindingBody))
    }
    const { bracketIdentitySha256: _oldBracketHash, ...bracketBody } = attacked
    void _oldBracketHash
    attacked.bracketIdentitySha256 = sha256(canonicalJson(bracketBody))

    expect(() => validateGoldImportV2DatabasePublicationBracket(attacked)).toThrow()
  })

  it.each([
    ['after initial collection', 'after_initial_collection', 'capture' as const],
    ['during output construction', 'during_output_construction', 'capture' as const],
    ['after files are staged', 'after_files_staged', 'capture' as const],
    ['immediately before capture publication', 'before_capture_publication', 'capture' as const],
    [
      'after capture publication before package generation',
      'after_capture_publication',
      'package_readiness' as const,
    ],
    [
      'between loading capture 1 and capture 2',
      'between_capture_loads',
      'package_readiness' as const,
    ],
    ['after package readiness is staged', 'after_readiness_staged', 'package_readiness' as const],
    [
      'immediately before package publication',
      'before_package_publication',
      'package_readiness' as const,
    ],
  ] as const)(
    'rejects database drift %s at its exact lifecycle boundary',
    async (_label, injectionPoint, subject) => {
      const events: string[] = ['initial-collected']
      let databaseStateIdentitySha256 = 'a'.repeat(64)
      const inject = (event: string) => {
        events.push(event)
        databaseStateIdentitySha256 = 'e'.repeat(64)
      }
      const capturedBinding = binding({
        databaseStateIdentitySha256,
        observationStartedAt: '2026-08-11T04:59:50.000Z',
      })

      if (injectionPoint === 'after_initial_collection') inject('drift-after-initial')
      if (injectionPoint === 'after_capture_publication') {
        events.push('capture-published')
        inject('drift-before-package-generation')
      }
      if (injectionPoint === 'between_capture_loads') {
        events.push('capture-1-loaded')
        inject('drift-between-capture-loads')
        events.push('capture-2-loaded')
      }

      const consumerInitial = binding({
        databaseStateIdentitySha256,
        observationStartedAt: '2026-08-11T04:59:50.000Z',
      })
      const usesPriorConsumerGate =
        injectionPoint === 'after_capture_publication' || injectionPoint === 'between_capture_loads'

      await expect(
        runGoldImportV2DatabasePublicationProtocol<string, string>({
          afterStageForTest: () => {
            if (
              injectionPoint === 'after_files_staged' ||
              injectionPoint === 'after_readiness_staged'
            ) {
              inject(
                injectionPoint === 'after_files_staged'
                  ? 'drift-after-files-staged'
                  : 'drift-after-readiness-staged',
              )
            }
          },
          beforeFinalObservationForTest: () => {
            if (
              injectionPoint === 'before_capture_publication' ||
              injectionPoint === 'before_package_publication'
            ) {
              inject(
                injectionPoint === 'before_capture_publication'
                  ? 'drift-before-capture-publication'
                  : 'drift-before-package-publication',
              )
            }
          },
          discard: async () => {
            events.push('discard')
          },
          finalize: async () => {
            events.push('finalize')
          },
          initial: usesPriorConsumerGate ? consumerInitial : capturedBinding,
          now: () => new Date('2026-08-11T04:59:59.000Z'),
          observeFinal: async () => {
            events.push('final-observed')
            return binding({
              databaseStateIdentitySha256,
              observationStartedAt: '2026-08-11T04:59:55.000Z',
            })
          },
          prior: usesPriorConsumerGate ? capturedBinding : undefined,
          publish: async () => {
            events.push('publish')
            return 'unsafe'
          },
          stage: async () => {
            events.push('output-construction-started')
            if (injectionPoint === 'during_output_construction') {
              inject('drift-during-output-construction')
            }
            events.push('files-staged')
            return {
              staged: 'staged',
              stagedAt: '2026-08-11T04:59:54.000Z',
              stagedPayloadSha256: 'd'.repeat(64),
            }
          },
          subject,
        }),
      ).rejects.toThrow('different protected states')
      expect(events).not.toContain('finalize')
      expect(events).not.toContain('publish')
      if (usesPriorConsumerGate) {
        expect(events).not.toContain('output-construction-started')
        expect(events).not.toContain('discard')
      } else {
        expect(events).toContain('discard')
      }
    },
  )

  it('uses the same full binding comparison for direct later-consumer revalidation', () => {
    expect(() =>
      assertGoldImportV2DatabasePublicationObservationBindingsMatch(
        initial,
        binding({
          databaseStateIdentitySha256: 'e'.repeat(64),
          observationStartedAt: '2026-08-11T04:59:55.000Z',
        }),
      ),
    ).toThrow('different protected states')
  })

  it('removes the exact staging directory and leaves no accepted output after bracket failure', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'gold-v2-publication-'))
    const outputDirectory = resolve(root, 'capture-final')
    let stagingDirectory = ''
    try {
      await expect(
        runGoldImportV2DatabasePublicationProtocol<StagedExclusiveOutputDirectory, string>({
          discard: discardStagedExclusiveOutputDirectory,
          finalize: async () => undefined,
          initial,
          now: () => new Date('2026-08-11T04:59:59.000Z'),
          observeFinal: async () =>
            binding({
              databaseStateIdentitySha256: 'f'.repeat(64),
              observationStartedAt: '2026-08-11T04:59:55.000Z',
            }),
          publish: async (staged) => {
            await publishStagedExclusiveOutputDirectory(staged)
            return outputDirectory
          },
          stage: async () => {
            const staged = await createStagedExclusiveOutputDirectory({
              outputDirectory,
              outputRoot: root,
              stagingNonce: '1'.repeat(64),
            })
            stagingDirectory = staged.stagingDirectory
            writeExclusiveOutputFiles(staged.identity, [
              { bytes: Buffer.from('slow staged payload'), name: 'payload.txt' },
            ])
            return {
              staged,
              stagedAt: '2026-08-11T04:59:54.000Z',
              stagedPayloadSha256: 'd'.repeat(64),
            }
          },
          subject: 'capture',
        }),
      ).rejects.toThrow('different protected states')
      await expect(lstat(stagingDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(lstat(outputDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it('installs an unchanged staged output with one same-parent rename', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'gold-v2-atomic-'))
    const outputDirectory = resolve(root, 'package-final')
    try {
      const staged = await createStagedExclusiveOutputDirectory({
        outputDirectory,
        outputRoot: root,
        stagingNonce: '2'.repeat(64),
      })
      writeExclusiveOutputFiles(staged.identity, [
        { bytes: Buffer.from('complete'), name: 'payload.txt' },
      ])
      await publishStagedExclusiveOutputDirectory(staged)
      await expect(lstat(staged.stagingDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(lstat(outputDirectory)).resolves.toMatchObject({
        isDirectory: expect.any(Function),
      })
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
})
