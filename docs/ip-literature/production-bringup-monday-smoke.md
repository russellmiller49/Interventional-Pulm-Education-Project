# AABIP Monday Literature MVP: conference smoke checklist

Ten minutes, on the conference network, before anyone is watching.

**Precondition — read before you plan the demo.** Items 2–7 require three things, in order: this
branch merged and deployed, the Railway authorization with the three dedicated variables set, and
the canary import. The capability-gating package is no longer a blocker —
`LITERATURE_PRODUCTION_RUNTIME_ACTIVATION` is `'activated_by_reviewed_cutover'`, so a deployment
carrying the three variables reads `IP_Literature`. See
[`production-bringup-railway-cutover.md`](./production-bringup-railway-cutover.md).

If any of those three is missing, run the **fallback** at the bottom instead. It is a real demo of
a real state, and it is honest. Note which state you are in before you plan the talk: with the
variables unset the page reports "not configured"; with them set and no records imported it reports
`foundation_ready_empty` — a measured zero rather than a fabricated one, which is itself the point
worth demonstrating.

---

## Before you leave for the venue

Run once from a laptop with the three variables exported:

Export the three Literature variables plus `LITERATURE_VERIFY_ANON_KEY` (the project publishable
key — without it the exposure checks report no verdict rather than a denial the API gateway
produced).

The canary run is two commands, and **both must report `verified`**. They verify different claims:
run 1 is an exact initial application, run 2 is an exact deterministic replay. Run 1 also captures
the baseline that run 2 reads back.

**Keep the receipt the import writes.** The canary run leaves
`local-data/literature-production-ingest/canary-<operation-id>.receipt.json`. That file is what
binds the twenty-five records in the database to the operation that wrote them; without it the
verification says only that _some_ twenty-five unreviewed drafts exist.

```bash
npm run literature:production-verify -- \
  --scenario canary \
  --ingest-receipt local-data/literature-production-ingest/canary-<operation-id>.receipt.json \
  --receipt evidence/monday-canary-1.json
```

Then run the import a second time — a plain re-run, no extra flags. The engine derives a
deterministic operation id, recognises the repeat, writes nothing, and emits a replay receipt
alongside the first:

```bash
npm run literature:production-verify -- \
  --scenario canary \
  --ingest-receipt local-data/literature-production-ingest/canary-<operation-id>.replay-<epoch>.receipt.json \
  --baseline evidence/monday-canary-1.json \
  --receipt evidence/monday-canary-2.json
```

Both runs must report `verified`, and both need `--ingest-receipt`.

Run 1 verifies an **exact initial application**: one completed batch with a non-null
`completed_at`, exactly twenty-five provenance rows scoped to that batch, exactly twenty-five live
unreviewed drafts, and receipt counters that match the row. It needs no baseline, because nothing
ran before it — that is not a gap in the evidence.

Run 2 verifies an **exact deterministic replay**: the same completed operation and batch, no new
batch, no start time moved, nothing written. Its receipt says so directly, and the check confirms
the claim against the database rather than believing the outcome string.

Without `--ingest-receipt` the receipt-binding checks report no verdict, the run verdict is
`indeterminate`, and the exit status is nonzero. That is deliberate — the database alone cannot
tell a replay that wrote nothing from an import that never happened, and twenty-five unreviewed
drafts are twenty-five unreviewed drafts whoever wrote them. If either run reports `stopped`, an
import batch has no receipt: resolve it before the conference, not at it.

```bash
LITERATURE_VERIFY_APP_BASE_URL=https://<production origin> \
  npx tsx scripts/literature-production-verify/verify.ts \
  --scenario public-exclusion --receipt evidence/monday-exclusion.json
```

Must report `verified`. Keep all three receipts; they are what you show if anyone asks what was
checked.

---

## At the venue

