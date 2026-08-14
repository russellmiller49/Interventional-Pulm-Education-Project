/**
 * The read-only observation of a remote Literature target.
 *
 * Neither the preflight nor the postflight ever holds a credential. The operator opens a read-only
 * session against the target, runs the two statements this module emits, and saves the results into
 * a small JSON document; the verifiers then evaluate that document offline. Keeping the credential
 * out of the verifier entirely means there is no code path in this repository that could log it,
 * write it to an artifact, or send it anywhere.
 *
 * Both emitted statements are wrapped in an explicitly read-only transaction, so a target cannot be
 * mutated even by accident.
 */

import { LITERATURE_CATALOG_INSPECTION_SQL } from './foundation-catalog'
import type { LiteratureCatalogSnapshot } from './foundation-catalog'

/**
 * The catalog statement, wrapped read-only. `BEGIN READ ONLY` plus the redundant
 * `SET TRANSACTION READ ONLY` makes the intent explicit and survives a client that opens its own
 * transaction; `ROLLBACK` guarantees nothing is left open.
 */
export const LITERATURE_READ_ONLY_CATALOG_STATEMENT = [
  'begin read only;',
  'set transaction read only;',
  LITERATURE_CATALOG_INSPECTION_SQL,
  'rollback;',
].join('\n')

export const LITERATURE_READ_ONLY_HISTORY_STATEMENT = [
  'begin read only;',
  'set transaction read only;',
  `select coalesce(jsonb_agg(version order by version), '[]'::jsonb)`,
  'from supabase_migrations.schema_migrations;',
  'rollback;',
].join('\n')

/**
 * Statement listing every extension and role the foundation migration depends on, so a preflight
 * can prove the prerequisites exist before anything is applied.
 */
export const LITERATURE_READ_ONLY_PREREQUISITE_STATEMENT = [
  'begin read only;',
  'set transaction read only;',
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
  'rollback;',
].join('\n')

export interface LiteratureTargetObservation {
  /** The project ref the operator connected to, recorded by hand from the connection URL. */
  projectRef: string
  /** Hostname of the target, so loopback presented as production can be refused. */
  hostname?: string
  /** Result of LITERATURE_READ_ONLY_HISTORY_STATEMENT. */
  migrationVersions: string[]
  /** Result of LITERATURE_READ_ONLY_CATALOG_STATEMENT. */
  catalog: LiteratureCatalogSnapshot
  /** Result of LITERATURE_READ_ONLY_PREREQUISITE_STATEMENT. Required by the preflight. */
  prerequisites?: {
    availableExtensions: string[]
    roles: string[]
    schemas: string[]
  }
  /** Total rows across Literature tables. Required by the postflight. */
  totalRowCount?: number
}

const SECRET_SHAPED = /(?:sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]{10,})/u

/**
 * Reject an observation document that carries anything credential-shaped. The observation is an
 * artifact an operator may attach to a receipt, so it must be provably free of secrets.
 */
export function assertObservationCarriesNoSecret(raw: string) {
  if (SECRET_SHAPED.test(raw)) {
    throw new Error(
      'The observation document contains a credential-shaped value. Remove it; the verifiers ' +
        'never need a credential.',
    )
  }
}

export function parseTargetObservation(raw: string): LiteratureTargetObservation {
  assertObservationCarriesNoSecret(raw)
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The observation document must be a JSON object.')
  }
  const value = parsed as Record<string, unknown>
  if (typeof value.projectRef !== 'string') {
    throw new Error('The observation document must record the projectRef that was inspected.')
  }
  if (!Array.isArray(value.migrationVersions)) {
    throw new Error('The observation document must record migrationVersions.')
  }
  if (!value.catalog || typeof value.catalog !== 'object') {
    throw new Error('The observation document must record the catalog snapshot.')
  }
  return value as unknown as LiteratureTargetObservation
}
