import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  auditUltraV1MigrationEquivalence,
  buildUltraV1MigrationPlan,
  commitUltraV1Migration,
  type UltraV1MigrationPlan,
} from './ultra-v1-migration'
import { canonicalJson } from './ultra-storage-v2'
import {
  assertKnownArguments,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'

const HELP = `
Plan, commit, or audit an additive Ultra v1-to-v2 state migration.

Usage:
  tsx scripts/literature/ultra-v1-migration-cli.ts dry-run --v1-root <path> --expected-source-sha256 <sha256> --migration-git-commit <commit> [--destination-root <sibling>]
  tsx scripts/literature/ultra-v1-migration-cli.ts commit --v1-root <path> --expected-source-sha256 <sha256> --migration-git-commit <commit> [--destination-root <sibling>] [--owner-id <id>]
  tsx scripts/literature/ultra-v1-migration-cli.ts audit --v1-root <path> --expected-source-sha256 <sha256> --migration-git-commit <commit> [--destination-root <sibling>]

dry-run writes nothing. commit creates only the distinct sibling v2 container. audit re-hashes every
legacy artifact, verifies the event chain and checkpoint, and requires exact semantic equivalence.
`.trim()

function requiredArgument(arguments_: ParsedCliArguments, key: string) {
  const value = stringArgument(arguments_, key)
  if (!value) throw new Error(`--${key} is required.`)
  return value
}

function planArguments(arguments_: ParsedCliArguments) {
  return {
    v1Root: requiredArgument(arguments_, 'v1-root'),
    expectedSourceManifestSha256: requiredArgument(arguments_, 'expected-source-sha256'),
    migrationGitCommit: requiredArgument(arguments_, 'migration-git-commit'),
    destinationRoot: stringArgument(arguments_, 'destination-root'),
  }
}

function sha256Canonical(value: unknown) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

function eventTypeCounts(plan: UltraV1MigrationPlan) {
  return plan.events.reduce<Record<string, number>>((counts, event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1
    return counts
  }, {})
}

function migrationPlanSummary(plan: UltraV1MigrationPlan) {
  const nextPacket = plan.runDefinition.packetInventory.find(
    (packet) => packet.chunkId === plan.counts.nextPendingChunk,
  )
  return {
    migrationVersion: plan.runDefinition.migrationVersion,
    mode: 'dry-run',
    writesPerformed: false,
    sourceRoot: plan.sourceRoot,
    destinationRoot: plan.destinationRoot,
    sourceManifestPath: plan.sourceManifestPath,
    sourceManifestSha256: plan.sourceManifestSha256,
    historySnapshotCount: plan.runDefinition.sourceV1.historySnapshotCount,
    runDefinitionContentSha256: sha256Canonical(plan.runDefinition),
    finalProjectionSha256: plan.finalProjectionSha256,
    rawArtifactCount: plan.runDefinition.rawArtifactInventory.length,
    rawArtifactInventorySha256: plan.runDefinition.rawArtifactInventorySha256,
    eventCount: plan.events.length,
    eventTypeCounts: eventTypeCounts(plan),
    counts: plan.counts,
    dispatchAuthorization: plan.runDefinition.dispatchAuthorization,
    nextPendingPacket: nextPacket
      ? {
          chunkId: nextPacket.chunkId,
          finalLegacyStatus: nextPacket.finalLegacyStatus,
          legacyAttemptCount: nextPacket.legacyAttemptCount,
          packetSha256: nextPacket.packetSha256,
          legacyCanonicalPacketSha256: nextPacket.legacyCanonicalPacketSha256,
          validatedOutputSha256: nextPacket.validatedOutputSha256,
        }
      : null,
  }
}

export async function runUltraV1MigrationCli(argv: readonly string[]) {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === 'help') {
    console.log(HELP)
    return
  }
  if (!['dry-run', 'commit', 'audit'].includes(command)) {
    throw new Error(`Unknown command ${command}.\n\n${HELP}`)
  }
  const arguments_ = parseCliArguments(rest)
  assertKnownArguments(arguments_, [
    'v1-root',
    'expected-source-sha256',
    'migration-git-commit',
    'destination-root',
    'owner-id',
  ])
  if (command !== 'commit' && stringArgument(arguments_, 'owner-id')) {
    throw new Error('--owner-id is valid only for commit.')
  }
  const plan = await buildUltraV1MigrationPlan(planArguments(arguments_))
  const summary = migrationPlanSummary(plan)
  if (command === 'dry-run') {
    console.log(JSON.stringify(summary, null, 2))
    return summary
  }
  if (command === 'commit') {
    const committed = await commitUltraV1Migration(plan, {
      ownerId: stringArgument(arguments_, 'owner-id'),
    })
    const result = {
      ...summary,
      mode: 'commit',
      writesPerformed: committed.writesPerformed,
      commitResult: committed.result,
      mutation: {
        initializedStorage: committed.initializedStorage,
        appendedEventCount: committed.appendedEventCount,
        checkpointWritten: committed.checkpointWritten,
        progressSummaryWritten: committed.progressSummaryWritten,
      },
      equivalence: committed.equivalence,
    }
    console.log(JSON.stringify(result, null, 2))
    return result
  }
  const equivalence = await auditUltraV1MigrationEquivalence(plan)
  const result = {
    ...summary,
    mode: 'audit',
    writesPerformed: false,
    equivalence,
  }
  console.log(JSON.stringify(result, null, 2))
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runUltraV1MigrationCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
