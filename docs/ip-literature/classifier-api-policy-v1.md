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
