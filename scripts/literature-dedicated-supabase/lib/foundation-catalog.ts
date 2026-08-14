/**
 * Catalog introspection for the dedicated Literature foundation schema.
 *
 * One SQL statement produces a single JSON document describing every Literature object, its
 * security posture, and its privileges. The same document shape is produced by the disposable
 * rehearsal and by the read-only postflight, so the two verify against one expectation.
 *
 * Every query here is `SELECT`-only against `pg_catalog`. Nothing in this file writes.
 */

import {
  LITERATURE_FOUNDATION_EXTENSIONS,
  LITERATURE_FOUNDATION_FUNCTIONS,
  LITERATURE_FOUNDATION_INDEXES,
  LITERATURE_FOUNDATION_TABLES,
  LITERATURE_FOUNDATION_TRIGGERS,
  LITERATURE_FOUNDATION_EXPECTED_POLICY_COUNT,
  LITERATURE_PROBED_TABLE_PRIVILEGES,
  LITERATURE_SERVICE_ROLE_TABLE_PRIVILEGES,
  LITERATURE_UNPRIVILEGED_ROLES,
  type LiteratureFunctionExpectation,
} from '../../../src/features/literature/dedicated-supabase/catalog-expectations'

/**
 * A read-only catalog inspection statement.
 *
 * Wrapped by the caller in `begin read only; … ; rollback;` so a remote target cannot be mutated
 * even if the statement were changed to something that tried.
 */
export const LITERATURE_CATALOG_INSPECTION_SQL = `
select jsonb_build_object(
  'extensions', coalesce((
    select jsonb_agg(jsonb_build_object('name', e.extname, 'schema', n.nspname) order by e.extname)
    from pg_catalog.pg_extension as e
    join pg_catalog.pg_namespace as n on n.oid = e.extnamespace
    where e.extname = any(array['pg_trgm'])
  ), '[]'::jsonb),
  'tables', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'name', c.relname,
        'rowLevelSecurity', c.relrowsecurity,
        'rowLevelSecurityForced', c.relforcerowsecurity
      )
      order by c.relname
    )
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'literature%'
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(jsonb_build_object('table', c.relname, 'policy', p.polname) order by p.polname)
    from pg_catalog.pg_policy as p
    join pg_catalog.pg_class as c on c.oid = p.polrelid
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname like 'literature%'
  ), '[]'::jsonb),
  'functions', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'name', p.proname,
        'argumentTypes', pg_catalog.pg_get_function_arguments(p.oid),
        'returnType', pg_catalog.pg_get_function_result(p.oid),
        'language', l.lanname,
        'volatility', p.provolatile,
        'securityDefiner', p.prosecdef,
        'searchPath', (
          select replace(config, 'search_path=', '')
          from unnest(coalesce(p.proconfig, array[]::text[])) as config
          where config like 'search_path=%'
          limit 1
        ),
        'owner', pg_catalog.pg_get_userbyid(p.proowner),
        'publicExecute', pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE'),
        'anonExecute', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'),
        'authenticatedExecute', pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        'serviceRoleExecute', pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
      order by p.proname, pg_catalog.pg_get_function_arguments(p.oid)
    )
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    join pg_catalog.pg_language as l on l.oid = p.prolang
    where n.nspname = 'public' and p.proname like '%literature%'
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(
      jsonb_build_object('table', c.relname, 'trigger', t.tgname)
      order by c.relname, t.tgname
    )
    from pg_catalog.pg_trigger as t
    join pg_catalog.pg_class as c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal and c.relname like 'literature%'
  ), '[]'::jsonb),
  'indexes', coalesce((
    select jsonb_agg(c.relname order by c.relname)
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'i' and c.relname like 'literature%'
  ), '[]'::jsonb),
  'tablePrivileges', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'table', target.relname,
        'role', probe.role_name,
        'privilege', probe.privilege_name,
        'granted', pg_catalog.has_table_privilege(
          probe.role_name,
          format('public.%I', target.relname),
          probe.privilege_name
        )
      )
      order by target.relname, probe.role_name, probe.privilege_name
    )
    from (
      select c.relname
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'literature%'
    ) as target
    cross join (
      select role_name, privilege_name
      from unnest(array['public', 'anon', 'authenticated', 'service_role']) as role_name
      cross join unnest(
        array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
      ) as privilege_name
    ) as probe
  ), '[]'::jsonb)
) as catalog;
`.trim()

