# PI-FELLOW-DRAFTS — owner review packet (Prompt 04)

> **AI-authored draft — not clinically reviewed.** Prepared 2026-09-22 by Claude (Opus 5.5) for
> Russell Miller's review. Documentation only. Nothing in this directory changes the running
> module, a question or case identity, stored progress, a clinical-review status or a shared index.
>
> **Owner decisions recorded 2026-09-22.** Russell decided OD4-01 … OD4-12, including explicit
> deferrals (Tier 3 patient media held; QS-2 held; LAO/RAO mapping, lobe naming and authentic
> motion/opacity/banding examples deferred; teaching-CT rights basis to be resolved before release).
> See [owner-decisions.md](owner-decisions.md#recorded-owner-decisions-2026-09-22). These are scope
> and editorial decisions, not clinical review. The six Prompt 03 holds remain open.

The walkthrough these drafts answer is **AI-persona feedback** (a first-year-fellow persona), not a
learner study. Its educational comments are treated as design hypotheses. No learner validation,
faculty approval or clinical approval is claimed anywhere in this packet.

## Base

- `origin/main` at start: **`745146f6e40bd536c201313f0480ddde2ee03ca3`** (fetched 2026-09-22).
- The prompt's expected baseline `c1fb8a0d4d0704ea7fc3050d34512104edba79b7` is an ancestor. The 20
  commits between them touch CRRT, EBUS and ICU-hemodynamics files only:
  `git diff --stat c1fb8a0d..origin/main` lists no path under `src/features/peripheral-imaging`,
  `docs/gap-remediation/fellow-feedback/pi` or `public/peripheral-imaging`. PI content read for
  this packet is therefore identical to the Prompt 03 merge state.
- Branch `claude/pi04`, worktree `Interventional-Pulm-Education-Worktrees/claude-pi04`.

## Files

| File                                                           | What it gives you                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [evidence-needs.md](evidence-needs.md)                         | Complete map: 16 practice cases, 8 integrated cases, every in-section question, and every in-section activity that shows a visual. Each is classified. |
| [question-revision-samples.md](question-revision-samples.md)   | Eight before/after question samples. They are samples, not a bank rewrite.                                                                             |
| [connected-cases.md](connected-cases.md)                       | Two unfolding teaching-case storyboards (IC1), five decisions each                                                                                     |
| [media-and-reference-briefs.md](media-and-reference-briefs.md) | Five media/reference specifications (3.1, 5.2, 5.5, 3.5 + 6.6, PR5)                                                                                    |
| [owner-decisions.md](owner-decisions.md)                       | The decisions Russell needs to make before implementation, plus the Prompt 03 holds these drafts depend on                                             |

Read `owner-decisions.md` first if time is short: its first section records what was decided and
deferred, and every decision links back to its evidence.

## Evidence tags

Every clinical or technical claim in these drafts carries one tag. They separate what a source
actually read in this pass says from what the module already says, what the code does, what is
newly proposed, and what nobody has established.

| Tag   | Meaning                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S** | Directly supported by a supplied or local source **actually read in this pass**: the walkthrough PDF (page), a pack file, a Prompt 03 artifact, or a local PubMed record (PMID). For literature this means the **abstract only**, never the full text. |
| **M** | Existing module content says it (file, block or item id). The module's own citation is shown. Its full source text was **not** re-read here, so the tag vouches for "the module says this", not "the paper says this".                                 |
| **I** | Inferred from the current implementation (file, symbol): what the code or data actually does.                                                                                                                                                          |
| **T** | Proposed teaching structure or wording drafted in this pass. New words; nothing supports them yet except the reasoning shown.                                                                                                                          |
| **U** | Unresolved. No source read in this pass supports it. It stays open and must not be filled from general knowledge.                                                                                                                                      |
| **O** | Owner judgment required.                                                                                                                                                                                                                               |

## Sources actually read (whole packet)

Each file also lists the subset it relied on.

**Supplied pack** (`Interventional-Pulm-Local-Data/module_update_9_19/PI_Claude_Implementation_Pack/`):
`00_START_HERE.md`, `04_PI_CASE_AND_MEDIA_DRAFTS.md`, `FEEDBACK_LEDGER.md`, `FEEDBACK_LEDGER.json`
(extracted records for all assigned and related IDs), `SOURCE_CONTEXT.md`, `OWNER_DECISIONS.md`.
Not read: `01`–`03`, `05`, `06` task files and `MANIFEST.json` (other lanes).

**Supplied handoff:** `~/Downloads/PI_MODULE_HANDOFF_2026-09-21.md` (read in full).

**Walkthrough PDF:** _Peripheral Bronchoscopy Imaging — First-Year Fellow Walkthrough Feedback
Log.pdf_, 48 pages. Its full text layer was extracted with `pdftotext -layout` and read, pages 1–48.
**The embedded screenshots were not inspected as images**; statements about what a screenshot shows
come from the log's own captions.

**Merged Prompt 03 artifacts** (`docs/gap-remediation/fellow-feedback/pi/`):
`PI-FELLOW-03-handoff.md` (full), `PI-FELLOW-owner-decisions.md` (full),
`PI-FELLOW-03-sanity-review.md` (lines 1–120: findings, all 37 dispositions, six owner areas),
`PI-FELLOW-03-text-map.md` (header and structure only; its row-level strings were not re-read, the
handoff and sanity review carry the same dispositions).

**Current PI module at the base SHA** (`src/features/peripheral-imaging/`, read-only):

- `content/microCases.ts` (all 16 practice situations), `content/cases.ts` (all 8 integrated cases),
  `data/questions.ts` (every item: stems, choices, keys, rationales, takeaways, sources, safety flags),
  `content/interpretationChecks.ts` (all seven v2 checks), `content/stageItems.ts` (plausibility
  overrides, management-decision set, section item wiring), `content/teachingExamples.ts` (all
  authored examples, fixed-example state and evidence declarations), `content/learningActivities.ts`
  (activity builders, `INDEPENDENT_IMAGE_PANEL_SECTIONS`), `content/stageLessons.ts` (check
  instructions, lines 100–260), `content/pathway.ts`, `content/relatedCases.ts`,
  `content/learnerCopy.ts`, `content/doseQuantities.ts` (template lines).
- `data/lessons.ts`: the six registered objectives and Sections 1, 5, 6, 9, 12, 13, 14, 16 and 17 in
  full. Other sections were read only through the structural dump below.
- `data/sources.ts`: every registered source record, dumped with author, title, year, kind,
  `supports` and URL.
- Components, for what a learner is shown: `components/ImagingCaseActivity.tsx` (the image rule for
  practice cases), `components/stage/TeachingPanels.tsx` (`SignalImage`, `SignalComparison`,
  `DoseRecord`, panel dispatch), `components/suite/views/TomosynthesisView.tsx` (prior-layer
  behaviour, by search), `components/suite/views/ConeBeamView.tsx` (scout legend),
  `components/suite/suiteModel.ts` (`GANTRY_VARIANTS`), `components/suite/staffModel.ts`,
  `components/PeripheralImagingHub.tsx` ("Who this is for").
- Assets: `public/peripheral-imaging/README.md`, `manifest.json`, `anatomy/manifest.json`, and
  `docs/peripheral-imaging/slicer-assets.md` (provenance section).
- Shared copy gate (for proposed wording only): `src/features/learning-module/activity/clinicalLearningItem.ts`
  lines 1–110.
- **Structural dumps.** Section activities, step instructions, lab goals and check items were
  listed with read-only `tsx` scripts that import the module's own registries (kept in the session
  scratchpad, not committed). Every count in `evidence-needs.md` comes from those dumps.

