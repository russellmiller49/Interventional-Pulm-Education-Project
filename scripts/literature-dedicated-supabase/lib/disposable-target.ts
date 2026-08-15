/**
 * Guards and helpers for the disposable rehearsal target.
 *
 * The rehearsal creates a throwaway PostgreSQL 17 container, applies the foundation migration to
 * it, inspects the result, and destroys it. Two properties matter more than anything else here:
 *
 *   1. It must never touch the protected real-local Literature database (container
 *      `supabase_db_ip-literature-local`, host port 55322). The container publishes **no port at
 *      all** and is reached exclusively through `docker exec … psql` over the container's own unix
 *      socket, so there is no TCP surface that could collide with the protected stack.
 *   2. Cleanup must remove only what this operation created. Resources are named with a per-run
 *      random suffix and removed by exact name, never by prefix or wildcard.
 */

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'

/** The protected real-local Literature database. Never contacted, never removed, never inspected. */
export const PROTECTED_REAL_LOCAL_CONTAINER = 'supabase_db_ip-literature-local'
export const PROTECTED_REAL_LOCAL_DATABASE_PORT = '55322'

/** Shared name prefix for rehearsal-owned resources. */
export const REHEARSAL_RESOURCE_PREFIX = 'literature-dedicated-bootstrap'

/**
 * PostgreSQL 17 image matching the dedicated project's engine (17.6.1). The Supabase image is used
 * rather than stock `postgres` because it ships the `anon`, `authenticated`, and `service_role`
 * roles and the `extensions` schema, which is what makes the rehearsal representative of a real
 * new Supabase project.
 */
export const REHEARSAL_POSTGRES_IMAGE =
  'public.ecr.aws/supabase/postgres:17.6.1.143@sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453'

export const REHEARSAL_DATABASE = 'literature_foundation_rehearsal'
export const REHEARSAL_SUPERUSER = 'supabase_admin'

/**
 * Environment keys stripped from every child process the rehearsal spawns. A rehearsal must never
 * inherit a credential or a connection string that could point it at a real database.
 */
const STRIPPED_ENVIRONMENT_PATTERN = /^(?:DOCKER_|LITERATURE_SUPABASE_|PG|POSTGRES_|SUPABASE_)/u
const STRIPPED_ENVIRONMENT_KEYS = ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']

export function sanitizeRehearsalChildEnvironment(
  source: Readonly<Record<string, string | undefined>>,
  overrides: Readonly<Record<string, string>> = {},
): NodeJS.ProcessEnv {
  const environment: Record<string, string | undefined> = { ...source }
  for (const key of STRIPPED_ENVIRONMENT_KEYS) delete environment[key]
  for (const key of Object.keys(environment)) {
    if (STRIPPED_ENVIRONMENT_PATTERN.test(key)) delete environment[key]
  }
  return { ...environment, ...overrides } as NodeJS.ProcessEnv
}

/**
 * Refuse anything but a local Docker socket. A remote Docker endpoint would put the rehearsal
 * container on someone else's host, where the protected-target guarantees do not hold.
 */
export function assertLocalDockerEndpoint(endpoint: string) {
  const normalized = endpoint.trim()
  if (/^unix:\/\/\/.+/u.test(normalized)) return 'unix-domain-socket' as const
  if (/^npipe:\/\/.+/u.test(normalized)) return 'windows-named-pipe' as const
  throw new Error(
    `The disposable rehearsal requires a local Docker socket; refusing endpoint ${
      normalized || '(empty)'
    }.`,
  )
}

/** Reject any identifier that could name the protected stack. */
export function assertNotProtectedResource(name: string) {
  const normalized = name.trim()
  if (normalized === PROTECTED_REAL_LOCAL_CONTAINER || normalized.includes('ip-literature-local')) {
    throw new Error(
      `Refusing to operate on ${normalized}: that is the protected real-local Literature database.`,
    )
  }
  if (normalized.includes(PROTECTED_REAL_LOCAL_DATABASE_PORT)) {
    throw new Error(
      `Refusing to operate on ${normalized}: it names the protected database port ` +
        `${PROTECTED_REAL_LOCAL_DATABASE_PORT}.`,
    )
  }
}

/** A unique, operation-owned resource name. */
export function rehearsalResourceName(role: string) {
  const name = `${REHEARSAL_RESOURCE_PREFIX}-${role}-${process.pid}-${randomBytes(4).toString('hex')}`
  assertNotProtectedResource(name)
  return name
}

export interface CommandResult {
  stdout: string
  stderr: string
  code: number
}

export interface CommandOptions {
  stdin?: string
  cwd?: string
  env?: Record<string, string>
  allowFailure?: boolean
  timeoutMs?: number
}

/**
 * Run a command with a sanitized environment. Arguments that could carry a credential are redacted
 * from any error message.
 */
export function runCommand(
  commandName: string,
  arguments_: readonly string[],
  options: CommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(commandName, [...arguments_], {
      cwd: options.cwd ?? process.cwd(),
      env: sanitizeRehearsalChildEnvironment(process.env, options.env ?? {}),
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = options.timeoutMs
      ? setTimeout(() => {
          child.kill('SIGKILL')
        }, options.timeoutMs)
      : null

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      rejectPromise(error)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      const exitCode = code ?? -1
      if (exitCode === 0 || options.allowFailure) {
        resolvePromise({ stdout, stderr, code: exitCode })
        return
      }
      const redacted = arguments_.map((argument) =>
        /^(?:POSTGRES_PASSWORD|PGPASSWORD)=/u.test(argument)
          ? argument.replace(/=.*/u, '=[redacted]')
          : argument,
      )
      rejectPromise(
        new Error(
          `${commandName} ${redacted.join(' ')} exited with ${exitCode}:\n${stderr || stdout}`,
        ),
      )
    })

    child.stdin.end(options.stdin ?? '')
  })
}

/** The Supabase migration-history table, as the Supabase CLI itself creates it. */
export const MIGRATION_HISTORY_BOOTSTRAP_SQL = `
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
`.trim()