export interface CatalogTable {
  name: string
  rowLevelSecurity: boolean
  rowLevelSecurityForced: boolean
}

export interface CatalogFunction {
  name: string
  argumentTypes: string
  returnType: string
  language: string
  volatility: string
  securityDefiner: boolean
  searchPath: string | null
  owner: string
  publicExecute: boolean
  anonExecute: boolean
  authenticatedExecute: boolean
  serviceRoleExecute: boolean
}

export interface CatalogTablePrivilege {
  table: string
  role: string
  privilege: string
  granted: boolean
}

export interface LiteratureCatalogSnapshot {
  extensions: { name: string; schema: string }[]
  tables: CatalogTable[]
  policies: { table: string; policy: string }[]
  functions: CatalogFunction[]
  triggers: { table: string; trigger: string }[]
  indexes: string[]
  tablePrivileges: CatalogTablePrivilege[]
}

export interface CatalogComparison {
  matches: boolean
  failures: string[]
}

function normalizeArguments(value: string): string {
  return value.replaceAll(/\s+/gu, ' ').trim()
}

/**
 * Argument lists are compared with the parameter names stripped, because PostgreSQL renders
 * `p_query text` while a signature-only expectation may reasonably be written either way. Types and
 * their order are what actually identify the function.
 */
function argumentTypeSignature(value: string): string {
  const normalized = normalizeArguments(value)
  if (normalized === '') return ''
  return normalized
    .split(',')
    .map((part) => {
      const trimmed = part.trim()
      const withoutName = trimmed.replace(/^[a-z_][a-z0-9_]*\s+/iu, '')
      return withoutName.replace(/\s+DEFAULT\s+.*$/iu, '').trim()
    })
    .join(', ')
}

function functionKey(name: string, argumentTypes: string): string {
  return `${name}(${argumentTypeSignature(argumentTypes)})`
}

/**
 * Compare an observed catalog against the checked-in expectations, in both directions: every
 * expected object must exist with the expected security posture, and no unexpected Literature
 * object may exist.
 */
