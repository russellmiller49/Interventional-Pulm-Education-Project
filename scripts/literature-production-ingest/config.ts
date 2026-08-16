import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  DESTINATION_ENV_NAMES,
  PROHIBITED_ENDOREELS_REF,
} from './constants'
import type { DestinationBinding } from './types'

export type DestinationEnvironment = Readonly<Record<string, string | undefined>>

const LEGACY_DESTINATION_ENV_NAMES = [
  'LITERATURE_SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const
const REQUIRED_DESTINATION_ENV_NAMES = [
  DESTINATION_ENV_NAMES.url,
  DESTINATION_ENV_NAMES.projectRef,
  DESTINATION_ENV_NAMES.secret,
] as const

const SERVER_SECRET_PATTERN = /^sb_secret_[A-Za-z0-9._-]+$/u
const CREDENTIAL_ARGUMENT_PATTERN =
  /(?:sb_(?:secret|publishable)_[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/u
const FORBIDDEN_TARGET_ARGUMENT_NAMES = new Set([
  '--anon-key',
  '--apikey',
  '--credential',
  '--key',
  '--password',
  '--project-ref',
  '--publishable-key',
  '--ref',
  '--secret',
  '--service-role-key',
  '--supabase-key',
  '--supabase-url',
  '--token',
  '--url',
  `--${DESTINATION_ENV_NAMES.url.toLowerCase().replaceAll('_', '-')}`,
  `--${DESTINATION_ENV_NAMES.projectRef.toLowerCase().replaceAll('_', '-')}`,
  `--${DESTINATION_ENV_NAMES.secret.toLowerCase().replaceAll('_', '-')}`,
])
const FORBIDDEN_ENVIRONMENT_ASSIGNMENT_NAMES = new Set<string>([
  ...REQUIRED_DESTINATION_ENV_NAMES,
  ...LEGACY_DESTINATION_ENV_NAMES,
])

function populated(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0
}

function approvedConfigurationMessage() {
  return `Configure ${DESTINATION_ENV_NAMES.url}, ${DESTINATION_ENV_NAMES.projectRef}, and ${DESTINATION_ENV_NAMES.secret}.`
}

function assertApprovedUrl(rawUrl: string): void {
  if (rawUrl.toLowerCase().includes(PROHIBITED_ENDOREELS_REF)) {
    throw new Error('Refusing the prohibited Endoreels destination.')
  }

  if (rawUrl !== APPROVED_PROJECT_URL) {
    throw new Error(
      'The Literature destination URL does not match the approved IP_Literature project.',
    )
  }
}

function assertApprovedProjectRef(projectRef: string): void {
  if (projectRef === PROHIBITED_ENDOREELS_REF) {
    throw new Error('Refusing the prohibited Endoreels destination.')
  }
  if (projectRef !== APPROVED_PROJECT_REF) {
    throw new Error('The Literature destination project ref does not match IP_Literature.')
  }
}

function assertServerSecret(secret: string): void {
  if (!SERVER_SECRET_PATTERN.test(secret)) {
    throw new Error(
      `Only an sb_secret_ server-side secret is accepted in ${DESTINATION_ENV_NAMES.secret}; ` +
        'all other key formats are refused.',
    )
  }
}

/**
 * Resolve the one approved production destination. When `required` is false, an entirely absent
 * binding is allowed for local-only validation. A partially configured or legacy-only binding is
 * always an error so an operator cannot silently fall through to another project.
 */
export function resolveDestinationBinding(
  environment: DestinationEnvironment,
  required: boolean,
): DestinationBinding | null {
  const url = environment[DESTINATION_ENV_NAMES.url]
  const projectRef = environment[DESTINATION_ENV_NAMES.projectRef]
  const secret = environment[DESTINATION_ENV_NAMES.secret]
  const configuredCount = [url, projectRef, secret].filter(populated).length
  const suppliedCount = REQUIRED_DESTINATION_ENV_NAMES.filter(
    (name) => environment[name] !== undefined,
  ).length

  if (suppliedCount === 0) {
    const legacyConfigured = LEGACY_DESTINATION_ENV_NAMES.some((name) =>
      populated(environment[name]),
    )
    if (legacyConfigured) {
      throw new Error(
        `Legacy destination configuration is not accepted. ${approvedConfigurationMessage()}`,
      )
    }
    if (!required) return null
    throw new Error(
      `The Literature destination is not configured. ${approvedConfigurationMessage()}`,
    )
  }

  if (configuredCount !== 3 || !populated(url) || !populated(projectRef) || !populated(secret)) {
    throw new Error(
      `Partial Literature destination configuration is refused. ${approvedConfigurationMessage()}`,
    )
  }

  if (url !== url.trim() || projectRef !== projectRef.trim() || secret !== secret.trim()) {
    throw new Error(
      'Literature destination environment values must not contain surrounding whitespace.',
    )
  }

  assertApprovedProjectRef(projectRef)
  assertApprovedUrl(url)
  assertServerSecret(secret)

  return {
    url: APPROVED_PROJECT_URL,
    projectRef: APPROVED_PROJECT_REF,
    secret,
  }
}

/** Refuse target URLs, refs, or credentials supplied in process arguments. */
export function assertNoCredentialArguments(arguments_: readonly string[]): void {
  for (const argument of arguments_) {
    const normalizedName = argument.trim().toLowerCase().split('=', 1)[0]
    const environmentAssignmentName = argument.trim().split('=', 1)[0]
    if (
      FORBIDDEN_TARGET_ARGUMENT_NAMES.has(normalizedName) ||
      FORBIDDEN_ENVIRONMENT_ASSIGNMENT_NAMES.has(environmentAssignmentName) ||
      CREDENTIAL_ARGUMENT_PATTERN.test(argument)
    ) {
      throw new Error(
        'Destination targets and credentials must be supplied only through the dedicated environment variables.',
      )
    }
  }
}
