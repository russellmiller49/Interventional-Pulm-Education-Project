import { createHash } from 'node:crypto'

import { z } from 'zod'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'

export const GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_OBSERVATION_SCHEMA_VERSION =
  'literature-gold-v2-fixed-local-target-observation/1.0.0' as const

export const GOLD_IMPORT_V2_FIXED_LOCAL_TARGET = Object.freeze({
  containerHostname: '906d62f9e2b5',
  containerId: '906d62f9e2b5ac7c58742090566e87f8d2a36199ee897b09bb5c1b7727e286a8',
  containerName: 'supabase_db_ip-literature-local',
  database: 'postgres',
  dockerContext: 'default',
  dockerEndpoint: 'unix:///var/run/docker.sock',
  expectedProfile: 'local_supabase_postgres_owner_v1',
  imageId: 'sha256:5deba92e50cd17bfacf8603834d317cdf3bfc1c016ec8293991997fa3b55fa3d',
  imageManifestDigest: 'sha256:3def78638e8892eeac1bd31deef2c9c535e559624075ebc14a6997c51d8c84e4',
  imageReference: 'public.ecr.aws/supabase/postgres:17.6.1.104',
  internalPort: 5432,
  network: 'supabase_network_ip-literature-local',
  project: 'ip-literature-local',
  publishedPort: 55322,
  socketDirectory: '/var/run/postgresql',
} as const)

export const GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_SQL = String.raw`begin transaction isolation level repeatable read read only;
set local statement_timeout = '120s';
select jsonb_build_object(
  'clientAddress', inet_client_addr()::text,
  'configuredPort', current_setting('port')::integer,
  'currentUser', current_user,
  'database', current_database(),
  'isolationLevel', current_setting('transaction_isolation'),
  'observedAt', clock_timestamp(),
  'postmasterStartedAt', pg_postmaster_start_time(),
  'serverAddress', inet_server_addr()::text,
  'serverPort', inet_server_port(),
  'sessionUser', session_user,
  'socketDirectories', current_setting('unix_socket_directories'),
  'transactionReadOnly', current_setting('transaction_read_only')::boolean
);
rollback;`

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u
const CONTAINER_ID_PATTERN = /^[a-f0-9]{64}$/u
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const timestampSchema = z.string().datetime({ offset: true })

const dockerSnapshotSchema = z
  .object({
    composeProject: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.project),
    containerHostname: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.containerHostname),
    containerId: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.containerId),
    containerName: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.containerName),
    context: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.dockerContext),
    endpoint: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.dockerEndpoint),
    health: z.literal('healthy'),
    imageId: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.imageId),
    imageManifestDigest: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.imageManifestDigest),
    imageReference: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.imageReference),
    inspectedAt: timestampSchema,
    internalPort: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.internalPort),
    network: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.network),
    publishedBindings: z.tuple([
      z.object({ hostAddress: z.literal('0.0.0.0'), hostPort: z.literal(55322) }).strict(),
      z.object({ hostAddress: z.literal('::'), hostPort: z.literal(55322) }).strict(),
    ]),
    restartCount: z.literal(0),
    running: z.literal(true),
    startedAt: timestampSchema,
    supabaseProject: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.project),
  })
  .strict()

const databaseObservationSchema = z
  .object({
    clientAddress: z.null(),
    configuredPort: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.internalPort),
    connectionTransport: z.literal('unix_socket_inside_exact_container'),
    currentUser: z.literal('postgres'),
    database: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.database),
    isolationLevel: z.literal('repeatable read'),
    observedAt: timestampSchema,
    postmasterStartedAt: timestampSchema,
    serverAddress: z.null(),
    serverPort: z.null(),
    sessionUser: z.literal('postgres'),
    socketDirectory: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.socketDirectory),
    transactionReadOnly: z.literal(true),
  })
  .strict()

