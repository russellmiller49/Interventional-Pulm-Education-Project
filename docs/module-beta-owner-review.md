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
   displayed page address. Write a comment and optionally upload or paste an image, or choose
   **Capture this tab** and approve **This Tab** in the browser. Use **Box**, **Arrow**, **Draw**,
   or **Text** to annotate it; all marks are included in the saved PNG. Capture verifies this
   exact tab and rejects other tabs, windows, and screens. Upload/paste remains available in
   browsers without current-tab capture support.
3. Choose **Save feedback locally**. The confirmation says **Feedback saved locally** and gives
   a report reference. It appears only after the IndexedDB transaction commits.
4. Use **Review feedback** or the hub's review/export link. The workspace says **Owner review
   feedback · local to this browser**. Filter by module/status, view images, open reported pages,
   and save New / In review / Resolved status and private review notes. **Refresh** reads current
   browser data (including changes from another tab). Reports display full IDs and timestamps.

Successfully saved reports survive reload and browser restart. So do unsent drafts, described next.

## Unsent drafts

An unsent draft is feedback you started and have not saved. In owner-local mode it is kept in this
browser, apart from saved reports, until you save or discard it. It is never a saved report: it
does not appear in the review workspace, is not exported, and is never submitted for you.

**What counts as a draft.** At least one of: a comment with a non-whitespace character; referenced
text with a visible character (whitespace or zero-width characters picked up by a stray selection
do not count); or a screenshot, with or without annotations. Opening the dialog and closing it
without adding anything is not a draft, and neither is a reserved report ID. The toolbar button
reads **Continue feedback** only while such content exists, and **Give feedback** otherwise. If you
remove everything you added, the draft is dropped and the next report starts from the page you are
on then.

**What is kept.** The report/retry ID; the testing page the draft was started on; the reported
module; the original page address (the same audited, sanitized context a saved report uses); the
comment and referenced text exactly as typed; and the screenshot as its unannotated source image
plus each Box, Arrow, Draw and Text mark as separate, still-editable annotations (Undo, Clear
marks, further marks and Remove image all work after recovery). A text note typed but not yet
placed on the image is not part of the draft.

**When it is written.** About 0.4 seconds after a change, immediately on **Continue testing** or
closing the dialog, and when the tab is hidden or the page is left. A change made in the last
fraction of a second before an abrupt reload or crash may not be captured.

**Recovery.** Reopen that module's testing page after a reload or a browser restart: the button
reads **Continue feedback** and the dialog reopens the draft with its original page, not the page
the module happens to show now. Moving around the module after starting a draft never rewrites its
page. The dialog is not opened automatically, the module frame is not navigated back, and live
simulator state is not restored. The hub lists the testing pages that hold unsent feedback. Each
testing page presents one draft at a time; if another tab left a second draft for the same page,
it is offered after the first is saved or discarded.

**The same draft open in two tabs.** This is not shared live editing: a tab shows what it loaded
and does not update while the other tab types. What is guaranteed is that neither tab's unsent
work is lost and that a draft which has been saved or discarded never comes back under its old
ID.

- **Save in one tab.** The report holds what that tab showed. If the other tab had already stored
  a newer version, that version is kept as a new unsent draft and the saving tab says so. If the
  other tab edits afterwards, its changes are kept as a new unsent draft and its dialog says that
  another tab already saved an earlier version; saving there adds a second, separate report.
- **Save in both tabs.** Exactly one report is created under the draft's ID: the first save to
  reach the reports database. The other tab is never told its work was saved unless the report
  holds exactly the same content. If its content differs, it stays an unsent draft under a new
  ID, once, and the dialog says "Another tab saved this feedback. Your different unsent changes
  were kept as a separate draft." Saving that draft is a separate choice and adds its own
  report. If both tabs held identical content, there is one report and no extra draft. A tab
  with unstored edits whose draft was meanwhile changed by another tab has those edits kept as a
  separate draft first and is asked to save again.
- **Discard in one tab.** The same, without a report: a newer version the other tab had stored,
  or an edit it makes afterwards, is kept as a new unsent draft. The discarded draft itself does
  not reappear.
- **Nothing changed in the other tab.** No extra draft is created. That tab's button may still
  read **Continue feedback** until it is used; opening it then says the draft was already saved
  or discarded in another tab and returns to **Give feedback**.
