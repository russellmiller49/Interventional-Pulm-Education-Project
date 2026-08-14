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

When Layer 3 is implemented, `LiteratureProviderAttestation` must carry all of:

- `mechanism` — exactly `supabase_project_scoped_read_only_mcp_v1`
- `providerProjectRef` — **from the adapter context**, never from a document body
- `providerProjectUrl` — the provider-returned identity
- `queryBundleSha256` — identity of the exact read-only bundle that produced the evidence
- `repositoryCommit` — the owner-approved commit
- `migrationPath` and `migrationSha256`
- `capturedAt` — checked against a 10-minute freshness window
- `contentSha256` — recomputed locally from the evidence
- `completeness` — anything but `complete` fails

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

The verdict names were chosen so no caller can misread them:

- `blocked`
- `repository_checks_passed_nonauthoritative`
- `provider_attestation_required`
- `ready_to_apply` — unreachable today

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
