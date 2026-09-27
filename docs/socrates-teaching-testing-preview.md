# SOCRATES teaching and testing module preview

The local slide workspace now has independent **Teaching** and **Testing** modules.
Both modules now use the same editable slide library as the annotation builder.
Each draft has one assignment: Unassigned, Teaching, or Testing. All migrated slides
start Unassigned; the team can preview either presentation while deciding. Only
assigned slides appear in each module. Testing never transitions to a teaching reveal.

## Scope and source

`SOCRATES Case Descriptions (1).xlsx` is byte-identical to the previous workbook
(SHA-256 `f4a06fb8ccb06f7993fcfca156c4138df0bc4368e100a0444366c68e7ff2f279`).
It has 59 case-series entries across six modules (20/5/8/14/6/6), with matching
learner text in both source sheets. The teaching presentation partitions explicit
headings without rewriting the narrative. Unrecognized structures fall back to
the full narrative. Original cells, including private author notes, remain in the
private preview package; private notes are never rendered in either module.

## Learning design

Audience: clinicians learning SRH slide interpretation, using a desktop or tablet.
Prerequisites: basic tissue/cell terminology. The module supports image-based
recognition and interpretation (Miller's knows how), not clinical competency.

| Objective                                            | Teaching                                                                | Testing                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Distinguish tissue architecture from cellular detail | Explicit low/high-magnification source sections, followed by key points | Independent image exploration and optional reasoning |
| Decide adequacy for the targeted lesion              | Authored adequacy interpretation and reasoning                          | Adequate / not adequate / uncertain                  |
| Distinguish cancer from non-cancer patterns          | Authored classification, reasoning, and pitfall where supplied          | Cancer / non-cancer / uncertain                      |
| Express uncertainty about an interpretation          | Authored qualifications preserved                                       | Low / moderate / high confidence                     |

Teaching follows the workbook order: normal baseline before increasingly complex
patterns, with one source section on screen at a time. The testing pool currently
uses neutral slide numbers and a consistent response form. Neither diagnostic
titles, module labels, teaching regions, color images, nor reference answers are
rendered during testing, including after submission and in fullscreen. Test
submissions are immutable within this local preview. No accuracy, pass, mastery,
or competency claim is made. Viewing teaching first is recorded as prior exposure.

Teaching and testing progress are independent and resume from browser storage.
Progress is invalidated if the corresponding image, case content, or annotations
change. Storage errors are surfaced without losing the current in-memory visit.
There are no required bounding boxes: adding reviewed annotations later enables
the existing teaching-region viewer; testing continues to suppress all regions.

## Generate the private author-review pool

Use a new output path under an existing private directory outside every checkout:

```sh
npx tsx scripts/socrates/curriculum-preview.ts \
  --workbook '/absolute/path/SOCRATES Case Descriptions (1).xlsx' \
  --output '/private/review/curriculum_PRIVATE.json'
```

The utility verifies the pinned workbook, all source rows, unique case+series
catalog matches, provider IDs/barcodes, approved tissue/color paths, equal image
dimensions, and the existing narrative contract. Output is exclusive, mode 0600.
It has no database client or write operation. Source membership holds are retained;
all preview documents have no saved record ID, revision zero, draft status,
eligibility disabled, and zero invented annotations. In particular, previewing the
Case 041 source does not reconcile or replace the existing protected author case.

Open `/en/socrates-demo#library` and choose **Import library**. Existing browser
curriculum imports migrate automatically into the builder's saved workspace, with
stable local UUIDs and the original workbook metadata. Existing builder drafts are
preserved as separate variants; the source filter distinguishes the prepared
curriculum from other drafts. The old curriculum package remains in browser storage
as a recovery copy. Reimporting it skips already imported source slugs, even after
the author edits a draft's title or slug.

Choose **Edit slide** to modify the title, case context, teaching narrative, color
key, and bounding boxes in the existing editor. **Preview teaching** shows current
context and teaching content; **Preview testing · tissue only** hides context,
diagnostic titles, color images, and annotations. These per-slide author previews
do not write module progress or test submissions. **Build a new slide** and the
builder's provider picker remain available. New slides start Unassigned.

Module assignments live in local workspace metadata, separate from protected
training/testing eligibility. Changes auto-save with the draft. Editing the source
image creates a separate local draft and does not carry the prior assignment.
Legacy local overlay drafts upgrade when edited; protected and sandbox workflows
retain their existing behavior.

**Export library** produces a private author bundle containing drafts, annotations,
source metadata, and module assignments. **Import library** accepts this bundle or
the original curriculum package. Identical records are skipped. Conflicting records
are appended as imported copies, retaining both authors' work; no automatic merging
or replacement occurs. The bundle contains private author notes and is for the
SOCRATES authoring team only. It excludes learner progress and responses. This is
file-based sharing, not multi-user synchronization.

The application never reads the workbook or Local-Data at runtime. Import the
private JSON separately in each browser where it is needed.

## Before release

Review the planned assignments in the shared library, then apply the final disjoint
memberships through the existing protected curriculum/study workflow. Review content, image identity, source membership holds,
and annotations. Formal participant assignment, answer isolation, and persistent
study results continue to belong to the existing server-backed study routes. This
author preview deliberately contains the author package in browser memory and is
not an examination security boundary. The formal study feedback/round configuration
has not changed.

Pilot both modules with target learners, checking case navigation, low/high-power
review, confidence capture, submission, and return/resume. Interpret responses
from already-taught slides as practice, not independent performance.

## Validation

- All 59 image pairs matched their source case+series, catalog ID, barcode, and
  descriptor dimensions. All source narratives and source cells round-tripped exactly.
- Focused Jest run: 20 suites, 141 tests passed, including separated module progress,
  incomplete responses, immutable submissions, storage failures, source partitioning,
  private-note exclusion, tissue-only fullscreen behavior, migration without data loss,
  edit/assignment persistence, module membership filtering, and private library
  export/import with preservation of conflicting edits.
- TypeScript, focused ESLint, and the production build passed.
- Browser checks covered import of all 59 slides, loaded teaching pairs, tissue-only
  testing, submission without feedback, persistence after reload, fullscreen, and a
  390px mobile viewport with no horizontal overflow. Test responses were entered on
  an isolated localhost origin; the user's review origin has no synthetic submissions.
