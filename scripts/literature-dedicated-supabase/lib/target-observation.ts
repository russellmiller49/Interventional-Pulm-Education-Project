/**
 * The read-only query bundle used to observe a Literature target.
 *
 * Neither the preflight nor the postflight ever holds a credential. The bundle below is the exact
 * set of statements a future provider-bound capture must run; its SHA-256 is the bundle identity
 * that a provider attestation has to carry, so evidence produced by some *other* set of queries is
 * detectable.
 *
 * All four statements are wrapped in an explicitly read-only transaction. The bundle is complete:
 * running these four produces every field the evidence schema requires, with no undocumented manual
 * step — the row-count query in particular is now emitted rather than merely existing (review
 * finding L-1).
 */

import {
  LITERATURE_CATALOG_INSPECTION_SQL,
  LITERATURE_ROW_COUNT_SQL,
  canonicalJson,
  sha256,
} from './foundation-catalog'

function readOnly(statement: string): string {
  return ['begin read only;', 'set transaction read only;', statement, 'rollback;'].join('\n')
}

export const LITERATURE_READ_ONLY_HISTORY_STATEMENT = readOnly(
  [
    `select coalesce(jsonb_agg(version order by version), '[]'::jsonb)`,
    'from supabase_migrations.schema_migrations;',
  ].join('\n'),
)

export const LITERATURE_READ_ONLY_CATALOG_STATEMENT = readOnly(LITERATURE_CATALOG_INSPECTION_SQL)

export const LITERATURE_READ_ONLY_PREREQUISITE_STATEMENT = readOnly(
  `select jsonb_build_object(
     'availableExtensions', coalesce((
       select jsonb_agg(name order by name)
       from pg_catalog.pg_available_extensions
       where name = 'pg_trgm'
     ), '[]'::jsonb),
     'roles', coalesce((
       select jsonb_agg(rolname order by rolname)
       from pg_catalog.pg_roles
       where rolname in ('anon', 'authenticated', 'service_role')
     ), '[]'::jsonb),
     'schemas', coalesce((
       select jsonb_agg(nspname order by nspname)
       from pg_catalog.pg_namespace
       where nspname in ('extensions', 'public')
     ), '[]'::jsonb)
   );`,
)

/**
 * Row count across every Literature table.
 *
 * Only meaningful *after* the migration — before it, the tables do not exist and the statement
 * errors, which is itself the expected pre-application answer.
 */
export const LITERATURE_READ_ONLY_ROW_COUNT_STATEMENT = readOnly(LITERATURE_ROW_COUNT_SQL)

export interface LiteratureQueryBundleEntry {
  id: 'migrationVersions' | 'catalog' | 'prerequisites' | 'totalRowCount'
  /** The evidence field this statement populates. */
  populates: string
  statement: string
  /** True when the statement only makes sense after the migration has been applied. */
  postApplicationOnly: boolean
}

/** The complete read-only bundle, in the order an operator should run it. */
export const LITERATURE_READ_ONLY_QUERY_BUNDLE: readonly LiteratureQueryBundleEntry[] = [
  {
    id: 'migrationVersions',
    populates: 'migrationVersions',
    statement: LITERATURE_READ_ONLY_HISTORY_STATEMENT,
    postApplicationOnly: false,
  },
  {
    id: 'catalog',
    populates: 'catalog',
    statement: LITERATURE_READ_ONLY_CATALOG_STATEMENT,
    postApplicationOnly: false,
  },
  {
    id: 'prerequisites',
    populates: 'prerequisites',
    statement: LITERATURE_READ_ONLY_PREREQUISITE_STATEMENT,
    postApplicationOnly: false,
  },
  {
    id: 'totalRowCount',
    populates: 'totalRowCount',
    statement: LITERATURE_READ_ONLY_ROW_COUNT_STATEMENT,
    postApplicationOnly: true,
  },
]

/**
 * Identity of the bundle. A provider attestation must carry this value, so evidence gathered with a
 * different or truncated query set cannot be presented as the output of this contract.
 */
export const LITERATURE_QUERY_BUNDLE_SHA256 = sha256(
  canonicalJson(
    LITERATURE_READ_ONLY_QUERY_BUNDLE.map((entry) => ({
      id: entry.id,
      populates: entry.populates,
      postApplicationOnly: entry.postApplicationOnly,
      statement: entry.statement,
    })),
  ),
)

/** Render the bundle as a runnable, commented SQL script. */
export function renderLiteratureQueryBundle(): string {
  const lines: string[] = [
    '-- Read-only Literature target query bundle.',
    `-- Bundle identity (SHA-256): ${LITERATURE_QUERY_BUNDLE_SHA256}`,
    '--',
    '-- Run every statement through a project-scoped, read-only Supabase connector bound to the',
    '-- dedicated Literature project. Do NOT paste a credential anywhere, and do NOT hand-edit the',
    '-- results: a hand-assembled document is audit evidence only and can never authorize a',
    '-- migration. Target identity must come from the connector, not from this file.',
    '',
  ]
  for (const entry of LITERATURE_READ_ONLY_QUERY_BUNDLE) {
    lines.push(
      `-- [${entry.id}] populates "${entry.populates}"${
        entry.postApplicationOnly ? ' (post-application only)' : ''
      }`,
      entry.statement,
      '',
    )
  }
  return lines.join('\n')
}
