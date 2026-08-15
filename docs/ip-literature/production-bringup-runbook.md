# Literature production bring-up: verification runbook

**Status:** verification tooling only. Nothing in this document authorizes a Railway change, a
deployment, a canary, or an import. Every command here is read-only.

**Target:** the dedicated Literature Supabase project `IP_Literature`
(`itcttmkxdxvwmwcmzmey`). The foundation migration is applied. The main application project
(`Endoreels`, `tqnhxlwvkkswuckszlee`) keeps authentication and site-admin identity and must never
hold Literature data.

---

## Read this first: what the deployed application can and cannot do today

The three Railway variables do **not** turn the Literature runtime on.

`LITERATURE_PRODUCTION_RUNTIME_ACTIVATION` in
[`src/features/literature/server/dedicated-project-contract.ts`](../../src/features/literature/server/dedicated-project-contract.ts)
is a **source constant**, currently `'not_activated'`. With a byte-perfect production
configuration, `resolveLiteratureDedicatedBinding` returns `not_activated` rather than `bound`,
`createLiteratureAdmin()` returns `null`, and every Literature route answers "not configured".
This is deliberate — it is the third review's fix for a design where setting variables would have
activated privileged remote mutation with no reviewed change in between.

The consequence for planning:

| Bring-up state                                    | Reachable today | Needs                                                  |
| ------------------------------------------------- | --------------- | ------------------------------------------------------ |
| Database verification (scenarios 2–8 below)       | **Yes**         | the three variables exported in your shell             |
| Application reports "not configured" (scenario 1) | **Yes**         | a deployment, an admin cookie, and the three variables |
| Application serves Literature records to an admin | **No**          | step 7 of the rollout sequence                         |

Every scenario resolves the database target first, so the three variables must be exported even for
the application-only scenario — the tool refuses to run against a configuration it cannot identify.

Step 7 of the canonical sequence in
[`dedicated-supabase-rollout-runbook.md`](./dedicated-supabase-rollout-runbook.md) is
"Implement and deploy capability gating, while the runtime stays disabled." That package is the
first change permitted to set the activation constant, and it must ship and be reviewed before
step 8, "Obtain the Railway authorization and cut over."

**So the Monday demo of 25 draft records in the admin UI depends on the capability-gating package
existing.** If it has not shipped, the honest Monday state is scenario 1 — a deployment that
truthfully declines — and the database evidence in scenarios 2–8, which the tool below produces
without the application being involved at all. Plan for that, or land step 7 first. See
[`production-bringup-monday-smoke.md`](./production-bringup-monday-smoke.md).

---

## The tool

One command, eight scenarios, `GET` requests only.

```bash
npx tsx scripts/literature-production-verify/verify.ts --scenario foundation-empty
```

It is read-only by construction, not by convention:

- The transport allows `GET` and `HEAD` and refuses every other method before a URL is built.
- PostgREST refuses `GET` on a `VOLATILE` function, so no mutating RPC is reachable even by a
  bug. `curate_literature_article_v1` and the gold-workflow writers are also refused by name.
- No request carries a body. No Supabase client is constructed. `createLiteratureAdmin` is neither
  imported nor called.

Credentials come from the environment only. A credential passed as an argument stops the run
before anything is read — a value on the command line is visible in `ps`, in shell history, and in
CI logs that this tool does not control.

### Environment

Required:

```
LITERATURE_SUPABASE_URL=https://itcttmkxdxvwmwcmzmey.supabase.co/
LITERATURE_SUPABASE_SECRET_KEY=<sb_secret_… from the IP_Literature dashboard>
LITERATURE_SUPABASE_EXPECTED_PROJECT_REF=itcttmkxdxvwmwcmzmey
```

The URL is compared byte for byte, trailing slash included. No trimming, no case folding, no
`:443`, no dot path.

For the application-layer scenarios (1, 4, 7):

```
LITERATURE_VERIFY_APP_BASE_URL=https://<the deployed origin>
LITERATURE_VERIFY_ADMIN_COOKIE=<a site-admin session cookie header>
```

The base URL must be `https:` for any non-loopback host. `LITERATURE_VERIFY_ADMIN_COOKIE` is a live
admin session, and it is withheld rather than sent in the clear over `http:` — the checks that need
it then report no verdict, which is the right price.

