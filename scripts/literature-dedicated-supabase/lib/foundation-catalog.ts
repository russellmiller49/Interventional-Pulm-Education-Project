/**
 * Complete canonical catalog introspection for the dedicated Literature foundation schema.
 *
 * The independent review found that the first version accepted material semantic drift: a tampered
 * body for `literature_admin_stats_v1()` kept its signature and ACLs and still compared equal. The
 * comparator now binds the full semantic surface — function definitions, owners, columns,
 * constraints, trigger and index definitions, complete ACL grids, role attributes, and forced-RLS
 * state — against a generated, committed expectations artifact, and every section carries an exact
 * expected row count so missing evidence fails closed instead of reading as "nothing granted".
 *
 * Every query here is `SELECT`-only against `pg_catalog`. Nothing in this file writes.
 *
 * The comparator is deliberately **not** self-authorizing. It proves the observed catalog equals
 * the reviewed artifact; the immutable migration checksum, the exact owner-approved commit, the
 * provider-bound attestation, and independent review all remain separate, independent gates.
 */

import { createHash } from 'node:crypto'

import {
  LITERATURE_FOUNDATION_TABLES,
  LITERATURE_PROBED_TABLE_PRIVILEGES,
  LITERATURE_PROBED_ROLES,
} from '../../../src/features/literature/dedicated-supabase/catalog-expectations'

/** Canonical JSON: recursively key-sorted, rejecting `undefined` and non-finite numbers. */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON rejects non-finite numbers.')
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (typeof value !== 'object') throw new Error(`Canonical JSON rejects ${typeof value}.`)
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
      .map((key) => {
        if (record[key] === undefined) {
          throw new Error(`Canonical JSON rejects undefined at ${key}.`)
        }
        return [key, canonicalValue(record[key])]
      }),
  )
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

const ROLE_VALUES = LITERATURE_PROBED_ROLES.map((role) => `('${role}')`).join(', ')
const PRIVILEGE_VALUES = LITERATURE_PROBED_TABLE_PRIVILEGES.map(
  (privilege) => `('${privilege}')`,
).join(', ')

/**
 * The complete read-only catalog statement.
 *
 * `relations` deliberately covers **every** relkind in `public` — ordinary, partitioned and foreign
 * tables, views, materialized views, sequences — plus types, so a same-name collision of any class
 * is observable. A view named `public.literature_journals` previously slipped through preflight and
 * then broke the migration; it is now visible here.
 */