const fixedLocalTargetIdentityBodySchema = z
  .object({
    classification: z
      .object({
        callerSuppliedTargetFactsAccepted: z.literal(false),
        expectedProfile: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.expectedProfile),
        expectedProfileDirectlyObserved: z.literal(false),
        expectedProfileProof: z.literal(
          'expected_configuration_authenticated_by_exact_local_catalog_identity',
        ),
        linkedProjectTargetDetected: z.literal(false),
        remoteDatabaseTargetDetected: z.literal(false),
        remoteDockerEndpointDetected: z.literal(false),
      })
      .strict(),
    database: databaseObservationSchema.omit({ observedAt: true }),
    docker: dockerSnapshotSchema.omit({ inspectedAt: true }),
    schemaVersion: z.literal('literature-gold-v2-fixed-local-target-identity/1.0.0'),
  })
  .strict()

const fixedLocalTargetIdentityStructuralSchema = fixedLocalTargetIdentityBodySchema
  .extend({ targetIdentitySha256: sha256Schema })
  .strict()

export const goldImportV2FixedLocalTargetIdentitySchema =
  fixedLocalTargetIdentityStructuralSchema.superRefine((identity, context) => {
    const { targetIdentitySha256, ...body } = identity
    if (sha256(canonicalJson(body)) !== targetIdentitySha256) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fixed-local target identity hash does not match its observed content.',
        path: ['targetIdentitySha256'],
      })
    }
  })

export type GoldImportV2FixedLocalTargetIdentity = z.infer<
  typeof goldImportV2FixedLocalTargetIdentitySchema
>

const targetObservationBodySchema = z
  .object({
    classification: z
      .object({
        callerSuppliedTargetFactsAccepted: z.literal(false),
        expectedProfile: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.expectedProfile),
        expectedProfileDirectlyObserved: z.literal(false),
        expectedProfileProof: z.literal(
          'expected_configuration_authenticated_by_exact_local_catalog_identity',
        ),
        linkedProjectTargetDetected: z.literal(false),
        remoteDatabaseTargetDetected: z.literal(false),
        remoteDockerEndpointDetected: z.literal(false),
      })
      .strict(),
    database: databaseObservationSchema,
    dockerAfter: dockerSnapshotSchema,
    dockerBefore: dockerSnapshotSchema,
    observationCompletedAt: timestampSchema,
    observationStartedAt: timestampSchema,
    schemaVersion: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_OBSERVATION_SCHEMA_VERSION),
  })
  .strict()

const goldImportV2FixedLocalTargetObservationStructuralSchema = targetObservationBodySchema
  .extend({ targetIdentitySha256: sha256Schema })
  .strict()

export const goldImportV2FixedLocalTargetObservationSchema =
  goldImportV2FixedLocalTargetObservationStructuralSchema.superRefine((observation, context) => {
    if (!fixedLocalTargetObservationIntegrityIsValid(observation)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fixed-local target observation content or identity is invalid.',
      })
    }
  })

export type GoldImportV2FixedLocalDockerSnapshot = z.infer<typeof dockerSnapshotSchema>
export type GoldImportV2FixedLocalTargetObservation = z.infer<
  typeof goldImportV2FixedLocalTargetObservationSchema
>

interface DockerContextInspect {
  Endpoints?: { docker?: { Host?: unknown; SkipTLSVerify?: unknown } }
  Name?: unknown
}

interface DockerContainerInspect {
  Config?: {
    Hostname?: unknown
    Image?: unknown
    Labels?: unknown
  }
  HostConfig?: { NetworkMode?: unknown; PortBindings?: unknown }
  Id?: unknown
  Image?: unknown
  ImageManifestDescriptor?: { digest?: unknown }
  Name?: unknown
  NetworkSettings?: { Ports?: unknown }
  RestartCount?: unknown
  State?: { Health?: { Status?: unknown }; Running?: unknown; StartedAt?: unknown }
}

