# Owner review feedback

## Optional local development workflow

Live beta testing now uses Supabase; see [Live user feedback](module-beta-testing.md).
This browser-local workflow remains available for local owner testing. Use `/en/development-beta` to test modules,
then `/en/admin/module-feedback` to review and export findings. Other locale prefixes work
as well. These findings are owner notes, not reports from authenticated external testers.
Owner review and either feedback mode do not authorize public release.

## Choose a storage mode explicitly

| Configuration                                  | Storage and access                                                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local` | IndexedDB in this browser. In local development, beta hub, known beta module wrappers, and the exact feedback workspace page require no Supabase account/configuration. |
| `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=server`      | Existing verified main-site account submissions, Supabase persistence, and `site_admin` review authorization.                                                           |
| Unset or any other value                       | Server mode; fails explicitly if storage is unavailable.                                                                                                                |

Production builds always use server storage. This setting only enables owner-local in non-production runs.
Set the value in the environment used to start the local app. For a local session, for example:

```sh
NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local npm run dev:codex
```

Do not edit or copy the worktree's read-only `.env.local` mount. The public variable is fixed at
Next.js build time: restart development after changing it, and rebuild for a production mode
change. There is no runtime mode switch or automatic fallback after an API error.

Owner-local exposes only local UI shells without sign-in; it is not an owner identity check.
Anyone opening those shells on that configured site sees their own browser's records. Other
admin routes and every feedback API retain their existing authorization. This setting grants
no access to server reports, server screenshots, or server review updates. A server outage
never writes into owner storage.

## Save and review

1. Open **Test with feedback** for a module. The toolbar says **Owner review · saved locally on
   this browser**. The standard module URLs have no feedback toolbar.
2. Navigate inside the module, select text if useful, and choose **Give feedback**. Check the
   displayed page address. Write a comment and optionally upload, paste, or capture an image.
   Highlight rectangles are included in the saved PNG.
3. Choose **Save feedback locally**. The confirmation says **Feedback saved locally** and gives
   a report reference. It appears only after the IndexedDB transaction commits.
4. Use **Review feedback** or the hub's review/export link. The workspace says **Owner review
   feedback · local to this browser**. Filter by module/status, view images, open reported pages,
   and save New / In review / Resolved status and private review notes. **Refresh** reads current
   browser data (including changes from another tab). Reports display full IDs and timestamps.

**Continue testing** closes the dialog but preserves the unsent draft, including its original
page context, selected text, image, rectangles, and retry ID. **Discard draft** clears that draft.
A failed save leaves it open and intact. Unsent drafts remain in memory only and are lost on
navigation/reload; successfully saved reports survive reload and browser restart.

## Persistence, privacy, and limits

Database: `module-owner-feedback`, schema version 1, object store `reports`, keyed by report UUID.
Each record stores module/page, verbatim comment and selected text, creation/update times, status,
notes, `storage_mode`, `schema_version`, and an optional PNG Blob with MIME, byte size, and dimensions.
Retries with the same ID return the existing report without replacing its image or review notes.
Unknown record/database versions produce an explicit error without resetting or deleting data.

Storage belongs to the current browser profile and origin (scheme, host, and port). For example,
localhost and 127.0.0.1, or ports 3110 and 3001, have different stores. Local records do not sync
between browsers, devices, accounts, or Supabase. They remain on disk after sign-out. Anyone
with access to this browser profile, and scripts running on this origin, can access them. There
is no additional encryption or account isolation. Do not include patient information, passwords,
tokens, or secrets in comments or screenshots. The adapter stores no account credentials or
arbitrary query parameters. It does not write learner progress or assessment data.

The existing image editor accepts PNG/JPEG/WebP inputs under 15 MB, resizes to a maximum dimension
of 2,000 pixels, and exports the annotated PNG. Saved images are limited to 3 MB; the adapter also
checks PNG signature/IHDR and the existing server dimension ceiling of 4,096 pixels. Text limits
remain 10,000 characters for comments/notes and 3,000 for selected text.

Browser quota, disabled IndexedDB, private browsing, clearing site data, or browser eviction can
prevent storage or remove it. Export regularly. The app never automatically clears reports and
does not promise a cloud backup. Large collections are read into memory for filtering/export;
ZIP generation also needs memory for all selected images. There is no import or automatic
migration to server reports. Live simulator state absent from the URL cannot be reconstructed
by a page link; use a screenshot/comment for that state.

## Export for ChatGPT

Choose **Export feedback** for all local records, regardless of pagination or active filters.
Choose **Export filtered feedback** to include all reports matching the current module/status
filters, including other result pages. An empty selection still produces a valid empty export.
The download is `module-owner-feedback-YYYY-MM-DD.zip` (UTC export date), containing:

- `feedback.md`: grouped by module, then oldest first; full report IDs, timestamps, page paths,
  statuses, original comments, selected text, notes, and screenshot links. Text is not summarized.
- `feedback.json`: schema version 1, export timestamp, `owner-local` mode, filters, structured
  records and screenshot metadata/filenames. No base64 images.
- `screenshots/<report-id>.png`: the saved annotated PNG bytes, with deterministic UUID filenames.

Upload the ZIP to ChatGPT for consolidated analysis. Export is a browser download, not an upload;
sharing it is a separate owner action. It contains private notes and screenshots: treat the ZIP
accordingly. JSZip is the existing browser archive dependency. Export never deletes local records.

## Clear local feedback

**Clear local feedback** asks for explicit confirmation that **all** local reports and screenshots
will be permanently removed from this browser, even when filters are active. Cancel keeps them.
Export a copy first if needed. Clearing is irreversible and never runs automatically after export.
It clears only the feedback object store, not learner progress, accounts, or server feedback.

## Audited page context

The existing allowlist (`lesson`, `unit`, `step`, `tab`, `mode`, `case`, `station`, `view`, `device`)
and bounded fragments remain supported. This task adds only scalar selectors found in module code:

| Keys           | Actual use                                                                              |
| -------------- | --------------------------------------------------------------------------------------- |
| `section`      | Peripheral Imaging, EBUS Guided, Bronchoscopy Foundations Learn sections                |
| `phase`        | Imaging/Foundation stage hosts; ECMO, hemodynamics, circulatory support stage addresses |
| `activity`     | Hemodynamics and Mechanical Ventilation Learn sections                                  |
| `track`        | ECMO VV/VA lesson/session selection                                                     |
| `entry`        | Mechanical Ventilation course check                                                     |
| `focus`        | Mechanical Ventilation practice unit picker                                             |
| `seed`         | Mechanical Ventilation assessment case selection                                        |
| `start`        | Hemodynamics assessment entry                                                           |
| `nextLearn`    | Validated hemodynamics section ID following a practice case (not a redirect URL)        |
| `scopeProfile` | Airway Anatomy orientation profile                                                      |
| `output`       | Procedure workspace output selector                                                     |

Values must be 1–100 ASCII word/dot/hyphen characters; only the first value per allowed key is
retained. Fragments allow bounded word, dot, slash, and hyphen characters. Auth parameters,
redirect URLs, email values, free-text search, encoded return contexts, and multi-value Device
Atlas comparison/filter state are excluded. Device Intelligence functionality is unchanged.

## Transition to external development beta

Before sending links to external testers:

1. Export owner records, then set `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=server` and rebuild/restart.
   Local records stay in that browser; server mode neither uploads nor displays them.
2. Configure the **main-site** Supabase URL, anonymous key, and server-only service role key.
3. Apply the feedback migration to the main-site project through the authorized primary-checkout
   workflow. The existing migration predates EBUS Guided and its module-ID check does not include
   `ebus-guided`; extend that constraint in a separately reviewed migration before enabling EBUS
   server feedback. Do not use the literature project. This task leaves database migrations intact.
4. Verify sign-in, email verification, and profile completion with a real tester account.
5. Submit a real report with an image. Confirm server persistence and private screenshot access.
6. Verify an active, unexpired `site_admin` account can filter, view, and update the report; confirm
   non-admin and signed-out users cannot read reports/images or update reviews.
7. Verify missing storage produces an explicit error and no local fallback; verify owner-local
   labels are absent. Only then distribute external development-beta links.

External flow remains: development-beta → authenticated tester → Supabase feedback → admin review.
Public main-page exposure is a later, separate owner publication decision.

## Validation commands

```sh
npx jest --runInBand src/features/module-beta src/app/api/module-feedback src/lib/site-auth src/lib/supabase/auth-redirect.test.ts
npx playwright test --config playwright.module-beta-owner.config.ts
npx playwright test --config playwright.module-beta.config.ts
npm run build
npm run type-check
```

The owner Chromium suite starts with empty Supabase configuration and local preview auth disabled.
It uses actual PI/EBUS sections, real IndexedDB, an annotated screenshot, a failed transaction,
reload and persistent-profile browser restart, review updates, ZIP inspection/byte comparison,
filters, mobile layout, clear confirmation, and checks for feedback/learner API writes.
The server suite retains API fixtures for successful authenticated persistence; Jest covers the
real handlers with missing storage and denied identities. No real Supabase secrets or shared
migrations are needed for these checks.
