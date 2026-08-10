# Gold import contract V2 protected-application threat model

## Summary

This model covers the local, migration-only workflow that may eventually apply protected contract
V2 to the dedicated Literature Supabase database. Its security objective is safe operation by an
authorized, trusted local operator: prevent accidental application, wrong-target use, stale or
incomplete capture, unintended replay, repository/runtime drift, and silent catalog drift. It does
not claim resistance to a malicious authorized operator who controls both the filesystem and
Docker/database administration.

The exact trust-model identity is
`trusted-local-operator-redundant-captures/1.0.0`. Commit mode requires the exact attestation:

`I ATTEST THESE ARE TWO SEPARATE READ-ONLY BACKUP CAPTURES`

## Scope

In scope:

- ordinary local prepare/start/status/stop/reset protection while V2 is absent;
- protected V2 diagnostic, authorization, sealed intent, staging, application, complete catalog
  audit, final receipt, and lost-ack reconciliation;
- local repository, generated Supabase workdir, dedicated local database, redundant captures, and
  application receipt directory;
- preservation of review, pointer, reveal, operation/action, import/compensation, and effective
  clinical state during the schema-only transition.

Out of scope:

- a malicious authorized local operator or process with the same filesystem and Docker/database
  authority;
- remote attestation, a second principal, hardware-backed approval, or an external evidence service;
- later import/package execution and later compensation, which require separate contracts and
  authorizations;
- remote databases and held-out identities, which this workflow forbids accessing.

## System overview

Ordinary lifecycle commands expose only migrations through V1 while V2 is absent. The protected
operator re-reads a clean primary `main`, the exact local database, and two separately executed
read-only captures; validates a checksum-bound migration-only authorization; exclusively seals an
immutable intent and conservative tracked operator-bundle identity; stages V2; invokes local migration-up once;
proves a schema-only exact-once transition; executes one complete REPEATABLE READ READ ONLY catalog
audit; and atomically adds a finalized receipt. Reconciliation starts from the sealed intent and an
already-applied exact ledger, never stages or invokes migration-up.

## Assets

- V1 migration history and its exact unchanged bytes.
- V2 migration and verifier source identities.
- Development membership, planning, effective, physical, review, pointer, and reveal state.
- Immutable operation/action/event and review-history protections.
- Source artifacts, signed authorizations, note dispositions, and package gates.
- Sealed authorization, intent bytes, protected-operator bundle, post-application audit, and receipt.
- The guarantee that migration application grants no import or compensation capability.
- The held-out/test split and remote databases, which must remain untouched.

## Trust boundaries

1. **Human/operator to CLI.** The operator supplies identity, two paths, exact confirmation,
   attestation, and output path. The operator is trusted but mistakes are expected.
2. **Repository to generated workdir.** Exact committed protected bytes may be copied only after
   intent sealing. Ordinary startup excludes absent V2.
3. **Host filesystem to local Docker database.** The workflow accepts only the pinned local project,
   container, loopback port, and database. The same trusted operator administers both sides.
4. **Pre-application state to sealed intent.** Repository, database, capture, authorization, and
   operator-bundle identities become immutable recovery inputs.
5. **Applied database to receipt.** A complete read-only catalog audit and schema-only state bracket
   must pass before finalization.
6. **Migration receipt to later data operations.** The receipt is evidence only; it crosses no import
   or compensation authorization boundary.

There is no separate trust boundary between a same-user capture receipt and its local duplicate
marker. Both are controlled by the trusted local operator.

## Attacker and failure capabilities

The expected failure actor can select a wrong path, reuse stale files, accidentally copy a directory,
omit output, run an ordinary lifecycle command, lose a process acknowledgement, or operate after
unrelated mainline advancement. A local development process may modify repository/runtime files or
generated migration inventory.

The authorized operator can also, by assumption, read and write local files, run repository builders,
administer Docker/PostgreSQL, recompute all unkeyed evidence, or bypass the CLI. Such deliberate
behavior is outside the claimed boundary. Local nonces, timestamps, chmod modes, inodes, receipts,
and markers do not change that capability.

## Entry points

- `literature:local:{prepare,start,status,stop,reset}`;
- `literature:diagnose-gold-import-compensation-v2-preapplication`;
- `literature:apply-protected-gold-import-contract-v2` dry-run, commit, and reconciliation modes;
- ignored generated Supabase migrations and local capture/receipt paths;
- git branch/HEAD/origin state, exact committed expectations, and the protected tracked superset;
- the dedicated local Docker/PostgreSQL catalog and migration ledger.

## Abuse paths and controls

