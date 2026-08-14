# Independent review handoff — dedicated Literature Supabase bootstrap

For a fresh reviewer with no context from the implementing session. The goal is to decide whether
this PR is safe to merge, **not** whether the migration should be applied — that is a separate
authorization.

## What this PR is

Preparation only. It binds the application's Literature data client to a dedicated Supabase project,
and it builds the contracts, verifiers, and rehearsal that a later authorized rollout would use. No
remote system was mutated.

## Setup

```bash
git fetch origin
git worktree add ../codex-literature-dedicated-review claude/literature-dedicated-supabase-bootstrap-v1
cd ../codex-literature-dedicated-review
npm ci
```

Node 20 (`.nvmrc`). Do **not** implement from the primary checkout.

## Hard constraints for the reviewer

Reading and running the local test suites is fine. Do not:

- apply any migration to `itcttmkxdxvwmwcmzmey` or `tqnhxlwvkkswuckszlee`;
- run `supabase db push`, `db reset`, or `migration repair` against any remote project;
- mutate the protected real-local database (container `supabase_db_ip-literature-local`, port 55322) — do not stop, reset, or rename it;
- retrieve, reveal, or rotate any production credential;
- ingest a canary or the corpus;
- run any V2 import or compensation operation;
- access the 270-record held-out set.

`npm run literature:dedicated:rehearse` creates and destroys its own throwaway container. It
publishes no port and cannot reach 55322. Running it is safe and is the single most useful check.

## The four claims to verify

### C-1 — The Literature client cannot reach the main application project

Read `src/features/literature/server/dedicated-project-contract.ts` and `database-client.ts`.

Confirm there is no code path by which `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, or
`SUPABASE_SERVICE_ROLE_KEY` can produce a Literature client, in any mode. Confirm
`tqnhxlwvkkswuckszlee` is rejected in **every** mode rather than only in production. Try to
construct an environment that binds to the main project — that attempt failing is the claim.

Then check the fail-closed matrix independently: missing/partial config, missing or malformed
expected ref, URL/ref mismatch, loopback in production, publishable or anon credential, legacy
variable in production, and both credential variables set to different values. Each must produce a
distinct reason code.

### C-2 — Exactly one migration, bound by identity, against exactly one project

```bash
shasum -a 256 supabase/migrations/20260727032621_add_literature_explorer.sql
# expect c737865cdde3572ed0c0c59c134530bbd7e86e2013d97e0b9edc06c27aa426da
```

Read `src/features/literature/dedicated-supabase/foundation-manifest.ts`. Confirm zero, two, a
drifted, a relocated, a deferred, and an unrelated migration are each rejected, and that
`supabase db push` is refused by name with a stated reason.

**The highest-value independent check:** re-derive the Literature migration set yourself.

```bash
grep -il literature supabase/migrations/*.sql | sort
```

There should be **ten**, three of which do not carry `literature` in the filename
(`20260728170939`, `20260728171212`, `20260728174726`). Each of those three is a `DO` block that
`raise exception`s without `save_literature_gold_review_v1`, so they are Literature migrations
despite their names. Confirm the manifest defers all nine non-foundation ones. An earlier automated
pass in this session initially reported seven — the filename heuristic is genuinely misleading, so
please verify from the SQL rather than the names.

Also confirm the foundation migration is genuinely self-contained: that it references no object
created by an earlier migration, and that it is transactional (no `CREATE INDEX CONCURRENTLY`, no
`VACUUM`, no `ALTER SYSTEM`).

### C-3 — The rehearsal proves the real catalog, and proves it safely

```bash
npm run literature:dedicated:rehearse
```

Expect 23/23. Then verify the safety properties by reading
`scripts/literature-dedicated-supabase/rehearse-foundation.ts`:

- no published port anywhere (`--publish` / `-p` absent);
- every statement goes through `docker exec … psql`;
- cleanup is by exact container name, never a prefix or wildcard;
- scenario `R21` proves a same-prefix sentinel survives cleanup;
- scenario `R22` proves the protected container is still present.

Confirm afterwards:

```bash
docker ps -a --filter name=literature-dedicated-bootstrap --format '{{.Names}}'   # expect empty
docker inspect supabase_db_ip-literature-local --format '{{.State.StartedAt}}'    # unchanged
```

Then check the expectations are not self-fulfilling: `catalog-expectations.ts` is hand-authored and
the rehearsal compares against it **in both directions**. Try deleting an index name from the
expected list and re-running — the rehearsal should fail. (One transcription error was found and
fixed this way during implementation: `search_literature_v1`'s return type.)

### C-4 — Nothing can apply, retry, or leak

Confirm no script under `scripts/literature-dedicated-supabase/` can apply a migration, retry after
an ambiguous acknowledgement, or reach a credential. The preflight and postflight take an
operator-captured observation document rather than a connection; verify that is actually true and
not merely documented.

Confirm every classification in `lib/reconciliation.ts` carries `automaticRetryPermitted: false`,
`automaticReapplicationPermitted: false`, `automaticCompensationPermitted: false`, and
`migrationHistoryEditPermitted: false`, and that no branch can return otherwise.

## Gates to re-run

```bash
npm run type-check
npm run lint
npx prettier --check .
npm test -- --runInBand
npm run build
git diff --check
```

The protected-bundle suites under `scripts/literature/` are the ones to watch: this PR adds npm
scripts to `package.json`, which is a protected runtime root. The bundle recomputes content hashes
dynamically, so they should stay green. The new operational scripts were deliberately placed in
`scripts/literature-dedicated-supabase/` rather than `scripts/literature/` so they fall outside
`PROTECTED_V2_PROTECTED_DIRECTORIES` (the match is `startsWith('scripts/literature/')`) and do not
enter the protected bundle inventory. Confirm that reasoning holds.

## Known scope decisions to sanity-check, not bugs

1. Operational CLIs under `scripts/literature/` still read `LITERATURE_SUPABASE_SERVICE_ROLE_KEY`
   only — deliberately unchanged.
2. Admin gold-set surfaces will error against a foundation-only database.
3. A local production build with a loopback Literature URL reports _not configured_. Required
   fail-closed behaviour; `npm run dev` is unaffected.
4. After merge and before the Railway variables are set, production Literature reports _not
   configured_ instead of silently reading `Endoreels`.

## What a good review returns

For each of C-1 … C-4: confirmed, or a specific counter-example — an environment, a candidate, or a
catalog state that defeats the claim. Flag anything that would let Literature data reach
`tqnhxlwvkkswuckszlee`, let more than one migration be selected, let a credential escape, or let an
ambiguous acknowledgement become a retry.
