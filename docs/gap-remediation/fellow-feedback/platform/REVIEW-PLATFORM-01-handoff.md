# REVIEW-PLATFORM-01 — feedback reliability and wrapper usability

Shared-platform lane for findings **P1–P4** of the Peripheral Imaging fellow-feedback program
(Prompt 05). It changes the development-beta feedback wrapper and its owner-local storage. It does
not change Peripheral Imaging, EBUS, Device Intelligence or any other module's content or runtime.

The source findings are AI-assisted browser observations written in a first-year-fellow persona
(`FEEDBACK_LEDGER` rows P1–P4, walkthrough PDF page 3). They are not learner-study results and not
clinical approval. "Reproduced" below means this task observed the behaviour on a local build at
the SHA below; it does not mean a human tester met it.

| Item                   | Value                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting `origin/main` | `e961695391bebdadb7c5f3fb95438ea3f6b1acbe` (merge of PR #279), unchanged between prompt preparation and the start of work. During the work `origin/main` moved to `754bed0e` (PRs #273 and #314, Branch Tracing and ICU Hemodynamics). None of their paths overlap this change, and everything below was run on the starting SHA plus this change |
| Branch                 | `claude/pi-platform-05`, cut from that SHA. Head: the PR head; it is recorded in the PR description rather than here, because this file is part of that commit                                                                                                                                                                                    |
| Worktree               | `…/Interventional-Pulm-Education-Worktrees/claude-pi-10-3` — the clean dated worktree this session was opened in, not the suggested `claude-pi-platform-05` name. Nothing else used it                                                                                                                                                            |
| Overlap check          | No open PR and no unmerged branch touches `src/features/module-beta/**`, the development-beta routes, the two beta specs or the two beta docs                                                                                                                                                                                                     |
| Evidence outside Git   | `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/review-platform-01-2026-10-02-e9616953/`                                                                                                                                                                                                                             |

## Dispositions

| ID  | Reported issue                                  | Disposition                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Feedback submission returned 503                | **Configuration/deployment finding, already resolved.** The current code and tests implement the documented mode contract; no storage change was made. Live storage was not re-verified by this task.                                                                              |
| P2  | Unsent feedback lost on reload                  | **Reproduced and repaired** in owner-local mode. Server-mode drafts are unchanged: memory only.                                                                                                                                                                                    |
| P3  | Empty dialog creates "Continue feedback"        | **Reproduced and repaired** in both modes.                                                                                                                                                                                                                                         |
| P4  | Beta wrapper stacked headers / nested scrolling | **Split.** Hidden second scroll range, covered duplicate site navigation, and toolbar height: reproduced and repaired inside the wrapper. The site header shown inside the module frame: measured and **kept by owner decision** (see the repair section). See [P4](#p4--wrapper). |

One further defect was found and repaired while verifying P2; see
[Save could wait about seven seconds](#save-could-wait-about-seven-seconds).

An independent sanity review of head `92488747` then found one merge-blocking defect: with the
same draft open in two tabs, unsent work could be lost or a discarded draft revived. That repair,
and what it changes in the sections below, is recorded in
[Sanity-review repair: one draft in two tabs](#sanity-review-repair-one-draft-in-two-tabs).
Where an earlier section describes storage version 1, a draft being cleared because a report
with its ID exists, or "last write wins", the repair section supersedes it.

### Implemented

- Owner-local unsent drafts are kept in the browser and recovered after reload and browser restart
  (P2).
- "Continue feedback" is shown only for a draft with content, in both modes (P3).
- The review shell no longer leaves a scrollable page or a second, covered copy of the site
  navigation behind the module frame, and its toolbar is shorter (P4, wrapper-owned parts).
- The Save export and the draft image are encoded synchronously, removing a multi-second stall.
- The hub names the testing pages that hold unsent feedback (owner-local only).

### Already resolved

- P1, per the repository record: `docs/module-beta-testing.md` records both feedback migrations
  applied to the main-site project and a live validation of all 12 modules on 2026-09-25 UTC.

### Configuration/deployment finding

- P1. The 503 the walkthrough saw is what the server path returns when feedback storage is not
  available. That is a property of the deployment the walkthrough ran against on 2026-09-19, six
  days before the migrations were applied. It does not show a fault in owner-local saving and was
  never a reason to change storage.

### Not reproduced

- A second scrollbar or scrollable page behind the shell at 1280 × 900, 1440 × 900 or 1024 × 768 at
  100% text. At those sizes the module frame was already the only scroll owner. The hidden scroll
  range appears when the covered site header and footer are taller than the viewport: narrow
  widths, enlarged text and browser zoom.
- Any scroll container added by the wrapper inside the module. In all 48 direct/wrapped
  measurements the frame held the same pinned elements, the same internal scroll owners (the PI
  course outline and sources panel), the same site-header height and the same horizontal-overflow
  state as the direct route.

### Owner-decided, and smaller open items

- The site header stays in the module frame in review. The owner decided this after the first
  review; the shared header contract described
  [below](#what-is-left-for-a-decision-the-site-header-inside-the-frame) is not being pursued and
  no shared layout or module offset was edited.
- Smaller items listed under [Remaining decisions and limits](#remaining-decisions-and-limits).

## P1 — feedback mode contract

Verified on the current code, on local builds:

| Setting                                        | Behaviour found                                                                                                                                        | Evidence                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local` | Non-production only. Reports in IndexedDB; hub, known wrappers and the workspace page open without an account; feedback APIs are not opened by it      | `config.ts`; `config.test.ts`; owner suite test "owner-local UI needs no account but never authorizes server feedback or other admin data" (APIs answer 503, fail closed, with no auth configured) |
| `server`                                       | Authenticated submission to Supabase; `site_admin` review                                                                                              | `route.ts`, `server.ts`; `route.test.ts`; server suite                                                                                                                                             |
| Unset or any other value                       | Server behaviour                                                                                                                                       | `config.test.ts` (`undefined`, `''`, `'server'`, `'typo'`)                                                                                                                                         |
| Production build with a stale `owner-local`    | Server behaviour                                                                                                                                       | `config.test.ts`; and the production build of this branch, built **with** `owner-local` set — see [Production build](#production-build)                                                            |
| Server storage unavailable                     | Explicit 503 with "Feedback storage is not available yet. Your draft has been kept open."; the draft stays open; nothing is written to browser storage | `storage-unavailable.test.ts`; server suite (503 fixture, then no `module-owner-feedback*` database exists)                                                                                        |

There is no code path from a failed server save to local storage: the only call to
`saveOwnerFeedback` in the wrapper is inside `if (local)`, and the new draft store is reached only
through functions that return immediately when the mode is not owner-local.

Live deployment, read-only and unauthenticated, 2026-10-03 UTC: `GET
https://interventionalpulm.com/api/module-feedback` answered **401** and `GET /en/development-beta`
answered **307** to the sign-in page. That is consistent with a server-mode deployment whose
sign-in layer is reachable. It does not exercise storage, and this task made no live submission, so
**live persistence is documented, not re-verified here**.

## P2 — recoverable owner-local drafts

**Reproduction (owner-local development build, wrapped PI, 1280 × 900, before the change).** Typed
a comment, chose **Continue testing**, reloaded: the button read **Give feedback**, the comment was
empty, and `indexedDB.databases()` was empty both before and after the reload. The draft existed
only in React state.

### Storage design

A **separate database**, `module-owner-feedback-drafts`, version 1:

| Object store | Key                | Contents                                                                                                                                                                                                                                                                                                             |
| ------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drafts`     | `id` (report UUID) | `host_module_id` (the testing page), `module_id` and `page_path` (the report's original context), `comment`, `selected_text`, `annotations`, `image` metadata (`token`, type, size, width, height) or `null`, `created_at`, `updated_at`, `storage_mode: 'owner-local'`, `record_kind: 'draft'`, `schema_version: 1` |
| `images`     | `id` (same UUID)   | `token` and the **unannotated source image** as a PNG `Blob`. Written only when the image changes, so typing does not rewrite megabytes                                                                                                                                                                              |

Why a second database rather than a new store in `module-owner-feedback`: adding a store there
means raising that database's version. Older code — `main` before this merges, another branch
served on the same port, a rollback — would then fail to open the owner's saved reports with
"This browser has a newer feedback database". With a separate database the reports database is
not touched at all.

**Upgrade behaviour.** The reports database is still version 1, with its single `reports` store and
unchanged record schema (`schema_version: 1`). There is no migration, so there is nothing that
could reset or rewrite a report. The drafts database is created on first use; its upgrade handler
only creates stores when the old version is 0. A newer drafts database than this code understands
fails with an explicit message and is not modified.

**Validation.** Every draft is validated with zod on write and on read: UUID, known testing page,
the same sanitized page-context check a saved report uses (`isFeedbackPageContext`, now shared in
`schema.ts`), 10,000 / 3,000 character limits, at most 500 annotations and 20,000 points per drawn
stroke with coordinates in 0–4,096, annotations only with an image, and for the image the same PNG
signature/IHDR check, 3 MB limit and 4,096-pixel limit as a saved report. A record that fails is
reported by key and left in place.

### Meaningful-draft definition

`isMeaningfulDraft` in `draftContent.ts`: a comment with a non-whitespace character, **or**
referenced text with a visible character after whitespace and zero-width characters (U+200B–200D,
U+2060, U+FEFF) are removed, **or** a screenshot. Annotations exist only on a screenshot, so an
image with or without marks counts. A report ID, an open dialog, whitespace and a stray empty
selection do not.

### Lifecycle

| Event                                        | Result                                                                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A change to text, image or annotations       | Written about 0.4 s later                                                                                                                                                                                                 |
| **Continue testing**, Escape or the close X  | Written immediately if meaningful; otherwise the draft is dropped (and any stored copy removed)                                                                                                                           |
| Tab hidden, page left, or leaving by a link  | Written                                                                                                                                                                                                                   |
| Reload or browser restart                    | The testing page reads its newest stored draft and shows **Continue feedback**. The dialog is not opened, nothing is submitted, and the module frame is not navigated                                                     |
| Reopening the draft                          | Original module and page, comment, referenced text, source image and every annotation; **Undo**, **Clear marks**, new marks and **Remove image** all work. The module's current page is never read into an existing draft |
| **Save feedback locally** succeeds           | The draft is removed only after the report's IndexedDB transaction has committed. The report uses the draft's ID                                                                                                          |
| Save fails                                   | The dialog stays open with the existing error; the stored draft is untouched. A retry uses the same ID                                                                                                                    |
| The browser stops between commit and removal | On the next load the stored draft's ID is found among committed reports and its removal is finished; it is not offered again                                                                                              |
| **Discard draft**                            | Removes that draft and its image. Saved reports and learner progress are not touched                                                                                                                                      |
| Draft cannot be written                      | An alert in the dialog and under the toolbar says so; the draft stays open in memory                                                                                                                                      |
| Unreadable stored draft                      | An alert on the testing page and the hub; the record stays until **Remove unreadable draft** is chosen                                                                                                                    |

Storage operations for one testing page run one at a time through a queue, so a draft write that
is still in flight cannot land after the removal that follows a save or a discard.

### Screenshot and annotation recovery

The draft stores the source image once and the annotations as data, not a flattened picture. After
a reload the editor is rebuilt from both, so the preview is pixel-identical (the browser test
compares the PNG bytes of the preview before and after a reload) and the marks remain separate
objects that can be undone. Limits: a text note typed but not yet placed is not part of the draft;
an image whose processed source is over 3 MB is not kept, the dialog says so, and the text is still
kept (the same image would be refused on save); live simulator state is not restored.

### Privacy limits

Owner-local drafts are in this browser profile for this origin only, are not encrypted beyond
what the browser does, are not synced, are never uploaded, and have no account attached. They
survive sign-out and are offered to whoever next opens that testing page in that profile. Scripts
running on the origin can read them. The same warning the docs give for saved reports applies: no
patient information, passwords, tokens or secrets. Server mode writes nothing of a draft to
browser storage; no feedback API reads, lists or serves drafts.

## P3 — truthful "Continue feedback"

**Reproduction (same build, before the change).** Opened the dialog and chose **Continue testing**
without typing: the button read **Continue feedback**. Same result closing with Escape. The label
was derived from `reportId`, which is assigned when the dialog opens.

**Repair.** The label is derived from `isMeaningfulDraft`. Closing an empty dialog resets the
draft, so the next report captures the page and selection current at that time rather than
reopening an empty draft at a stale location. Adding content and then removing all of it returns
to **Give feedback** and removes any stored copy. This applies in server mode too.

## P4 — wrapper

All measurements: owner-local development build, Playwright Chromium, the wrapper's own toolbar
measured with `getBoundingClientRect`. "Wrapped" is `/en/development-beta/<module>` with the frame
on the same module page as the direct route.

### What the three bars are

| Bar                                    | What it is                                                                                                                                                                    | Finding                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Review toolbar                         | The wrapper's own control row                                                                                                                                                 | Expected. Taller than it needed to be at narrow widths and enlarged text — repaired                                                            |
| Site header inside the frame           | The module page's own site header, exactly as on the direct route. 81 px at ≥768 px, 73 px below, 377 px at 1280 px with 200% root text, 145 px at 390 px with 200% root text | Not a duplicate on screen: the testing page's own site header is completely covered by the shell. Left unchanged; decision needed to remove it |
| Module header                          | The module's own navigation                                                                                                                                                   | Necessary                                                                                                                                      |
| Site header and footer under the shell | The testing page is rendered inside the site layout, so a second site header and the footer sit under the fixed shell                                                         | A genuine duplicate, invisible but still scrollable-to and focusable — repaired                                                                |

### Defects reproduced before the change

1. **A second scroll range behind the module.** Whenever the covered header and footer were taller
   than the viewport, the testing page itself could scroll behind the fixed shell: 274 px at
   390 × 844, 418 px at 320 × 740, 863 px at 1280 × 900 with 200% root text, 1,934 px at 390 × 844
   with 200% root text, 409 px at the 200% zoom equivalent (640 × 450). A wheel over the toolbar, a
   wheel continued past the end of the module, and the End key each moved it 274 px at 390 × 844.
   Nothing visible moved, which is exactly why it reads as a stray second scrollbar.
2. **A covered copy of the site navigation in the tab order.** At 1280 × 900 a keyboard user
   passed the skip link and then 12 invisible site-header controls before reaching **All
   modules**; Shift+Tab from **All modules** went to the covered dark-mode toggle; Tab out of the
   module went into 20 covered footer links. 36 focusable controls and one `nav` landmark were
   exposed outside the shell.
3. **Toolbar height.** 65 px at desktop widths, 121 px at 390, 141 px at 320 (PI), 217 px at
   1280 with 200% root text and 417–449 px — half the screen — at 390 × 844 with 200% root text.

### Repair, inside `BetaTestingFrame.tsx` only

- While the shell is mounted, `overflow: hidden` is set on the root element and restored on
  unmount. Wheel, touch and keyboard can no longer move the covered page.
- While the shell is mounted, the siblings of the `<main>` that contains it — the covered site
  header and footer — are made `inert`, and restored on unmount. They leave the tab order and the
  accessibility tree. The skip link stays.
- The toolbar is one wrapping row with tighter padding; the back link is icon-only below 640 px
  (it keeps its accessible name); the title wraps to at most two lines instead of pushing the row.

No shared file was edited. Nothing is sent between the frames: there is no `postMessage`, and the
wrapper still only reads the frame's own-origin location and selection when feedback is opened.
Routes, deep links, authentication, same-origin framing headers and the page-context allowlist are
unchanged. In-frame layout is unchanged by design: the module is still the standard route.

### Measurements, before → after

| Viewport                                  | Module | Direct: site header / height below it | Toolbar   | Frame height | Wrapped: height below the in-frame site header |
| ----------------------------------------- | ------ | ------------------------------------- | --------- | ------------ | ---------------------------------------------- |
| 1280 × 900 dark                           | PI     | 81 / 819                              | 65 → 53   | 835 → 847    | 754 → 766                                      |
| 1280 × 900 dark                           | EBUS   | 81 / 819                              | 65 → 53   | 835 → 847    | 754 → 766                                      |
| 1440 × 900                                | PI     | 81 / 819                              | 65 → 53   | 835 → 847    | 754 → 766                                      |
| 1440 × 900                                | EBUS   | 81 / 819                              | 65 → 53   | 835 → 847    | 754 → 766                                      |
| 1024 × 768                                | PI     | 81 / 687                              | 65 → 53   | 703 → 715    | 622 → 634                                      |
| 1024 × 768                                | EBUS   | 81 / 687                              | 65 → 53   | 703 → 715    | 622 → 634                                      |
| 390 × 844                                 | PI     | 73 / 771                              | 121 → 89  | 723 → 755    | 650 → 682                                      |
| 390 × 844                                 | EBUS   | 73 / 771                              | 121 → 89  | 723 → 755    | 650 → 682                                      |
| 320 × 740                                 | PI     | 73 / 667                              | 141 → 105 | 599 → 635    | 526 → 562                                      |
| 320 × 740                                 | EBUS   | 73 / 667                              | 121 → 105 | 619 → 635    | 546 → 562                                      |
| 1280 × 900, 200% root text                | PI     | 377 / 523                             | 217 → 185 | 683 → 715    | 306 → 338                                      |
| 1280 × 900, 200% root text                | EBUS   | 377 / 523                             | 217 → 137 | 683 → 763    | 306 → 386                                      |
| 390 × 844, 200% root text                 | PI     | 145 / 699                             | 417 → 377 | 427 → 467    | 282 → 322                                      |
| 390 × 844, 200% root text                 | EBUS   | 145 / 699                             | 449 → 337 | 395 → 507    | 250 → 362                                      |
| 640 × 450 at DPR 2 (200% zoom equivalent) | PI     | 73 / 377                              | 105 → 85  | 345 → 365    | 272 → 292                                      |
| 640 × 450 at DPR 2 (200% zoom equivalent) | EBUS   | 73 / 377                              | 105 → 65  | 345 → 385    | 272 → 312                                      |

The three rows per module measured (first page, a Learn section, Practice) gave the same toolbar
height within a viewport, and no toolbar control was outside the viewport at any size.

After the change, at 390 × 844: wheel over the toolbar, wheel past the end of the module, and End
with toolbar focus each left the covered page at scroll 0 (the module frame had been taken to its own end, 7,166 px,
before the wheel continued). The shell browser test also turns a real wheel over the module and
sees the module document move while the covered page stays at 0. Keyboard from page start: skip link, then **All modules** (1 stop, none
covered; was 13, 12 covered). Shift+Tab from **All modules**: the skip link. Outside the shell:
1 focusable control (the skip link) and 0 navigation landmarks (was 36 and 1). A script calling
`window.scrollTo` can still move the covered page, because `overflow: hidden` does not forbid
scripted scrolling; no user input reaches it.

**Three kinds of enlargement, kept apart.** "200% root text" is `html { font-size: 200% }` injected
into the testing page and the frame. "200% zoom equivalent" is a 640 × 450 viewport at device pixel
ratio 2, the layout a 1280 × 900 window has at 200% zoom. **Native browser zoom** was also run
once: `chrome.tabs.setZoom(tab, 2)` from a throwaway extension in full Chromium (the API behind
Cmd/Ctrl +), reporting `devicePixelRatio` 2 and a 640 × 446 viewport in a 1280-wide window. Wrapped
PI at native 200%: toolbar 85 px, frame 640 × 361, no control outside the viewport, wheel over the
toolbar leaves the covered page at 0, no horizontal overflow in the module; direct PI at native
200%: site header 73 px, no horizontal overflow. CSS `zoom` was not used.

### What is left for a decision: the site header inside the frame

In review, the frame shows the site header above the module: 81 px on a desktop viewport, and at
200% root text 377 px at 1280 wide. Removing it would return more room than every wrapper-owned
change above combined. It was **not** done, for two reasons that a wrapper-only change cannot
answer.

1. **It needs a shared contract.** The wrapper could hide `body > div > header` in the frame and
   set `--site-header-height: 0px` from outside, with no shared file edited. But module code does
   not uniformly use that variable. Hard-coded header offsets remain in `devices/[productId]/page.tsx`
   (`lg:top-16` on a sticky row), `learning-module-v2.module.css` (`100dvh - 5rem` in three places,
   the shared learning-module shell), `branch-tracing.module.css` (`100dvh - 4rem`) and
   `mechanical-ventilation.module.css` (`100dvh - 5rem`). With the header gone those would show a
   64–80 px gap above a sticky row or a short stage. Correcting them means editing Device
   Intelligence, the shared lesson stage and three module stylesheets, all outside this lane.
2. **It changes what review shows.** Today the frame is the standard route exactly, so a
   screenshot or a comment about sticky rows, focus clearance or text reflow describes what a
   learner gets. PI-FOCUS-01, PI-OUTLINE-01 and PI-WRAP-01 were all tuned against the real header.

The shared change that would be required, for one authorized patch: (a) `components/layout/Layout.tsx`
omits the site header and footer and sets `--site-header-height: 0px` when the page is rendered
for review — the signal should be something the server can check for same-origin framing, for
example a dedicated query value together with `Sec-Fetch-Dest: iframe`, and never a `postMessage`;
(b) the hard-coded offsets above move to `var(--site-header-height)`; (c) each of the current
catalog's modules is re-checked in the shell. Until then the wrapper-owned repair stands on its own.

## Save could wait about seven seconds

Found while repeating the new draft test. With **Save** clicked just as a draft write landed, the
dialog stayed on **Saving…** for 6.8 s. Instrumentation showed the time was entirely between
`canvas.toBlob` being called for the export and its callback (start +2,463 ms, callback +9,175 ms);
IndexedDB then committed in 2 ms. Chromium schedules `toBlob` encoding in idle time and falls back
on timeouts of about 1 s and 5.7 s when the main thread does not go idle.

The first version of this change made that worse by adding a second `toBlob` for the draft image.
Both are now replaced by a synchronous `canvas.toDataURL` encode (`canvasPng` in
`screenshotDraftImage.ts`), measured at 6–9 ms for a 1440 × 947 image and producing the same bytes
(the existing server test already compared the submitted file with `toDataURL` output byte for
byte). After the change: 30 of 30 instrumented saves at the timings that had stalled finished in
45–241 ms.

Whether a deployed build could stall the same way before this change was **not established**: the
stall was only observed on this branch, with a draft write as the trigger, and the pre-change
export used the same `toBlob` call. The export change applies to server mode as well.

## Files changed

| Path                                                                          | Change                                                                                                                 |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/features/module-beta/BetaTestingFrame.tsx`                               | Draft persistence, recovery and queue; label from content; scroll lock and inert covered chrome; compact toolbar       |
| `src/features/module-beta/ownerDraftStore.ts` (new)                           | The drafts database                                                                                                    |
| `src/features/module-beta/draftContent.ts` (new)                              | Meaningful-draft definition                                                                                            |
| `src/features/module-beta/screenshotDraftImage.ts` (new)                      | Synchronous PNG encode; source-image encode/decode for drafts                                                          |
| `src/features/module-beta/OwnerDraftNotice.tsx` (new)                         | Hub notice of testing pages holding unsent feedback                                                                    |
| `src/features/module-beta/ScreenshotEditor.tsx`                               | `onDraftChange` callback; export through the synchronous encoder                                                       |
| `src/features/module-beta/ownerFeedbackStore.ts`                              | `ownerFeedbackExists` (a key count; reads no record). Nothing else                                                     |
| `src/features/module-beta/schema.ts`                                          | `feedbackPagePathSchema` and `isFeedbackPageContext` extracted for reuse; report validation is behaviourally unchanged |
| `src/app/[locale]/development-beta/page.tsx`                                  | Renders the hub notice in owner-local mode                                                                             |
| `src/features/module-beta/ownerDraftStore.test.ts` (new)                      | 17 tests                                                                                                               |
| `src/features/module-beta/BetaTestingFrame.test.tsx` (new)                    | 14 tests                                                                                                               |
| `e2e/module-beta-owner.spec.ts`                                               | 8 new browser tests; failed-save test extended; route warm-up                                                          |
| `e2e/module-beta.spec.ts`                                                     | 1 new server-mode isolation test; the no-fallback check now also covers the drafts database                            |
| `docs/module-beta-owner-review.md`                                            | Unsent drafts, storage, export and clear behaviour, transition steps, validation                                       |
| `docs/module-beta-testing.md`                                                 | Server-mode draft behaviour, the review shell, validation                                                              |
| `docs/gap-remediation/fellow-feedback/platform/REVIEW-PLATFORM-01-handoff.md` | This file                                                                                                              |

Not changed: `FeedbackWorkspace.tsx`, `ownerFeedbackExport.ts`, `catalog.ts`, `config.ts`,
`server.ts`, the feedback API routes, `proxy.ts`, `access.ts`, `next.config.mjs`,
`components/layout/**`, any module, any migration.

A documentation correction rode along because the two beta docs contradicted each other: the
"Transition to external development beta" step in `module-beta-owner-review.md` still said the
EBUS catalog migration was outstanding, while `module-beta-testing.md` records it applied on
2026-09-25. The step now points at that record.

## Required test coverage

| #   | Requirement                                           | Where                                                                                                               |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Empty open/close leaves no draft                      | Component "returns to Give feedback…"; browser "an empty feedback dialog is not a pending draft…"; server suite     |
| 2   | Comment-only draft persists                           | Store "keeps a comment-only draft…"; browser ("narrow EBUS…": a comment-only draft is offered again after a reload) |
| 3   | Selected-text-only draft persists                     | Store; component "ignores a whitespace-only selection but keeps real referenced text"; browser, across a reload     |
| 4   | Image-only draft persists                             | Store; component; browser, across a reload with identical PNG bytes                                                 |
| 5   | Annotated-image draft persists                        | Store (all four tools); browser (four tools, byte-identical preview after reload)                                   |
| 6   | Original module/page context persists                 | Store; browser (`page_path` in IndexedDB and in the dialog after reload and restart)                                |
| 7   | Frame navigation does not rewrite the context         | Component "keeps the original sanitized page…"; browser (module moved, then draft reopened)                         |
| 8   | Reload restores the draft                             | Browser                                                                                                             |
| 9   | Persistent-profile browser restart restores the draft | Browser                                                                                                             |
| 10  | Continue feedback only for meaningful drafts          | Component (four tests); browser; server suite                                                                       |
| 11  | Explicit discard removes the draft                    | Store; component; browser                                                                                           |
| 12  | Discard does not remove saved reports                 | Store; browser (report ID still present after discard)                                                              |
| 13  | Save clears the draft only after commit               | Component "clears the draft only after the report has committed" (held promise); browser                            |
| 14  | Failed save keeps the draft                           | Component; browser (aborted transaction, then reload still offers the draft)                                        |
| 15  | Retry keeps the same report ID                        | Store; component; browser (saved ID equals the failed draft's ID)                                                   |
| 16  | Saved report and draft remain distinct                | Store "keeps a saved report and a draft distinct, even under one ID"; browser                                       |
| 17  | Unsupported/corrupt draft errors safely               | Store (three tests); component; browser "a damaged draft record is named, kept, and removed only on request"        |
| 18  | Upgrade preserves existing reports                    | Store "leaves the reports database at its version…"; browser (earlier report's PNG bytes unchanged at the end)      |
| 19  | Draft does not appear in exports                      | Store; browser (ZIP inspected after restart)                                                                        |
| 20  | Server mode neither reads nor writes draft storage    | Component "keeps drafts in memory only…"; server suite "server-mode drafts stay in memory…"                         |

The store tests run against `fake-indexeddb`; the browser tests use Chromium's real IndexedDB and,
for restart, a persistent profile. The component tests mock storage and are not offered as proof of
persistence.

## Test results

Final code, on the starting SHA plus this change. Local builds only.

| Check                                                                                                                                | Result                                               |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `npx jest --runInBand src/features/module-beta`                                                                                      | 6 suites, 74 tests, all pass (43 before this change) |
| `npx jest --runInBand src/features/module-beta src/app/api/module-feedback src/lib/site-auth src/lib/supabase/auth-redirect.test.ts` | 13 suites, 141 tests, all pass                       |
| `npx playwright test --config playwright.module-beta-owner.config.ts` (owner-local development build)                                | 11 of 11 pass                                        |
| `npx playwright test --config playwright.module-beta.config.ts` (local server-mode fixture, development build)                       | 8 of 8 pass                                          |
| `NODE_OPTIONS=--max-old-space-size=12288 npm run type-check`                                                                         | Exit 0                                               |
| `eslint` on changed paths                                                                                                            | Exit 0, no warnings                                  |
| `prettier --check` on changed paths; `git diff --check`                                                                              | Clean                                                |
| Production build                                                                                                                     | See [Production build](#production-build)            |

### Runs that did not pass, and what each one was

Kept as they happened; none was resolved by loosening a behavioural assertion.

1. **Owner suite, first run: 10 passed, 1 failed.** The new shell test asserted a toolbar of at
   most 96 px at 320 × 740; it measured 105 px. The bound was an estimate written before
   measuring: at 320 the storage label needs a second line. It is now 112 with that reason in the
   spec; the toolbar was 141 px there before.
2. **Owner suite, second run: 10 passed, 1 failed.** The draft test moved the frame with a hard
   navigation to a route the development server had not compiled, and the server reloaded the
   testing page. The test now follows a real module link, as the existing helper does.
3. **Draft test repeated three times: 1 passed, 2 failed.** **Save** sat on **Saving…** past the
   5 s expectation. This was a real defect in the first version of this change and is the subject
   of [Save could wait about seven seconds](#save-could-wait-about-seven-seconds). Fixed in
   application code, not in the test.
4. **Owner suite, full: 11 of 11.**
5. **Draft tests repeated: 7 passed, 2 failed — discarded.** I edited the wrapper's source while
   that run was in progress, so hot reload disturbed it. It is evidence of nothing either way.
6. **Draft tests repeated with no edits in flight: 11 passed, 1 failed.** The existing
   `openSection` helper waited for a frame address that never came: the trace shows three
   requests for the testing page, that is, two development-server reloads after first-time route
   compiles. The suite now compiles its routes over HTTP before opening any page.
7. **Draft tests repeated on a cold development cache with that warm-up: 12 of 12.**
8. **Final owner suite: 11 of 11. Server suite: 8 of 8, twice.**
9. **`baxter-crrt-workbench-wayfinding.spec.ts`, "the beta-wrapped route…"**, the one other spec
   that drives the wrapper, run with owner-local mode set: on a cold server 1 failed for the same
   reason (the trace shows a second request for the testing page after the practice route
   compiled); against a warmed server 2 of 2 passed. That spec belongs to the CRRT lane and was
   not changed.
10. **`tsc` at the default heap** aborted out of memory; the rerun with a larger heap exited 0.

### Not run

The whole Jest suite and the repository-wide `npm run lint` (changed paths were linted). The PI,
EBUS and other module Playwright suites, since no module file changed. Firefox and Safari. A real
phone or touch input. Any authenticated or mutating request to the live site.

### Which build each conclusion rests on

| Conclusion                                                                 | Build                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| P2 and P3 reproduction; draft recovery; shell scroll, keyboard and toolbar | Owner-local development build, beta-wrapped route                                           |
| Module layout inside the frame equals the direct route                     | Owner-local development build, direct **and** beta-wrapped routes, PI and EBUS              |
| Every catalog module opens in the shell                                    | Owner-local development build, beta-wrapped routes, all 12 entries of the current catalog   |
| Server mode keeps drafts in memory and writes nothing to browser storage   | Local server-mode fixture (development build, preview sign-in cookie, stubbed feedback API) |
| Authorization and storage-unavailable behaviour                            | Jest against the real route handlers; server-mode fixture                                   |
| Production ignores a stale `owner-local` setting                           | Local production build                                                                      |
| The deployed site persists feedback                                        | Repository documentation only. Not verified by this task                                    |

## Production build

`NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid
NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only NODE_OPTIONS=--max-old-space-size=8192 npm run build` —
**exit 0**, with no development server running. Values came from the process environment; no
`.env` file was read, written or copied, and nothing was deployed. `owner-local` was set on purpose,
at build time and again when serving, to test that production ignores it.

Warnings, none from a changed file, retained rather than hidden: `metadataBase` unset (17),
embedded training-app chunk-size notices, a contentlayer build-dependency cache notice (6), the
mermaid/langium "Critical dependency" notice under `components/board-review`, "Compiled with
warnings", and Node `DEP0205`.

Served with `node .next/standalone/server.js` on `127.0.0.1:3166` and probed over HTTP:

| Request                                                                       | Result                                                                  |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `/en/development-beta`                                                        | 307 to `/en/login?next=…` — server mode, not an owner-local shell       |
| `/en/development-beta/peripheral-imaging`, `/en/development-beta/ebus-guided` | 307 to sign-in                                                          |
| `/en/admin/module-feedback`                                                   | 307 to sign-in                                                          |
| `/en/peripheral-imaging`, `/en/ebus-guided` and one Learn section of each     | 200, `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'`, `noindex` |
| `/en`, `/en/login`                                                            | `X-Frame-Options: DENY`                                                 |
| `GET /api/module-feedback`                                                    | 401                                                                     |

The review shell itself could not be opened on the production build: it needs a real signed-in
account, the preview sign-in cookie is a development-only aid, and this task used no production
credentials. The shell's behaviour is therefore evidenced on development builds (owner-local, and
the server-mode fixture), not on the production build. **Nothing here verifies the deployment.**

## Remaining decisions and limits

1. **Site header inside the review frame** — owner-decided: it stays. This is an accepted
   limitation, not a pending decision.
2. **Toolbar at 200% root text on a phone** is still 337–377 px of 844. The remaining height is the
   storage label and module title wrapping at double size. Shortening the visible label at
   enlarged text would need a decision, because that label is the explicit local/server marker.
3. The button is now **Clear saved feedback**; it removes saved reports only, and the page says
   beside it that unsent drafts are kept separately. **Discard draft** removes a draft.
4. **One draft per testing page is presented at a time.** A second draft, including one kept
   apart by a two-tab conflict, is offered after the first is saved or discarded; there is no
   list. Two tabs no longer overwrite each other: see the repair section.
5. **Last-moment edits.** A change made within about 0.4 s of an abrupt reload or crash may not be
   stored. Closing the dialog, hiding the tab and leaving the page all write immediately.
6. **Server-mode drafts** remain memory-only by design. Persisting them would need its own
   privacy and account-isolation design.
7. **Live P1 re-verification** needs someone authorized to submit on production. This task did not.
8. The owner suite now compiles its routes over HTTP before opening a page. On a cold development
   server, Next reloaded every open page after a first-time route compile (three requests for the
   testing page in the trace), which returned the frame to the module's first page mid-test. That
   is development-server behaviour; it was not seen on the production build.

## Sanity-review repair: one draft in two tabs

Bounded repair on the same PR and branch, starting from the reviewed head
`92488747b3f6b4176b3967e39245b78ae352eeaf`. `origin/main` was `60e3bd64` when the repair started;
nothing it added since the branch point touches `src/features/module-beta/**`, the
development-beta routes, authentication, package or build configuration, or shared layout, and
the branch was not rebased.

### The defect

Tabs A and B restore the same stored draft. B edits and its edit is stored. A saves its older
version as the report, under the shared ID. On the next load the old restore logic saw "a report
with this ID exists" and deleted the stored draft, which by then held B's newer text. Discard had
the mirror problem: after A discarded, B's next write put the draft back under the same ID. The
per-page promise queue orders one tab's own storage work; it never coordinated two tabs.

### Design

All of it is durable state in the drafts database, changed in single IndexedDB transactions over
`drafts`, `images` and a new `finalizations` store. No BroadcastChannel, lock, or in-memory flag
is relied on.

- **Revision.** Every draft write stores a new random `revision`. A tab remembers the revision it
  last read or wrote and names it on every later operation.
- **Finalization record.** One per closed draft ID: `outcome` (`saved`, `discarded`), the
  `revision` the save or discard covered, for a save the fingerprint of what the report holds, a
  time, and `fork` (the ID and revision of a stored version that was moved aside). Both outcomes
  close the ID permanently. (The first repair also wrote a replaceable `saving` outcome here;
  see the second repair below, which replaced it.)
- **Write rule.** A draft is written under its ID only if the ID is not closed and the stored
  revision is the one the tab named. If the ID is closed, or another tab stored a different
  revision, the content is written under a fresh ID in the same transaction, with `forked_from`,
  and the tab continues under that ID.
- **Close rule (Save and Discard).** If the stored draft is at the revision the finalizing tab
  named, it and its image are removed. If it is at any other revision, it is another tab's newer
  work: record and image are moved to a fresh ID, unchanged, and the finalization record points
  to it.
- **No duplicate.** The moved copy keeps its revision. When the tab that wrote it later writes
  under the closed ID, storage recognises that revision in the finalization record and continues
  the moved copy instead of creating a second one.
- **Save across two databases.** Superseded by
  [Second repair: competing Saves](#second-repair-competing-saves).
- **Restore.** Before offering a draft, a testing page settles stored drafts: a closed ID's
  covered revision is removed and any other is moved to a fresh ID; an interrupted save is
  finished as above. A report existing with the same ID is never sufficient to remove a draft.
  For a draft stored by the reviewed head, which had no finalization records, a same-ID report
  removes it only when both are text-only and identical; otherwise it is kept under a fresh ID.
  Unreadable records are still reported and left in place.

| Database / store                    | After the repair                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `module-owner-feedback` / `reports` | Version 1, unchanged. No migration, no rewrite                                             |
| `module-owner-feedback-drafts`      | Version 2 after this repair; version 3 after the second repair                             |
| … `drafts`                          | Record schema 2: adds `revision` and `forked_from`. Version 1 records are read as they are |
| … `images`                          | Unchanged                                                                                  |
| … `finalizations` (new)             | `id`, `outcome`, `revision`, `at`, `fork`. No feedback text or image                       |

The upgrade only adds the store. Existing drafts and images are not rewritten; a version 1 record
takes the current shape the next time it is edited. A database newer than version 2 still fails
with the explicit message and is not modified. A build that knows only version 1 gets that
message for drafts once this build has opened the database; reports are unaffected.

### What the owner sees

| Situation                                      | Result                                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A saves; B had already stored newer content    | Report holds A's content. B's content is an unsent draft under a new ID. A says a newer version from another tab was kept                             |
| A saves; B edits afterwards                    | B's content becomes an unsent draft under a new ID; B's dialog says another tab already saved an earlier version. The saved ID is never written again |
| A discards; B had already stored newer content | B's content is an unsent draft under a new ID; A says so. The discarded ID stays closed                                                               |
| A discards; B edits afterwards                 | B's content becomes an unsent draft under a new ID. The discarded draft does not return                                                               |
| B changed nothing                              | No draft is created. B's button can read **Continue feedback** until used; opening it says the draft was already saved or discarded elsewhere         |
| B presses Save on a draft A already saved      | No report is overwritten or duplicated silently: B's edits stay open as a new draft and B is told to save again to add a new report                   |
| Both edit before either finalizes              | First stored edit keeps the ID; the other tab's version becomes a separate unsent draft and its dialog says so                                        |

A kept draft carries the original module, sanitized page address, comment, referenced text,
source image, editable annotations and creation time. It is never saved as a report on its own.
This is conflict handling, not live shared editing: a tab does not update while another types.

### Other changes in this repair

- **Clear saved feedback** replaces "Clear local feedback", with "Unsent drafts are kept
  separately and are not removed by this action." beside it and matching confirmation and result
  wording. Deletion behaviour is unchanged.
- **Skip link.** Unchanged. The shell test now states the claim precisely: wheel, keyboard and
  scroll chaining leave the covered page at 0; activating the skip link may move that hidden
  page to its target while the fixed shell still covers the whole viewport, which the test
  checks at five points. No scroll position is forced.
- **Orphan images.** Draft and image are removed, moved or replaced in one transaction in every
  path. The browser tests check that no image is stored without its draft after save, discard,
  conflict and screenshot replacement. No garbage collection of pre-existing orphans was added.
- The 0.4 s write delay, the synchronous PNG export and server-mode behaviour are unchanged.
  Server mode still never opens the drafts database.

### Files changed by the repair

`ownerDraftStore.ts` (revisions, finalizations, conflict rules, version 2), `ownerFeedbackStore.ts`
(`createOwnerFeedback` reports whether the save wrote the report; `ownerFeedbackContent` reads one
report's text fields; database unchanged), `BetaTestingFrame.tsx`, `OwnerDraftNotice.tsx`,
`FeedbackWorkspace.tsx` (wording only), their two test files, `e2e/module-beta-owner.spec.ts`, and
the three docs. `components/layout/**`, module stylesheets, curriculum, API routes, migrations and
authentication were not touched.

### Test results for the repair

Final repair code, local builds only.

| Check                                                                                                                                | Result                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `npx jest --runInBand src/features/module-beta`                                                                                      | 6 suites, 91 tests, all pass (74 at the reviewed head) |
| `npx jest --runInBand src/features/module-beta src/app/api/module-feedback src/lib/site-auth src/lib/supabase/auth-redirect.test.ts` | 13 suites, 158 tests, all pass                         |
| `npx playwright test --config playwright.module-beta-owner.config.ts`                                                                | 19 of 19 pass (11 at the reviewed head)                |
| `npx playwright test --config playwright.module-beta.config.ts`                                                                      | 8 of 8 pass                                            |
| `NODE_OPTIONS=--max-old-space-size=12288 npm run type-check`                                                                         | Exit 0                                                 |
| `eslint --max-warnings 0` and `prettier --check` on changed paths; `git diff --check`                                                | Clean                                                  |
| `npm run build` (12 GB heap)                                                                                                         | Exit 0                                                 |

The eight new browser tests use two pages of one persistent Chromium profile and real IndexedDB:
Save in A with newer content already stored by B (through reload and a browser restart, then
saving the kept draft as its own report); Save in A then an edit in B; the same two for Discard;
no divergence for Save and for Discard; a screenshot with annotations through the conflict
(report bytes equal A's preview, kept draft's preview equal B's, Undo still works, image record
moved with the draft, replacement and discard leave no image); both tabs editing before either
finalizes; and a version 1 database created by hand, upgraded on open with its record unrewritten
and its image intact. Each two-tab case first asserts that tab A is still the original page.

Runs that did not pass during the repair, kept separate from the final results:

1. Owner suite, first full run: 15 of 19. One failure was the new upgrade test seeding version 1
   from the hub, which had already opened the database at version 2 (test error; it now seeds
   from a page that never opens drafts). Two were locators matching the notice twice, in the
   toolbar and in the still-closing dialog (test error). One was the cold-server case below.
2. Two subset runs on a cold development server: the first two-tab test failed because the
   server reloaded tab A when tab B first loaded, so A re-read the stored draft and was no longer
   stale. This is the development-server reload already described for this suite. The describe
   block now takes that reload in a throwaway context first, and the precondition check fails
   the test plainly if it ever recurs. Not seen on a warm server; not a product behaviour.
3. One Jest run during development: the aborted-transaction test received a different error
   message after the transaction helper was rewritten; the helper now reports every storage
   failure with the one documented message.

### Limits that remain

1. Finalization records are not pruned. Each is a few hundred bytes with no feedback content;
   removing one would let a tab left open since then write under that ID again.
2. A tab that changed nothing learns its draft was finalized elsewhere when it is next used or
   reloaded, not at the moment it happens.
3. (Closed by the second repair.) Two Saves could replace each other's `saving` record, so a
   stop after the report committed could finish from the wrong revision.
4. A draft stored by the reviewed head beside a same-ID report is kept as a new draft unless it
   is text-only and identical to the report, so an interrupted save from that head can leave one
   extra draft of already-saved content. It is never the other way round.
5. The 0.4 s abrupt-reload limit and the retained site header are as before.

## Second repair: competing Saves

A second independent review of head `3775ed642f915b10879bc638cd5dc4375ff23d41` reproduced two
defects, both from one cause: an in-progress Save was one replaceable `saving(revision)` record
per draft ID, so a second Save overwrote the first Save's recovery identity.

- **Durable loss.** B had stored a different revision R2. A began Save of R1; B began Save and
  replaced `saving(R1)` with `saving(R2)`; A's report won; the browser stopped. Recovery read
  "report exists, `saving(R2)`", concluded R2 was what had been saved, and deleted it.
- **Duplicate.** With B's losing Save finishing first, B kept its work as a new draft while its
  stored revision stayed under the original ID; A's later finalization moved that revision to
  another new ID. Two identical drafts.

`origin/main` was `9086f2af` at the start of this repair, with nothing overlapping these paths;
the branch was not rebased.

### Model

- **One immutable record per Save.** Store `save_attempts`, keyed by a fresh `attempt_id`:
  `draft_id`, the stored `revision` the save covers, the `fingerprint` of the submission, a time.
  It is added once and never updated. A Save never reads, replaces or removes another Save's
  record. Records are removed only when their draft ID closes, or by their own Save when its
  report write fails.
- **Fingerprint.** SHA-256 over the module, page address, comment, referenced text and the
  SHA-256 of the final annotated PNG bytes: exactly what a report holds. It is computed from the
  submission before the report is written, and can be computed again from any stored report.
- **Submission tied to storage.** Superseded by
  [Third repair: one snapshot, attempt before report](#third-repair-one-snapshot-attempt-before-report).
- **One winner.** The reports database is unchanged: the first write of a report ID creates it,
  later writes return the existing report untouched. No metadata was added to report records.
- **Which attempt won** is read from the report, not from the draft database's history: the
  winning attempts are those whose fingerprint equals the report's. Only the revisions they
  covered count as saved. Time stamps, which record was written last, the current stored
  revision and enumeration order are not consulted. If no attempt matches, no stored revision
  counts as saved and the stored draft is kept.
- **Closing is idempotent.** `finishOwnerDraftSave(id, reportFingerprint)` is the same operation
  for the winner, a loser and recovery: remove the stored draft if its revision is one a winning
  attempt covered, otherwise move it (record and image) to a fresh ID; write the finalization
  record; delete the draft's attempts. A stored draft can be moved only once because moving
  removes it from the original ID, so a later call, from any tab or load, finds nothing to move.
- **Loser.** A Save that finds the report already written, or the ID already closed, compares
  fingerprints. Equal: the report holds this tab's content; no draft is made and a stored copy
  of that same revision is removed. Different: the tab continues the copy that closing already
  made of its stored revision if there is one, otherwise its content is written once under a
  fresh ID. It is told the work was kept as a draft, never that it was saved, and no second
  report is created until the owner saves that draft.
- **Recovery.** Report absent: nothing is removed, whatever was attempted. Report present and
  the ID not closed: the load fingerprints the report and performs the same close. Version 2
  `saving` records are read as "not closed" and carry no weight.

| Database / store               | After the second repair                                   |
| ------------------------------ | --------------------------------------------------------- |
| `module-owner-feedback`        | Version 1, one `reports` store, record shape unchanged    |
| `module-owner-feedback-drafts` | Version 3                                                 |
| … `drafts`, `images`           | Unchanged from version 2 (draft record schema 2)          |
| … `finalizations`              | Adds optional `fingerprint`; `saving` no longer written   |
| … `save_attempts` (new)        | `attempt_id`, `draft_id`, `revision`, `fingerprint`, `at` |

Upgrades from version 1 and from version 2 only add stores; drafts, images and finalization
records are not rewritten.

### Results

Final code of the second repair, local builds only.

| Check                                                                                                                                | Result                                                |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `npx jest --runInBand src/features/module-beta`                                                                                      | 6 suites, 101 tests, all pass (91 before this repair) |
| `npx jest --runInBand src/features/module-beta src/app/api/module-feedback src/lib/site-auth src/lib/supabase/auth-redirect.test.ts` | 13 suites, 168 tests, all pass                        |
| `npx playwright test --config playwright.module-beta-owner.config.ts`                                                                | 31 of 31 pass (19 before this repair)                 |
| `npx playwright test --config playwright.module-beta.config.ts`                                                                      | 8 of 8 pass                                           |
| `NODE_OPTIONS=--max-old-space-size=12288 npm run type-check`                                                                         | Exit 0                                                |
| `eslint --max-warnings 0` and `prettier --check` on changed paths; `git diff --check`                                                | Clean                                                 |
| `npm run build` (12 GB heap)                                                                                                         | Exit 0                                                |

The twelve new browser tests run in real Chromium tabs of one persistent profile on real
IndexedDB. To force exact orders, an init script lets the test hold, release or fail a tab's next
open of one database; a released open is the browser's own. Storage is read through a separate
page so the tabs under test are not disturbed.

| Case                                                                | Result                                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1: both attempts stored, A's report commits, browser stops         | After restart and three loads: report holds A; B's stored version is one draft under a new ID; original ID closed; no attempts left               |
| S2: B's losing Save finishes before A's finalization                | Report holds A; B kept exactly once; B continues that one draft; unchanged after reloads and restart                                              |
| S3: both Save, A wins                                               | One report (A); B one draft, not in the review workspace; saving it later adds exactly one more report                                            |
| S4: both Save, B wins                                               | One report (B); A's content one draft                                                                                                             |
| S5: identical content, both Save                                    | One report; no draft, image or attempt left; both tabs report it saved                                                                            |
| S6: three tabs, three versions, all Save                            | One report; the other two versions one draft each; same two IDs after restart and reload                                                          |
| Stop after both attempts, before any report                         | No report; the stored draft is unchanged under its ID and still saves normally                                                                    |
| Stop after the report commits, before the draft is closed           | Report holds A; B's stored version kept once                                                                                                      |
| Stop after the winner closed the draft, before the loser was told   | Same                                                                                                                                              |
| Stop after the loser's work was moved, before its tab was told      | Same                                                                                                                                              |
| Competing Saves with screenshots (A: Box, Arrow; B adds Draw, Text) | Report image equals A's preview; B's draft preview equals B's; one image record, same source token, no orphan; Undo works before and after reload |
| Version 2 database with a `saving` mark naming the newer revision   | Opens at version 3; the newer wording is kept as a draft; the existing report is untouched                                                        |

Jest adds the same S1 and S2 sequences at the store level, the mirrored winner, both attempt
orders, a report that no attempt matches, release of a failed save's own attempt, and a version 2
upgrade with drafts, images and finalizations intact.

Runs that did not pass during this repair:

1. One store test asserted a hard-coded attempt ID while sharing a counter with other tests
   (test error).
2. One frame test showed two kept drafts. The test's stand-in for the draft store did not
   continue an already-kept copy the way the real store does; the stand-in was corrected. The
   real store and the browser tests never produced two.
3. Owner suite, first full run: 30 of 31. The existing failed-save test aborts "the next
   `add`", which is now the Save's own attempt record rather than the report; the report then
   saved, correctly, since draft storage must not block a save. The injection now targets the
   reports store, which is what the test is about.

### Limits that remain after the second repair

1. Finalization records are still not pruned. Attempt records for a draft that is never saved
   or discarded (for example, emptied and abandoned after a failed save) also remain; each holds
   IDs, a revision and a hash.
2. Work that was only in a tab's memory when the browser stopped is lost, as before. The
   guarantees are about stored revisions. A losing Save stores its work before it does anything
   else, so this window is the existing 0.4 s one.
3. (Changed by the third repair.) A Save no longer proceeds when the draft database cannot be
   written; see below.
4. A tab that changed nothing still learns of a finalization elsewhere only when next used.
5. Fingerprints need Web Crypto, which browsers provide on HTTPS and on localhost, the same
   condition `crypto.randomUUID` already imposed.

## Third repair: one snapshot, attempt before report

A third independent review of head `54e29bfddf664cf9941b909b7de02510fe4d4014` accepted the
attempt-and-fingerprint model and found two defects at the edge of the Save path itself.

- **A. A failed attempt write did not stop the Save.** `submit` swallowed the error from
  `beginOwnerDraftSave` and went on to write the report. With the real `save_attempts`
  transaction aborted, the report committed, the draft was removed and the dialog said "saved",
  with no attempt on record.
- **B. The pieces of one Save were read at different times.** Save waited on a queued autosave
  while the form stayed editable. Pressed with text B, then edited to C: the queued write stored
  C and returned C's revision, while the fingerprint and report were built from B. The attempt
  tied B's fingerprint to C's revision, and finalization deleted the stored C.

`origin/main` was `1dfc5845` at the start of this repair.

### What changed

- **One snapshot.** `captureSaveSnapshot()` runs synchronously when Save is pressed, before any
  await: draft ID, module, page, comment, referenced text, the encoded source image, a copy of
  the annotation list, and the final annotated PNG. The editor's export is now synchronous so it
  is part of the same step. Nothing later in the Save reads React state, `latest.current` or the
  live editor draft.
- **Frozen form.** The Save flag is set in that same turn, so a second Save is ignored and no
  autosave can start under it. While `sending`, the text fields and the screenshot editor are
  inside a disabled fieldset and the editor ignores pointer, paste, upload and capture input.
  This is protection for the owner; correctness comes from the snapshot.
- **Explicit persistence of the snapshot.** `persistSaveSnapshot(snapshot)` runs in the storage
  queue, so an autosave already in flight finishes first. It returns the draft ID and the stored
  revision that holds exactly the snapshot: the revision this tab last stored or restored if its
  recorded content signature equals the snapshot's, otherwise a new revision written from the
  snapshot. That revision, not "whatever is stored now", is what the attempt names. If storage
  could only keep it under a new ID because another tab changed or closed the draft, Save stops,
  the tab follows the new draft, and the owner is asked to save again. If the write fails, Save
  stops with "Not saved".
- **Mandatory attempt.** The attempt record (draft ID, that revision, the snapshot's fingerprint)
  must commit before `createOwnerFeedback` is called. If it does not, Save stops with "Not
  saved": no report, no success message, nothing cleared, the draft still stored and open.
- **No fallback.** `finishOwnerDraftSave` lost its `ownRevision` parameter. Closing a draft uses
  the stored attempts only; a report can no longer exist under a draft ID without the winner's
  attempt on record.
- **A signature fix found by the new browser test.** The record of "what this tab last stored"
  was computed after the write returned, from the live annotation list. A mark added while an
  autosave was in flight made that record describe four marks when three were stored, and Save
  reused the three-mark revision. The signature and the annotation copy are now taken before
  the write is awaited.

Owner-local Save order: (0) capture snapshot and freeze; (1) store the snapshot as a draft
revision; (2) fingerprint the snapshot; (3) commit the attempt naming that revision and
fingerprint; (4) write the report from the snapshot; (5) close the draft by fingerprint, as
before. Server mode is unchanged apart from sending the same snapshot: no draft database, no
attempts, memory-only drafts, no local fallback.

### Results

Final code of the third repair, local builds only.

| Check                                                                                                                                | Result                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `npx jest --runInBand src/features/module-beta`                                                                                      | 6 suites, 106 tests, all pass (101 before this repair) |
| `npx jest --runInBand src/features/module-beta src/app/api/module-feedback src/lib/site-auth src/lib/supabase/auth-redirect.test.ts` | 13 suites, 173 tests, all pass                         |
| `npx playwright test --config playwright.module-beta-owner.config.ts`                                                                | 34 of 34 pass (31 before this repair)                  |
| `npx playwright test --config playwright.module-beta.config.ts`                                                                      | 8 of 8 pass                                            |
| `NODE_OPTIONS=--max-old-space-size=12288 npm run type-check`                                                                         | Exit 0                                                 |
| `eslint --max-warnings 0` and `prettier --check` on changed paths; `git diff --check`                                                | Clean                                                  |
| `npm run build` (12 GB heap)                                                                                                         | Exit 0                                                 |

New real-browser tests (real Chromium, real IndexedDB):

| Case                                                                                              | Result                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The real `save_attempts.add` transaction is aborted, with a screenshot and Box, Arrow, Draw, Text | Twice in a row: "Not saved" shown, no reports database content, no success message, the same draft with its four marks and its one image still stored, form editable, preview unchanged. After a reload it is offered again. It then saves exactly once, and the report image equals the preview |
| Autosave in flight, text becomes B, Save pressed, then C typed and C forced in from script        | The fields are disabled and typing does nothing. Before the report is written: the stored draft is B, and the one attempt names B's revision with the fingerprint of B (computed independently in the test). The report is B. No draft, image or attempt remains                                 |
| A third mark autosaving, a fourth added just before Save, a drag on the frozen image afterwards   | The covered revision holds the same source image and exactly the four marks; the attempt's fingerprint equals the one computed from the previewed PNG; the report PNG equals the preview; nothing is left stored                                                                                 |

Jest adds: attempt failure and snapshot-store failure each submitting nothing; the A-then-B
queued autosave order with the attempt naming B's revision; a frozen form, a second submit
ignored, and state forced to C after the click not reaching the draft write, the attempt or the
report; and reuse of the stored revision when nothing changed.

All earlier competing-Save browser cases (S1 to S6, the four stop phases, the screenshot
conflict), the Discard cases and both database upgrades pass unchanged in the same run.

Runs that did not pass during this repair:

1. One new frame test called `Blob.text()`, which the Jest DOM does not provide (test error).
2. First run of the three new browser tests: 1 of 3.
   - The image test failed for a real reason, described above as the signature fix: the attempt
     named a revision that held three marks while the report held four. Fixed in the product.
   - The attempt-failure test hung in a test helper that opened the reports database before any
     report existed (helper error; it now returns an empty list when the database is absent).

### Limits after the third repair

1. Owner-local Save now needs working draft storage. Where the drafts database cannot be
   written (storage full or disabled, a newer database version, some private-browsing modes),
   feedback cannot be saved locally until that is resolved; the dialog says so and keeps the
   draft open in memory.
2. A change made after Save is pressed is not sent and, if the save succeeds, is not kept. The
   form is frozen so the owner cannot make one.
3. If closing the draft fails after the report commits, the report stands and the next load
   closes the draft from the stored attempt. The two databases are not one transaction.
4. The earlier limits on pruning, in-memory work at a browser stop, and stale unchanged tabs
   are unchanged.

## Confirmations

No migration was written or run. No Supabase table, bucket or setting was created or changed. No
production write, submission or deployment was made; the only requests to the live site were the
two unauthenticated GETs recorded under P1. Authentication and authorization are unchanged. There
is no server-to-local fallback. No PI, EBUS or other module curriculum or runtime file was edited,
and Device Intelligence is untouched. `.env.local` was not read, written or copied; test
configuration came from process environment. Feedback text and images in tests were synthetic. No
paid API was called. Prompt 06 was not started. The PR is open and not merged; auto-merge is not
enabled.