- **Both tabs edit before either saves or discards.** The first stored edit keeps the draft; the
  other tab's version is kept as a separate unsent draft and its dialog says so. Neither
  overwrites the other.

A kept draft has a new ID and the original module, page address, comment, referenced text, source
image, editable annotations and creation time. It is unsent work: it is never saved as a report
automatically.

**What one Save sends.** When **Save feedback locally** is pressed, the comment, referenced text,
page, source image with its marks, and the final annotated image are taken together in one step,
and the form is frozen until the save settles. Everything after that uses this one snapshot:
it is first stored as a draft revision (after any autosave already under way has finished), then
the save's own record is stored, and only then is the report written. A change made after the
click, by any means, is not part of that save. If the snapshot or the save's record cannot be
stored, no report is written: the dialog says "Not saved", nothing is cleared, the draft stays
open and recoverable, and pressing Save again retries. There is no transaction spanning the
drafts and reports databases; this ordering is what keeps them consistent.

**What clears it.** **Discard draft** removes that draft only. **Save feedback locally** removes it
only after the report's IndexedDB transaction has committed; the report keeps the draft's ID, so a
retry cannot create a second report. Before the report is written, each save stores its own
record of the stored version it covers and a fingerprint of exactly what it is sending; one
save's record never replaces another's. If the browser stops between the report's commit and the
removal, the next load fingerprints the report, finds the save record that sent exactly that, and
finishes from it: the version that save covered is removed, and any other stored version is kept
as a new draft. If no report was written, nothing is removed. A report with the same ID is never, by itself, a reason to remove
a draft. A failed save leaves the dialog open and the stored draft in place. Export, **Clear saved
feedback**, sign-out and switching modules do not remove a draft, and discarding a draft never
removes a saved report or learner progress.

**When it cannot be kept.** If the draft cannot be written (storage full, disabled, or unavailable
in private browsing), the dialog and toolbar say so and the draft stays open in memory until you
reload. A screenshot whose processed source image exceeds 3 MB is not kept in the draft, and the
dialog says that while keeping the text; the same image would also be refused on save. A stored
draft this version cannot read (unsupported version, damaged record, or an image that no longer
matches its record) is reported on the testing page and the hub and is left in place; **Remove
unreadable draft** deletes only those records, and only when you choose it.

## Persistence, privacy, and limits

Saved reports: database `module-owner-feedback`, version 1, object store `reports`, keyed by report UUID.
Each record stores module/page, verbatim comment and selected text, creation/update times, status,
notes, `storage_mode`, `schema_version`, and an optional PNG Blob with MIME, byte size, and dimensions.
Retries with the same ID return the existing report without replacing its image or review notes.
Unknown record/database versions produce an explicit error without resetting or deleting data.