| ID  | Abuse or failure path                                                          | Impact                                                 | Control and disposition                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Ordinary start/reset sees absent V2                                            | Unauthorized schema application                        | V2 is excluded from ordinary inventory; ledger ambiguity and staged-byte drift fail closed.                                                                                                                                                                                                          |
| T2  | Wrong, remote, or linked database target                                       | Mutation outside the dedicated local database          | Exact project/container/port checks; no URL or remote target input; remote and held-out access recorded false.                                                                                                                                                                                       |
| T3  | Stale, partial, duplicate, aliased, or accidentally copied capture             | Inadequate recovery evidence                           | Two distinct realpaths, IDs, nonces, receipts, timestamps, manifests, ledgers, state and repository bindings, local duplicate markers, freshness limit, and exact attestation.                                                                                                                       |
| T4  | Malicious same-user operator recomputes both captures and markers              | Fabricated local evidence                              | Explicitly possible and out of scope. Mitigation would require another principal/service; none is claimed or added.                                                                                                                                                                                  |
| T5  | Mutation occurs before recoverable intent                                      | Applied migration with no authoritative recovery input | Exclusive immutable intent is fully sealed before staging or migration-up.                                                                                                                                                                                                                           |
| T6  | Lost acknowledgement leads to retry                                            | Duplicate or ambiguous migration execution             | Commit is never retried. Reconciliation requires exact applied-once ledger, makes zero migration calls, and records `migrationReexecuted=false`.                                                                                                                                                     |
| T7  | `main` advances after intent                                                   | Recovery blocked or unsafe new code used               | Intent commit must be an ancestor of clean current `main == origin/main`; exact expected artifacts and the conservative Git-tracked bundle (config, package, sources, migration, verifier, module/runtime audits) must be unchanged. Documentation-only descendants can pass; protected drift fails. |
| T8  | Count-preserving catalog drift or a self-generated/profile-crossed expectation | Weakened database contract accepted                    | Observed hashes are descriptive. Only the exact committed profile artifact authorizes readiness; seven components, deployment/full-inventory/full-audit/model identities are context-bound, and the disposable drift matrix must reject every exact ordered probe.                                   |
| T9  | Receipt implies the write-capable verifier ran real-locally                    | Misstated assurance or unintended writes               | Verifier source SHA is pinned, but the receipt records `verifierExecuted=false` and `auditMethod=complete_read_only_catalog_identity`.                                                                                                                                                               |
| T10 | Migration receipt is reused to import or compensate                            | Unauthorized clinical/data mutation                    | Capability is migration-only; intent/result explicitly bind `importAuthorized=false` and `compensationAuthorized=false`; later gates ignore receipt possession as authorization.                                                                                                                     |
| T11 | Schema transition changes review, pointer, reveal, or effective state          | Clinical/source integrity loss                         | Exact before/after hashes and zero operation/action/import/compensation counts are required; any change blocks finalization.                                                                                                                                                                         |
| T12 | Source, signed authorization, note, or status is fabricated                    | Provenance and medical-review integrity loss           | Protected application reads no finalized source/package authorization and grants no data-operation capability; existing source/note/package contracts remain separate and exact.                                                                                                                     |

## Mitigation map

- Startup gating: T1, T6.
- Fixed local target and environment scrubbing: T2, T12.
- Redundant capture integrity and exact attestation: T3; explicitly not T4.
- Intent-before-mutation and atomic finalization: T5, T6.
- Commit ancestry plus exact expectation and conservative bundle identity: T7.
- Complete catalog identity and disposable drift matrix: T8, T9.
- Migration-only capability and state brackets: T10–T12.

## Risk rating

- T1, T2, T5–T8, T10–T12 are high impact and must fail closed; their residual likelihood is low
  when the trusted workflow is followed.
- T3 is medium impact and reduced by redundant captures and exact bindings.
- T9 is a medium assurance risk and eliminated by explicit receipt semantics.
- T4 would be critical under an adversarial-operator model, but that actor violates the workflow's
  foundational trust assumption. The residual risk is accepted and stated, not cryptographically
  mitigated.

## Residual risks

- A malicious or compromised authorized operator can fabricate or bypass all local evidence.
- Host or Docker compromise can alter the database outside this CLI.
- Catastrophic interruption after database commit but before intent durability is addressed by the
  intent-before-mutation order; storage failure that violates filesystem durability remains a host
  risk.
- Future protected dependencies must be captured by module resolution or an explicit runtime-input
  declaration. Unsupported dynamic acquisition fails closed; it cannot silently fall outside the
  conservative tracked bundle.

## Assumptions and review triggers

- The operator is authorized, trusted, and follows the exact command/runbook sequence.
- The primary checkout and configured origin identify the reviewed repository.
- The dedicated local Supabase role inventory matches one of the supported profiles.
- V1 occurs exactly once and V2 is absent before commit or exact-once applied before reconciliation.
- Any proposal to resist the authorized operator, use a remote service, change principals, access
  held-out identities, contact a remote database, or authorize import/compensation requires a new
  threat model and separate review.
