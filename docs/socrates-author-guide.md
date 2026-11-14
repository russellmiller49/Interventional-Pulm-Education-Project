# SOCRATES author guide

Enter whole-case text in **Case content**. Teaching regions are optional: use them
to explain a particular area of the image. Keep the vignette to the context learners
should see before reveal; interpretations belong in the teaching fields.

Choose **Preview teaching view**, then **Reveal teaching interpretation** to read
the current draft. Continue through observations, interpretation and learning points.
The banner says **Draft learner preview — not published**. Preview does not save
revisions or participant progress. **Return to editing** keeps the current draft;
save it separately. Browser drafts remain on that browser; protected drafts use
**Save draft**. Publication is a separate administrator action.

**Diagnostic-list order** (formerly “Sort order”) puts lower numbers first within
each diagnostic category. Categories remain alphabetical; equal numbers use the
stable case ID. Curriculum module order and position within a module are separate.
A case number is an identifier, not its position in the curriculum.

## Annotation / color key

The key explains the provider's existing color image. It does not create, recolor
or classify pixels. It is separate from drawing teaching regions.

In the shared library and teaching preview, UCSD Slide Viewer slides automatically
show the [provider's tissue annotation key](https://ucsd-slide-viewer-1080580899927.us-central1.run.app/assets/annotation-key-DI2mkxIw.svg)
when their saved custom key is empty. The 14 labels and exact colors were checked
against that source on October 12, 2026. The key is above the authoring canvas and
can be collapsed. Custom entries take precedence and retain their review status.
The shared-library testing preview remains tissue-only and does not show a key.

For other image sources, or to provide a custom key:

1. Select **Add key entry**.
2. Enter the provider-approved category label.
3. Enter its actual six-digit hex color, such as the supplied `#RRGGBB` value.
   The picker previews the value; the exact hex field remains editable.
4. Add the reviewed meaning or explanation.
5. Repeat for the relevant entries.
6. If editing an existing saved key, save the changed entries first. Check the actual
   provider-approved mapping, then mark **Annotation key reviewed**.
7. Save the draft and inspect the complete teaching preview.

“Pending label” and the initial gray swatch are placeholders with no clinical
meaning. Incomplete entries cannot be marked reviewed. Editing an entry clears the
review flag. Learners see **Annotation key pending review** until the key is reviewed.
Testing rounds retain their own explicit key and color-image settings.
Saving changed teaching content also clears content review; review the saved
version and save that review separately.

## Move, resize, and delete boxes

Click a box or select it in **Regions**, then choose **Move / resize** above the
image. Drag inside the box to move it; drag a corner or edge handle to resize it.
The handles work on either image in a paired view. Boxes stay within the slide,
details stay within their parent, and resizing a parent keeps its details in place.

Choose **Delete** above the image to remove the selected box (and its details).
**Undo** restores a move, resize, or deletion; **Redo** reapplies it. Each drag is
one history step. With the canvas focused, arrow keys move by 10 source pixels;
hold Shift for 1 pixel. Focus a resize handle to use the same keys for resizing.
Delete/Backspace removes the selected box when the canvas has focus. Numeric
coordinates remain available for exact adjustments.

## Workbook text and modules

Imported descriptions appear in one **Learner narrative (after reveal)** field. Keep its
headings and paragraphs intact; it contains the observations, learning point,
expected classifications and any common pitfall. It appears after reveal. Edit
this field rather than maintaining a second, contradictory set of observations.
Private source notes and the reason a case belongs in a module stay in protected
author metadata. Teaching edits require content review again.

The SOCRATES homepage starts with **CORE SRH ORIENTATION**, followed by five
optional modules. Each shows available cases separately from its planned count.
Open a module for its ordered list; previous/next links stay within that module.
Diagnosis browsing remains available. “Opened”, “Teaching revealed” and
“Completed” describe distinct saved activities for the current case revision.

The source has 59 case-series entries and still needs identity matching and owner
decisions. Source Case 041 / Series 4 is position 6, not position 41. Case 430 /
Series 2 needs a core-versus-advanced decision; Cases 357 / Series 2 and 436 /
Series 1 need retention decisions. A planned position does not mean a case is
approved or published. An operator can import reviewed descriptions without
retyping them using the [private workbook workflow](socrates-workbook-import.md).
