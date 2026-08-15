/**
 * Complete canonical catalog introspection for the dedicated Literature foundation schema.
 *
 * The first review found that a tampered function body could survive a signature-level comparison;
 * the comparator therefore binds the full semantic surface (function definitions, owners, columns,
 * constraints, trigger and index definitions, complete ACL grids) against a generated, committed
 * expectations artifact, and every section carries an exact expected row count so missing evidence
 * fails closed instead of reading as "nothing granted".
 *
 * The second review (H-1) found the opposite defect: the committed artifact also froze *global*
 * state of the disposable image — every installed extension and every `pg_default_acl` row — which
 * an actual managed Supabase project does not share (it ships baseline extensions and default-ACL
 * rows of its own). A correct managed migration would therefore have read as drift. The catalog is
 * now split into four scopes:
 *
 *   1. **Exact foundation-owned sections** (`LITERATURE_EXACT_CATALOG_SECTIONS`): objects the
 *      foundation migration itself creates or alters. Compared byte-exactly against the artifact.
 *   2. **Scoped managed prerequisites** (`LITERATURE_PREREQUISITE_CATALOG_SECTIONS`): `pg_trgm`
 *      state and the three API role attributes. Checked *semantically* by
 *      `evaluateManagedPrerequisiteState`, never bound to the disposable image's incidental values.
 *   3. **Pre/post global-state deltas** (`LITERATURE_DELTA_CATALOG_SECTIONS`): default privileges
 *      and schema privileges, which the foundation migration does not touch. The requirement is
 *      that they are *unchanged across the apply* (`compareGlobalStateDelta`), not that they equal
 *      any fixed inventory. For the managed project this is an execution-time, provider-bound
 *      requirement; it cannot produce a success verdict in this PR.
 *   4. **Observation-only sections** (`LITERATURE_OBSERVATION_ONLY_CATALOG_SECTIONS`): every index
 *      relation name in `public`, observed independently of its owning table so a same-name index
 *      on an *unrelated* table is visible to the preflight collision check (H-2).
 *
 * The third review found a fifth distinction that scope (1) was missing. The inspection must see
 * **every** public relation and type to detect collisions, but the *exact* comparison must not
 * freeze them: an unrelated, non-colliding public table planted by another workload made the
 * observed `relations` section 9 rows where the artifact expects 8, and the postflight reported
 * drift for an object the foundation neither owns nor forbids. Observation breadth and comparison
 * scope are now separated explicitly:
 *
 *   - **Broad observation inventory** (`collectCatalogCollisionInventory`): every public relation
 *     name and kind, every public standalone type name, and every public index relation name.
 *     Feeds occupied-name, reserved-namespace, and collision detection. It is never compared
 *     wholesale to the artifact.
 *   - **Exact foundation-owned projection** (`projectFoundationOwnedSection`): the same sections,
 *     narrowed to what the migration itself creates. `relations` is narrowed to the eight
 *     foundation tables by name; `types` is narrowed to `LITERATURE_FOUNDATION_OWNED_TYPES`, which
 *     is empty because the migration defines no standalone type. Every other exact section is
 *     already scoped in SQL to `literature%` objects, so a reserved-namespace extra still shows up
 *     as drift while an unrelated public object never does.
 *
 * What that preserves: expected-name collisions (broad inventory), altered expected relation or
 * type semantics (checksum over the projection), missing expected objects (row count over the
 * projection), and prohibited extras inside the reserved Literature namespace (SQL-scoped
 * sections plus `summarizeCatalogPresence`).
 *
 * Every query here is `SELECT`-only against `pg_catalog`. Nothing in this file writes.
 *
 * The comparator is deliberately **not** self-authorizing. It proves the observed catalog equals
 * the reviewed artifact; the immutable migration checksum, the exact owner-approved commit, the
 * (absent, therefore blocking) provider-bound attestation, and independent review all remain
 * separate, independent gates.
 */

import { createHash } from 'node:crypto'

