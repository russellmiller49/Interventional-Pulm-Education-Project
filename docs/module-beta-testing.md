# Development beta testing

## Live user feedback — current

The deployed beta hub uses server storage. Verified main-site users can submit feedback and
optional screenshots from any of the 12 beta modules. Reports are available to the site owner
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

The hub offers 12 modules: EBUS Guided, the two airway simulators, the existing live anatomy lesson,
Device Atlas, Peripheral Bronchoscopy Imaging, Bronchoscopy Foundations, and the five critical
care modules. The live lesson at `/en/intro-bronchoscopy/airway-anatomy` is now titled **Live
Bronchoscopy Anatomy**; the synchronized simulator is a separate entry at
`/en/learn/anatomy/airway`.

Each **Test with feedback** link opens `/en/development-beta/<module-id>`. The actual module
runs in a same-origin frame with a compact feedback toolbar outside it, so lesson navigation
and simulator state stay intact. The usual module URLs have no feedback UI and open without
an account. Therapeutic Bronchoscopy is not in the beta hub. It remains in **Modules in development**,
and its `/admin/therapeutic-bronchoscopy` page requires `site_admin` access.

## Tester feedback

The feedback button records the current module page, supported lesson/view query parameters,
and fragment, plus any selected text. Testers can edit the quoted text, write a comment, upload
or paste an image, or use the browser's screen-sharing picker to capture a screenshot. Screen
capture is user initiated and its media tracks stop immediately after capture. Browsers without
screen capture support still accept uploads and pasted images.

Images are resized to a maximum dimension of 2,000 pixels in the browser and converted to PNG.
Testers can draw highlight rectangles and undo them. The final annotated image is submitted
with the report, limited to 3 MB. Screenshots are optional; a comment is required. Drafts remain
in the current testing page when the feedback dialog closes or a save fails; reloading or
leaving that testing page discards the draft. A save confirmation is shown only after the
server persists the report. Report IDs make retries idempotent, and submissions are limited to
30 per account per hour.

## Review workspace

`/en/admin/module-feedback` requires the existing active, unexpired `site_admin` entitlement.
The **Modules in development with direct links** admin page links both the beta hub and this
workspace. Reviewers can filter by module/status, open the reported page, read the tester's
comment and selected text, view the annotated screenshot, set New / In review / Resolved, and
save private review notes. Reports are paginated in batches of 30.

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

Both were applied to the main-site project on 2026-09-25 UTC. Do not apply them to the dedicated
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

Owner-local validation and commands are documented in [Owner review feedback](module-beta-owner-review.md).

- Targeted Jest coverage: catalog/access boundaries, signed-in and admin authorization,
  submission validation, account identity, retries, image rejection, cleanup after failed saves,
  review updates, and existing development-navigation behavior.
- `npx playwright test --config playwright.module-beta.config.ts`: unlisted sign-in gate,
  real standard-route HTTP checks, normal pages without feedback controls, image upload and
  highlighting, selected-text/page context, draft preservation, failed-save retry, review edits,
  and mobile layout. Persistence responses use fixtures; real API calls confirm that preview
  cookies cannot access feedback data.
- During initial implementation, the base migration was executed against an isolated in-memory PostgreSQL (PGlite) database with
  representative auth/storage schemas. Service-role insert/read/review, check constraints,
  denied browser-role table access, and restrictive screenshot access were verified, including
  a deliberately broad pre-existing storage policy. That initial rehearsal did not mutate shared Supabase state; the live rollout and verification are recorded above.

The shared future-session asset guidance is in `AGENTS.md` and `docs/local-authoring-assets.md`.
The local `interventional-pulm-education` Codex skill also points to that map; no authoring
sources or secrets are copied into this checkout.
