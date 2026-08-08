import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertLocalDockerEndpoint,
  buildCanonicalScenarioEvidence,
  canonicalJson,
  EXECUTION_RECEIPT_SCHEMA_VERSION,
  extractSqlScenarioEvidence,
  LINT_INTROSPECTION_SCHEMA_VERSION,
  parseRehearsalCliArguments,
  REHEARSAL_MANIFEST_SCHEMA_VERSION,
  sanitizeRehearsalChildEnvironment,
  validateSecurityIntrospection,
  validateSqlScenarioEvidence,
  validateSupabaseLint,
} from './gold-import-compensation-rehearsal-evidence'

const ROOT = process.cwd()
const POSTGRES_IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.104'
const MIGRATIONS = [
  '20260727032621_add_literature_explorer.sql',
  '20260727164510_add_literature_gold_set.sql',
  '20260727190000_add_literature_gold_review_categories.sql',
  '20260727193432_add_literature_full_text_categorization_flag.sql',
  '20260728170939_add_interactive_clinical_case_publication_status.sql',
  '20260728171212_add_immune_inflammatory_disease_tag.sql',
  '20260728174726_add_safety_complication_prevention_clinical_purpose.sql',
  '20260730194025_add_literature_gold_test_unlock.sql',
  '20260808035633_add_literature_gold_import_compensation_contract.sql',
] as const
const CONTRACT_MIGRATION = MIGRATIONS.at(-1) as (typeof MIGRATIONS)[number]
const VERIFICATION = '20260808035633_verify_literature_gold_import_compensation_contract.sql'
const RUNNER = 'scripts/literature/rehearse-gold-import-compensation-db.ts'
const EVIDENCE_HELPER = 'scripts/literature/gold-import-compensation-rehearsal-evidence.ts'
const CONTAINER = `ip-gold-compensation-${process.pid}-${randomBytes(4).toString('hex')}`
const DATABASE = 'gold_compensation_rehearsal'
const DATABASE_USER = 'supabase_admin'
const PASSWORD = randomBytes(24).toString('hex')
let verifiedLocalDockerEndpoint: string | undefined

interface CommandResult {
  stdout: string
  stderr: string
}

interface CommandOptions {
  stdin?: string
  env?: Record<string, string>
}

function childEnvironment(overrides: Record<string, string> = {}) {
  return sanitizeRehearsalChildEnvironment(process.env, overrides)
}

function command(commandName: string, arguments_: string[], options: CommandOptions = {}) {
  return new Promise<CommandResult>((resolvePromise, rejectPromise) => {
    const environmentOverrides = { ...options.env }
    if (commandName === 'docker' && verifiedLocalDockerEndpoint) {
      environmentOverrides.DOCKER_HOST = verifiedLocalDockerEndpoint
    }
    const child = spawn(commandName, arguments_, {
      cwd: ROOT,
      env: childEnvironment(environmentOverrides),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr })
        return
      }
      const displayedArguments = arguments_.map((argument, index) => {
        if (argument.startsWith('PGPASSWORD=')) return 'PGPASSWORD=[redacted]'
        if (argument.startsWith('POSTGRES_PASSWORD=')) return 'POSTGRES_PASSWORD=[redacted]'
        if (arguments_[index - 1] === '--db-url') return '[redacted-local-disposable-url]'
        return argument
      })
      rejectPromise(
        new Error(
          `${commandName} ${displayedArguments.join(' ')} exited with ${code ?? 'unknown'}:\n${stderr || stdout}`,
        ),
      )
    })
    child.stdin.end(options.stdin)
  })
}

function sha256(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function inspectLocalDockerRuntime() {
  const contextResult = await command('docker', ['context', 'show'])
  const context = contextResult.stdout.trim()
  if (!context) throw new Error('Docker did not report an effective context.')
  const endpointResult = await command('docker', [
    'context',
    'inspect',
    context,
    '--format',
    '{{(index .Endpoints "docker").Host}}',
  ])
  const endpoint = endpointResult.stdout.trim()
  const endpointKind = assertLocalDockerEndpoint(endpoint)
  verifiedLocalDockerEndpoint = endpoint
  return { context, endpoint, endpointKind }
}

async function waitForDatabase() {
  let lastError = ''
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await command('docker', [
      'exec',
      '--env',
      `PGPASSWORD=${PASSWORD}`,
      CONTAINER,
      'psql',
      '--no-psqlrc',
      '--host',
      '127.0.0.1',
      '--username',
      DATABASE_USER,
      '--dbname',
      DATABASE,
      '--tuples-only',
      '--command',
      'select 1',
    ]).catch((error: unknown) => {
      lastError = error instanceof Error ? error.message : String(error)
      return null
    })
    if (result?.stdout.trim() === '1') return
    await new Promise<void>((resolvePromise) => {
      setTimeout(resolvePromise, 250)
    })
  }
  throw new Error(`Disposable Supabase PostgreSQL did not become ready. ${lastError}`)
}

