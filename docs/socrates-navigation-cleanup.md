# SOCRATES navigation cleanup

Baseline: `f6a406a9515750dc39fe1a110cdcf0f42b04e203` (`origin/main`, fetched
2026-10-16). Branch: `codex/socrates-library-navigation-20261016`. The primary
checkout and other worktrees were left intact. Open PR file lists were inspected;
none overlaps the changed navigation, SOCRATES, or test-fixture files. PR #297
also touches the shared access-policy implementation, which this patch leaves intact.

## Route trace and decision

- Site admin `/[locale]/admin` linked to `/socrates-builder`; the account dashboard
  linked there too. Both now say **SOCRATES Library** and open `/socrates-library`.
- `/[locale]/socrates-builder` had no implemented case query/hash selection. Its
  page loaded `socrates_slides`, `list_socrates_author_cases`, and sandbox cleanup
  documents, then rendered the persistent builder. It now issues a same-locale
  temporary redirect to the library.
- `/[locale]/socrates-library` loads `list_socrates_library_slides` and embeds the
  same `SocratesBuilder` in shared mode. Edit and teaching/testing preview are
  component state within this route; they never navigate through the old page.
- Library membership is separate from saved author cases. Automatically importing
  a legacy case would create a new case through the existing library RPC. Therefore
  this navigation change performs no migration/import. A collapsed **Earlier saved
  slides** disclosure opens `/[locale]/socrates-library/legacy`, retaining the exact
  former server bootstrap and save/export workflow with a return link. Existing
  action revalidation follows that moved page. Shared editor code/actions remain.
- Case-specific `/socrates-demo?slide=<slug>` links and `/socrates/training/<id>`
  routes remain unchanged. The demo's browser drafts and imports remain available.
- The redirect acts only on new page requests. Already open editor sessions are not
  forcibly navigated; save/export unfinished work before leaving. Shared recovery,
  conflict handling and unsaved unload protection are unchanged.
- The legacy recovery route inherits the existing `/socrates-library/*` editor
  requirement. No production auth, entitlement, schema, case, annotation,
  assignment, publication or curriculum implementation changes are included.

## Validation evidence

Results: **33 Jest suites / 240 tests passed**; TypeScript passed; scoped ESLint,
Prettier and `git diff --check` passed; **105 disposable PostgreSQL checks passed**.
The final focused Chromium run passed **2/2** (Site Admin/library/redirect/recovery
and anonymous/participant authorization). The broader Chromium run passed **9/11**,
including protected desktop/mobile unsaved preview and earlier-case save/reload.
Two existing browser-demo journeys failed:

- Browser-only v2 preview timed out looking for **Reveal teaching interpretation**;
  the snapshot instead shows the current stepped teaching navigation.
- Bootstrap-generated browser draft could not locate **Learner narrative (after
  reveal)** in the editor before opening its preview.

Neither the failing test bodies nor the demo, learning workspace or lesson
implementations changed from the baseline (`git diff` for those implementations
is empty). A separate baseline runtime run was NOT RUN; these are recorded
failures in untouched flows, not claimed to be proven baseline passes/failures.
Screenshots and traces were retained; the new library screenshot was opened and
visually checked. Exact head is recorded in the draft PR. Commands/logs:

- Focused Jest: `npm test -- --runInBand src/features/socrates-builder
src/features/socrates-demo src/features/socrates-learning src/features/socrates-study
'src/app/\[locale\]/socrates' 'src/app/\[locale\]/admin/page.test.tsx'
src/app/api/socrates src/lib/site-auth/access.test.ts`.
  Log: `/tmp/socrates-navigation-jest.log`.
- TypeScript: `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`.
  Log: `/tmp/socrates-navigation-typecheck.log`.
- Scoped ESLint and Prettier over every changed source/test/doc; `git diff --check`.
- Disposable PostgreSQL: `node scripts/socrates/rehearsal.mjs --serve`.
  Log: `/tmp/socrates-navigation-rehearsal.log`.
- Chromium: `node node_modules/@playwright/test/cli.js test --config
playwright.socrates.config.ts`. Log: `/tmp/socrates-navigation-browser.log`.
  Focused navigation/auth runs: `/tmp/socrates-navigation-targeted-browser.log`.
  Screenshots/traces: ignored `test-results/socrates/`.

The synthetic Auth adapter needed completed synthetic profile responses to satisfy
current registration middleware. The original uncorrected run was stopped after
two existing journeys reached profile completion. Only the isolated fixture was
updated; production registration checks remain authoritative. Navigation browser
checks use synthetic users and disposable PostgreSQL, not production Supabase Auth.

The five-slide regression uses synthetic Teaching assignments and annotations,
verifies edit/preview/return paths preserve them, and asserts no save or publish
call. It does not claim a live audit of the user's five restored assignments.
No production database connection or write was made.

NOT RUN: production build, full repository-wide Jest/lint, production signed-in
smoke, deployment, merge, real-case writes or data audit. Validation is scoped to
this navigation change; the dev server compiles the changed routes, and existing
SOCRATES checks cover the shared editor/data contracts.