export interface GoldImportV2RawDockerTargetSnapshot {
  containerInspect: unknown
  contextInspect: unknown
  hostnameStdout: string
  inspectedAt: string
}

export interface GoldImportV2RawDatabaseTargetObservation {
  clientAddress: unknown
  configuredPort: unknown
  currentUser: unknown
  database: unknown
  isolationLevel: unknown
  observedAt: unknown
  postmasterStartedAt: unknown
  serverAddress: unknown
  serverPort: unknown
  sessionUser: unknown
  socketDirectories: unknown
  transactionReadOnly: unknown
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function identityFromObservationBody(
  body: z.infer<typeof targetObservationBodySchema>,
): GoldImportV2FixedLocalTargetIdentity {
  const { observedAt: _databaseObservedAt, ...database } = body.database
  const { inspectedAt: _dockerInspectedAt, ...docker } = body.dockerAfter
  void _databaseObservedAt
  void _dockerInspectedAt
  const identityBody = fixedLocalTargetIdentityBodySchema.parse({
    classification: body.classification,
    database,
    docker,
    schemaVersion: 'literature-gold-v2-fixed-local-target-identity/1.0.0',
  })
  return goldImportV2FixedLocalTargetIdentitySchema.parse({
    ...identityBody,
    targetIdentitySha256: sha256(canonicalJson(identityBody)),
  })
}

function fixedLocalTargetObservationIntegrityIsValid(
  observation: z.infer<typeof goldImportV2FixedLocalTargetObservationStructuralSchema>,
): boolean {
  const { inspectedAt: _beforeInspectedAt, ...beforeIdentity } = observation.dockerBefore
  const { inspectedAt: _afterInspectedAt, ...afterIdentity } = observation.dockerAfter
  void _beforeInspectedAt
  void _afterInspectedAt
  const startMs = Date.parse(observation.observationStartedAt)
  const beforeMs = Date.parse(observation.dockerBefore.inspectedAt)
  const databaseMs = Date.parse(observation.database.observedAt)
  const afterMs = Date.parse(observation.dockerAfter.inspectedAt)
  const completedMs = Date.parse(observation.observationCompletedAt)
  const targetIdentity = identityFromObservationBody(observation)
  return (
    canonicalJson(beforeIdentity) === canonicalJson(afterIdentity) &&
    startMs <= beforeMs &&
    beforeMs <= databaseMs &&
    databaseMs <= afterMs &&
    afterMs <= completedMs &&
    completedMs - startMs <= 5 * 60_000 &&
    Math.abs(
      Date.parse(observation.dockerAfter.startedAt) -
        Date.parse(observation.database.postmasterStartedAt),
    ) <= 5_000 &&
    targetIdentity.targetIdentitySha256 === observation.targetIdentitySha256
  )
}

export function validateGoldImportV2FixedLocalTargetIdentity(
  input: unknown,
): GoldImportV2FixedLocalTargetIdentity {
  const identity = goldImportV2FixedLocalTargetIdentitySchema.parse(input)
  return Object.freeze({ ...identity })
}

function parseTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} is not an ISO timestamp.`)
  }
  return new Date(value).toISOString()
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is not an object.`)
  }
  return value as Record<string, unknown>
}

function parseJsonObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'string') return record(value, label)
  try {
    return record(JSON.parse(value) as unknown, label)
  } catch {
    throw new Error(`${label} is not valid JSON.`)
  }
}

function parsePublishedBindings(value: unknown): Array<{ hostAddress: string; hostPort: number }> {
  const ports = record(value, 'Docker published ports')
  const bindings = ports['5432/tcp']
  if (!Array.isArray(bindings)) throw new Error('Docker 5432/tcp bindings are absent.')
  return bindings
    .map((binding) => {
      const parsed = record(binding, 'Docker published port binding')
      return {
        hostAddress: String(parsed.HostIp),
        hostPort: Number(parsed.HostPort),
      }
    })
    .sort(
      (left, right) =>
        ['0.0.0.0', '::'].indexOf(left.hostAddress) - ['0.0.0.0', '::'].indexOf(right.hostAddress),
    )
}

