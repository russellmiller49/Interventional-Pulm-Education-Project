# Storyboard — Positioning

> **Status: PLANNING / DRAFT.** No media has been generated. Higgsfield is
> configured but not yet authenticated. This storyboard plans shots to be
> generated once authorized. All output is DRAFT until physician review and must
> not appear on the production learner route.

**Lesson id:** `positioning`
**Shot id convention:** `RB-POS-<NNN>`
**Content type:** external mechanics on an adult airway **training manikin**
(explicitly synthetic; no patient identifiers).

This lesson **supplements** supervised simulation and clinical instruction and
does **not** credential a learner to perform rigid bronchoscopy.

---

## Objective

The learner identifies a correct baseline setup: supine manikin, operator at the
head of the bed, aligned airway axis, and dental protection in place before any
instrument approaches the mouth.

## Safety statement

Positioning is established **before** instrumentation. Dental protection is placed
over the upper incisors and is never used as a fulcrum. No advancement occurs in
this lesson.

## Key movement rule

Establish head/neck alignment and operator position **first**; the barrel does
not approach the mouth until the setup is stable.

## Common error

Beginning instrumentation before alignment and dental protection are in place, or
positioning the operator off the airway axis.

---

## Shot list

| Shot id    | Description                                                                        | Camera location           | Side | Length |
| ---------- | ---------------------------------------------------------------------------------- | ------------------------- | ---- | ------ |
| RB-POS-001 | Wide establishing frame: manikin supine, operator at head of bed, table height set | External, foot-of-bed 3/4 | n/a  | 4–6 s  |
| RB-POS-002 | Head/neck neutral alignment along the airway axis                                  | External, overhead        | n/a  | 4–6 s  |
| RB-POS-003 | Dental guard placed over upper incisors; hands withdraw                            | External, close on mouth  | n/a  | 4–6 s  |
| RB-POS-004 | Operator adopts stable stance and hand-ready position at the head of the bed       | External, 3/4 from head   | n/a  | 4–6 s  |

Each shot: one movement, fixed documentary camera, deep focus, no generated text.

---

## Left/right orientation check

Positioning shots are **not** side-specific, so no side-specific maneuver is
demonstrated. Still record the camera location per shot and include an
asymmetrical reference landmark in frame (e.g., a consistently placed table
accessory) so any unintended left-right mirroring is detectable at review. See
`left-right-orientation-standard.md`.

---

## External-view vs synthetic-view relationship

This lesson is **external only**. There is no synthetic internal panel. If an
orientation diagram is desired, use a validated static diagram in postproduction;
do not generate internal anatomy here.

## Postproduction overlays (deterministic, added after generation)

- Setup labels (e.g., "Supine", "Dental protection") added deterministically.
- No text is generated inside any clip.

## Review gate

Route to `clinical-review-checklist.md` → **General review**. Only the physician
owner or a designated faculty reviewer may set `medicalAccuracyVerified = true`.
