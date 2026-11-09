# Development beta testing

## Live user feedback — current

The deployed beta hub uses server storage. Verified main-site users can submit feedback and
optional screenshots from any of the 13 beta modules. Reports are available to the site owner
at `/en/admin/module-feedback` using the existing `site_admin` account. Open **Admin → Modules
in development → Review module feedback**, or visit that address directly. The workspace
supports module/status filters, screenshots, review status, and private notes. Choose **Refresh**
to fetch new reports. Feedback is collected in the workspace; no email notifications are sent.

Production always uses Supabase, even if an old `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local`
setting remains in the hosting environment. Missing/unrecognized mode configuration also uses
server storage. Server errors preserve the current draft and never fall back to local storage.

## Optional local owner review

For local development only, set `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local` to save findings
and screenshots in IndexedDB. These notes remain in that browser and are not sent to the owner
workspace on the live site. Export existing local notes before clearing browser data. See
[Owner review feedback](module-beta-owner-review.md) for local storage and export details.

## Public release — later

Public main-page exposure requires a separate publication decision after external beta.
Neither feedback mode nor a resolved report authorizes publication.

## Server-backed beta design

The unlisted hub is `/en/development-beta` (also available under the other locale prefixes).
It uses the existing main-site sign-in, email verification, and profile completion flow. Any
verified site account can test; no shared password or separate tester account is introduced.
The hub is absent from public navigation and the sitemap, with `noindex, nofollow, noarchive`.

The catalog holds 15 modules; the hub lists 11 of them: EBUS Guided, the EUS-B Simulator,
Synchronized Bronchoscopy (`/en/learn/anatomy/airway`), Bronchial Branch Tracing, Peripheral
Bronchoscopy Imaging, Bronchoscopy Foundations, and the five critical care modules. By the owner's
decision of 2026-11-04, Live Bronchoscopy Anatomy, Dolphin Bronchoscopy, Device Atlas and the
Literature Atlas are `withheld`: the hub does not list them, and admins open them from
**Modules in development** (`/en/admin/modules`). They keep their catalog entries, so their past
feedback stays reviewable and their wrapper addresses still open when typed.