export function parseGoldImportV2FixedLocalDockerSnapshot(
  input: GoldImportV2RawDockerTargetSnapshot,
): GoldImportV2FixedLocalDockerSnapshot {
  const context = parseJsonObject(
    input.contextInspect,
    'Docker context inspection',
  ) as DockerContextInspect
  const container = parseJsonObject(
    input.containerInspect,
    'Docker container inspection',
  ) as DockerContainerInspect
  const labels = record(container.Config?.Labels, 'Docker container labels')
  const networkSettings = record(container.NetworkSettings, 'Docker network settings')
  const networks = record(networkSettings.Networks, 'Docker container networks')
  const networkNames = Object.keys(networks).sort()
  const hostname = input.hostnameStdout.trim()
  const containerId = container.Id
  const configuredHostname = container.Config?.Hostname
  if (
    typeof containerId !== 'string' ||
    !CONTAINER_ID_PATTERN.test(containerId) ||
    hostname !== containerId.slice(0, 12) ||
    configuredHostname !== hostname
  ) {
    throw new Error('Observed container ID disagrees with the exact in-container hostname.')
  }
  if (
    context.Name !== GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.dockerContext ||
    context.Endpoints?.docker?.Host !== GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.dockerEndpoint ||
    context.Endpoints.docker.SkipTLSVerify !== false
  ) {
    throw new Error('Docker context is not the exact local Unix-socket endpoint.')
  }
  if (networkNames.length !== 1 || networkNames[0] !== GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.network) {
    throw new Error('Observed container network is not the exact fixed-local project network.')
  }
  const snapshot = dockerSnapshotSchema.parse({
    composeProject: labels['com.docker.compose.project'],
    containerHostname: hostname,
    containerId,
    containerName:
      typeof container.Name === 'string' && container.Name.startsWith('/')
        ? container.Name.slice(1)
        : container.Name,
    context: context.Name,
    endpoint: context.Endpoints.docker.Host,
    health: container.State?.Health?.Status,
    imageId: container.Image,
    imageManifestDigest: container.ImageManifestDescriptor?.digest,
    imageReference: container.Config?.Image,
    inspectedAt: parseTimestamp(input.inspectedAt, 'Docker inspection time'),
    internalPort: Number(
      Object.keys(record(container.HostConfig?.PortBindings, 'Port bindings'))[0]?.split('/')[0],
    ),
    network: container.HostConfig?.NetworkMode,
    publishedBindings: parsePublishedBindings(networkSettings.Ports),
    restartCount: container.RestartCount,
    running: container.State?.Running,
    startedAt: parseTimestamp(container.State?.StartedAt, 'Container start time'),
    supabaseProject: labels['com.supabase.cli.project'],
  })
  return Object.freeze(snapshot)
}

