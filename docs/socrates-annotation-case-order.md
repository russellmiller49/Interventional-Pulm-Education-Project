# SOCRATES annotation tools and core teaching order — October 6, 2026

This update addresses Steve's email about direct bounding-box editing, the missing
annotation key, and the revised 25-case core training set. The supplied spreadsheet
is source data for the order; its proposals do not authorize patient-content changes,
publishing drafts, or emailing the team.

## Annotation authoring

- Choose **Move/select regions** and drag an existing box in either image pane.
  The viewer converts the gesture to source-image pixels. A parent moves with its
  descendants; details stay inside their parent and the complete family stays
  inside the slide. A completed gesture is one undoable edit. Cancelling a gesture
  does not save it.
- Select a region and choose **Delete** above the canvas. With the canvas focused,
  Delete/Backspace removes it and arrow keys move it by 10 pixels (Shift: 1 pixel).
  Text fields retain their normal editing behavior. Deleting a parent also removes
  its details, reports that fact, and can be undone.
- Coordinate edits remain available. Moving a parent by coordinates also moves its
  details. Resizing cannot strand a detail outside its parent.
- The saved annotation/color key appears beside the builder and below the images
  in teaching lessons, including shared-library teaching previews and published
  teaching. Authors can see draft entries with a pending-review label. Learners
  see only a valid, reviewed provider mapping; missing/unreviewed keys remain
  pending. No color/category mapping is invented. Testing shows no key.

## Core teaching sequence

Source: `Socrates Case Order.xlsx`, **Case Order!A2:D26**, provided October 6, 2026.
The derived registry is `src/features/socrates-learning/core-teaching.ts`.

| Teaching section                           | Core positions | Cases |
| ------------------------------------------ | -------------- | ----- |
| Normal/benign lung tissue                  | 1–7            | 7     |
| Non-diagnostic specimens                   | 8–11           | 4     |
| Diagnostic/Adequate non-cancer: granulomas | 12–14          | 3     |
| Diagnostic/Adequate cancer                 | 15–25          | 11    |

Case plus series identifies each entry, including leading-zero case numbers.
The source image must match that identity; a conflicting original workbook name
prevents automatic core classification. The five promoted entries are included in
the registry. Existing optional cases follow the core in their previous relative
order and retain their original module grouping.

The browser and shared author libraries display this order and core position.
Teaching uses the same sequence for section filters, Start/Continue, and Next.
Counts distinguish available/assigned cases from the planned 25. Published
teaching receives only a derived position and section before source identifiers
are removed from its image relay projection. Testing receives neither field and
retains its prior order, neutral titles, and tissue-only presentation.

The learner is a clinician learning SRH image interpretation, with basic tissue/cell
terminology, on a desktop or tablet. The revised spine establishes normal findings,
then non-diagnostic specimens, diagnostic benign processes, and cancer patterns.
Existing objectives, authored interpretations, and the knows-how learning boundary
are preserved. No assessment, scoring, or clinical claim changes.

The application does not rewrite case UUIDs, descriptions, annotation polygons,
source workbook cells, assignments, release approvals, or formal study configuration.
The added teaching display metadata alone does not reset existing browser progress.
There is no database migration or remote write. Deploying the application applies
the order to identified cases already in the library; cases still unassigned or
unpublished require the existing assignment/review/publication workflow. The
formal `/socrates` study curriculum and pinned attempts remain separate.

## Verification

- Final focused run: 27 suites passed, 187 tests passed, one existing test skipped.
  A separate read of the attached workbook confirms every ordered case-series
  identity and all four counts against the derived registry.
- Focused Socrates Jest suites cover source-pixel drag release/cancellation,
  parent/detail containment, keyboard movement, text-field isolation, Delete/Undo,
  all 25 identities and exact group sizes, Start/Next order, stable content progress,
  reviewed/pending keys, and exclusion of teaching metadata from testing.
- Browser checks on an isolated localhost origin verified movement in the actual
  paired OpenSeadragon viewer, child translation, keyboard movement, reversible
  deletion, and the saved key in teaching preview. A narrow-screen focus-scroll
  bug found during the drag check was fixed with `preventScroll`.
- A 25-case synthetic browser import, supplied in reverse order, rendered the
  exact four groups with 7/7, 4/4, 3/3, and 11/11 availability. No production
  author content or study responses were edited.
- TypeScript passes with `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`;
  the default 4 GiB Node heap was insufficient for the complete repository.
- Targeted ESLint and formatting checks pass. Browser development compilation
  passes. A complete production build and deployed team session are not verified.

The separate education review found the new normal-to-cancer sequence, consistent
navigation, available/planned counts, and tissue-only testing boundary intact.
No new clinical statements or scoring rules were introduced.
