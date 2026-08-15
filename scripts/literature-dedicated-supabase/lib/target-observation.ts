/**
 * Phase-specific, existence-safe read-only query plans for observing a Literature target (L-1).
 *
 * The first design published one four-statement "bundle" whose statements referenced
 * `supabase_migrations.schema_migrations` and `public.literature_articles` directly. On a
 * brand-new project neither relation exists, so the bundle errored instead of returning absence
 * evidence — inviting the operator to fabricate the missing fields by hand. There are now three
 * ordered plans, each with its own canonical identity, and no statement in any plan references a
 * relation whose existence the plan has not already established:
 *
 *   1. **Preflight plan** — safe on a completely empty project. Existence probes and
 *      `pg_catalog`-only inspection. The migration-history *versions* statement is conditional:
 *      it runs only when the probe proved the history table present. In the future authoritative
 *      gate, migration history comes from the provider's project-scoped `list_migrations`
 *      operation, never from a manually assembled SQL result.
 *   2. **Postflight existence probe** — establishes which foundation relations and which history
 *      table actually exist, before anything touches them.
 *   3. **Postflight complete plan** — history versions, full catalog, prerequisites, and the row
 *      count. Valid only after the probe proved the referenced relations present.
 *
 * Each plan's SHA-256 is the identity a future provider attestation must carry, so evidence
 * produced by a different, truncated, or substituted query set is detectable — and the three
 * identities are distinct by construction, so a preflight capture cannot be replayed as a
 * postflight capture.
 *
 * Neither the preflight nor the postflight ever holds a credential, and because Layer 3 is not
 * implemented in this PR, no output of any of these plans can authorize anything.
 */

import {
  LITERATURE_CATALOG_INSPECTION_SQL,
  LITERATURE_ROW_COUNT_SQL,
  canonicalJson,
  sha256,
} from './foundation-catalog'
import { LITERATURE_FOUNDATION_TABLES } from '../../../src/features/literature/dedicated-supabase/catalog-expectations'

function readOnly(statement: string): string {
  return ['begin read only;', 'set transaction read only;', statement, 'rollback;'].join('\n')
}

/** Existence probe for the migration-history table. `pg_catalog` only; safe on an empty project. */
export const LITERATURE_HISTORY_TABLE_EXISTENCE_STATEMENT = readOnly(
  [
    'select exists (',
    '  select 1',
    '  from pg_catalog.pg_class as c',
    '  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace',
    "  where n.nspname = 'supabase_migrations'",
    "    and c.relname = 'schema_migrations'",
    "    and c.relkind = 'r'",
    ') as history_table_exists;',
  ].join('\n'),
)

/**
 * Migration versions. References `supabase_migrations.schema_migrations` directly, so it is valid
 * **only after** `LITERATURE_HISTORY_TABLE_EXISTENCE_STATEMENT` returned true.
 */
export const LITERATURE_HISTORY_VERSIONS_STATEMENT = readOnly(
  [
    `select coalesce(jsonb_agg(version order by version), '[]'::jsonb)`,
    'from supabase_migrations.schema_migrations;',
  ].join('\n'),
)

