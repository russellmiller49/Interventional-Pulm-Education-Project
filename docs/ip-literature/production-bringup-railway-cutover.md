# Literature production bring-up: Railway cutover checklist

**Status:** checklist only. Nothing here has been executed, and this document does not authorize
executing it. The Railway cutover is step 8 of the canonical rollout sequence in
[`dedicated-supabase-rollout-runbook.md`](./dedicated-supabase-rollout-runbook.md) and requires its
own owner authorization — one that is not implied by the migration authorization, by this
document, or by a passing verification run.

**No raw secret value appears in this file, and none may be added to it.**

---

## Precondition, stated plainly

Setting these variables **does** connect the Literature read path. Treat this as a live change.

`LITERATURE_PRODUCTION_RUNTIME_ACTIVATION` is a source constant, and on this branch it is
`'activated_by_reviewed_cutover'`. A byte-perfect production configuration resolves to `bound`, a
Supabase client is constructed, and the Literature routes read `IP_Literature` instead of answering
"not configured".

Activation being a constant rather than a variable is unchanged and still load-bearing: the third
review found that a valid configuration would otherwise have activated privileged remote mutation
with no reviewed change in between, so activation lives in code. Flipping it relaxed no validation
rule — these three values are still checked byte-for-byte against the canonical URL, against the
single approved ref, against the prohibited main-project ref, and for the `sb_secret_…` credential
class, and a partial set still fails closed with no fallback to `Endoreels`.

What these variables cannot do is grant write access. `LITERATURE_ACTIVATED_OPERATIONS` carries the
four foundation reads only; curation writes and every gold-set operation are withheld, and
ingestion is an operator CLI rather than an application operation. So the blast radius of getting
this wrong is a service that can _read_ draft Literature records behind its own site-admin gate —
which is why the service and environment must be named in the authorization record and read back
afterwards.

The deploy-first step below is still worth doing, and its purpose has changed: it proves the
application reports "not configured" honestly _before_ the variables exist, so that the change
after they are set is attributable.

**Sequencing note.** The canonical rollout runbook puts capability gating (step 7) before the
Railway authorization (step 8), and nothing here changes that order. Step 1 below deploys with the
variables **absent** — it is a baseline measurement, not an early cutover. Adding the three
variables happens at step 3, after the step-2 authorization, and that authorization is the owner's
to give or withhold on their own reading of whether step 7 has landed. Do not treat the deploy-first
framing as licence to add the variables early.

---

## The three variables

Exactly three. No fallback, no alias, no fourth.

| Variable                                   | Value                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `LITERATURE_SUPABASE_URL`                  | `https://itcttmkxdxvwmwcmzmey.supabase.co/`                             |
| `LITERATURE_SUPABASE_SECRET_KEY`           | the `sb_secret_…` backend key from the `IP_Literature` project settings |
| `LITERATURE_SUPABASE_EXPECTED_PROJECT_REF` | `itcttmkxdxvwmwcmzmey`                                                  |

Notes that matter more than they look:

- **The URL is compared byte for byte, trailing slash included.** No trimming, no case folding, no
  `:443`, no dot path, no percent-encoding variant. A missing trailing slash is a refusal, not a
  near miss.
- **The credential must be the current `sb_secret_…` model.** A legacy service-role JWT is refused
  in the strict contract. A publishable key is refused always.
- **The expected ref exists so the client can prove which project it reached.** It is not
  redundant with the URL: the two are compared, and a disagreement is a refusal.
- Copy the secret from the Supabase dashboard into the Railway variable UI directly. Do not paste
  it into a note, a ticket, or this repository, and never into a command line.
- The verification steps below need the same secret **exported in the operator's own shell**, which
  is a different thing from putting it in a command line: `export LITERATURE_SUPABASE_SECRET_KEY=…`
  (or a `.env` file that is git-ignored) keeps it out of `ps`, out of shell history when the shell
  is configured to ignore leading spaces, and out of every log the tool writes. The tool refuses a
  credential passed as an argument for exactly that reason.

### Scope

- **Service:** the production application service only.
- **Environment:** `production` only. Do not add these to preview, staging, or PR environments —
  a preview deployment resolves the strict contract and would then be pointed at the production
  Literature project.
- **Main authentication stays on `Endoreels`.** `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` keep their
  current values and are **not** touched. They are not Literature fallbacks and never were — the
  Literature contract reads none of them — but site authentication and site-admin identity depend
  on them.

### Variables that must NOT be set

| Variable                               | Why                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LITERATURE_SUPABASE_RUNTIME_MODE`     | the value `local` relaxes the strict contract; anything else is inert but pointless                                                                                                   |
| `LITERATURE_SUPABASE_SERVICE_ROLE_KEY` | the legacy alias — refused outright in strict mode, and setting it alongside the secret key to a different value resolves to `ambiguous_credentials` rather than to either credential |

No variable whose name contains `ACTIVAT` may be introduced. `.env.example` already asserts this.

---

## Sequence

Each numbered step completes before the next begins.

### 1. Deploy once with the variables absent

Deploy the current build with **no** Literature variables set, and verify the truthful
not-configured state:

```bash
LITERATURE_VERIFY_APP_BASE_URL=https://<production origin> \
  npx tsx scripts/literature-production-verify/verify.ts --scenario runtime-not-configured