import {
  LITERATURE_FOUNDATION_OWNED_TYPES,
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
 * The complete read-only catalog statement. Existence-safe by construction: every subquery reads
 * `pg_catalog` only, so it runs identically against a brand-new project with no Literature
 * relation and no migration-history table (L-1).
 *
 * `relations` deliberately covers **every** relkind in `public` — ordinary, partitioned and foreign
 * tables, views, materialized views, sequences — plus types, so a same-name collision of any class
 * is observable. `indexNames` additionally lists every index relation name in `public`
 * independently of its owning table, so an expected foundation index name occupied by an index on
 * an *unrelated* table is observable too (H-2). `extensions` is scoped to `pg_trgm`, the one
 * extension the foundation migration requires, so unrelated managed baseline extensions cannot
 * read as drift (H-1); `defaultPrivileges` and `schemaPrivileges` are captured for pre/post delta
 * comparison only, scoped to the relevant namespaces and roles.
 */
export const LITERATURE_CATALOG_INSPECTION_SQL = `
select jsonb_build_object(
  'extensions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', e.extname, 'schema', n.nspname, 'version', e.extversion
    ) order by e.extname)
    from pg_catalog.pg_extension as e
    join pg_catalog.pg_namespace as n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm'
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
  'indexNames', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', c.relname
    ) order by c.relname)
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('i','I')
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
    where n.nspname is null or n.nspname in ('public', 'extensions')
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

export interface CatalogExtension {
  name: string
  schema: string
  version: string
}

export interface CatalogIndexName {
  schema: string
  name: string
}

export interface CatalogRoleAttributes {
  role: string
  superuser: boolean
  bypassRls: boolean
  canLogin: boolean
  inherit: boolean
}

export interface LiteratureCatalogSnapshot {
  extensions: CatalogExtension[]
  relations: CatalogRelation[]
  indexNames: CatalogIndexName[]
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
  roleAttributes: CatalogRoleAttributes[]
}

/** Every section the inspection emits. A missing section is never "nothing found". */
export const LITERATURE_CATALOG_SECTIONS = [
  'extensions',
  'relations',
  'indexNames',
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
 * Sections the foundation migration itself creates or alters. These — and only these — are
 * compared byte-exactly against the committed expectations artifact. Freezing anything broader
 * (installed extensions, default ACLs) would encode disposable-image state as if it were a managed
 * platform contract, guaranteeing false drift on the real project (H-1).
 */
export const LITERATURE_EXACT_CATALOG_SECTIONS = [
  'columns',
  'constraints',
  'functions',
  'indexes',
  'policies',
  'relations',
  'tablePrivileges',
  'triggers',
  'types',
] as const satisfies readonly LiteratureCatalogSection[]

export type LiteratureExactCatalogSection = (typeof LITERATURE_EXACT_CATALOG_SECTIONS)[number]

/** Sections checked semantically as scoped managed prerequisites, never byte-exactly. */
export const LITERATURE_PREREQUISITE_CATALOG_SECTIONS = [
  'extensions',
  'roleAttributes',
] as const satisfies readonly LiteratureCatalogSection[]

/**
 * Global-state sections the foundation migration must leave untouched. Compared pre-versus-post
 * (`compareGlobalStateDelta`) — the disposable rehearsal proves the migration produces an empty
 * delta, and the managed project inherits the same requirement as an execution-time, provider-bound
 * check. No fixed inventory is asserted, because the managed baseline is a platform observation,
 * not a contract this repository owns.
 */
export const LITERATURE_DELTA_CATALOG_SECTIONS = [
  'defaultPrivileges',
  'schemaPrivileges',
] as const satisfies readonly LiteratureCatalogSection[]

/** Sections captured purely for preflight collision observation. */
export const LITERATURE_OBSERVATION_ONLY_CATALOG_SECTIONS = [
  'indexNames',
] as const satisfies readonly LiteratureCatalogSection[]

/**
 * Exact sections whose captured rows are broader than what the foundation owns, and therefore need
 * an explicit name projection before comparison. Every other exact section is already narrowed by
 * the inspection SQL itself (`relname like 'literature%'` / `proname like '%literature%'`).
 */
export const LITERATURE_NAME_SCOPED_EXACT_SECTIONS = [
  'relations',
  'types',
] as const satisfies readonly LiteratureExactCatalogSection[]

/**
 * The broad, observation-only inventory used for collision and reserved-namespace detection.
 *
 * Deliberately unfiltered: an unrelated public object is *not* drift, but it is exactly what has to
 * be visible when deciding whether a name the migration creates is already occupied.
 */
export interface LiteratureCollisionInventory {
  /** Every public relation, as `{name, relkind}`. */
  relations: { name: string; relkind: string }[]
  /** Every public standalone type name (table row types are excluded by the inspection SQL). */
  typeNames: string[]
  /** Every public index relation name, independent of its owning table. */
  indexNames: string[]
}

export function collectCatalogCollisionInventory(
  snapshot: LiteratureCatalogSnapshot,
): LiteratureCollisionInventory {
  return {
    relations: (snapshot.relations ?? []).map((relation) => ({
      name: relation.name,
      relkind: relation.relkind,
    })),
    typeNames: (snapshot.types ?? []).map((entry) => entry.name),
    indexNames: (snapshot.indexNames ?? []).map((entry) => entry.name),
  }
}

/**
 * The reviewed expectations artifact. Function definitions are bound by SHA-256 rather than stored
 * verbatim, so a same-signature function with a tampered body fails while the artifact stays
 * reviewable. Everything else in the exact scope is stored in full. Version 3.0.0 narrowed the
 * artifact to foundation-owned sections only (H-1).
 */
export interface LiteratureCatalogExpectationArtifact {
  schemaVersion: 'literature-foundation-catalog-expectations/3.0.0'
  /** Exact expected row count per foundation-owned section. Zero is a real expectation. */
  sectionCounts: Record<LiteratureExactCatalogSection, number>
  /** Canonical checksum per foundation-owned section. */
  sectionSha256: Record<LiteratureExactCatalogSection, string>
  /** Checksum over every section checksum. */
  aggregateSha256: string
}

/**
 * Normalize a snapshot section into the comparable form: function `definition` collapses to a
 * checksum, everything else is compared verbatim.
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

/**
 * Narrow a normalized exact section to the objects the foundation migration owns.
 *
 * `relations` and `types` are captured across the whole `public` namespace so collisions are
 * visible; comparing them wholesale would make any unrelated public table or enum read as
 * foundation drift. The projection keeps only the eight foundation relation names and the
 * (currently empty) list of foundation-owned standalone types. Matching is by **name only**: a row
 * carrying an expected name with an unexpected schema, relkind, owner, or RLS flag stays in the
 * projection and fails the checksum, which is a more precise failure than dropping it.
 *
 * Every other exact section passes through unchanged — the inspection SQL already scoped it to
 * `literature%` objects, so a prohibited extra in the reserved namespace still surfaces as drift.
 */
export function projectFoundationOwnedSection(
  section: LiteratureExactCatalogSection,
  snapshot: LiteratureCatalogSnapshot,
): unknown[] {
  const normalized = normalizeCatalogSection(section, snapshot)
  if (section === 'relations') {
    return normalized.filter((row) =>
      LITERATURE_FOUNDATION_TABLES.includes(String((row as CatalogRelation).name)),
    )
  }
  if (section === 'types') {
    return normalized.filter((row) =>
      LITERATURE_FOUNDATION_OWNED_TYPES.includes(String((row as { name: string }).name)),
    )
  }
  return normalized
}

export function buildCatalogExpectationArtifact(
  snapshot: LiteratureCatalogSnapshot,
): LiteratureCatalogExpectationArtifact {
  const sectionCounts = {} as Record<LiteratureExactCatalogSection, number>
  const sectionSha256 = {} as Record<LiteratureExactCatalogSection, string>
  for (const section of LITERATURE_EXACT_CATALOG_SECTIONS) {
    const projected = projectFoundationOwnedSection(section, snapshot)
    sectionCounts[section] = projected.length
    sectionSha256[section] = sha256(canonicalJson(projected))
  }
  return {
    schemaVersion: 'literature-foundation-catalog-expectations/3.0.0',
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
 * Compare an observed catalog against the reviewed artifact, foundation-owned section by section.
 *
 * Fail-closed: a missing section, a wrong row count, or any checksum difference fails. Because the
 * checksum covers function owners, ACL rows, column defaults, constraint definitions, trigger and
 * index definitions, and forced-RLS state, any material semantic drift fails even when signatures
 * and grants are untouched.
 *
 * Each section is compared through `projectFoundationOwnedSection`, so unrelated public relations
 * and types in the observed catalog are outside the comparison entirely rather than counted as
 * drift. Collision detection over those same unrelated objects is a *separate* concern and lives
 * in the preflight content rules over the broad inventory.
 *
 * A match is a *content* fact only; it says nothing about which database was observed and never
 * authorizes anything.
 */
export function compareLiteratureCatalog(
  snapshot: LiteratureCatalogSnapshot,
  artifact: LiteratureCatalogExpectationArtifact,
): CatalogComparison {
  const failures: string[] = []

  if (artifact.schemaVersion !== 'literature-foundation-catalog-expectations/3.0.0') {
    return {
      matches: false,
      failures: [`unsupported expectations artifact version ${String(artifact.schemaVersion)}`],
    }
  }

  for (const section of LITERATURE_EXACT_CATALOG_SECTIONS) {
    const raw = (snapshot as unknown as Record<string, unknown>)[section]
    if (!Array.isArray(raw)) {
      failures.push(`catalog section ${section} is missing or is not an array`)
      continue
    }
    const projected = projectFoundationOwnedSection(section, snapshot)
    const expectedCount = artifact.sectionCounts[section]
    if (projected.length !== expectedCount) {
      failures.push(
        `catalog section ${section} has ${projected.length} foundation-owned rows, expected ` +
          `${expectedCount}`,
      )
    }
    const observed = sha256(canonicalJson(projected))
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

export type PgTrgmState =
  | { state: 'absent' }
  | { state: 'installed_in_extensions'; version: string }
  | { state: 'installed_elsewhere'; schema: string; version: string }

/** Classify the installed state of `pg_trgm` from a snapshot's scoped extensions section. */
export function classifyPgTrgmState(snapshot: LiteratureCatalogSnapshot): PgTrgmState {
  const installed = (snapshot.extensions ?? []).find((entry) => entry.name === 'pg_trgm')
  if (!installed) return { state: 'absent' }
  if (installed.schema === 'extensions') {
    return { state: 'installed_in_extensions', version: installed.version }
  }
  return { state: 'installed_elsewhere', schema: installed.schema, version: installed.version }
}

export interface PrerequisiteCheck {
  id: string
  description: string
  passed: boolean
  detail: string
}

/**
 * Scoped managed prerequisite state, checked semantically (H-1).
 *
 * `pg_trgm`: before the migration, absent and installed-in-`extensions` are both acceptable;
 * installed anywhere else is rejected, because `create extension if not exists … with schema
 * extensions` would silently keep the wrong location and every later `extensions.gin_trgm_ops`
 * reference would fail (H-2). After the migration it must be installed in exactly `extensions`.
 * Its version is *observed* in the detail text but never bound — the migration does not pin one.
 *
 * Role attributes: the three API roles must exist, none may be a superuser, `service_role` must
 * bypass RLS and `anon`/`authenticated` must not. `canLogin`/`inherit` are observed but not bound;
 * they are managed-platform details this repository does not own.
 */
export function evaluateManagedPrerequisiteState(
  snapshot: LiteratureCatalogSnapshot,
  phase: 'pre_application' | 'post_application',
): PrerequisiteCheck[] {
  const checks: PrerequisiteCheck[] = []
  const trgm = classifyPgTrgmState(snapshot)

  if (phase === 'pre_application') {
    checks.push({
      id: 'Q01-pg-trgm-location',
      description: 'pg_trgm is absent or already installed in the extensions schema',
      passed: trgm.state !== 'installed_elsewhere',
      detail:
        trgm.state === 'absent'
          ? 'absent (the migration will install it into extensions)'
          : trgm.state === 'installed_in_extensions'
            ? `installed in extensions (version ${trgm.version}, observed, not bound)`
            : `installed in schema ${trgm.schema}: CREATE EXTENSION IF NOT EXISTS cannot relocate ` +
              'it and extensions.gin_trgm_ops references would fail. Reject this target.',
    })
  } else {
    checks.push({
      id: 'Q01-pg-trgm-location',
      description: 'pg_trgm is installed in exactly the extensions schema',
      passed: trgm.state === 'installed_in_extensions',
      detail:
        trgm.state === 'installed_in_extensions'
          ? `installed in extensions (version ${trgm.version}, observed, not bound)`
          : trgm.state === 'absent'
            ? 'pg_trgm is not installed'
            : `pg_trgm is installed in schema ${trgm.schema}, not extensions`,
    })
  }

  const roles = new Map((snapshot.roleAttributes ?? []).map((entry) => [entry.role, entry]))
  const required = ['anon', 'authenticated', 'service_role'] as const
  const missing = required.filter((role) => !roles.has(role))
  checks.push({
    id: 'Q02-api-roles-exist',
    description: 'the anon, authenticated, and service_role roles exist',
    passed: missing.length === 0,
    detail: missing.length === 0 ? 'all present' : `missing: ${missing.join(', ')}`,
  })

  const superusers = required.filter((role) => roles.get(role)?.superuser === true)
  checks.push({
    id: 'Q03-no-api-superuser',
    description: 'no API role is a superuser',
    passed: missing.length === 0 && superusers.length === 0,
    detail: superusers.length === 0 ? 'none' : `superuser: ${superusers.join(', ')}`,
  })

  const serviceRole = roles.get('service_role')
  const nonBypass = ['anon', 'authenticated'].filter((role) => roles.get(role)?.bypassRls === true)
  checks.push({
    id: 'Q04-rls-bypass-shape',
    description: 'service_role bypasses RLS and anon/authenticated do not',
    passed: serviceRole?.bypassRls === true && nonBypass.length === 0,
    detail:
      `service_role.bypassRls=${String(serviceRole?.bypassRls)}` +
      (nonBypass.length > 0 ? `; unexpected bypass: ${nonBypass.join(', ')}` : ''),
  })

  return checks
}

/**
 * Pre-versus-post comparison of the global-state sections the migration must not touch.
 *
 * The requirement is a *delta*, not an inventory: whatever default privileges and schema
 * privileges the target had before the apply, it must have identically afterwards. Because Layer 3
 * is absent, running this against the managed project is a documented execution-time provider
 * requirement — nothing here can produce a production success verdict.
 */
export function compareGlobalStateDelta(
  before: LiteratureCatalogSnapshot,
  after: LiteratureCatalogSnapshot,
): CatalogComparison {
  const failures: string[] = []
  for (const section of LITERATURE_DELTA_CATALOG_SECTIONS) {
    const beforeCanonical = canonicalJson(normalizeCatalogSection(section, before))
    const afterCanonical = canonicalJson(normalizeCatalogSection(section, after))
    if (beforeCanonical !== afterCanonical) {
      failures.push(
        `global-state section ${section} changed across the apply ` +
          `(before sha256 ${sha256(beforeCanonical)}, after ${sha256(afterCanonical)})`,
      )
    }
  }
  return { matches: failures.length === 0, failures }
}

/** Literature object names present, used by the content-observation summarizer. */
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

/**
 * Row-count statement covering every Literature table. Read-only. **Not existence-safe**: it
 * references the Literature tables directly, so it belongs exclusively to the postflight complete
 * plan and may run only after the existence probe has proven every table present (L-1).
 */
export const LITERATURE_ROW_COUNT_SQL = `
select coalesce(sum(counted), 0)::bigint as total
from (
  ${LITERATURE_FOUNDATION_TABLES.map(
    (table) => `select count(*) as counted from public.${table}`,
  ).join('\n  union all\n  ')}
) as counts;
`.trim()
