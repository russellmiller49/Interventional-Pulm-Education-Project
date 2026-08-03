import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

export const FROZEN_LEGACY_ULTRA_RUN_ID = 'ip-literature-ultra-v1'

export const ULTRA_SCREENING_MUTATING_COMMANDS = [
  'prepare',
  'start',
  'validate',
  'worker-failed',
  'dispatch-blocked',
  'authorize-substitution',
  'derive',
  'evaluate',
] as const

const READ_ONLY_COMMANDS = new Set(['status', 'audit'])

interface FrozenV1CommandGuardOptions {
  command: string
  runId?: string
  runRoot?: string
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

async function existingManifestRunId(runRoot: string) {
  try {
    const raw = await readFile(resolve(runRoot, 'progress-manifest.json'), 'utf8')
    const manifest = JSON.parse(raw) as { runId?: unknown }
    return typeof manifest.runId === 'string' ? manifest.runId : undefined
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

function frozenRunError(command: string) {
  return new Error(
    `Legacy Ultra run ${FROZEN_LEGACY_ULTRA_RUN_ID} is frozen experimental evidence. ` +
      `The ${command} command is disabled; status and audit are the only permitted commands for this run.`,
  )
}

/**
 * Enforces the permanent, fail-closed boundary around the preserved v1 runtime.
 * This guard must run before a command handler performs database reads or artifact writes.
 */
export async function assertFrozenLegacyUltraRunIsReadOnly({
  command,
  runId,
  runRoot,
}: FrozenV1CommandGuardOptions) {
  if (READ_ONLY_COMMANDS.has(command)) return

  if (runId === FROZEN_LEGACY_ULTRA_RUN_ID) {
    throw frozenRunError(command)
  }
  if (!runRoot) return

  const resolvedRunRoot = resolve(runRoot)
  if (basename(resolvedRunRoot) === FROZEN_LEGACY_ULTRA_RUN_ID) {
    throw frozenRunError(command)
  }

  const manifestRunId = await existingManifestRunId(resolvedRunRoot)
  if (manifestRunId === FROZEN_LEGACY_ULTRA_RUN_ID) {
    throw frozenRunError(command)
  }
}
