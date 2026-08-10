# AABIP unlisted-beta launch runbook

Prepared for owner launch decision; **production remains disabled**. Nothing in the
repository, this document, or the verification harness sets a production variable, and no
step below happens automatically. Every state change in this runbook is a deliberate owner
action performed by hand.

The launch surface is the Phase D1 device-intelligence slice: `/[locale]/devices`,
`/[locale]/procedures` (three exemplars), and `/[locale]/clinical-roles/[roleCode]` — all
public-unlisted, noindexed, watermarked, and absent from navigation and the sitemap.

## 1. Prerequisites

- PRs merged **in order** (each is stacked on the one before it):
  1. PR #91 — the governed-data corrections (F-04 / F-05 / F-06 / F-10, composition ledger).
  2. The definition-set retention / F-09 PR stacked on it (this branch).
- The production deployment has been built and released from a commit **at or after** the
  second merge. The verification below is meaningless against an older build.
- A local checkout of the same commit, with `npm ci` run, for the local verification passes.
- No database migration, Supabase change, or upload accompanies this launch. The D1 slice is
  read-only over committed generated data.

## 2. The production flag

```
NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE=true
```

Outside production the routes are always on (development previews); in production they serve
**only** while this variable is exactly `true` (`src/features/device-intelligence/feature.ts`).
It is deliberately separate from `NEXT_PUBLIC_ENABLE_PREFERENCE_CARDS`. It is not set today,
and this repository never sets it.

## 3. Local rehearsal (before touching production)

Build once, then run the harness in both modes against a local production server:

```bash
npm run build
npm run ip-intel:verify-beta -- --mode=off --start
npm run ip-intel:verify-beta -- --mode=on --start
```

`--start` launches `next start` on port 3210 with the flag set only inside that child
process for `--mode=on`, and terminates it afterwards; nothing is persisted. A server you
started yourself can be checked instead with `--base-url=http://localhost:<port>` — the
mode you pass is the claim being verified about that server's environment.

Both passes must be fully green before proceeding. The harness fails closed with the exact
check that did not hold.

## 4. Pre-enable checks against production (flag still unset)

```bash
npm run ip-intel:verify-beta -- --mode=off --base-url=https://<production-host>
```

Expected: every D1 route 404s with no authentication redirect, the
`X-Robots-Tag: noindex, nofollow, noarchive` tier stays on, and the existing
public-unlisted modules (control: `/mechanical-circulatory-support`) are untouched.

## 5. Enable — a separate owner operation

Set `NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE=true` on the production service by hand, in the
deployment platform's own configuration surface, and redeploy/restart per the platform's
semantics. This step is intentionally outside every script in this repository.

## 6. Post-enable checks

```bash
npm run ip-intel:verify-beta -- --mode=on --base-url=https://<production-host>
```

What the mode-on pass verifies, in one run:

- `/en/devices`, `/en/procedures`, the three exemplar workspaces
  (`EBUS_TBNA`, `THERAPEUTIC_BRONCH`, `CHEST_TUBE`) and their readiness pages → 200.
- **Negative controls:** non-exemplar procedures (`THORACENTESIS`, `RIGID_BRONCH`, an
  unknown code) → 404; two non-cohort (candidate/hidden) product ids derived from the
  committed catalog through the real cohort predicate → 404; one cohort product → 200.
- A deprecated role code (permanent alias) redirects to its canonical role page.
- Every checked D1 response carries the noindex header **and** noindex robots metadata.
- The D1 routes are absent from the home navigation and the sitemap.
- The draft watermark on every workspace, the demo watermark
  ("DEMO DATA — NOT AN ACTUAL INSTITUTION") on every readiness page, and the qualified
  readiness headline ("Demo: Not ready") the committed data produces — proposals never
  satisfy coverage, and no institutional claim appears.
- No non-cohort product identity anywhere in the served HTML of any checked page.
- F-09: the THERAPEUTIC_BRONCH workspace presents the rigid APC applicator as conditional
  ("Rigid system in use"), data-driven.

Manually spot-check one exemplar workspace and one readiness page in a browser as well —
the harness reads served bytes, not rendered pixels.

## 7. Rollback

Unset `NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE` (or set it to anything other than `true`)
and redeploy. On platforms that inline `NEXT_PUBLIC_` variables at build time (Railway
rebuilds on an environment change), rollback requires that **rebuild** — a bare restart of a
build made with the flag set would leave the routes serving. Re-run the §4 mode-off pass to
confirm every route is a 404 again; it fails loudly if the rollback did not take. No data
changes, so there is nothing else to roll back.

## 8. Evidence to retain from the launch smoke test

Keep, alongside the launch decision record — as an **internal** record: the harness stdout
names non-cohort product ids as negative controls, and while those ids are already present
in the repository's committed catalog data, the project's own bar keeps candidate/hidden
identity off served pages, so the evidence should not be pasted into public PR or issue
text either:

1. The full stdout of the §4 mode-off pass (pre-enable), with its timestamp and target host.
2. The full stdout of the §6 mode-on pass (post-enable), same.
3. The production commit SHA the deployment was built from.
4. The exact fixture ids the harness printed (cohort product, non-cohort negative controls,
   alias pair) — they are derived from the committed catalog, so they document precisely
   which negative controls were exercised.
5. Screenshots of one workspace and one readiness page showing the draft and demo
   watermarks.
6. If anything failed and was re-run: what changed in between.