Unsent drafts: a separate database, `module-owner-feedback-drafts`, version 3, with object stores
`drafts` (one record per draft, keyed by report UUID, record schema version 2), `images` (the
draft's source PNG Blob, keyed by the same UUID and written only when the image changes),
`finalizations` (one small record per draft ID that has been saved or discarded) and
`save_attempts` (one record per Save that has started and whose draft is not yet closed: the
draft ID, the stored revision the save covers, and a SHA-256 fingerprint of the submission; no
feedback text or image). Each draft record carries a `revision` that changes on every write and, for a draft
kept apart from another, the ID it came from. A tab writes a draft under its ID only while that
ID has not been saved or discarded and the stored revision is the one the tab last saw; otherwise
its content is written under a new ID. Draft, image and finalization records are changed together
in one IndexedDB transaction. Finalization records are kept so that a tab left open cannot write
under a closed ID later; they hold IDs and times, no feedback text or image. Versions 1
(no revisions, no `finalizations`) and 2 (no `save_attempts`) of this database are upgraded in
place: the missing stores are added and existing drafts, images and finalization records are left
as they are and stay readable. Version 2 marked a save in progress with one replaceable record
per draft; that mark is no longer written and is not treated as evidence of what was saved. Adding
drafts did not change the reports database: it is still version 1 with its single `reports` store
and unchanged record schema, so existing reports were not migrated, rewritten or made unreadable
to an older build. A newer drafts database than this version understands produces an explicit
error and is not reset. A build that only knows an earlier drafts database version gets that same explicit
error for drafts once this version has opened the database; saved reports are unaffected. Draft records are validated on every read and write with the same page
allowlist, text limits, PNG signature/IHDR check, 3 MB and 4,096-pixel limits as saved reports,
plus bounds of 500 annotations and 20,000 points per drawn stroke.

Storage belongs to the current browser profile and origin (scheme, host, and port). For example,
localhost and 127.0.0.1, or ports 3110 and 3001, have different stores. Local records, saved or
unsent, do not sync between browsers, devices, accounts, or Supabase, and are never uploaded.
They remain on disk after sign-out, and a draft is offered to whoever next opens that testing
page in this browser profile. Anyone
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
filters, including other result pages. An empty selection still produces a valid empty export. Unsent drafts are never exported: they
do not appear in `feedback.md`, `feedback.json` or `screenshots/`. Save a draft first if it should
be in the export.
The download is `module-owner-feedback-YYYY-MM-DD.zip` (UTC export date), containing:

- `feedback.md`: grouped by module, then oldest first; full report IDs, timestamps, page paths,
  statuses, original comments, selected text, notes, and screenshot links. Text is not summarized.
- `feedback.json`: schema version 1, export timestamp, `owner-local` mode, filters, structured
  records and screenshot metadata/filenames. No base64 images.
- `screenshots/<report-id>.png`: the saved annotated PNG bytes, with deterministic UUID filenames.

Upload the ZIP to ChatGPT for consolidated analysis. Export is a browser download, not an upload;
sharing it is a separate owner action. It contains private notes and screenshots: treat the ZIP
accordingly. JSZip is the existing browser archive dependency. Export never deletes local records.

## Clear saved feedback

**Clear saved feedback** asks for explicit confirmation that **all** saved local reports and
screenshots will be permanently removed from this browser, even when filters are active. Cancel
keeps them. Export a copy first if needed. Clearing is irreversible and never runs automatically
after export. It clears only the saved-report object store, not learner progress, accounts, or
server feedback. The page states beside the button that unsent drafts are kept separately and are
not removed by this action; use **Discard draft** for those.

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

1. Save or discard unsent drafts, export owner records, then set
   `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=server` and rebuild/restart. Local records and drafts stay in
   that browser; server mode neither uploads, reads nor displays them, and keeps its own unsent
   drafts in memory only.
2. Configure the **main-site** Supabase URL, anonymous key, and server-only service role key.
3. The two feedback migrations, including the catalog expansion that permits EBUS Guided, were
   applied to the main-site project on 2026-09-25 UTC; see [Deployment](module-beta-testing.md#deployment).
   A new environment needs both, through the authorized primary-checkout workflow. Do not use the
   literature project.
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
filters, mobile layout, clear confirmation, and checks for feedback/learner API writes. For
drafts it checks, in real IndexedDB: empty open/close; comment-, selection- and image-only drafts;
all four annotation tools restored pixel-for-pixel and still editable; the original page kept
after the module navigates; reload and persistent-profile restart; discard; a failed save; the
report committing under the draft's ID before the draft is cleared; a damaged record; and the
draft's absence from the workspace and the ZIP. With two tabs of one persistent profile on one
stored draft it checks: Save in one tab with newer content already stored by the other, and with
an edit made afterwards; the same two cases for Discard; a tab that changed nothing; a screenshot
with annotations carried through the conflict; both tabs editing before either finalizes; survival
across reload and a browser restart; and that no stored image is left without its draft. For
competing Saves it holds and releases each tab's storage steps to force exact orders: both tabs
begin and one report wins before the browser stops; the losing Save finishing before the winner;
either tab winning; identical content; three tabs with three versions; a stop after each Save
phase; and screenshots whose annotations differ between the tabs. Version 1 and version 2 drafts
databases are opened and upgraded with their drafts and images intact. It also compares the PI and EBUS direct routes
with their review shells at 1280, 1024, 390 and 320 pixels wide and opens every module in the
current catalog in the shell.
The server suite retains API fixtures for successful authenticated persistence, and checks that
server mode writes no draft to browser storage; Jest covers the real handlers with missing storage
and denied identities. No real Supabase secrets or shared migrations are needed for these checks.
