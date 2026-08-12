# PR #97 four-blocker correction contract

This document records the source/evidence correction made on draft PR #97. It is implementation
evidence only. It does not authorize a real capture, package, import, or compensation operation.

## Confirmed defects and exact corrections

1. Fixed-local target constants previously described the intended target without proving the
   runtime connection. The shared `fixed-local-target-observation/1.0.0` contract now brackets every
   database collection with module-owned Docker observations and binds the exact local Unix Docker
   endpoint, independently reviewed container ID
   `906d62f9e2b5ac7c58742090566e87f8d2a36199ee897b09bb5c1b7727e286a8` and hostname
   `906d62f9e2b5` as continuity anchors, immutable image/project/network/port identity, Unix
   PostgreSQL transport, database/users/port/socket, transaction mode, and mutually consistent
   container/postmaster lifecycle. Expected profile classification remains explicitly non-observed
   and is accepted only with the exact local catalog authority.
2. The delivery backup was still semantically rooted in PR #95. The current PR #97 backup is a new
   `literature-gold-v2-postmigration-delivery-backup/1.0.0` authority over this branch, frozen base,
   exact pushed HEAD, current capture/readiness/rehearsal runtime closure and source bytes, finalized
   receipt authority, changed tracked files, and named evidence. The original PR #95 verifier is
   unchanged except for an explicit `historical_pr95_only` scope and remains callable only through a
   historical package script.
3. The shared backup/rehearsal assumptions accepted only exact rehearsal `2.0` while current
   rehearsal emits `2.1`. One compatibility matrix and strict `2.1` parser now govern current
   capture, pair, readiness, generation-readiness, rehearsal, receipt, and backup consumers. It
   never relabels old evidence and rejects missing, arbitrary, future, changed, or unknown shapes.
4. Initial database evidence could age while slow output was constructed. Capture, production
   package generation, and production rehearsal now stage first, perform a fresh final
   repeatable-read/read-only observation, compare exact state and target identity, reauthenticate
   non-database authorities, write the bracket/manifest, and publish with one same-parent rename.
   Package generation independently reloads both captures and reobserves current database state.

## Observed target versus expected configuration

Observed identity includes Docker context name/endpoint/TLS mode, container ID/name/hostname,
running/healthy/restart/start state, image reference/image ID/manifest digest, Compose and Supabase
project labels, network, published IPv4/IPv6 bindings, PostgreSQL database/current and session users,
configured internal port, Unix socket directory and null TCP address/port observations, transaction
isolation/read-only mode, and postmaster start time. Before and after Docker snapshots must match;
the database timestamp must fall between them; the postmaster and container start times must agree.

Expected configuration includes the profile name and expected catalog. The profile is not directly
observable from PostgreSQL, is labeled `expectedProfileDirectlyObserved=false`, and cannot prove the
connection. Caller-supplied target facts and Docker/psql arguments are not accepted.

Persisted target identities are not trusted merely because they parse. Their canonical SHA-256 is
recomputed, nested target observations rerun the full semantic validator, and readiness, capture,
publication-bracket, package, rehearsal, and backup boundaries compare the complete derived target
identity. Changing a container fact while retaining or recomputing only outer hashes fails closed.

## Compatibility matrix

| Artifact                     | Exact current version                                           |
| ---------------------------- | --------------------------------------------------------------- |
| Capture                      | `literature-gold-v2-preimport-capture/1.1.0`                    |
| Capture pair                 | `literature-gold-v2-preimport-capture-pair/1.1.0`               |
| Package readiness            | `literature-gold-v2-package-readiness/1.1.0`                    |
| Package-generation readiness | `literature-gold-v2-package-generation-readiness/1.1.0`         |
| Package generator            | `gold-import-compensation-package-generator/2.0.0`              |
| Package                      | `gold-import-compensation-package/1.0.0`                        |
| Exact rehearsal              | `gold-import-compensation-exact-package-rehearsal/2.1.0`        |
| Finalized receipt evidence   | `literature-gold-v2-finalized-migration-receipt-evidence/1.0.0` |
| PR #97 delivery backup       | `literature-gold-v2-postmigration-delivery-backup/1.0.0`        |

Historical PR #95 remains the exact tuple
`gold-import-contract-v2-forward-repair-backup/2.0.0` plus
`gold-import-compensation-exact-package-rehearsal/2.0.0`. The tuples are intentionally
non-interchangeable.

## Publication ordering and residual limitation

The published bracket proves initial observation before staging, final observation after staging,
authorization after final observation, and atomic rename after authorization. It binds both full
target observations, database-state identities, finalized receipt authority, ledger occurrence,
zero-operation counts, state hashes, transaction modes, and staged payload.

The protocol honestly retains one micro-window: a database commit after final observation and before
filesystem rename cannot be excluded without a cross-system lock. No artifact claims otherwise.
Every later consumer must independently reobserve current state, including package generation after
capture loading and production rehearsal before publication. The adversarial matrix injects drift
at eight distinct boundaries: after initial collection, during construction, after capture staging,
before the capture final observation, after capture publication, between the two capture loads,
after readiness staging, and before the package final observation. The two post-capture cases fail
at the prior-consumer gate before new output construction begins.

## Non-authorizing lifecycle

The only valid sequence remains finalized V2 receipt, capture 1, capture 2, pair verification,
current package readiness, unsigned package generation, package rehearsal, separate signed import
authorization, import execution, and later separate compensation authorization. All generated
authorization templates keep `notExecutable=true`, `importAuthorized=false`, and
`compensationAuthorized=false`. Feature-branch code cannot create the real capture pair or real
package; those operations require merged clean primary `main` at exact `origin/main`.
