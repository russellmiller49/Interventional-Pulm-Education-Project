# Literature classifier API policy V1

> Status: recorded owner decision, 2026-08-16. No API is configured or called by this
> repository as of this document; recording the policy grants no execution authority.

The owner permits OpenAI API use for GPT-5.6 Luna relevance classification **after
qualification**, under exactly these terms:

1. **Local artifact generation only.** API output lands in local, gitignored artifacts. The API
   lane has no path to any database.
2. **Bibliography-only packets.** Model workers receive only the sanitized packet shape already
   defined by the ultra-screening plan (PMID, title, abstract or the explicit no-abstract
   marker, MeSH, author keywords, publication types, journal, year, language). Never physician
   labels, physician notes, confidences, sampling strata, selection reasons, review history,
   prior classifications, or full text.
3. **No Supabase credentials** in the classifier environment — not the dedicated project's, not
   the main project's, not the local stack's.
4. **No direct database writes.** Loading any classifier output into any database is a separate,
   later, explicitly authorized operation with its own operator and receipts.
5. **No physician truth in inference packets.** Physician labels are used only by coordinator
   evaluation after outputs are frozen.
6. **No held-out identities or labels.** The sealed held-out split is never packetized, scored,
   enumerated, or referenced by the API lane.
7. **One primary model, prompt, and schema per run**, pinned and checksummed in the run
   manifest. Changing any of the three is a new run.
8. **Standard API** may be used for calibration and urgent small cohorts; the **Batch API is
   preferred** for broad scoring.
9. **Coverage counting:** the only coverage number is validated distinct PMIDs — schema-valid
   outputs for distinct PMIDs, after validation. Requests sent, tokens spent, and raw responses
   are not coverage.
10. **No automatic spending and no automatic production loading.** Every spend is initiated by
    the owner; every load is a separately authorized operation.

This session recorded the policy and did not configure, call, or test any API.

## Amendment 1 — universal triage packets (2026-08-17)

The Luna universal triage lane (`scripts/literature-luna-triage/`) supersedes item 2's packet
shape for Stage-A triage with a strictly more protective one: the packet carries an opaque,
operation-salted, content-bound `record_id` **instead of a PMID**, plus title, abstract or an
explicit null, journal, year, publication types, MeSH, keywords, language, and a derived
`evidence_profile`. The PMID ↔ record-id mapping is coordinator-owned, mode-0600, and never
model-facing. Every other item of the recorded policy stands unchanged.

## Amendment 2 — blind full-corpus inference (2026-08-17)

Recorded owner policy for corpus-wide Stage-A scoring:

1. Blind corpus-wide inference runs over the complete fixed bibliographic corpus and **may
   include held-out records incidentally**; membership is never consulted to include or skip
   anything.
2. The classifier receives **no held-out membership and no held-out labels** — no packet
   field, prompt text, filename, or custom id encodes membership of any kind.
3. **No query, join, subtraction, complement, or metadata field reveals held-out
   membership.** The lane's only read is the committed full-corpus SQL over
   `literature_articles`/`literature_journals`; it names no split, no gold table, and no
   complement construct, and this is pinned by tests.
4. Model, prompt, output schema, and routing policy are **frozen before submission**; the
   freeze receipt digest names the run.
5. Outputs are **sealed before any held-out unblinding**: validated result and routing
   artifacts are content-hashed and their digests recorded before anyone may look at held-out
   truth.
6. **No held-out metric is calculated without separate owner authorization.** Corpus-wide
   routing manifests report aggregates only.
7. **Scoring a record blindly is not access to held-out truth.** Access means reading
   membership or labels; producing a triage output for a record whose membership nobody
   queried is not access.

No session may access held-out identities or labels under this amendment; it authorizes only
blindness-preserving corpus-wide scoring.

## Amendment 3 — offline-only scope for PR #114 (2026-08-18)

PR #114 ships the **offline** Luna triage preparation platform. It does not exercise any part
of this policy that involves an API:

- it makes no OpenAI call of any kind, standard or Batch (items 7–9 remain unexercised);
- it reads no `OPENAI_API_KEY` and declares no OpenAI endpoint anywhere in executable source;
- it submits and retrieves no Batch job;
- it does not run the locked/held-out 200, and it refuses that cohort both by declared label
  and by actual membership (item 6, enforced structurally rather than by convention);
- it produces no predictions and loads nothing into any database (items 1, 4, 10);
- it declares no qualification verdict — the "after qualification" precondition in this
  policy's opening sentence is therefore untouched and still unmet.

Amendment 2's blind full-corpus inference remains recorded policy but is **not implemented**
by PR #114: full-corpus _packet and shard preparation_ is offline and produces no model call,
and the freeze receipt named in Amendment 2 item 4 is deferred with the locked coordinator.

Remote execution returns only through a separate PR carrying its own transport adapter, its
own threat model, its own regression suite, and its own explicit owner spend authorization.
Nothing in PR #114 grants that authorization.