```

Requires, in the environment: the three Literature variables (every scenario identifies its target
before anything else) and `LITERATURE_VERIFY_ADMIN_COOKIE`. The cookie is not optional here — every
Literature route sits behind the site-admin gate, so an unauthenticated request is answered `401`
by that gate and the runtime never gets to report whether it is configured.

Expect `V90-runtime-state` to pass on **503 `LITERATURE_SEARCH_UNAVAILABLE`** — a structured
refusal. A bare 500 with no error envelope fails this check, and it should: "not configured" and
"broken" must not look the same to an operator.

This step exists so the next one has a baseline. Without it, a post-cutover failure is
indistinguishable from a deployment that was already failing.

### 2. Obtain the separate Railway authorization

In writing, from the owner, naming:

- the service and the `production` environment;
- the three variable names, and that exactly three are being added;
- the project ref `itcttmkxdxvwmwcmzmey`;
- that the main-application variables are untouched and authentication stays on `Endoreels`;
- that no canary, no import, and no ingestion is authorized by this.

The migration authorization does not cover this. Neither does a passing verification run — a
verification is a precondition for asking, never a substitute for the answer.

### 3. Add only the three variables

In the Railway UI, in the production environment of the production service. Add. Do not edit,
rename, or remove anything else.

### 4. Redeploy

Trigger a redeploy so the new environment is picked up.

### 5. Verify the empty-foundation state

Against the database:

```bash
npx tsx scripts/literature-production-verify/verify.ts \
  --scenario foundation-empty \
  --migration-history evidence/list-migrations.json \
  --catalog evidence/catalog.json \
  --receipt evidence/foundation-empty.json
```

Expect `verified`: the approved project, exactly one migration (`20260815223259`,
`add_literature_explorer`), all 8 tables present, zero rows everywhere.

Against the application:

```bash
LITERATURE_VERIFY_APP_BASE_URL=https://<production origin> \
  npx tsx scripts/literature-production-verify/verify.ts --scenario runtime-not-configured
```

**Before capability gating ships, this still passes** — the runtime is deliberately inert, so the
application still declines. That is the correct result, not a failure of the cutover. What the
cutover bought you is that the configuration is now provably valid, which the database scenario
above demonstrates independently of the application.

After capability gating ships, this scenario is expected to _fail_ — `V90-runtime-state` will see a
`200` where it expected the `503`. That inversion is the observable signal that step 7 landed, and
it is the only signal this tool produces about it: there is no scenario that affirms "the
application now serves Literature". Confirming that is the Monday smoke checklist's job, through
the admin UI.

### 6. Stop

The cutover authorizes the variables and nothing further. **No canary until separately
authorized.** No import, no ingestion, no data of any kind written to `IP_Literature`.

---

## Rollback and containment

Literature runtime access is removed by **removing the three variables**. That is the entire
mechanism, and it is deliberate: the failure mode being contained is Literature data becoming
reachable, and the fastest true statement about a deployment with no Literature variables is that
it cannot reach the Literature project at all.

Automatic rollback is **not implemented and must not be.** A tool that removes production
variables on a signal is a tool that can remove them on a false one, and the containment action
here is cheap for a human and unattended for a machine.

### When to contain

Immediately, without waiting for a diagnosis, if any of these is observed:

- `V82-anonymous-table` or `V83-anonymous-rpc` fails — an anonymous caller reached Literature rows.
- `V84-sitemap-exclusion` fails — a draft article URL is being advertised.
- `V92-anonymous-api` fails — an unauthenticated request got past the site-admin gate.
  Note what is **not** on that list: `V01-project-ref`. That check inspects the _operator's own
  environment_, not the deployment's — a typo in your shell fails it while a correctly configured
  production service carries on working. Fix your shell and re-run; do not pull production variables
  over it.

Everything else — a count mismatch, a receipt gap, an ambiguous batch, a failed read — is
investigated, not contained. Those are wrong answers; the three above are exposures.

### Containment procedure

1. In the Railway production environment, delete `LITERATURE_SUPABASE_URL`,
   `LITERATURE_SUPABASE_SECRET_KEY`, and `LITERATURE_SUPABASE_EXPECTED_PROJECT_REF`.
2. Redeploy.
3. Confirm the deployment is back to declining:

   ```bash
   LITERATURE_VERIFY_APP_BASE_URL=https://<production origin> \
     npx tsx scripts/literature-production-verify/verify.ts \
     --scenario runtime-not-configured --receipt evidence/containment.json
   ```

   Expect `verified`, and file the receipt.

4. Leave the main-application variables alone. Removing them takes site authentication down and
   contains nothing.
5. If a credential may have been exposed, rotate the `IP_Literature` secret key in the Supabase
   dashboard **after** the variables are removed, and treat the old key as compromised regardless
   of whether exposure was confirmed.
6. Only after containment, investigate. The database remains readable with the tool from a local
   shell, which is the point of keeping verification independent of the deployment.

### What containment does not do

It does not delete data, revoke the migration, or change the database. `IP_Literature` is
untouched: the same rows, the same schema, the same one recorded migration. Re-enabling is
steps 2–5 of the sequence above, including a fresh authorization.