`LITERATURE_VERIFY_ADMIN_COOKIE` is **required** for `V90-runtime-state`, not optional. Every
Literature route — including the ones named "public" — sits behind `requireLiteratureSiteAdminApi`,
so an unauthenticated request is answered `401` by the auth gate and the runtime never gets to say
whether it is configured. Without the cookie, `V90` reports no verdict.

For the exposure checks (`V82`, `V83`):

```
LITERATURE_VERIFY_ANON_KEY=<the project publishable key>
```

Also **required**, for a reason worth understanding. A request carrying _no_ `apikey` is rejected
by the Supabase API gateway before PostgreSQL ever sees it, so its `401` proves nothing about
row-level security or about what `anon` may select — it would pass identically on a project where
someone had run `grant select on public.literature_articles to anon`. Without a publishable key the
probes are skipped and the checks report no verdict, rather than a denial the gateway produced.

The key is checked before use: a `sb_secret_…` or legacy service-role value in that variable is
refused rather than used, because an "anonymous" probe authenticated as `service_role` would read
rows successfully and report an exposure that does not exist.

Export all of these; never pass them as flags.

### Flags

| Flag                         | Meaning                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `--scenario <id>`            | required; see the table below                                                                       |
| `--migration-history <path>` | provider `list_migrations` output, as a JSON array                                                  |
| `--catalog <path>`           | connector-captured catalog attestation                                                              |
| `--corpus <path>`            | declared source expectation, for `full-corpus`                                                      |
| `--baseline <path>`          | a receipt written by a prior run, for canary idempotency                                            |
| `--receipt <path>`           | write a redacted receipt of this run                                                                |
| `--pmid <pmid>`              | a PMID (1–12 digits) for the article-detail spot check; one is sampled from the corpus when omitted |
| `--keyword <word>`           | keyword for the search check (default `bronchoscopy`)                                               |
| `--json`                     | print the receipt envelope instead of the report                                                    |

---

## Verdicts and exit status

| Verdict         | Meaning                                              | Exit    |
| --------------- | ---------------------------------------------------- | ------- |
| `verified`      | every check passed                                   | 0       |
| `not_verified`  | at least one check failed                            | nonzero |
| `indeterminate` | at least one value could not be observed             | nonzero |
| `stopped`       | an import batch has no receipt; no verdict is issued | nonzero |

`indeterminate` exits nonzero on purpose. A run that could not observe what it needed has proven
nothing, and a `&&` chain must not read "we could not tell" as "it is fine."

The rule underneath every check: **a read that did not succeed never becomes a number.** An
uncounted response, a 500, a timeout, and a missing evidence file all produce `indeterminate` —
never `0`, never "empty", never "absent". The case this exists to prevent is a failed search read
being reported as "0 public results, exclusion verified."

---

## Scenarios

| #   | `--scenario`             | Claims                                                                                            | Needs                             |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | `runtime-not-configured` | the deployment truthfully declines with a structured 503, and no Literature URL is in the sitemap | app base URL **and** admin cookie |
| 2   | `foundation-empty`       | approved project, exactly one migration, full schema, zero rows                                   | database                          |
| 3   | `foundation-populated`   | non-empty corpus, consistent states, search vectors, provenance, receipts                         | database                          |
| 4   | `gold-unavailable`       | the gold RPCs are absent and the API declines cleanly                                             | database + app                    |
| 5   | `canary`                 | exactly 25 unreviewed drafts, receipted, none public, second run added nothing                    | database (+ `--baseline`)         |
| 6   | `full-corpus`            | declared source files and counts reconcile with the destination                                   | database + `--corpus`             |
| 7   | `public-exclusion`       | no draft is reachable by any unauthenticated path                                                 | database + app + anon key         |
| 8   | `batch-reconciliation`   | every batch left a receipt and the receipts account for the corpus                                | database                          |

Run them in order. That is how you find out _which_ step broke rather than that something did.

---

## Verification command matrix

Every check the tool performs, and what produces it.

### Target and schema

