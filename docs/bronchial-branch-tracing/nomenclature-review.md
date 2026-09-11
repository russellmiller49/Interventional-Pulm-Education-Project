# Anatomical nomenclature review

September 11, 2026 · `nomenclature-v1` · unpublished educational module. Anatomical assignments by Codex using the owner-supplied textbook and existing case assets; this is not faculty sign-off.

The owner explicitly requested named airway segments in place of CT level numbers. The implementation identifies **bronchi** with B notation, expands each name, preserves R/L laterality, and explains the distinction from pulmonary segments (S). Lobar bronchi, common stems and subsegments retain their actual level in the hierarchy. Proximal/distal describe relative sampling positions within the same named bronchus; acquisition indices remain available in image details.

## Reference vision and case correspondence

- Kurimoto & Morita, _Bronchial Branch Tracing_ (2020), DOI [10.1007/978-981-13-9905-3](https://doi.org/10.1007/978-981-13-9905-3). Supplied local PDF inspected as rendered images: printed pp. 2–3 (PDF 12–13), Figs. 1.1–1.2; printed p. 27 (PDF 36), Figs. 2.9–2.10; printed p. 46 (PDF 55), Figs. 2.47–2.48. Adjacent text on pp. 45–47 supports the middle-lobe assignments. No textbook image is shipped.
- Existing `case-001/metadata/centerline_labels.json` provides main, lobar and segmental identities. Its SHA-256 is `fc446faabf7654592b88ec7315321a9c874244efac29f5de2dcd501d2a9f7f8a`.
- Every one of the **36 selected source edges** has identical complete LPS polylines, start nodes and end nodes in the original patient-new graph and the labeled case-001 graph. Every checkpoint lies on its assigned source edge within 0.0001 mm rounding tolerance. This establishes data correspondence, not clinical registration precision.
- The native CT pixels, source intensities, sample coordinates, source graph, book and original labeled assets are unchanged. The authoring file records the existing label and the reason for every refinement.

## Explicit anatomical choices

- RB1a/RB1b: the posterior/anterior daughters of the labeled right apical bronchus, respectively, using p. 27 and actual patient-space branching. Further descendants keep RB1a without invented i/ii suffixes.
- RB3a: the lateral daughter in RB3 territory, opposite the ventral RB3 branch; p. 27, Fig. 2.9. Distal sampling retains RB3a rather than asserting an unverified finer suffix.
- RB4a: the posterolateral daughter in labeled RB4 territory, opposite the anterolateral sibling; pp. 45–47.
- RB5a/RB5b: the near-horizontal and caudally directed daughters of labeled RB5; pp. 45–47. RB5a has a small local cranial excursion in this source case, so the lesson no longer calls the entire daughter a cranial bronchus.
- RB1/B2 denotes a right B1–B2 **common trunk**, distinct from the left apicoposterior bronchus LB1+2. Left upper division is distinct from lower-lobe superior segmental bronchus LB6. Distal LB6 samples retain LB6; no B6a assignment is made.

## Checkpoint names

| Trace                 | Checkpoint sequence                                   |
| --------------------- | ----------------------------------------------------- |
| central-right         | Trachea → RMSB (proximal) → RMSB (distal)             |
| central-left          | Trachea → LMSB (proximal) → LMSB (distal)             |
| right-upper-entry     | RMSB → RUL → RB1/B2                                   |
| right-upper-apical    | RB1/B2 → RB1 → RB1b                                   |
| right-upper-distal    | RB1 → RB1a (proximal) → RB1a (distal)                 |
| middle-lobe-entry     | BI → RML → RB5                                        |
| middle-lobe-lateral   | RML (proximal) → RML (distal) → RB4a                  |
| middle-lobe-caudal    | RB5 (proximal) → RB5 (distal) → RB5b                  |
| middle-lobe-cranial   | RB5 (proximal) → RB5 (distal) → RB5a                  |
| upper-oblique-lateral | RB3a (proximal) → RB3a (midportion) → RB3a (distal)   |
| upper-oblique-medial  | RB3a (proximal) → RB3a (midportion) → RB3a (distal)   |
| left-upper-division   | LUL → LUL division → LB1+2                            |
| left-upper-anterior   | LUL division (proximal) → LUL division (distal) → LB3 |
| left-lingula          | LUL → LB4+5 → LB5                                     |
| left-lower-returning  | LLL → LB6 (proximal) → LB6 (distal)                   |
| right-lower-basal     | RLL → R basal → RB8                                   |
| left-lower-basal      | L basal (proximal) → L basal (distal) → LB9           |

The route breadcrumb also retains intermediate named bronchi that fall between sampled checkpoints. Clinical accuracy grading, mucosal ostial labels and new-patient validation remain outside this ungraded preview. Named targets do not reveal the reference lumen coordinates before the existing submission boundary.

## Reproduction

Run `python3 scripts/branch-tracing/label_native_traces.py` from this worktree. The Slicer export uses the same annotator. Clinical naming decisions are explicit in `scripts/branch-tracing/authoring/airway-nomenclature.json`; they are not generated from graph depth or CT slice indices.