export const LITERATURE_CATALOG_INSPECTION_SQL = `
select jsonb_build_object(
  'extensions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', e.extname, 'schema', n.nspname, 'version', e.extversion
    ) order by e.extname)
    from pg_catalog.pg_extension as e
    join pg_catalog.pg_namespace as n on n.oid = e.extnamespace
  ), '[]'::jsonb),
  'relations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', c.relname,
      'relkind', c.relkind,
      'owner', pg_catalog.pg_get_userbyid(c.relowner),
      'persistence', c.relpersistence,
      'rowLevelSecurity', c.relrowsecurity,
      'forcedRowLevelSecurity', c.relforcerowsecurity
    ) order by c.relname, c.relkind)
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','f','v','m','S')
  ), '[]'::jsonb),
  'types', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', t.typname, 'typtype', t.typtype
    ) order by t.typname)
    from pg_catalog.pg_type as t
    join pg_catalog.pg_namespace as n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype in ('e','d','c')
      and not exists (
        select 1 from pg_catalog.pg_class as c
        where c.oid = t.typrelid and c.relkind in ('r','p','f','v','m','S')
      )
  ), '[]'::jsonb),
  'columns', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'ordinal', a.attnum,
      'name', a.attname,
      'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
      'notNull', a.attnotnull,
      'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid),
      'generated', a.attgenerated,
      'identity', a.attidentity,
      'collation', co.collname
    ) order by c.relname, a.attnum)
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute as a on a.attrelid = c.oid
    left join pg_catalog.pg_attrdef as d on d.adrelid = c.oid and d.adnum = a.attnum
    left join pg_catalog.pg_collation as co on co.oid = a.attcollation
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'literature%'
      and a.attnum > 0 and not a.attisdropped
  ), '[]'::jsonb),
  'constraints', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'name', con.conname,
      'type', con.contype,
      'definition', pg_catalog.pg_get_constraintdef(con.oid),
      'validated', con.convalidated,
      'deferrable', con.condeferrable,
      'deferred', con.condeferred
    ) order by c.relname, con.conname)
    from pg_catalog.pg_constraint as con
    join pg_catalog.pg_class as c on c.oid = con.conrelid
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname like 'literature%'
  ), '[]'::jsonb),
  'functions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', p.proname,
      'argumentTypes', pg_catalog.pg_get_function_arguments(p.oid),
      'identityArguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
      'returnType', pg_catalog.pg_get_function_result(p.oid),
      'language', l.lanname,
      'owner', pg_catalog.pg_get_userbyid(p.proowner),
      'volatility', p.provolatile,
      'strict', p.proisstrict,
      'parallel', p.proparallel,
      'securityDefiner', p.prosecdef,
      'leakproof', p.proleakproof,
      'config', coalesce(to_jsonb(p.proconfig), 'null'::jsonb),
      'definition', pg_catalog.pg_get_functiondef(p.oid),
      'acl', coalesce(to_jsonb(p.proacl::text[]), 'null'::jsonb),
      'publicExecute', pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE'),
      'anonExecute', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticatedExecute', pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'serviceRoleExecute', pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
    ) order by p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid))
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    join pg_catalog.pg_language as l on l.oid = p.prolang
    where n.nspname = 'public' and p.proname like '%literature%'
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'name', t.tgname,
      'definition', pg_catalog.pg_get_triggerdef(t.oid),
      'enabled', t.tgenabled,
      'function', tp.proname
    ) order by c.relname, t.tgname)
    from pg_catalog.pg_trigger as t
    join pg_catalog.pg_class as c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    join pg_catalog.pg_proc as tp on tp.oid = t.tgfoid
    where n.nspname = 'public' and not t.tgisinternal and c.relname like 'literature%'
  ), '[]'::jsonb),
  'indexes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', ic.relname,
      'table', tc.relname,
      'definition', pg_catalog.pg_get_indexdef(i.indexrelid),
      'unique', i.indisunique,
      'primary', i.indisprimary,
      'valid', i.indisvalid,
      'ready', i.indisready,
      'method', am.amname
    ) order by ic.relname)
    from pg_catalog.pg_index as i
    join pg_catalog.pg_class as ic on ic.oid = i.indexrelid
    join pg_catalog.pg_class as tc on tc.oid = i.indrelid
    join pg_catalog.pg_namespace as n on n.oid = tc.relnamespace
    join pg_catalog.pg_am as am on am.oid = ic.relam
    where n.nspname = 'public' and tc.relname like 'literature%'
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'name', p.polname,
      'command', p.polcmd,
      'permissive', p.polpermissive,
      'using', pg_catalog.pg_get_expr(p.polqual, p.polrelid),
      'withCheck', pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)
    ) order by c.relname, p.polname)
    from pg_catalog.pg_policy as p
    join pg_catalog.pg_class as c on c.oid = p.polrelid
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname like 'literature%'
  ), '[]'::jsonb),
  'tablePrivileges', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table', target.relname,
      'role', probe.role_name,
      'privilege', probe.privilege_name,
      'granted', pg_catalog.has_table_privilege(
        probe.role_name, format('public.%I', target.relname), probe.privilege_name
      )
    ) order by target.relname, probe.role_name, probe.privilege_name)
    from (
      select c.relname
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'literature%'
    ) as target
    cross join (
      select role_name, privilege_name
      from (values ${ROLE_VALUES}) as roles(role_name)
      cross join (values ${PRIVILEGE_VALUES}) as privileges(privilege_name)
    ) as probe
  ), '[]'::jsonb),
  'schemaPrivileges', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', s.nspname,
      'role', probe.role_name,
      'privilege', probe.privilege_name,
      'granted', pg_catalog.has_schema_privilege(probe.role_name, s.nspname, probe.privilege_name)
    ) order by s.nspname, probe.role_name, probe.privilege_name)
    from (
      select nspname from pg_catalog.pg_namespace where nspname in ('public', 'extensions')
    ) as s
    cross join (
      select role_name, privilege_name
      from (values ${ROLE_VALUES}) as roles(role_name)
      cross join (values ('USAGE'), ('CREATE')) as privileges(privilege_name)
    ) as probe
  ), '[]'::jsonb),
  'defaultPrivileges', coalesce((
    select jsonb_agg(jsonb_build_object(
      'owner', pg_catalog.pg_get_userbyid(d.defaclrole),
      'schema', coalesce(n.nspname, ''),
      'objectType', d.defaclobjtype,
      'acl', d.defaclacl::text[]
    ) order by pg_catalog.pg_get_userbyid(d.defaclrole), coalesce(n.nspname, ''), d.defaclobjtype)
    from pg_catalog.pg_default_acl as d
    left join pg_catalog.pg_namespace as n on n.oid = d.defaclnamespace
  ), '[]'::jsonb),
  'roleAttributes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'role', r.rolname,
      'superuser', r.rolsuper,
      'bypassRls', r.rolbypassrls,
      'canLogin', r.rolcanlogin,
      'inherit', r.rolinherit
    ) order by r.rolname)
    from pg_catalog.pg_roles as r
    where r.rolname in ('anon', 'authenticated', 'service_role')
  ), '[]'::jsonb)
) as catalog;
`.trim()