| ID                       | Check                                                    | Source                |
| ------------------------ | -------------------------------------------------------- | --------------------- |
| `V01-project-ref`        | the target is `itcttmkxdxvwmwcmzmey`, never `Endoreels`  | binding               |
| `V02-canonical-url`      | the URL is the canonical byte sequence                   | binding               |
| `V10-migration-count`    | exactly one migration is recorded                        | `--migration-history` |
| `V11-migration-identity` | version `20260815223259`, name `add_literature_explorer` | `--migration-history` |
| `V20-schema-present`     | all 8 foundation tables exist and are reachable          | `GET` per table       |
| `V21-table-inventory`    | 8 tables, exactly                                        | `--catalog`           |
| `V22-function-inventory` | 6 functions, exactly                                     | `--catalog`           |
| `V23-index-inventory`    | 28 indexes, exactly                                      | `--catalog`           |
| `V24-trigger-inventory`  | 6 enabled triggers, exactly                              | `--catalog`           |
| `V25-rls-enabled`        | RLS on all 8 tables, 0 policies                          | `--catalog`           |
| `V26-privilege-grid`     | `public`, `anon`, `authenticated` hold nothing           | `--catalog`           |
| `V27-catalog-totals`     | 132 columns, 55 constraints                              | `--catalog`           |

The recorded migration **version** is provider-assigned, not the filename version. The applied
value is `20260815223259`; the filename says `20260727032621`. The manifest predicted exactly this
divergence, and the checks never suggest repairing migration history to make a mismatch pass.

Migration history comes from the provider's `list_migrations` operation and nothing else —
`supabase_migrations.schema_migrations` is not exposed through PostgREST. Without the file, `V10`
and `V11` are `indeterminate`, which is correct: a hand-typed file proves nothing.

### Contents

| ID                            | Check                                                      | Source                      |
| ----------------------------- | ---------------------------------------------------------- | --------------------------- |
| `V30-foundation-empty`        | every table holds zero rows                                | counted `GET` per table     |
| `V31-foundation-populated`    | the corpus is non-empty                                    | counted `GET`               |
| `V32-relevance-distribution`  | the four relevance states sum to the corpus                | counted `GET` per state     |
| `V33-visibility-distribution` | the three visibility states sum to the corpus              | counted `GET` per state     |
| `V34-search-vectors`          | every article has a populated `search_vector`              | counted `GET`               |
| `V40-blank-admin-preview`     | the blank admin-preview search returns a valid result set  | `search_literature_v1`      |
| `V41-keyword-search`          | keyword search executes and is a subset of the corpus      | `search_literature_v1`      |
| `V42-admin-stats`             | `literature_admin_stats_v1` agrees with the counted corpus | `literature_admin_stats_v1` |
| `V43-article-detail`          | a known PMID resolves to exactly one row                   | `--pmid`                    |

### Canary

| ID                       | Check                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `V50-canary-exact-count` | exactly 25 — 24 and 26 both fail, and are reported as failures rather than near misses |
| `V51-canary-state`       | every record is `unreviewed` / `draft`, the foundation defaults                        |
| `V52-canary-idempotent`  | a second identical import moved the corpus by 0 and inserted 0                         |

`V52` needs `--baseline` pointing at a receipt from the first run. Without it the check is
`indeterminate`: idempotency is a comparison of two runs and cannot be inferred from one. It also
fails when no _new_ batch is recorded, so a single run cannot pass it vacuously.

### Batches, receipts, provenance

| ID                        | Check                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `V60-no-ambiguous-batch`  | no batch is `started` or missing `completed_at`                                        |
| `V61-no-failed-batch`     | no batch is `failed`                                                                   |
| `V62-receipt-consistency` | the receipts' inserts equal the corpus                                                 |
| `V63-provenance-coverage` | every article has at least one `literature_article_sources` row                        |
| `V64-provenance-batches`  | every source row names a batch that exists                                             |
| `V65-no-duplicate-pmids`  | rows equal distinct PMIDs                                                              |
| `V70-corpus-counts`       | receipts read the declared record count, destination holds the declared distinct PMIDs |
| `V71-corpus-files`        | every declared file has a batch with a matching SHA-256                                |

`V71` matches by checksum, not filename: a re-exported file with the same name is a different
file, and a renamed identical file is not.

### Public exclusion

| ID                        | Check                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| `V80-public-search-empty` | the default (non-admin-preview) search returns 0 rows                   |
| `V81-nothing-published`   | 0 articles are `included` **and** `published`                           |
| `V82-anonymous-table`     | an anonymous PostgREST caller cannot enumerate rows                     |
| `V83-anonymous-rpc`       | an anonymous caller cannot invoke `search_literature_v1`                |
| `V84-sitemap-exclusion`   | no `/literature` URL appears in `sitemap.xml`                           |
| `V91-anonymous-page`      | an anonymous browser is redirected or refused at `/en/admin/literature` |
| `V92-anonymous-api`       | an anonymous API request gets 401 `LITERATURE_ACCESS_DENIED`            |