export function compareLiteratureCatalog(snapshot: LiteratureCatalogSnapshot): CatalogComparison {
  const failures: string[] = []

  for (const expected of LITERATURE_FOUNDATION_EXTENSIONS) {
    const actual = snapshot.extensions.find((entry) => entry.name === expected.name)
    if (!actual) {
      failures.push(`extension ${expected.name} is absent`)
    } else if (actual.schema !== expected.schema) {
      failures.push(
        `extension ${expected.name} is installed in schema ${actual.schema}, expected ${expected.schema}`,
      )
    }
  }

  const actualTableNames = snapshot.tables.map((table) => table.name).sort()
  const expectedTableNames = [...LITERATURE_FOUNDATION_TABLES].sort()
  for (const name of expectedTableNames) {
    if (!actualTableNames.includes(name)) failures.push(`table ${name} is absent`)
  }
  for (const name of actualTableNames) {
    if (!expectedTableNames.includes(name)) failures.push(`unexpected table ${name}`)
  }
  for (const table of snapshot.tables) {
    if (!table.rowLevelSecurity) {
      failures.push(`table ${table.name} does not have row-level security enabled`)
    }
  }

  if (snapshot.policies.length !== LITERATURE_FOUNDATION_EXPECTED_POLICY_COUNT) {
    failures.push(
      `expected ${LITERATURE_FOUNDATION_EXPECTED_POLICY_COUNT} policies, found ` +
        `${snapshot.policies.length} (${snapshot.policies
          .map((entry) => `${entry.table}.${entry.policy}`)
          .join(', ')})`,
    )
  }

  const expectedFunctionByKey = new Map<string, LiteratureFunctionExpectation>(
    LITERATURE_FOUNDATION_FUNCTIONS.map((entry) => [
      functionKey(entry.name, entry.argumentTypes),
      entry,
    ]),
  )
  const seenFunctionKeys = new Set<string>()

  for (const actual of snapshot.functions) {
    const key = functionKey(actual.name, actual.argumentTypes)
    seenFunctionKeys.add(key)
    const expected = expectedFunctionByKey.get(key)
    if (!expected) {
      failures.push(`unexpected function ${key}`)
      continue
    }
    if (actual.language !== expected.language) {
      failures.push(`function ${key} language is ${actual.language}, expected ${expected.language}`)
    }
    if (actual.volatility !== expected.volatility) {
      failures.push(
        `function ${key} volatility is ${actual.volatility}, expected ${expected.volatility}`,
      )
    }
    if (actual.securityDefiner !== expected.securityDefiner) {
      failures.push(`function ${key} securityDefiner is ${actual.securityDefiner}`)
    }
    if (normalizeArguments(actual.searchPath ?? '') !== expected.searchPath) {
      failures.push(
        `function ${key} search_path is ${actual.searchPath ?? '(unset)'}, expected ` +
          `${expected.searchPath}`,
      )
    }
    if (normalizeArguments(actual.returnType) !== normalizeArguments(expected.returnType)) {
      failures.push(`function ${key} returns ${actual.returnType}, expected ${expected.returnType}`)
    }
    if (actual.publicExecute) failures.push(`function ${key} grants EXECUTE to PUBLIC`)
    if (actual.anonExecute) failures.push(`function ${key} grants EXECUTE to anon`)
    if (actual.authenticatedExecute) {
      failures.push(`function ${key} grants EXECUTE to authenticated`)
    }
    if (actual.serviceRoleExecute !== expected.serviceRoleExecute) {
      failures.push(
        `function ${key} serviceRoleExecute is ${actual.serviceRoleExecute}, expected ` +
          `${expected.serviceRoleExecute}`,
      )
    }
  }
  for (const key of expectedFunctionByKey.keys()) {
    if (!seenFunctionKeys.has(key)) failures.push(`function ${key} is absent`)
  }

  const actualTriggers = snapshot.triggers.map((entry) => `${entry.table}.${entry.trigger}`).sort()
  const expectedTriggers = LITERATURE_FOUNDATION_TRIGGERS.map(
    (entry) => `${entry.table}.${entry.trigger}`,
  ).sort()
  for (const name of expectedTriggers) {
    if (!actualTriggers.includes(name)) failures.push(`trigger ${name} is absent`)
  }
  for (const name of actualTriggers) {
    if (!expectedTriggers.includes(name)) failures.push(`unexpected trigger ${name}`)
  }

  const actualIndexes = [...snapshot.indexes].sort()
  const expectedIndexes = [...LITERATURE_FOUNDATION_INDEXES].sort()
  for (const name of expectedIndexes) {
    if (!actualIndexes.includes(name)) failures.push(`index ${name} is absent`)
  }
  for (const name of actualIndexes) {
    if (!expectedIndexes.includes(name)) failures.push(`unexpected index ${name}`)
  }

  for (const entry of snapshot.tablePrivileges) {
    const unprivileged =
      entry.role === 'public' || LITERATURE_UNPRIVILEGED_ROLES.includes(entry.role)
    if (unprivileged) {
      if (entry.granted && LITERATURE_PROBED_TABLE_PRIVILEGES.includes(entry.privilege)) {
        failures.push(`${entry.role} holds ${entry.privilege} on ${entry.table}`)
      }
      continue
    }
    if (entry.role === 'service_role') {
      const shouldHold = LITERATURE_SERVICE_ROLE_TABLE_PRIVILEGES.includes(entry.privilege)
      if (shouldHold && !entry.granted) {
        failures.push(`service_role lacks ${entry.privilege} on ${entry.table}`)
      }
    }
  }

  return { matches: failures.length === 0, failures }
}

/** Literature object names present, used by the reconciliation classifier. */
export function summarizeCatalogPresence(snapshot: LiteratureCatalogSnapshot) {
  return {
    presentTables: snapshot.tables.map((table) => table.name).sort(),
    presentFunctions: [...new Set(snapshot.functions.map((entry) => entry.name))].sort(),
    unexpectedLiteratureObjects: [
      ...snapshot.tables
        .map((table) => table.name)
        .filter((name) => !LITERATURE_FOUNDATION_TABLES.includes(name))
        .map((name) => `table:${name}`),
      ...snapshot.functions
        .map((entry) => entry.name)
        .filter((name) => !LITERATURE_FOUNDATION_FUNCTIONS.some((fn) => fn.name === name))
        .map((name) => `function:${name}`),
    ].sort(),
  }
}

/** Row-count statement covering every Literature table. Read-only. */
export const LITERATURE_ROW_COUNT_SQL = `
select coalesce(sum(counted), 0)::bigint as total
from (
  ${LITERATURE_FOUNDATION_TABLES.map(
    (table) => `select count(*) as counted from public.${table}`,
  ).join('\n  union all\n  ')}
) as counts;
`.trim()
