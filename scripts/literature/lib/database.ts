import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { ParsedCliArguments } from './cli'
import { hasFlag, stringArgument } from './cli'

loadEnvConfig(process.cwd())

export type LiteratureDatabaseTarget = 'local' | 'remote'

export interface LiteratureWriteMode {
  client: SupabaseClient | null
  commit: boolean
  hostname: string | null
  target: LiteratureDatabaseTarget
}

function isLocalHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  )
}

function requestedTarget(arguments_: ParsedCliArguments): LiteratureDatabaseTarget {
  const rawTarget = stringArgument(arguments_, 'target', 'local')
  if (rawTarget !== 'local' && rawTarget !== 'remote') {
    throw new Error('--target must be either local or remote.')
  }
  return rawTarget
}

function databaseCredentials(target: LiteratureDatabaseTarget) {
  const supabaseUrl =
    process.env.LITERATURE_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.LITERATURE_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server-side Supabase URL and service-role/secret credentials are required.')
  }

  const url = new URL(supabaseUrl)
  const local = isLocalHostname(url.hostname)
  if (target === 'local' && !local) {
    throw new Error(
      `Refusing local-target access because the configured hostname is ${url.hostname}.`,
    )
  }
  if (target === 'remote' && local) {
    throw new Error(
      `Refusing remote-target access because the configured hostname is ${url.hostname}.`,
    )
  }

  return { serviceRoleKey, url }
}

export function createLiteratureReadClient(arguments_: ParsedCliArguments) {
  const target = requestedTarget(arguments_)
  const { serviceRoleKey, url } = databaseCredentials(target)
  console.log(`Read target: ${target}`)
  console.log(`Supabase hostname: ${url.hostname}`)
  return createClient(url.toString(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function resolveLiteratureWriteMode(
  arguments_: ParsedCliArguments,
  plannedRecordCount: number,
): LiteratureWriteMode {
  const commit = hasFlag(arguments_, 'commit')
  const explicitDryRun = hasFlag(arguments_, 'dry-run')
  if (commit && explicitDryRun) {
    throw new Error('Choose either --dry-run or --commit, not both.')
  }

  const target = requestedTarget(arguments_)

  if (!commit) {
    console.log('Mode: dry-run (no database writes)')
    console.log(`Target requested: ${target}`)
    console.log(`Planned records: ${plannedRecordCount}`)
    return { client: null, commit: false, hostname: null, target }
  }

  if (target === 'remote' && !hasFlag(arguments_, 'confirm-remote')) {
    throw new Error('Remote writes require both --commit and --confirm-remote.')
  }

  const { serviceRoleKey, url } = databaseCredentials(target)

  console.log(`Mode: COMMIT`)
  console.log(`Target: ${target}`)
  console.log(`Supabase hostname: ${url.hostname}`)
  console.log(`Planned records: ${plannedRecordCount}`)

  return {
    client: createClient(url.toString(), serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    commit: true,
    hostname: url.hostname,
    target,
  }
}

interface DatabaseError {
  code?: string
  message: string
}

interface DatabaseResult<T> {
  data: T | null
  error: DatabaseError | null
}

function wait(delayMs: number) {
  return new Promise<void>((resolvePromise) => {
    setTimeout(resolvePromise, delayMs)
  })
}

export async function executeDatabaseCall<T>(
  label: string,
  operation: () => PromiseLike<DatabaseResult<T>>,
  attempts = 3,
): Promise<T | null> {
  let lastError: DatabaseError | null = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await operation()
    if (!result.error) {
      return result.data
    }

    lastError = result.error
    if (attempt < attempts) {
      await wait(200 * 2 ** (attempt - 1))
    }
  }

  throw new Error(
    `${label} failed${lastError?.code ? ` (${lastError.code})` : ''}: ${
      lastError?.message ?? 'Unknown database error'
    }`,
  )
}