async function applySql(sql: string) {
  return command(
    'docker',
    [
      'exec',
      '--env',
      `PGPASSWORD=${PASSWORD}`,
      '-i',
      CONTAINER,
      'psql',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--host',
      '127.0.0.1',
      '--username',
      DATABASE_USER,
      '--dbname',
      DATABASE,
    ],
    { stdin: sql },
  )
}

async function queryJson(sql: string): Promise<unknown> {
  const result = await command('docker', [
    'exec',
    '--env',
    `PGPASSWORD=${PASSWORD}`,
    CONTAINER,
    'psql',
    '--no-psqlrc',
    '--set',
    'ON_ERROR_STOP=1',
    '--host',
    '127.0.0.1',
    '--username',
    DATABASE_USER,
    '--dbname',
    DATABASE,
    '--tuples-only',
    '--no-align',
    '--quiet',
    '--command',
    sql,
  ])
  try {
    return JSON.parse(result.stdout.trim()) as unknown
  } catch (error) {
    throw new Error(
      `Disposable introspection did not return JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
}

async function automaticHostPort() {
  const result = await command('docker', [
    'inspect',
    '--format',
    '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
    CONTAINER,
  ])
  const port = result.stdout.trim()
  if (!/^\d{1,5}$/u.test(port)) throw new Error('Docker did not assign a localhost database port.')
  return port
}

async function runSupabaseLint(hostPort: string) {
  const databaseUrl = `postgresql://${DATABASE_USER}:${PASSWORD}@127.0.0.1:${hostPort}/${DATABASE}`
  const result = await command(
    'npx',
    [
      '--no-install',
      'supabase',
      'db',
      'lint',
      '--db-url',
      databaseUrl,
      '--schema',
      'public',
      '--level',
      'warning',
      '--fail-on',
      'none',
      '--output',
      'json',
    ],
    { env: { PGSSLMODE: 'disable' } },
  )
  try {
    return {
      raw: JSON.parse(result.stdout) as unknown,
      diagnostics: result.stderr.trim(),
    }
  } catch (error) {
    throw new Error(
      `Supabase db lint did not return JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
}

export const SECURITY_INTROSPECTION_SQL = String.raw`
with
required_rls(table_name) as (
  values
    ('literature_gold_review_operation_actions'),
    ('literature_gold_review_operations'),
    ('literature_gold_set_batches'),
    ('literature_gold_set_events'),
    ('literature_gold_set_items'),
    ('literature_gold_set_review_drafts'),
    ('literature_gold_set_reviews')
),
rls as (
  select required.table_name,
    coalesce(class.relrowsecurity, false) as rls_enabled
  from required_rls as required
  left join pg_catalog.pg_class as class
    on class.relname = required.table_name
  left join pg_catalog.pg_namespace as namespace
    on namespace.oid = class.relnamespace and namespace.nspname = 'public'
),
required_functions(name) as (
  values
    ('apply_literature_gold_import_v1'),
    ('compensate_literature_gold_import_v1'),
    ('reconcile_literature_gold_review_operation_v1')
),
functions as (
  select required.name,
    pg_catalog.pg_get_function_identity_arguments(proc.oid) as identity_arguments,
    owner.rolname as owner,
    proc.prosecdef as security_definer,
    coalesce((
      select pg_catalog.regexp_replace(configured.setting, '^search_path=', '')
      from unnest(coalesce(proc.proconfig, array[]::text[])) as configured(setting)
      where configured.setting like 'search_path=%'
      limit 1
    ), '') as search_path,
    exists (
      select 1
      from pg_catalog.aclexplode(coalesce(
        proc.proacl,
        pg_catalog.acldefault('f', proc.proowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
    ) as public_execute,
    pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE') as anon_execute,
    pg_catalog.has_function_privilege('authenticated', proc.oid, 'EXECUTE') as authenticated_execute,
    pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE') as service_role_execute
  from required_functions as required
  left join pg_catalog.pg_proc as proc on proc.proname = required.name
  left join pg_catalog.pg_namespace as namespace
    on namespace.oid = proc.pronamespace and namespace.nspname = 'public'
  left join pg_catalog.pg_roles as owner on owner.oid = proc.proowner
),
review_table as (
  select class.*
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public' and class.relname = 'literature_gold_set_reviews'
),
review_privileges as (
  select
    exists (
      select 1 from review_table,
      lateral pg_catalog.aclexplode(coalesce(
        review_table.relacl,
        pg_catalog.acldefault('r', review_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'INSERT'
    ) as public_insert,
    exists (
      select 1 from review_table,
      lateral pg_catalog.aclexplode(coalesce(
        review_table.relacl,
        pg_catalog.acldefault('r', review_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'UPDATE'
    ) as public_update,
    exists (
      select 1 from review_table,
      lateral pg_catalog.aclexplode(coalesce(
        review_table.relacl,
        pg_catalog.acldefault('r', review_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'DELETE'
    ) as public_delete,
    exists (
      select 1 from review_table,
      lateral pg_catalog.aclexplode(coalesce(
        review_table.relacl,
        pg_catalog.acldefault('r', review_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'TRUNCATE'
    ) as public_truncate,
    exists (
      select 1 from review_table,
      lateral pg_catalog.aclexplode(coalesce(
        review_table.relacl,
        pg_catalog.acldefault('r', review_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'REFERENCES'
    ) as public_references,
    exists (
      select 1 from review_table,
      lateral pg_catalog.aclexplode(coalesce(
        review_table.relacl,
        pg_catalog.acldefault('r', review_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'TRIGGER'
    ) as public_trigger,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_reviews', 'INSERT') as anon_insert,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_reviews', 'UPDATE') as anon_update,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_reviews', 'DELETE') as anon_delete,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_reviews', 'TRUNCATE') as anon_truncate,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_reviews', 'REFERENCES') as anon_references,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_reviews', 'TRIGGER') as anon_trigger,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_reviews', 'INSERT') as authenticated_insert,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_reviews', 'UPDATE') as authenticated_update,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_reviews', 'DELETE') as authenticated_delete,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_reviews', 'TRUNCATE') as authenticated_truncate,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_reviews', 'REFERENCES') as authenticated_references,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_reviews', 'TRIGGER') as authenticated_trigger,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_reviews', 'SELECT') as service_role_select,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_reviews', 'INSERT') as service_role_insert,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_reviews', 'UPDATE') as service_role_update,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_reviews', 'DELETE') as service_role_delete,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_reviews', 'TRUNCATE') as service_role_truncate,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_reviews', 'REFERENCES') as service_role_references,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_reviews', 'TRIGGER') as service_role_trigger
),
event_table as (
  select class.*
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public' and class.relname = 'literature_gold_set_events'
),
event_privileges as (
  select
    exists (
      select 1 from event_table,
      lateral pg_catalog.aclexplode(coalesce(
        event_table.relacl,
        pg_catalog.acldefault('r', event_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'INSERT'
    ) as public_insert,
    exists (
      select 1 from event_table,
      lateral pg_catalog.aclexplode(coalesce(
        event_table.relacl,
        pg_catalog.acldefault('r', event_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'UPDATE'
    ) as public_update,
    exists (
      select 1 from event_table,
      lateral pg_catalog.aclexplode(coalesce(
        event_table.relacl,
        pg_catalog.acldefault('r', event_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'DELETE'
    ) as public_delete,
    exists (
      select 1 from event_table,
      lateral pg_catalog.aclexplode(coalesce(
        event_table.relacl,
        pg_catalog.acldefault('r', event_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'TRUNCATE'
    ) as public_truncate,
    exists (
      select 1 from event_table,
      lateral pg_catalog.aclexplode(coalesce(
        event_table.relacl,
        pg_catalog.acldefault('r', event_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'REFERENCES'
    ) as public_references,
    exists (
      select 1 from event_table,
      lateral pg_catalog.aclexplode(coalesce(
        event_table.relacl,
        pg_catalog.acldefault('r', event_table.relowner)
      )) as acl
      where acl.grantee = 0 and acl.privilege_type = 'TRIGGER'
    ) as public_trigger,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_events', 'INSERT') as anon_insert,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_events', 'UPDATE') as anon_update,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_events', 'DELETE') as anon_delete,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_events', 'TRUNCATE') as anon_truncate,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_events', 'REFERENCES') as anon_references,
    pg_catalog.has_table_privilege('anon', 'public.literature_gold_set_events', 'TRIGGER') as anon_trigger,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_events', 'INSERT') as authenticated_insert,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_events', 'UPDATE') as authenticated_update,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_events', 'DELETE') as authenticated_delete,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_events', 'TRUNCATE') as authenticated_truncate,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_events', 'REFERENCES') as authenticated_references,
    pg_catalog.has_table_privilege('authenticated', 'public.literature_gold_set_events', 'TRIGGER') as authenticated_trigger,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_events', 'SELECT') as service_role_select,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_events', 'INSERT') as service_role_insert,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_events', 'UPDATE') as service_role_update,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_events', 'DELETE') as service_role_delete,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_events', 'TRUNCATE') as service_role_truncate,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_events', 'REFERENCES') as service_role_references,
    pg_catalog.has_table_privilege('service_role', 'public.literature_gold_set_events', 'TRIGGER') as service_role_trigger
),
journal_tables(table_name) as (
  values
    ('literature_gold_review_operation_actions'),
    ('literature_gold_review_operations')
),
journal_roles(role_name) as (
  values ('public'), ('anon'), ('authenticated'), ('service_role')
),
journal_privileges as (
  select journal_tables.table_name,
    journal_roles.role_name,
    case when journal_roles.role_name = 'public' then exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        class.relacl, pg_catalog.acldefault('r', class.relowner)
      )) as acl where acl.grantee = 0 and acl.privilege_type = 'SELECT'
    ) else pg_catalog.has_table_privilege(
      journal_roles.role_name,
      pg_catalog.format('public.%I', journal_tables.table_name),
      'SELECT'
    ) end as can_select,
    case when journal_roles.role_name = 'public' then exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        class.relacl, pg_catalog.acldefault('r', class.relowner)
      )) as acl where acl.grantee = 0 and acl.privilege_type = 'INSERT'
    ) else pg_catalog.has_table_privilege(
      journal_roles.role_name,
      pg_catalog.format('public.%I', journal_tables.table_name),
      'INSERT'
    ) end as can_insert,
    case when journal_roles.role_name = 'public' then exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        class.relacl, pg_catalog.acldefault('r', class.relowner)
      )) as acl where acl.grantee = 0 and acl.privilege_type = 'UPDATE'
    ) else pg_catalog.has_table_privilege(
      journal_roles.role_name,
      pg_catalog.format('public.%I', journal_tables.table_name),
      'UPDATE'
    ) end as can_update,
    case when journal_roles.role_name = 'public' then exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        class.relacl, pg_catalog.acldefault('r', class.relowner)
      )) as acl where acl.grantee = 0 and acl.privilege_type = 'DELETE'
    ) else pg_catalog.has_table_privilege(
      journal_roles.role_name,
      pg_catalog.format('public.%I', journal_tables.table_name),
      'DELETE'
    ) end as can_delete,
    case when journal_roles.role_name = 'public' then exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        class.relacl, pg_catalog.acldefault('r', class.relowner)
      )) as acl where acl.grantee = 0 and acl.privilege_type = 'TRUNCATE'
    ) else pg_catalog.has_table_privilege(
      journal_roles.role_name,
      pg_catalog.format('public.%I', journal_tables.table_name),
      'TRUNCATE'
    ) end as can_truncate,
    case when journal_roles.role_name = 'public' then exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        class.relacl, pg_catalog.acldefault('r', class.relowner)
      )) as acl where acl.grantee = 0 and acl.privilege_type = 'REFERENCES'
    ) else pg_catalog.has_table_privilege(
      journal_roles.role_name,
      pg_catalog.format('public.%I', journal_tables.table_name),
      'REFERENCES'
    ) end as can_references,
    case when journal_roles.role_name = 'public' then exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        class.relacl, pg_catalog.acldefault('r', class.relowner)
      )) as acl where acl.grantee = 0 and acl.privilege_type = 'TRIGGER'
    ) else pg_catalog.has_table_privilege(
      journal_roles.role_name,
      pg_catalog.format('public.%I', journal_tables.table_name),
      'TRIGGER'
    ) end as can_trigger
  from journal_tables
  cross join journal_roles
  join pg_catalog.pg_class as class on class.relname = journal_tables.table_name
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = class.relnamespace and namespace.nspname = 'public'
),
required_schemas(schema_name) as (
  values ('public'), ('extensions')
),
ordinary_roles(role_name) as (
  values ('public'), ('anon'), ('authenticated')
),
schema_create_privileges as (
  select required_schemas.schema_name,
    owner.rolname as owner,
    ordinary_roles.role_name,
    case when ordinary_roles.role_name = 'public' then exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner)
      )) as acl where acl.grantee = 0 and acl.privilege_type = 'CREATE'
    ) else pg_catalog.has_schema_privilege(
      ordinary_roles.role_name, required_schemas.schema_name, 'CREATE'
    ) end as can_create
  from required_schemas
  cross join ordinary_roles
  join pg_catalog.pg_namespace as namespace on namespace.nspname = required_schemas.schema_name
  join pg_catalog.pg_roles as owner on owner.oid = namespace.nspowner
),
constraints as (
  select con.conname as name,
    class.relname as table_name,
    pg_catalog.pg_get_constraintdef(con.oid) as definition
  from pg_catalog.pg_constraint as con
  join pg_catalog.pg_class as class on class.oid = con.conrelid
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname in (
      'literature_gold_set_batches',
      'literature_gold_set_items',
      'literature_gold_set_review_drafts',
      'literature_gold_set_reviews',
      'literature_gold_set_events',
      'literature_gold_review_operations',
      'literature_gold_review_operation_actions'
    )
),
expected_indexes(index_name, table_name, is_unique) as (
  values
    ('literature_gold_review_operation_actions_item_idx', 'literature_gold_review_operation_actions', false),
    ('literature_gold_review_operation_actions_source_idx', 'literature_gold_review_operation_actions', false),
    ('literature_gold_review_operations_batch_started_idx', 'literature_gold_review_operations', false),
    ('literature_gold_review_operations_one_live_compensation_idx', 'literature_gold_review_operations', true),
    ('literature_gold_set_events_batch_created_idx', 'literature_gold_set_events', false),
    ('literature_gold_set_events_item_created_idx', 'literature_gold_set_events', false),
    ('literature_gold_set_events_one_test_unlock_idx', 'literature_gold_set_events', true),
    ('literature_gold_set_events_operation_action_idx', 'literature_gold_set_events', false),
    ('literature_gold_set_events_operation_sequence_idx', 'literature_gold_set_events', true),
    ('literature_gold_set_items_batch_status_order_idx', 'literature_gold_set_items', false),
    ('literature_gold_set_items_pmid_idx', 'literature_gold_set_items', false),
    ('literature_gold_set_items_split_idx', 'literature_gold_set_items', false),
    ('literature_gold_set_items_unresolved_idx', 'literature_gold_set_items', false),
    ('literature_gold_set_reviews_item_completed_idx', 'literature_gold_set_reviews', false),
    ('literature_gold_set_reviews_one_child_idx', 'literature_gold_set_reviews', true),
    ('literature_gold_set_reviews_one_operation_action_idx', 'literature_gold_set_reviews', true)
),
required_unique_indexes(index_name) as (
  values
    ('literature_gold_review_operations_one_live_compensation_idx'),
    ('literature_gold_set_events_operation_sequence_idx'),
    ('literature_gold_set_reviews_one_child_idx'),
    ('literature_gold_set_reviews_one_operation_action_idx')
),
catalog_indexes as (
  select index_class.relname as index_name,
    class.relname as table_name,
    index.indisunique as is_unique,
    index.indisvalid as is_valid,
    pg_catalog.pg_get_expr(index.indpred, index.indrelid) as predicate,
    pg_catalog.pg_get_indexdef(index.indexrelid) as definition
  from pg_catalog.pg_index as index
  join pg_catalog.pg_class as index_class on index_class.oid = index.indexrelid
  join pg_catalog.pg_class as class on class.oid = index.indrelid
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname in (
      'literature_gold_set_batches',
      'literature_gold_set_events',
      'literature_gold_set_items',
      'literature_gold_set_review_drafts',
      'literature_gold_set_reviews',
      'literature_gold_review_operations',
      'literature_gold_review_operation_actions'
    )
    and not exists (
      select 1
      from pg_catalog.pg_constraint as constraint_index
      where constraint_index.conindid = index.indexrelid
    )
),
index_catalog_drift as (
  select catalog.*
  from catalog_indexes as catalog
  left join expected_indexes as expected
    on expected.index_name = catalog.index_name
   and expected.table_name = catalog.table_name
   and expected.is_unique = catalog.is_unique
  where expected.index_name is null or catalog.is_valid is not true

  union all

  select
    '__missing_expected_index__:' || expected.index_name as index_name,
    expected.table_name,
    expected.is_unique,
    false as is_valid,
    null::text as predicate,
    'MISSING EXPECTED INDEX ' || expected.index_name as definition
  from expected_indexes as expected
  left join catalog_indexes as catalog
    on catalog.index_name = expected.index_name
   and catalog.table_name = expected.table_name
   and catalog.is_unique = expected.is_unique
   and catalog.is_valid is true
  where catalog.index_name is null
),
unique_indexes as (
  select catalog.*
  from required_unique_indexes as required
  join catalog_indexes as catalog on catalog.index_name = required.index_name

  union all

  select drift.* from index_catalog_drift as drift
),
journal_policies as (
  select policy.policyname as name,
    policy.tablename as table_name,
    policy.cmd,
    policy.roles,
    policy.qual,
    policy.with_check
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'
    and policy.tablename in (
      'literature_gold_review_operation_actions',
      'literature_gold_review_operations',
      'literature_gold_set_batches',
      'literature_gold_set_events',
      'literature_gold_set_items',
      'literature_gold_set_review_drafts',
      'literature_gold_set_reviews'
    )
),
triggers as (
  select trg.tgname as name,
    class.relname as table_name,
    trg.tgenabled as enable_mode,
    trg.tgenabled in ('O', 'A') as enabled
  from pg_catalog.pg_trigger as trg
  join pg_catalog.pg_class as class on class.oid = trg.tgrelid
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and trg.tgisinternal is false
    and class.relname in (
      'literature_gold_set_batches',
      'literature_gold_set_items',
      'literature_gold_set_review_drafts',
      'literature_gold_set_reviews',
      'literature_gold_set_events',
      'literature_gold_review_operations',
      'literature_gold_review_operation_actions'
    )
),
event_types as (
  select distinct extracted.value[1] as event_type
  from pg_catalog.pg_constraint as con
  cross join lateral pg_catalog.regexp_matches(
    pg_catalog.pg_get_constraintdef(con.oid),
    '''([a-z][a-z0-9_]*)''',
    'g'
  ) as extracted(value)
  where con.conname = 'literature_gold_set_events_type_check'
)
select pg_catalog.jsonb_build_object(
  'rls', (
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'tableName', table_name,
      'rlsEnabled', rls_enabled
    ) order by table_name) from rls
  ),
  'functions', (
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', name,
      'identityArguments', identity_arguments,
      'owner', owner,
      'securityDefiner', security_definer,
      'searchPath', search_path,
      'publicExecute', public_execute,
      'anonExecute', anon_execute,
      'authenticatedExecute', authenticated_execute,
      'serviceRoleExecute', service_role_execute
    ) order by name) from functions
  ),
  'reviewPrivileges', (
    select pg_catalog.jsonb_build_object(
      'publicInsert', public_insert,
      'publicUpdate', public_update,
      'publicDelete', public_delete,
      'publicTruncate', public_truncate,
      'publicReferences', public_references,
      'publicTrigger', public_trigger,
      'anonInsert', anon_insert,
      'anonUpdate', anon_update,
      'anonDelete', anon_delete,
      'anonTruncate', anon_truncate,
      'anonReferences', anon_references,
      'anonTrigger', anon_trigger,
      'authenticatedInsert', authenticated_insert,
      'authenticatedUpdate', authenticated_update,
      'authenticatedDelete', authenticated_delete,
      'authenticatedTruncate', authenticated_truncate,
      'authenticatedReferences', authenticated_references,
      'authenticatedTrigger', authenticated_trigger,
      'serviceRoleSelect', service_role_select,
      'serviceRoleInsert', service_role_insert,
      'serviceRoleUpdate', service_role_update,
      'serviceRoleDelete', service_role_delete,
      'serviceRoleTruncate', service_role_truncate,
      'serviceRoleReferences', service_role_references,
      'serviceRoleTrigger', service_role_trigger
    ) from review_privileges
  ),
  'eventPrivileges', (
    select pg_catalog.jsonb_build_object(
      'publicInsert', public_insert,
      'publicUpdate', public_update,
      'publicDelete', public_delete,
      'publicTruncate', public_truncate,
      'publicReferences', public_references,
      'publicTrigger', public_trigger,
      'anonInsert', anon_insert,
      'anonUpdate', anon_update,
      'anonDelete', anon_delete,
      'anonTruncate', anon_truncate,
      'anonReferences', anon_references,
      'anonTrigger', anon_trigger,
      'authenticatedInsert', authenticated_insert,
      'authenticatedUpdate', authenticated_update,
      'authenticatedDelete', authenticated_delete,
      'authenticatedTruncate', authenticated_truncate,
      'authenticatedReferences', authenticated_references,
      'authenticatedTrigger', authenticated_trigger,
      'serviceRoleSelect', service_role_select,
      'serviceRoleInsert', service_role_insert,
      'serviceRoleUpdate', service_role_update,
      'serviceRoleDelete', service_role_delete,
      'serviceRoleTruncate', service_role_truncate,
      'serviceRoleReferences', service_role_references,
      'serviceRoleTrigger', service_role_trigger
    ) from event_privileges
  ),
  'journalPrivileges', (
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'tableName', table_name,
      'role', role_name,
      'select', can_select,
      'insert', can_insert,
      'update', can_update,
      'delete', can_delete,
      'truncate', can_truncate,
      'references', can_references,
      'trigger', can_trigger
    ) order by table_name, role_name) from journal_privileges
  ),
  'schemaCreatePrivileges', (
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schemaName', schema_name,
      'owner', owner,
      'role', role_name,
      'create', can_create
    ) order by schema_name, role_name) from schema_create_privileges
  ),
  'constraints', (
    select pg_catalog.jsonb_agg(name order by name) from constraints
  ),
  'constraintDefinitions', (
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', name,
      'tableName', table_name,
      'definition', definition
    ) order by name) from constraints
  ),
  'uniqueIndexes', (
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', index_name,
      'tableName', table_name,
      'unique', is_unique,
      'valid', is_valid,
      'predicate', predicate,
      'definition', definition
    ) order by index_name) from unique_indexes
  ),
  'journalPolicies', (
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', name,
      'tableName', table_name,
      'command', cmd,
      'roles', roles,
      'using', qual,
      'withCheck', with_check
    ) order by name) from journal_policies
  ),
  'triggers', (
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', name,
      'tableName', table_name,
      'enableMode', enable_mode,
      'enabled', enabled
    ) order by name) from triggers
  ),
  'supportedEventTypes', (
    select pg_catalog.jsonb_agg(event_type order by event_type) from event_types
  )
);
`

function printHelp() {
  console.log(`Usage:
  npm run literature:rehearse-gold-import-compensation -- --output <fresh-directory>