export interface CatalogRelation {
  schema: string
  name: string
  relkind: string
  owner: string
  persistence: string
  rowLevelSecurity: boolean
  forcedRowLevelSecurity: boolean
}

export interface CatalogFunction {
  schema: string
  name: string
  argumentTypes: string
  identityArguments: string
  returnType: string
  language: string
  owner: string
  volatility: string
  strict: boolean
  parallel: string
  securityDefiner: boolean
  leakproof: boolean
  config: string[] | null
  definition: string
  acl: string[] | null
  publicExecute: boolean
  anonExecute: boolean
  authenticatedExecute: boolean
  serviceRoleExecute: boolean
}

export interface LiteratureCatalogSnapshot {
  extensions: { name: string; schema: string; version: string }[]
  relations: CatalogRelation[]
  types: { schema: string; name: string; typtype: string }[]
  columns: Record<string, unknown>[]
  constraints: Record<string, unknown>[]
  functions: CatalogFunction[]
  triggers: Record<string, unknown>[]
  indexes: Record<string, unknown>[]
  policies: Record<string, unknown>[]
  tablePrivileges: { table: string; role: string; privilege: string; granted: boolean }[]
  schemaPrivileges: Record<string, unknown>[]
  defaultPrivileges: Record<string, unknown>[]
  roleAttributes: Record<string, unknown>[]
}

/** Section names that must all be present. A missing section is never "nothing found". */
export const LITERATURE_CATALOG_SECTIONS = [
  'extensions',
  'relations',
  'types',
  'columns',
  'constraints',
  'functions',
  'triggers',
  'indexes',
  'policies',
  'tablePrivileges',
  'schemaPrivileges',
  'defaultPrivileges',
  'roleAttributes',
] as const

export type LiteratureCatalogSection = (typeof LITERATURE_CATALOG_SECTIONS)[number]

/**
 * The reviewed expectations artifact. Function definitions are bound by SHA-256 rather than stored
 * verbatim, so a same-signature function with a tampered body fails while the artifact stays
 * reviewable. Everything else is stored in full.
 */
export interface LiteratureCatalogExpectationArtifact {
  schemaVersion: 'literature-foundation-catalog-expectations/2.0.0'
  /** Exact expected row count per section. Zero is a real expectation, not an absence. */
  sectionCounts: Record<LiteratureCatalogSection, number>
  /** Canonical checksum per section. */
  sectionSha256: Record<LiteratureCatalogSection, string>
  /** Checksum over every section checksum. */
  aggregateSha256: string
}