function parseSocketDirectories(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function buildGoldImportV2FixedLocalTargetObservation(input: {
  database: GoldImportV2RawDatabaseTargetObservation
  dockerAfter: GoldImportV2RawDockerTargetSnapshot
  dockerBefore: GoldImportV2RawDockerTargetSnapshot
  observationCompletedAt: string
  observationStartedAt: string
}): GoldImportV2FixedLocalTargetObservation {
  const dockerBefore = parseGoldImportV2FixedLocalDockerSnapshot(input.dockerBefore)
  const dockerAfter = parseGoldImportV2FixedLocalDockerSnapshot(input.dockerAfter)
  const observationStartedAt = parseTimestamp(
    input.observationStartedAt,
    'Target observation start time',
  )
  const observationCompletedAt = parseTimestamp(
    input.observationCompletedAt,
    'Target observation completion time',
  )
  const socketDirectories = parseSocketDirectories(input.database.socketDirectories)
  const database = databaseObservationSchema.parse({
    clientAddress: input.database.clientAddress,
    configuredPort: input.database.configuredPort,
    connectionTransport: 'unix_socket_inside_exact_container',
    currentUser: input.database.currentUser,
    database: input.database.database,
    isolationLevel: input.database.isolationLevel,
    observedAt: parseTimestamp(input.database.observedAt, 'Database observation time'),
    postmasterStartedAt: parseTimestamp(
      input.database.postmasterStartedAt,
      'Database postmaster start time',
    ),
    serverAddress: input.database.serverAddress,
    serverPort: input.database.serverPort,
    sessionUser: input.database.sessionUser,
    socketDirectory:
      socketDirectories.length === 1 ? socketDirectories[0] : input.database.socketDirectories,
    transactionReadOnly: input.database.transactionReadOnly,
  })
  const { inspectedAt: _beforeInspectedAt, ...beforeIdentity } = dockerBefore
  const { inspectedAt: _afterInspectedAt, ...afterIdentity } = dockerAfter
  void _beforeInspectedAt
  void _afterInspectedAt
  const startMs = Date.parse(observationStartedAt)
  const beforeMs = Date.parse(dockerBefore.inspectedAt)
  const databaseMs = Date.parse(database.observedAt)
  const afterMs = Date.parse(dockerAfter.inspectedAt)
  const completedMs = Date.parse(observationCompletedAt)
  const containerStartMs = Date.parse(dockerAfter.startedAt)
  const postmasterStartMs = Date.parse(database.postmasterStartedAt)
  if (
    canonicalJson(beforeIdentity) !== canonicalJson(afterIdentity) ||
    startMs > beforeMs ||
    beforeMs > databaseMs ||
    databaseMs > afterMs ||
    afterMs > completedMs ||
    completedMs - startMs > 5 * 60_000 ||
    Math.abs(containerStartMs - postmasterStartMs) > 5_000
  ) {
    throw new Error('Docker/database target observations are stale, reordered, or disagree.')
  }
  const body = targetObservationBodySchema.parse({
    classification: {
      callerSuppliedTargetFactsAccepted: false,
      expectedProfile: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.expectedProfile,
      expectedProfileDirectlyObserved: false,
      expectedProfileProof: 'expected_configuration_authenticated_by_exact_local_catalog_identity',
      linkedProjectTargetDetected: false,
      remoteDatabaseTargetDetected: false,
      remoteDockerEndpointDetected: false,
    },
    database,
    dockerAfter,
    dockerBefore,
    observationCompletedAt,
    observationStartedAt,
    schemaVersion: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_OBSERVATION_SCHEMA_VERSION,
  })
  const targetIdentity = identityFromObservationBody(body)
  return goldImportV2FixedLocalTargetObservationSchema.parse({
    ...body,
    targetIdentitySha256: targetIdentity.targetIdentitySha256,
  })
}

export function validateGoldImportV2FixedLocalTargetObservation(
  input: unknown,
): GoldImportV2FixedLocalTargetObservation {
  const observation = goldImportV2FixedLocalTargetObservationSchema.parse(input)
  return Object.freeze({ ...observation })
}

export function fixedLocalTargetIdentityFromObservation(
  input: unknown,
): GoldImportV2FixedLocalTargetIdentity {
  return Object.freeze(
    identityFromObservationBody(validateGoldImportV2FixedLocalTargetObservation(input)),
  )
}

export function assertGoldImportV2FixedLocalTargetObservationsMatch(
  initialInput: unknown,
  finalInput: unknown,
): void {
  const initial = fixedLocalTargetIdentityFromObservation(initialInput)
  const final = fixedLocalTargetIdentityFromObservation(finalInput)
  if (canonicalJson(initial) !== canonicalJson(final)) {
    throw new Error('Fixed-local target identity changed across the publication bracket.')
  }
}

export function isSha256DockerIdentity(value: string): boolean {
  return SHA256_PATTERN.test(value)
}