The hub separates **Ready for review** from **Still in development**. Ready cards appear first
with a tester note: who the module is for, what it teaches, an estimated time where the module's
own sections and cases support one, where feedback helps most, and known limits. The ready section
is omitted when empty. All 11 listed modules currently remain `preview` under **Still in
development**, grouped by Bronchoscopy and Critical care; empty groups are omitted. Every listed
`preview` card carries the same note (see
[Beta reviewer readiness](gap-remediation/beta-reviewer-readiness-2026-11-03.md); the notes for
EUS-B, Branch Tracing, ECMO, CRRT, Hemodynamics and MCS were added on 2026-11-04 at the owner's
request and list each module's open hold among its known limits).
Readiness changes presentation only: every card keeps its
**Test with feedback** wrapper link and **Standard module** link, with the same access and
feedback behavior. A ready label does not authorize clinical use or public release. Modules
move to `ready` with a real tester note only after the gate in
[Beta finish line](gap-remediation/beta-finish-line.md#2-the-gate) is satisfied.

Each **Test with feedback** link opens `/en/development-beta/<module-id>`. The actual module
runs in a same-origin frame with a compact feedback toolbar outside it, so lesson navigation
and simulator state stay intact. Inside the frame the module is the standard route unchanged,
including the site header, so what a tester sees and captures matches what a learner gets. The
site page that sits underneath the review shell is covered by it; while the shell is open that
page cannot be scrolled by wheel, touch or keyboard, scrolling past the end of the module does not
chain into it, and its navigation is inert, so the module frame is the only scrolling document and
the keyboard goes from the skip link straight to the toolbar. Activating the skip link may move
that covered page to the link's target (about one site-header height); the fixed shell still
covers the whole viewport, so nothing underneath becomes visible. The site header inside the
frame is kept by owner decision. The usual module URLs
have no feedback UI and open without an account, with one exception below. Therapeutic Bronchoscopy is not in the beta hub. It remains in **Modules in development**,
and its `/admin/therapeutic-bronchoscopy` page requires `site_admin` access.

Live Bronchoscopy Anatomy is the exception. Its standard address,
`/en/intro-bronchoscopy/airway-anatomy`, sits under the intro course layout, which answers 404
in production to everyone without a course entitlement or `site_admin`, signed in or not. A
development server enables draft modules and hides that. Reviewers therefore open the same lesson
at `/en/development-beta/live-anatomy/lesson`, which is what the wrapper frames and what the card's
**Standard module** link opens. The proxy requires a verified, registered account there, as for
the rest of the hub, and the page sits outside `/intro-bronchoscopy`, so it grants no course
access. It needs no database row: the feedback module id `live-anatomy` is unchanged.

## Tester feedback

The feedback button records the current module page, supported lesson/view query parameters,
and fragment, plus any selected text. Testers can edit the quoted text, write a comment, upload
or paste an image, or choose **Capture this tab**. On supported browsers the permission picker
prefers **This Tab**, excludes entire screens, and disables switching the shared surface. A unique
Capture Handle verifies the exact beta-testing tab before any pixels are attached; selecting
another tab, a window, or a screen is rejected without replacing the current screenshot. Capture
is user initiated and its media tracks stop immediately after one frame, cancellation, or failure.
Browsers without verified current-tab capture still accept uploads and pasted images.

Images are resized to a maximum dimension of 2,000 pixels in the browser and converted to PNG.
The visible annotation toolbar offers **Box**, **Arrow**, **Draw**, and **Text**. Testers can
undo the last annotation, clear all marks, remove the image, or retake the tab. Text notes can be
placed by clicking the screenshot or using the keyboard-accessible **Add note at top** button.
The enlarged feedback dialog gives the screenshot more room. The final annotated image is submitted
with the report, limited to 3 MB. Screenshots are optional; a comment is required. On the
deployed beta, drafts are held in memory in the current testing page when the feedback dialog
closes or a save fails; reloading or leaving that testing page discards the draft, and nothing
about it is written to browser storage. The dialog says so. While a draft is unsent, the browser
asks before a reload or a closed tab discards it, and **All modules** asks for confirmation before
leaving; staying keeps the draft, and with no draft nothing is asked. The browser's Back button,
when the testing page was opened from the hub, is an in-app navigation the browser does not ask
about and still discards the draft. The toolbar button reads **Continue feedback** only
while the draft holds a comment, referenced text or an image; an empty dialog that is opened and
closed leaves **Give feedback**. Local owner review keeps unsent drafts in that browser instead;
see [Unsent drafts](module-beta-owner-review.md#unsent-drafts). A save confirmation is shown only after the
server persists the report. Report IDs make retries idempotent, and submissions are limited to
30 per account per hour.

## Overall review

Detailed feedback is one problem on one page. The overall review is one reviewer's verdict on a
whole module: how far they got, how good it is, whether it is ready, and who they are. Each
reviewer gives one per module and can edit it later; editing replaces their earlier answers.
Owner-local mode does not offer it.

**Where and when.** The testing toolbar has an **Overall review** button beside **Give feedback**
(**Edit overall review** once one is saved). Leaving by **All modules** offers it once per visit
("Before you go", with Start overall review / Leave without it / Stay), and only when:

- the module has no overall review from this reviewer;
- they spent at least 10 minutes in it, or sent at least one detailed report, on this visit;
- no detailed report or review answers are unsent (the existing unsent-feedback question comes
  first, and the offer is not stacked on it).

Each hub card says **Overall review: not yet**, or **submitted <date> · Edit**; the Edit link
opens the module with the form open (`?review=1`). The hub intro tells reviewers to send detailed
feedback while testing and finish each module with an overall review. Nothing interrupts a
reviewer mid-module.

**Who the reviewer is** comes from the site profile the hub already requires (role, training
level, years in practice); the form shows it ("Reviewing as PCCM Fellow · Fellow Year 2") and
does not ask again. The reviewer answers **as a learner** or **as an educator or practicing
clinician**. Students, residents and fellows start as learners, everyone else as educators, and
anyone may switch.

**Questions** (`src/features/module-beta/reviewSchema.ts`; every choice is required, the two text
boxes are optional):

- Everyone: how much of the module they went through; their experience with the topic before it;
  overall quality, clarity, ease of use and the interactive parts (Poor to Excellent); the level
  for the audience on the hub card (too basic / about right / too advanced); readiness (ready now
  / after minor fixes / needs major changes / not ready); what worked best; the one thing to fix.
- Learners: confidence with the topic before the module and now (retrospective pre/post); whether
  they would use it to prepare for a rotation, a procedure or boards.
- Educators: clinical accuracy (or "can't judge"); whether it is consistent with how they teach or
  practice; whether they would assign it; and each of the module's own **Where feedback helps
  most** prompts from its hub card (`rollout.ts`), answered looks right / needs changes / didn't
  reach it. Each prompt is stored with its wording, and the server refuses answers given against
  wording that has since changed.

Unsent answers stay in memory on the testing page, like a detailed draft, and are covered by the
same leave warnings. Switching "Answer as" alone is not unsent work. Change `reviewFormVersion`
whenever a question or its options change meaning.

## Review workspace

`/en/admin/module-feedback` requires the existing active, unexpired `site_admin` entitlement.
The **Modules in development with direct links** admin page links both the beta hub and this
workspace. Reviewers can filter by module/status, open the reported page, read the tester's
comment and selected text, view the annotated screenshot, set New / In review / Resolved, and
save private review notes. Reports are paginated in batches of 30. Each report names its sender
from their site profile (for example "PCCM Fellow · Fellow Year 2").

The **Overall reviews** tab summarizes each module: reviews from learners and educators, median
and mean overall quality, mean clarity, ease of use, interactive parts and (educators) accuracy,
learners' confidence before and now, and the readiness counts. With one module selected it also
counts the educators' answers to that module's own prompts. Each review card shows the reviewer,
their answers and text, and a button that opens that reviewer's detailed reports on the module.
**Export CSV** downloads the reviews shown, with cells that a spreadsheet will not run as formulas.

Every feedback API separately verifies a real main-site account; review, image retrieval, and
status updates also check `site_admin`. Local development preview cookies do not authorize
feedback writes or real review data access. Tester identity comes from the verified account.
Stored URLs exclude arbitrary query parameters such as auth tokens.

## Deployment

The **main-site Supabase project**, `tqnhxlwvkkswuckszlee` (Endoreels), needs these migrations:

1. `supabase/migrations/20260912234953_module_beta_feedback.sql`: feedback table, indexes,
   and private `module-beta-feedback` screenshot bucket.
2. `supabase/migrations/20260925055243_expand_module_beta_feedback_catalog.sql`: permits EBUS
   Guided submissions. Historical Therapeutic Bronchoscopy records remain valid and reviewable, including local notes and exports.
3. `supabase/migrations/20261004072344_add_eus_b_simulator_to_module_beta_feedback.sql`: permits
   EUS-B Simulator submissions. Applied to Endoreels on 2026-10-07: source version
   `20261004072344` is recorded in production migration history as
   `20261007011957_add_eus_b_simulator_to_module_beta_feedback`. Verification at
   **2026-10-07 01:19:58 UTC** confirmed that the prior 13 allowed module IDs were preserved,
   EUS-B was added, and the PostgREST schema reload completed. **Live EUS-B feedback has not
   yet been verified**; this migration record is not a successful tester submission or admin
   review. No migration or database write was run for this documentation update.
4. `supabase/migrations/20261016025933_add_literature_atlas_to_module_beta_feedback.sql`: permits
   Literature Atlas submissions, keeping all 14 earlier module IDs. **Not applied.** Until it is,
   feedback on the Literature Atlas card cannot be saved; applying it is one of the owner's
   go-live steps in [Literature Atlas preview](literature-atlas-preview.md).
5. `supabase/migrations/20261103180000_add_dolphin_bronchoscopy_to_module_beta_feedback.sql`:
   permits Dolphin Bronchoscopy submissions, keeping every earlier module ID. **Not applied.**
   Until it is, feedback on the Dolphin Bronchoscopy card cannot be saved. Apply it from the
   primary checkout.
6. `supabase/migrations/20261109120000_module_beta_reviews.sql`: the overall-review table, one
   row per reviewer per module, with the same service-role-only access as the feedback table.
   **Not applied.** Until it is, hub cards show no review status, the form says reviews are not
   open yet and keeps the reviewer's answers on the page, and the leave offer is not shown.
   Module IDs are checked by the API against the catalog, so adding a module needs no change to
   this table.

The first two were applied to the main-site project on 2026-09-25 UTC. Do not apply them to the dedicated
literature project. Follow the primary-checkout requirements in `AGENTS.md` for database operations.

In server mode, the API uses the site's existing server-only `SUPABASE_SERVICE_ROLE_KEY` and Supabase URL
configuration. `NEXT_PUBLIC_MODULE_FEEDBACK_MODE` selects local development storage only; it never changes
API authorization. Table access is revoked from public,
`anon`, and `authenticated`; only authenticated server endpoints use the service role. A
restrictive storage policy also excludes browser roles from this bucket even if an unrelated
legacy storage policy is broad. Images are served through an admin-authenticated endpoint with
private/no-store caching, never public URLs.

In server mode, without the migration or server storage configuration, the UI returns an explicit storage
unavailable error and preserves the current draft. After deployment, verify a real tester
submission with an image and a real admin review before distributing the beta link.

## Validation

Live verification on 2026-09-25 UTC used a temporary verified tester against
`https://interventionalpulm.com`: all 12 modules saved reports; an EBUS screenshot upload and
idempotent retry passed; a temporary reviewer retrieved the private image, saved status/notes,
and opened the real review workspace. Browser-role table reads, tester review access, and public
screenshot access were denied. The test reports, screenshot, session, temporary entitlement, and
account were removed afterward. The existing owner account retains active, unexpired `site_admin`.

Owner-local validation and commands are documented in [Owner review feedback](module-beta-owner-review.md). That document also
states what happens when the same owner-local draft is open, saved or discarded in more than one
tab: one report per draft ID, and different unsent work kept as a separate draft rather than
merged or lost. It is conflict handling, not shared editing. Server-mode drafts are unaffected:
they stay in memory in one tab.

- Targeted Jest coverage: catalog/access boundaries, signed-in and admin authorization,
  submission validation, account identity, retries, image rejection, cleanup after failed saves,
  review updates, the server-mode leave warnings (present only while a draft is unsent, gone
  after a send, a discard or clearing it, never in owner-local mode), and existing
  development-navigation behavior.
- `npx playwright test --config playwright.module-beta.config.ts`: unlisted sign-in gate,
  real standard-route HTTP checks, normal pages without feedback controls, image upload and
  all four annotation tools, exact annotated PNG submission, selected-text/page context,
  draft preservation, failed-save retry, review edits, and mobile upload fallback; an empty dialog
  leaving no draft, and a server-mode draft leaving no IndexedDB database or storage key behind and
  not surviving a reload; the reload and **All modules** prompts appearing only while a server-mode
  draft is unsent, with staying keeping it. Native Chromium
  capture verifies the module is visible without the feedback overlay and the media track stops.
  Other tabs/windows/screens and cancelled retakes preserve the previous annotated screenshot.
  Persistence responses use fixtures; real API calls confirm that preview
  cookies cannot access feedback data.
- During initial implementation, the base migration was executed against an isolated in-memory PostgreSQL (PGlite) database with
  representative auth/storage schemas. Service-role insert/read/review, check constraints,
  denied browser-role table access, and restrictive screenshot access were verified, including
  a deliberately broad pre-existing storage policy. That initial rehearsal did not mutate shared Supabase state; the live rollout and verification are recorded above.

The shared future-session asset guidance is in `AGENTS.md` and `docs/local-authoring-assets.md`.
The local `interventional-pulm-education` Codex skill also points to that map; no authoring
sources or secrets are copied into this checkout.