/**
 * Normalize a snapshot into the comparable form: function `definition` collapses to a checksum,
 * everything else is compared verbatim.
 */
export function normalizeCatalogSection(
  section: LiteratureCatalogSection,
  snapshot: LiteratureCatalogSnapshot,
): unknown[] {
  if (section === 'functions') {
    return snapshot.functions.map((entry) => {
      const { definition, ...rest } = entry
      return { ...rest, definitionSha256: sha256(definition) }
    })
  }
  const value = snapshot[section] as unknown
  return Array.isArray(value) ? (value as unknown[]) : []
}

export function buildCatalogExpectationArtifact(
  snapshot: LiteratureCatalogSnapshot,
): LiteratureCatalogExpectationArtifact {
  const sectionCounts = {} as Record<LiteratureCatalogSection, number>
  const sectionSha256 = {} as Record<LiteratureCatalogSection, string>
  for (const section of LITERATURE_CATALOG_SECTIONS) {
    const normalized = normalizeCatalogSection(section, snapshot)
    sectionCounts[section] = normalized.length
    sectionSha256[section] = sha256(canonicalJson(normalized))
  }
  return {
    schemaVersion: 'literature-foundation-catalog-expectations/2.0.0',
    sectionCounts,
    sectionSha256,
    aggregateSha256: sha256(canonicalJson(sectionSha256)),
  }
}

export interface CatalogComparison {
  matches: boolean
  failures: string[]
}

/**
 * Compare an observed catalog against the reviewed artifact, section by section.
 *
 * Fail-closed: a missing section, a wrong row count, or any checksum difference fails. Because the
 * checksum covers function owners, ACL rows, column defaults, constraint definitions, trigger and
 * index definitions, forced-RLS state, and role attributes, any material semantic drift fails even
 * when signatures and grants are untouched.
 */
export function compareLiteratureCatalog(
  snapshot: LiteratureCatalogSnapshot,
  artifact: LiteratureCatalogExpectationArtifact,
): CatalogComparison {
  const failures: string[] = []

  for (const section of LITERATURE_CATALOG_SECTIONS) {
    const raw = (snapshot as unknown as Record<string, unknown>)[section]
    if (!Array.isArray(raw)) {
      failures.push(`catalog section ${section} is missing or is not an array`)
      continue
    }
    const normalized = normalizeCatalogSection(section, snapshot)
    const expectedCount = artifact.sectionCounts[section]
    if (normalized.length !== expectedCount) {
      failures.push(
        `catalog section ${section} has ${normalized.length} rows, expected ${expectedCount}`,
      )
    }
    const observed = sha256(canonicalJson(normalized))
    if (observed !== artifact.sectionSha256[section]) {
      failures.push(`catalog section ${section} checksum ${observed} does not match the artifact`)
    }
  }

  const aggregate = sha256(canonicalJson(artifact.sectionSha256))
  if (aggregate !== artifact.aggregateSha256) {
    failures.push('the expectations artifact aggregate checksum is internally inconsistent')
  }

  return { matches: failures.length === 0, failures }
}

/** Literature object names present, used by the reconciliation classifier. */
export function summarizeCatalogPresence(snapshot: LiteratureCatalogSnapshot) {
  const literatureRelations = (snapshot.relations ?? []).filter((relation) =>
    relation.name.startsWith('literature'),
  )
  const tables = literatureRelations
    .filter((relation) => relation.relkind === 'r')
    .map((relation) => relation.name)
  return {
    presentTables: [...tables].sort(),
    presentFunctions: [...new Set((snapshot.functions ?? []).map((entry) => entry.name))].sort(),
    unexpectedLiteratureObjects: [
      ...literatureRelations
        .filter(
          (relation) =>
            relation.relkind !== 'r' || !LITERATURE_FOUNDATION_TABLES.includes(relation.name),
        )
        .map((relation) => `${relation.relkind}:${relation.name}`),
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
