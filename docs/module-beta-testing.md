# Development beta testing

The unlisted hub is `/en/development-beta` (also available under the other locale prefixes).
It uses the existing main-site sign-in, email verification, and profile completion flow. Any
verified site account can test; no shared password or separate tester account is introduced.
The hub is absent from public navigation and the sitemap, with `noindex, nofollow, noarchive`.

The hub offers 12 modules: the three requested simulators, the existing live anatomy lesson,
Device Atlas, Peripheral Bronchoscopy Imaging, Bronchoscopy Foundations, and the five critical
care modules. The live lesson at `/en/intro-bronchoscopy/airway-anatomy` is now titled **Live
Bronchoscopy Anatomy**; the synchronized simulator is a separate entry at
`/en/learn/anatomy/airway`.

Each **Test with feedback** link opens `/en/development-beta/<module-id>`. The actual module
runs in a same-origin frame with a compact feedback toolbar outside it, so lesson navigation
and simulator state stay intact. The usual module URLs have no feedback UI and open without
an account. The public exception under `/admin` is limited to the exact therapeutic
bronchoscopy simulator page; the other admin surfaces retain their access requirements.

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

Apply `supabase/migrations/20260912234953_module_beta_feedback.sql` to the **main-site Supabase
project** as part of deployment. It creates `public.module_beta_feedback`, indexes, and the
private `module-beta-feedback` image bucket. Do not apply it to the dedicated literature
project. Follow the primary-checkout requirements in `AGENTS.md` for database operations.
This PR does not apply the migration to a shared or production database.

The API uses the site's existing server-only `SUPABASE_SERVICE_ROLE_KEY` and Supabase URL
configuration. No new environment variables are required. Table access is revoked from public,
`anon`, and `authenticated`; only authenticated server endpoints use the service role. A
restrictive storage policy also excludes browser roles from this bucket even if an unrelated
legacy storage policy is broad. Images are served through an admin-authenticated endpoint with
private/no-store caching, never public URLs.

Without the migration or server storage configuration, the UI returns an explicit storage
unavailable error and preserves the current draft. After deployment, verify a real tester
submission with an image and a real admin review before distributing the beta link.

## Validation

- Targeted Jest coverage: catalog/access boundaries, signed-in and admin authorization,
  submission validation, account identity, retries, image rejection, cleanup after failed saves,
  review updates, and existing development-navigation behavior.
- `npx playwright test --config playwright.module-beta.config.ts`: unlisted sign-in gate,
  real standard-route HTTP checks, normal pages without feedback controls, image upload and
  highlighting, selected-text/page context, draft preservation, failed-save retry, review edits,
  and mobile layout. Persistence responses use fixtures; real API calls confirm that preview
  cookies cannot access feedback data.
- The migration was executed against an isolated in-memory PostgreSQL (PGlite) database with
  representative auth/storage schemas. Service-role insert/read/review, check constraints,
  denied browser-role table access, and restrictive screenshot access were verified, including
  a deliberately broad pre-existing storage policy. No shared Supabase state was mutated.

The shared future-session asset guidance is in `AGENTS.md` and `docs/local-authoring-assets.md`.
The local `interventional-pulm-education` Codex skill also points to that map; no authoring
sources or secrets are copied into this checkout.