| #   | Step                                                     | Expected                                                  | If not                                                                                                                                                        |
| --- | -------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sign in as a site admin                                  | you reach the dashboard                                   | you are not a `site_admin`; fix entitlements, do not demo                                                                                                     |
| 2   | Open `/en/admin/literature`                              | the review page loads                                     | if it says "not configured", step 7 has not shipped → fallback                                                                                                |
| 3   | Confirm the record count                                 | **25 draft records**                                      | any other number → stop; the canary is wrong, not nearly right                                                                                                |
| 4   | Leave the search box empty                               | a populated review queue of drafts                        | empty list → the corpus is empty, or the queue query returned an error — check the stats panel and the tool, in that order                                    |
| 5   | Search a keyword present in the set                      | a subset of the 25                                        | zero results → search vectors are missing                                                                                                                     |
| 6   | Open one article                                         | detail page renders: title, journal, abstract, provenance | 404 → the PMID is not in the corpus                                                                                                                           |
| 7   | Check the stats panel                                    | total = **25**                                            | disagreement with item 3 → stop and reconcile                                                                                                                 |
| 8   | Open `/en/literature` with a clean URL (no query string) | **0 results**                                             | any result → either a stale `?adminPreview=1` is in the URL bar, or a record has been curated to `included` + `published` — check the URL first, then contain |
| 9   | Open a private window, request `/api/literature/search`  | **401 `LITERATURE_ACCESS_DENIED`**                        | anything else → contain immediately                                                                                                                           |
| 10  | Open `/en/admin/literature/gold-set`                     | a clear "unavailable" message                             | a stack trace or blank page → do not open this during the demo                                                                                                |
| 11  | Open `/sitemap.xml`, search for `literature`             | **no match**                                              | any match → contain immediately                                                                                                                               |

Items 3 and 7 must agree, and item 8 must be zero _while_ item 3 is 25. Those two facts together
are the demo: the corpus exists, is complete, and is invisible to the public. Either alone is
much less interesting.

### Why item 8 is zero

`search_literature_v1` admits a record to the public path only when it is `included` **and**
`published`. Every canary record is `unreviewed` / `draft` — the foundation defaults — so it fails
both halves.

Two things to be precise about, because they are easy to overstate on a stage:

- **The page does have an admin-preview toggle**, and ticking it (or arriving with
  `?adminPreview=1` in the URL) shows the drafts. That is a deliberate reviewer affordance, not a
  leak: the whole `/literature` tree is behind the site-admin gate in both the middleware and the
  layout, so only a site admin can reach the page at all, toggle or no toggle. Start item 8 from a
  clean URL, and if someone asks to see the drafts, the toggle is the honest answer.
- **What keeps a draft away from the public is the record's state, not the toggle.** Item 9 — an
  anonymous request refused — is the check that demonstrates that, and it is the one to show.

### Why item 10 is unavailable

The gold-set review workflow lives in migrations that were deliberately not applied to
`IP_Literature`. The foundation rollout applied one migration; the nine deferred ones stayed
deferred. The page should say so cleanly. It is a legitimate thing to mention out loud — the
project deployed exactly what was reviewed and nothing else — but do not open it mid-demo unless
you have confirmed item 10 beforehand.

---

## Contain, don't debug

Items 8, 9, and 11 are exposures, not bugs. If any of them is wrong, follow the containment
procedure in [`production-bringup-railway-cutover.md`](./production-bringup-railway-cutover.md):
remove the three Railway variables, redeploy, confirm with

```bash
LITERATURE_VERIFY_APP_BASE_URL=https://<production origin> \
  npx tsx scripts/literature-production-verify/verify.ts --scenario runtime-not-configured
```

and investigate afterwards. Do not debug a live exposure on a conference network. The database is
untouched by containment; nothing is lost by doing it early.

Items 3, 4, 5, 6, 7, and 10 are wrong answers. Stop the demo, keep the deployment, and reconcile
with the tool.

---

## Fallback: the honest demo when capability gating has not shipped

Everything below is true today and demonstrable.

| #   | Step                                                                        | Expected                                                                     |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| F1  | Open `/en/admin/literature` as a site admin                                 | a clear "the Literature database is not configured" state, not an error page |
| F2  | `curl -i https://<origin>/api/literature/search` unauthenticated            | 401 `LITERATURE_ACCESS_DENIED`                                               |
| F3  | `curl -s https://<origin>/sitemap.xml \| grep literature`                   | no match                                                                     |
| F4  | Show `evidence/monday-canary-2.json`                                        | `verified`, exactly 25 records, all `unreviewed` / `draft`, receipted        |
| F5  | Show `evidence/monday-exclusion.json`                                       | `verified`, 0 publicly visible, anonymous callers refused                    |
| F6  | Run `--scenario foundation-empty` or `--scenario canary` live from a laptop | a live read of the production project, read-only                             |

The story this tells is a defensible one: the corpus is loaded and verified in its own dedicated
project, the application cannot reach it until a reviewed code change says so, and the tooling that
proves both is independent of the deployment. That is a stronger position to present than a UI
demo that had to be rushed, and it does not require touching Railway on a Sunday night.