**Local literature records** (`Interventional-Pulm-Local-Data/literature/nbib-files/`),
**abstracts only**, matched by DOI or exact title:

| Registered id | PMID     | What was read                                                                                                                                   |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `setser`      | 33447430 | Abstract: technical review of CBCT for bronchoscopy (systems, image quality, dose, room set-up, acquisition practice)                           |
| `wabip`       | 39033746 | Abstract: WABIP white paper on radiation principles, reporting consensus and practical protection measures                                      |
| `mobile`      | 36899971 | Abstract: retrospective mobile-CBCT series of 51 patients (thin/ultrathin scope, radial probe, m-CBCT)                                          |
| `verhoeven`   | 34162799 | Abstract: CBCT with augmented fluoroscopy, 238 patients, dose and accuracy learning curves with tailored protocols                              |
| `ilocate`     | 32561439 | Abstract: I-LOCATE; atelectasis in dependent segments under general anesthesia, atelectasis mimicking or obscuring lesions on radial probe EBUS |
| `vespa`       | 35803302 | Abstract: VESPA randomized trial (already verified in Prompt 03; re-read here)                                                                  |
| `frontier`    | 38923084 | Abstract: FRONTIER first-in-human robotic navigation with integrated tomosynthesis                                                              |
| `confirm`     | 41698810 | Abstract: CONFIRM prospective multicentre shape-sensing robotic bronchoscopy with integrated mobile CBCT                                        |
| `pritchett`   | 30179922 | Abstract: CBCT with augmented fluoroscopy and electromagnetic navigation, 75 patients                                                           |
| `saad`        | 39625122 | Abstract: CT-augmented (prior-aided) DTS reconstruction; phantom and six patient datasets; similarity to reference CBCT                         |
| `sumner`      | 39268128 | Abstract: state-of-the-art review of peripheral diagnostic bronchoscopy                                                                         |
| `podder`      | 41158339 | Abstract: clinical practice review of DTS for navigational bronchoscopy                                                                         |

**Not available locally, so registry metadata only:** `aapm12`, `tg272`, `tg125`, `icrp`, `skin`.
No full text of any registered source was read in this pass.

**Local media search.** Filenames only, no file opened or copied: `Local-Data/raw-assets`,
`renders`, `authoring-imports`, `private-references` for fluoroscopy, CBCT, cone-beam,
tomosynthesis, DTS or radial EBUS. Every hit was a screenshot of this module's own teaching model
from earlier test runs. No acquired clinical fluoroscopy, DTS, CBCT or radial EBUS image was found.

**Not used:** no paid API, external model, web source, patient data or media generation.

## Boundaries these drafts keep

- Prompt 03 terms stay as merged: **modeled lesion**, **stored contour**, **C-arm obliquity** and
  **beam tilt** in the model's own signed convention, **Optional review · …** for reused closing
  questions, the forwarded radial EBUS limitation, the visibly provisional CBCT provenance and pulse
  ownership accounts, and the VESPA clause without effect sizes.
- The six open Prompt 03 decisions stay open. Where a draft depends on one, the draft says so.
- Self-paced contract: explanation available before answering, retry, skip or jump, no score, no
  penalty, no mastery threshold, no weighting, no forced order.
- No live question id, case id or item id is reused for changed meaning. Every proposed new identity
  is marked as a proposal.