The command always creates its own fixed-image Supabase PostgreSQL 17 container
on a Docker-assigned localhost port. It accepts no database target, URL, host,
port, credentials, or remote-selection option.`)
}

async function writeExclusive(path: string, bytes: string) {
  await writeFile(path, bytes, { encoding: 'utf8', flag: 'wx' })
}

async function main() {
  const options = parseRehearsalCliArguments(process.argv.slice(2), ROOT)
  if (options.help) {
    printHelp()
    return
  }
  if (!options.outputDirectory) throw new Error('A fresh output directory is required.')

  const startedAt = new Date().toISOString()
  const sqlPaths = [
    ...MIGRATIONS.map((migration) => resolve(ROOT, 'supabase/migrations', migration)),
    resolve(ROOT, 'supabase/verification', VERIFICATION),
  ]
  const identityPaths = [resolve(ROOT, RUNNER), resolve(ROOT, EVIDENCE_HELPER)]
  const inputs = await Promise.all(
    [...sqlPaths, ...identityPaths].map(async (path) => ({ path, bytes: await readFile(path) })),
  )
  const inputManifest = inputs.map(({ path, bytes }) => ({
    path: path.slice(ROOT.length + 1),
    sha256: sha256(bytes),
  }))
  const inputSha256 = sha256(
    inputManifest.map(({ path, sha256: digest }) => `${path}\0${digest}\n`).join(''),
  )
  const identity = (path: string) => {
    const match = inputManifest.find((entry) => entry.path === path)
    if (!match) throw new Error(`Missing rehearsal input identity: ${path}.`)
    return match.sha256
  }
  const migrationPath = `supabase/migrations/${CONTRACT_MIGRATION}`
  const verifierPath = `supabase/verification/${VERIFICATION}`
  const migrationSha256 = identity(migrationPath)
  const verifierSha256 = identity(verifierPath)
  const runnerSha256 = identity(RUNNER)

  const dockerRuntime = await inspectLocalDockerRuntime()
  await mkdir(options.outputDirectory)
  await command('docker', [
    'run',
    '--detach',
    '--rm',
    '--name',
    CONTAINER,
    '--publish',
    '127.0.0.1::5432',
    '--env',
    `POSTGRES_PASSWORD=${PASSWORD}`,
    '--env',
    `POSTGRES_DB=${DATABASE}`,
    POSTGRES_IMAGE,
  ])

  try {
    await waitForDatabase()
    const hostPort = await automaticHostPort()
    for (const input of inputs.slice(0, MIGRATIONS.length)) {
      await applySql(input.bytes.toString('utf8'))
    }
    const verification = inputs[MIGRATIONS.length]
    if (!verification || basename(verification.path) !== VERIFICATION) {
      throw new Error('Verification SQL is missing or out of order.')
    }
    const verificationResult = await applySql(verification.bytes.toString('utf8'))
    const rawScenarioEvidence = validateSqlScenarioEvidence(
      extractSqlScenarioEvidence(`${verificationResult.stdout}\n${verificationResult.stderr}`),
    )
    const scenarioEvidence = buildCanonicalScenarioEvidence(
      rawScenarioEvidence,
      migrationSha256,
      verifierSha256,
    )
    const scenarioBytes = canonicalJson(scenarioEvidence)
    const scenarioSha256 = sha256(scenarioBytes)

    const lintExecution = await runSupabaseLint(hostPort)
    const lint = validateSupabaseLint(lintExecution.raw)
    const security = validateSecurityIntrospection(await queryJson(SECURITY_INTROSPECTION_SQL))
    const lintIntrospection = {
      schemaVersion: LINT_INTROSPECTION_SCHEMA_VERSION,
      database: {
        engine: 'Supabase PostgreSQL',
        majorVersion: 17,
        image: POSTGRES_IMAGE,
        networkScope: 'Docker-assigned localhost port only',
        dockerEndpointPolicy: 'local Unix-domain socket or Windows named pipe verified before use',
      },
      lint,
      security,
      allChecksPassed: true,
    }
    const lintIntrospectionBytes = canonicalJson(lintIntrospection)
    const lintIntrospectionSha256 = sha256(lintIntrospectionBytes)

    const manifest = {
      schemaVersion: REHEARSAL_MANIFEST_SCHEMA_VERSION,
      database: lintIntrospection.database,
      inputs: inputManifest,
      inputSha256,
      identities: {
        migrationSha256,
        verifierSha256,
        runnerSha256,
        evidenceHelperSha256: identity(EVIDENCE_HELPER),
      },
      artifacts: {
        scenarioEvidence: {
          path: 'scenario-evidence.json',
          sha256: scenarioSha256,
        },
        lintIntrospection: {
          path: 'lint-introspection.json',
          sha256: lintIntrospectionSha256,
        },
      },
      scenarioSummary: {
        scenarioCount: scenarioEvidence.scenarios.length,
        allScenariosPassed: scenarioEvidence.allScenariosPassed,
        mixedPackageCounts: scenarioEvidence.mixedPackageCounts,
      },
      proofs: {
        effectiveStateRestoration: {
          scenarioId: 'S07_restore_compensation',
          passed: true,
        },
        physicalStateRemainsAppendOnly: {
          scenarioId: 'S07_restore_compensation',
          passed: true,
        },
        compensationReplayIdempotent: {
          scenarioId: 'S10_compensation_idempotent_replay',
          passed: true,
        },
      },
      lintSummary: {
        errorCount: lint.errors.length,
        warningCount: lint.warningCount,
        rawIssueCount: lint.rawIssueCount,
      },
      securityIntrospectionPassed: security.passed,
      allChecksPassed: true,
    }
    const manifestBytes = canonicalJson(manifest)
    const manifestSha256 = sha256(manifestBytes)

    await writeExclusive(resolve(options.outputDirectory, 'scenario-evidence.json'), scenarioBytes)
    await writeExclusive(
      resolve(options.outputDirectory, 'lint-introspection.json'),
      lintIntrospectionBytes,
    )
    await writeExclusive(resolve(options.outputDirectory, 'rehearsal-manifest.json'), manifestBytes)
    await writeExclusive(
      resolve(options.outputDirectory, 'execution-receipt.json'),
      canonicalJson({
        schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
        startedAt,
        completedAt: new Date().toISOString(),
        outputDirectory: options.outputDirectory,
        disposableRuntime: {
          image: POSTGRES_IMAGE,
          containerName: CONTAINER,
          dockerContext: dockerRuntime.context,
          dockerEndpoint: dockerRuntime.endpoint,
          dockerEndpointKind: dockerRuntime.endpointKind,
          host: '127.0.0.1',
          automaticallyAssignedPort: hostPort,
        },
        rawSqlScenarioEvidence: rawScenarioEvidence,
        lintDiagnostics: lintExecution.diagnostics,
        artifactSha256: {
          scenarioEvidence: scenarioSha256,
          lintIntrospection: lintIntrospectionSha256,
          rehearsalManifest: manifestSha256,
        },
        passed: true,
      }),
    )

    console.log(`PASS isolated gold import-compensation rehearsal (${inputSha256})`)
    console.log(`Scenario evidence SHA-256: ${scenarioSha256}`)
    console.log(`Rehearsal manifest SHA-256: ${manifestSha256}`)
    console.log(`Artifacts: ${options.outputDirectory}`)
  } finally {
    await command('docker', ['rm', '--force', CONTAINER])
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