/** Existence probe for the eight foundation tables. `pg_catalog` only. */
export const LITERATURE_FOUNDATION_TABLE_EXISTENCE_STATEMENT = readOnly(
  [
    `select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)`,
    'from pg_catalog.pg_class as c',
    'join pg_catalog.pg_namespace as n on n.oid = c.relnamespace',
    "where n.nspname = 'public'",
    "  and c.relkind = 'r'",
    `  and c.relname in (${LITERATURE_FOUNDATION_TABLES.map((table) => `'${table}'`).join(', ')});`,
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
 * Row count across every Literature table. References the tables directly, so it belongs only to
 * the postflight complete plan, after the existence probe proved every table present.
 */
export const LITERATURE_READ_ONLY_ROW_COUNT_STATEMENT = readOnly(LITERATURE_ROW_COUNT_SQL)

export interface LiteratureQueryPlanStep {
  id: string
  /** The evidence field this statement populates. */
  populates: string
  statement: string
  /**
   * When set, this step runs only if the named prior step returned true. Statements that
   * reference optional relations are always conditional on an existence probe.
   */
  conditionalOnProbe?: string
}

export interface LiteratureQueryPlan {
  /** Distinct phase identity. The plans are not interchangeable. */
  planId:
    | 'literature-preflight-observation-plan/3.0.0'
    | 'literature-postflight-existence-probe/3.0.0'
    | 'literature-postflight-observation-plan/3.0.0'
  description: string
  steps: readonly LiteratureQueryPlanStep[]
}

/**
 * Preflight: runs safely when the migration-history relation and every Literature relation are
 * absent. Only existence probes and `pg_catalog` inspection; the versions step is conditional.
 */
export const LITERATURE_PREFLIGHT_QUERY_PLAN: LiteratureQueryPlan = {
  planId: 'literature-preflight-observation-plan/3.0.0',
  description:
    'Existence-safe pre-application observation. Populates the preflight evidence document ' +
    '(literature-dedicated-preflight-observation/3.0.0). No statement references an optional ' +
    'relation unconditionally.',
  steps: [
    {
      id: 'historyTableExists',
      populates: 'migrationHistory.tableExists',
      statement: LITERATURE_HISTORY_TABLE_EXISTENCE_STATEMENT,
    },
    {
      id: 'historyVersions',
      populates: 'migrationHistory.versions (null when the table does not exist)',
      statement: LITERATURE_HISTORY_VERSIONS_STATEMENT,
      conditionalOnProbe: 'historyTableExists',
    },
    {
      id: 'catalog',
      populates: 'catalog',
      statement: LITERATURE_READ_ONLY_CATALOG_STATEMENT,
    },
    {
      id: 'prerequisites',
      populates: 'prerequisites',
      statement: LITERATURE_READ_ONLY_PREREQUISITE_STATEMENT,
    },
  ],
}

/** Postflight step one: prove what exists before anything references it. */
export const LITERATURE_POSTFLIGHT_EXISTENCE_PROBE_PLAN: LiteratureQueryPlan = {
  planId: 'literature-postflight-existence-probe/3.0.0',
  description:
    'Post-application existence probe. Populates existenceProbe in the postflight evidence ' +
    'document. pg_catalog only; must run and be evaluated before the complete plan.',
  steps: [
    {
      id: 'historyTableExists',
      populates: 'existenceProbe.migrationHistoryTableExists',
      statement: LITERATURE_HISTORY_TABLE_EXISTENCE_STATEMENT,
    },
    {
      id: 'presentLiteratureTables',
      populates: 'existenceProbe.presentLiteratureTables',
      statement: LITERATURE_FOUNDATION_TABLE_EXISTENCE_STATEMENT,
    },
  ],
}

/**
 * Postflight step two: the complete observation. Every step that references a Literature relation
 * or the history table is conditional on the corresponding probe result.
 */
export const LITERATURE_POSTFLIGHT_QUERY_PLAN: LiteratureQueryPlan = {
  planId: 'literature-postflight-observation-plan/3.0.0',
  description:
    'Post-application complete observation. Populates the postflight evidence document ' +
    '(literature-dedicated-postflight-observation/3.0.0). Runs only after the existence probe; ' +
    'the row count runs only when every foundation table was proven present.',
  steps: [
    {
      id: 'historyVersions',
      populates: 'migrationVersions',
      statement: LITERATURE_HISTORY_VERSIONS_STATEMENT,
      conditionalOnProbe: 'historyTableExists',
    },
    {
      id: 'catalog',
      populates: 'catalog',
      statement: LITERATURE_READ_ONLY_CATALOG_STATEMENT,
    },
    {
      id: 'prerequisites',
      populates: 'prerequisites',
      statement: LITERATURE_READ_ONLY_PREREQUISITE_STATEMENT,
    },
    {
      id: 'totalRowCount',
      populates: 'totalRowCount',
      statement: LITERATURE_READ_ONLY_ROW_COUNT_STATEMENT,
      conditionalOnProbe: 'presentLiteratureTables',
    },
  ],
}

function planIdentity(plan: LiteratureQueryPlan): string {
  return sha256(
    canonicalJson({
      planId: plan.planId,
      steps: plan.steps.map((step) => ({
        id: step.id,
        populates: step.populates,
        statement: step.statement,
        conditionalOnProbe: step.conditionalOnProbe ?? null,
      })),
    }),
  )
}

/** Identity of the preflight plan. Preflight evidence must carry exactly this value. */
export const LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256 = planIdentity(LITERATURE_PREFLIGHT_QUERY_PLAN)

/** Identity of the postflight existence probe. */
export const LITERATURE_POSTFLIGHT_EXISTENCE_PROBE_SHA256 = planIdentity(
  LITERATURE_POSTFLIGHT_EXISTENCE_PROBE_PLAN,
)

/** Identity of the postflight complete plan. Postflight evidence must carry exactly this value. */
export const LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256 = planIdentity(
  LITERATURE_POSTFLIGHT_QUERY_PLAN,
)

/** Render every plan as a commented, runnable SQL script. */
export function renderLiteratureQueryPlans(): string {
  const lines: string[] = [
    '-- Read-only Literature target query plans, by phase.',
    '--',
    '-- Run statements through a project-scoped, read-only Supabase connector bound to the',
    '-- dedicated Literature project. Do NOT paste a credential anywhere, and do NOT hand-edit',
    '-- the results: a hand-assembled document is audit evidence only and can never authorize a',
    '-- migration. Target identity must come from the connector, not from this file. In the',
    '-- future authoritative gate, migration history comes from the provider list_migrations',
    '-- operation rather than these SQL dumps.',
    '',
  ]
  const plans: readonly { plan: LiteratureQueryPlan; identity: string }[] = [
    { plan: LITERATURE_PREFLIGHT_QUERY_PLAN, identity: LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256 },
    {
      plan: LITERATURE_POSTFLIGHT_EXISTENCE_PROBE_PLAN,
      identity: LITERATURE_POSTFLIGHT_EXISTENCE_PROBE_SHA256,
    },
    { plan: LITERATURE_POSTFLIGHT_QUERY_PLAN, identity: LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256 },
  ]
  for (const { plan, identity } of plans) {
    lines.push(
      `-- ============ ${plan.planId} ============`,
      `-- Plan identity (SHA-256): ${identity}`,
      `-- ${plan.description}`,
      '',
    )
    for (const step of plan.steps) {
      lines.push(
        `-- [${step.id}] populates "${step.populates}"${
          step.conditionalOnProbe
            ? ` (run ONLY if probe "${step.conditionalOnProbe}" allows it)`
            : ''
        }`,
        step.statement,
        '',
      )
    }
  }
  return lines.join('\n')
}
