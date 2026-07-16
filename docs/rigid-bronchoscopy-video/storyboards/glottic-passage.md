# Storyboard — Glottic Passage

> **Status: PLANNING / DRAFT.** No media has been generated. Higgsfield is
> configured but not yet authenticated. This storyboard plans shots to be
> generated once authorized. All output is DRAFT until physician review and must
> not appear on the production learner route.

**Lesson id:** `glottic-passage`
**Shot id convention:** `RB-GLOTTIS-<NNN>`
**Prompts:** see `../prompts/intubation.md` (verbatim movement prompt).
**Content type:** **synthetic training representation** of the glottis, combined
with validated airway references.

This lesson **supplements** supervised simulation and clinical instruction and
does **not** credential a learner to perform rigid bronchoscopy.

---

## Objective

The learner demonstrates the timed ~90° rotation of the straight rigid
bronchoscope to align its narrower dimension with the glottic opening, controlled
passage, and return to the working orientation — all under continuous
visualization.

## Safety statement

The sequence is slow, atraumatic, and continuously visualized, with tooth
protection maintained and **no forceful advancement**. If visualization is lost,
the operator stops or repositions rather than advancing.

## Key movement rule

Rotate ~90° to align the narrower dimension **immediately before** passing the
glottis; **return to the working orientation** after controlled passage.

## Common error

Forcing passage, advancing without a clear view, or failing to return the barrel
to the working orientation after passage.

---

## Shot list

| Shot id            | Description                                                                                                        | Camera location                       | Side | Length |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---- | ------ |
| RB-GLOTTIS-001     | Verbatim sequence: lift with tooth protection → ~90° rotation → controlled passage → return to working orientation | Synthetic internal (validated), fixed | n/a  | 6–10 s |
| RB-GLOTTIS-002     | Isolated de-rotation back to working orientation after passage                                                     | Synthetic internal (validated), fixed | n/a  | 4–6 s  |
| RB-GLOTTIS-EXT-001 | External hands/barrel view of the same rotation timing (movement only)                                             | External, close on hands + mouth      | n/a  | 4–8 s  |

Each shot: continuous visualization, one primary movement, no generated text.

---

## Left/right orientation check

Glottic passage rotation is **not** a patient left/right maneuver (rotation aligns
the barrel's narrow dimension with the opening), so no side-specific direction is
demonstrated. Still record camera location per shot, and keep an asymmetrical
landmark visible so any unintended mirroring is caught. Confirm the rotation
direction reads consistently between the internal and external panels. See
`left-right-orientation-standard.md`.

---

## External-view vs synthetic-view relationship

- **Synthetic internal panel** (`RB-GLOTTIS-001/002`): demonstrates the timed
  rotation and passage. Carries persistent postproduction label **"Synthetic
  procedural visualization"**; never presented as real footage. Exact anatomy is
  driven by validated airway references, not free generation.
- **External panel** (`RB-GLOTTIS-EXT-001`): shows the operator's hand/barrel
  mechanics for the same rotation timing.
- In postproduction the two panels are shown together so the learner links the
  external rotation to the internal alignment.

## Postproduction overlays (deterministic)

- Persistent "Synthetic procedural visualization" on all internal panels.
- Step captions ("Align narrower dimension", "Return to working orientation").
- No generated text inside any clip.

## Review gate

Route to `clinical-review-checklist.md` → **General review** and **Intubation
review**. Only the physician owner or a designated faculty reviewer may set
`medicalAccuracyVerified = true`.
