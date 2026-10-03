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

| ID  | Reported issue                                  | Disposition                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | Feedback submission returned 503                | **Configuration/deployment finding, already resolved.** The current code and tests implement the documented mode contract; no storage change was made. Live storage was not re-verified by this task.                                                                                      |
| P2  | Unsent feedback lost on reload                  | **Reproduced and repaired** in owner-local mode. Server-mode drafts are unchanged: memory only.                                                                                                                                                                                            |
| P3  | Empty dialog creates "Continue feedback"        | **Reproduced and repaired** in both modes.                                                                                                                                                                                                                                                 |
| P4  | Beta wrapper stacked headers / nested scrolling | **Split.** Hidden second scroll range, covered duplicate site navigation, and toolbar height: reproduced and repaired inside the wrapper. The site header shown inside the module frame: measured, left as it is, and **needs an owner/shared-platform decision**. See [P4](#p4--wrapper). |

One further defect was found and repaired while verifying P2; see
[Save could wait about seven seconds](#save-could-wait-about-seven-seconds).

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

### Needs owner/shared-platform decision

- Whether the site header should be removed from the module frame in review, which needs a shared
  header contract ([details](#what-is-left-for-a-decision-the-site-header-inside-the-frame)).
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

1. **Site header inside the review frame** — described above. Owner authorization needed for the
   shared patch; nothing is blocked meanwhile.
2. **Toolbar at 200% root text on a phone** is still 337–377 px of 844. The remaining height is the
   storage label and module title wrapping at double size. Shortening the visible label at
   enlarged text would need a decision, because that label is the explicit local/server marker.
3. **Clear local feedback** still removes saved reports only. Whether it should also remove unsent
   drafts is a product choice; today it does not, the doc says so, and **Discard draft** does.
4. **One draft per testing page is presented at a time.** A second draft left by another tab for
   the same page is kept and offered after the first is saved or discarded; there is no list.
   Two tabs editing the same draft overwrite each other's record, last write wins.
5. **Last-moment edits.** A change made within about 0.4 s of an abrupt reload or crash may not be
   stored. Closing the dialog, hiding the tab and leaving the page all write immediately.
6. **Server-mode drafts** remain memory-only by design. Persisting them would need its own
   privacy and account-isolation design.
7. **Live P1 re-verification** needs someone authorized to submit on production. This task did not.
8. The owner suite now compiles its routes over HTTP before opening a page. On a cold development
   server, Next reloaded every open page after a first-time route compile (three requests for the
   testing page in the trace), which returned the frame to the module's first page mid-test. That
   is development-server behaviour; it was not seen on the production build.

## Confirmations

No migration was written or run. No Supabase table, bucket or setting was created or changed. No
production write, submission or deployment was made; the only requests to the live site were the
two unauthenticated GETs recorded under P1. Authentication and authorization are unchanged. There
is no server-to-local fallback. No PI, EBUS or other module curriculum or runtime file was edited,
and Device Intelligence is untouched. `.env.local` was not read, written or copied; test
configuration came from process environment. Feedback text and images in tests were synthetic. No
paid API was called. Prompt 06 was not started. The PR is open and not merged; auto-merge is not
enabled.