`search_literature_v1` admits a record only when it is `relevance_state = 'included'` **and**
`visibility_state = 'published'`. A canary record is `unreviewed` / `draft` and fails both halves,
which is why a canary-populated corpus must return zero to the public path.

`V82` fails on a 200 with zero rows as well as a 200 with rows. Reachability is the finding; zero
rows today says nothing about tomorrow.

### Application state and gold workflow

| ID                            | Check                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `V90-runtime-state`           | the app declines with 503 `LITERATURE_SEARCH_UNAVAILABLE` (scenario 1) or serves 200 |
| `V95-gold-absent-in-database` | the gold-workflow RPCs are absent from `IP_Literature`                               |
| `V96-gold-declines-cleanly`   | the gold API returns a structured error code, not a bare 500                         |

The gold workflow is unavailable because its migrations were deliberately not applied here: the
foundation rollout applied one migration and the nine deferred ones stayed deferred. `V95` expects
`PGRST202`. `V96` distinguishes declining from breaking — a 404 with
`LITERATURE_GOLD_SET_EXPORT_FAILED` passes; a 500 with no error envelope fails, because an admin
at a conference should see a message rather than a broken page.

---

## Lost or ambiguous batch reconciliation

A batch with `status = 'started'` and no `completed_at` describes an import whose outcome nobody
recorded. It may have written every row, some rows, or none, and the destination cannot tell which
— the counts you would reconcile against are the very thing in doubt.

So `foundation-populated`, `canary`, and `full-corpus` **stop**: verdict `stopped`, no counts
reported, nonzero exit. `batch-reconciliation` does not stop, because reporting the ambiguity is
its whole job.

A failure that is _not_ the ambiguity outranks the stop. An anonymous caller reading draft rows
does not become less urgent because an import was also left half-finished, so a run with both
reports `not_verified` — with the stop reason still printed alongside it, because the ambiguity is
still the thing to fix first.

Response:

1. Run `--scenario batch-reconciliation --json --receipt evidence/ambiguity.json`.
2. Read the batch row and its `literature_import_errors` rows by hand. The `records_read`,
   `inserted_count`, and `error_count` columns are the receipt; a null `completed_at` means they
   were never finalized.
3. Decide, with the owner, whether the batch completed. Do not infer it from the destination count.
4. **Do not re-import over an ambiguous batch.** A second import against an unresolved first one
   produces two unreconciled receipts instead of one.
5. Only once the batch is resolved, re-run the scenario the ambiguity blocked.

A `skipped` batch is not ambiguous — it legitimately never completes. A `completed` batch with a
null `completed_at` **is** ambiguous: the status says done and the receipt says otherwise, and
believing the status is how a short corpus gets certified.

---

## Receipts

`--receipt <path>` writes a redacted JSON envelope: the verdict, every check, and
`target.credentialPresent: true` — never a credential, never a header, never a URL with userinfo.
Redaction is applied at one output boundary and covers both registered credential literals and
credential shapes echoed back by the target.

It also carries the corpus `snapshot`, so the receipt from one run is exactly what `--baseline`
reads on the next. The file you are told to keep and the file the idempotency check can consume are
the same file. A receipt path that already exists is refused rather than overwritten — evidence is
not replaced silently.

Every receipt carries a `notAuthorization` sentence, because a receipt outlives the terminal it was
printed in. It opens:

> This receipt records what was observed. It authorizes nothing: not a canary, not an import, not
> a Railway change, and not a deployment. …

The full text lives in `RECEIPT_NOT_AUTHORIZATION` in
[`lib/report.ts`](../../scripts/literature-production-verify/lib/report.ts); the receipt is the
authority on its own wording, not this quotation.

---

## Tests

```bash
npx jest --runInBand scripts/literature-production-verify
```

The suites prove the distinctions the tool exists to make: missing schema versus empty schema,
empty versus populated, a failed RPC never becoming zero, exactly 25, draft exclusion, migration
mismatch, wrong project, privilege drift, receipt mismatch, an ambiguous batch stopping, redaction,
and — through a real subprocess against a recording HTTP stub — that every request the assembled
command issues is a `GET` with no body.

That last suite also demonstrates something worth knowing: **a cooperative fake cannot make this
command report `verified`.** The stub answers every read successfully, and the run still refuses,
because a loopback origin is not the canonical production URL.
