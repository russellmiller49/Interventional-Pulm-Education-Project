# Provenance layering — dedicated Literature rollout

Status: **Layer 3 is not implemented. Production migration is blocked.**

## The finding this answers

An independent review blocked the first version of this work with one observation:

> A valid observation from another disposable database, the main project, or an arbitrary hostname
> can be relabelled with `projectRef: itcttmkxdxvwmwcmzmey` and accepted.

That is correct, and it is not fixable with a checksum. **Hashing proves that bytes did not change
after hashing. It says nothing about which database produced them.** A hand-assembled JSON document
with a perfect checksum is still a document someone typed.

## The three layers

| Layer                   | What it establishes                                                                                                                    | Authoritative?                             | Implemented? |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------ |
| 1. Repository           | Branch, `HEAD == origin/main == ownerApprovedCommit`, migration path/bytes/SHA-256, exactly one selection, exact application mechanism | **Yes** — every fact is locally verifiable | Yes          |
| 2. Evidence content     | Shape and internal consistency of catalog evidence                                                                                     | **No** — cannot establish origin           | Yes          |
| 3. Provider attestation | Which database was actually observed                                                                                                   | **Yes**                                    | **No**       |

Layer 1 and Layer 2 passing means "this repository and this document are internally consistent". It
does **not** mean "the approved project is empty". Only Layer 3 can say that.

## Where Layer 3 sits in the rollout

Layer 3 is implemented and independently reviewed **before** the owner is asked to authorize the
migration — not after it, and not alongside it. The reason is the finding above: until a
provider-bound adapter exists, no one can say which database an observation came from, so an
authorization granted earlier would be an authorization to act on evidence that cannot be
attributed. The nine steps, identical in every document:

1. Merge this preparation PR after independent review.
2. Implement and independently review Layer 3.
3. Obtain the exact owner migration authorization.
4. Run the provider-bound preflight.
5. Apply exactly the foundation migration.
6. Run the provider-bound postflight, and stop.
7. Implement and deploy capability gating, while the runtime stays disabled.
8. Obtain the Railway authorization and cut over.
9. Stop, before any canary or ingestion.

Step 5 is a provider operation through the approved mechanism. The CLIs in this repository cannot
perform it and are not a route to it: they hold no credential, open no connection, apply nothing,
and exit nonzero on every invocation. See the
[rollout runbook](./dedicated-supabase-rollout-runbook.md) for the operational detail.

## Why Layer 3 is deliberately absent

Implementing it honestly requires an authenticated, project-scoped, read-only Supabase adapter.
Adding an OAuth/PAT/secret workflow inside a preparation-only PR would be unreviewed, out of scope,
and would put a credential path into a repository that currently has none.

So `captureLiteratureProviderAttestation()` is a seam that always reports
`provider_adapter_not_implemented`, and every production-authorizing path fails closed with
`provider_attestation_required`. **A safe, honestly blocked gate is better than false provenance.**

No cryptographic provenance is claimed. There is no signature primitive here, and the code does not
pretend otherwise.

## What a real attestation must bind

The second independent review established that no exported type or evaluator may represent a
satisfied attestation while the adapter is absent — a structurally typed object is always forgeable
through a cast or a deserialized fixture. The future bindings therefore live only as inert data
(`LITERATURE_LAYER3_REQUIRED_BINDINGS`): nothing consumes them as an input, and holding a value
shaped like them grants nothing. When Layer 3 is implemented — in its own, separately reviewed
PR — the adapter must bind all of:

- the capture mechanism, exactly `supabase_project_scoped_read_only_mcp_v1`
- the project ref, **from the adapter context**, never from a document body
- the provider-returned project URL
- the identity (SHA-256) of the exact phase query plan that produced the evidence
- the owner-approved repository commit
- the migration path and SHA-256
- the capture timestamp, checked against a 10-minute freshness window
- the canonical checksum of the evidence content
- capture completeness — anything but complete fails
- migration history taken from the provider's project-scoped `list_migrations` operation, never
  from a manually fabricated SQL result

The capture channel must be project-scoped to `itcttmkxdxvwmwcmzmey`, read-only, without
account-wide project selection during capture, and without any mutating tool in scope.

## Structural anti-relabelling

Two independent mechanisms, not one:

1. **The evidence body cannot name its own target.** There is no `projectRef` or `hostname` field in
   the schema, and the schema is `.strict()`, so a document that adds one is rejected as carrying an
   unknown field. Relabelling is not merely detected — it is unrepresentable.
2. **Identity comes from the adapter.** `providerProjectRef` originates in the connector context and
   is compared against the manifest's approved ref.

## What a persisted observation is

Audit evidence. Nothing more.

A sanitized observation file may be attached to a receipt for later reading. It is **not
re-ingestible** to produce an authoritative PASS: feeding it back through the preflight yields
`provider_attestation_required`, and feeding it through the postflight yields
`provider_attestation_required` as a _classification_, not a warning appended to a success.

The verdict names were chosen so no caller can misread them, and the unions contain **no success
member at all** — the second correction removed `ready_to_apply`, `applied_correct`, and `proceed`
from production code entirely rather than trying to guard them:

- preflight: `blocked` or `provider_attestation_required`, with layer summaries
  `repository_checks_passed_nonauthoritative` / `content_checks_passed_nonauthoritative`
- postflight: classification `provider_attestation_required`, next action
  `stop_read_only_reconciliation`, plus a `*_nonauthoritative` content assessment
  (e.g. `catalog_matches_expected_nonauthoritative`)

The future provider-adapter PR will introduce the first success-capable verdict, under its own
independent review.

## Migration-history fidelity

The postflight does **not** assert that the recorded migration version equals `20260727032621`.
That is the historical _filename_ version. Supabase's `apply_migration` takes a migration _name_ and
the provider assigns the stored version, commonly a capture-time timestamp. Proving the exact
semantics would require a remote write, which is not authorized here.

So the contract binds what is knowable — **exactly one recorded migration** — and defers version
identity to execution-time evidence carried by the attestation, together with the applied-SQL
checksum. `LITERATURE_MIGRATION_HISTORY_FIDELITY` states this in code so a future session cannot
silently inherit the assumption. Migration history is never written or repaired to make it match.

## Related

- [Architecture](./dedicated-supabase-architecture.md)
- [Rollout runbook](./dedicated-supabase-rollout-runbook.md)
- [Threat model](./dedicated-supabase-threat-model.md)
- [Review handoff](./dedicated-supabase-codex-review-handoff.md)
