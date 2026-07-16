# Storyboard — Mainstem Direction (PROTOTYPE)

> **Status: PLANNING / DRAFT.** No media has been generated. Higgsfield is
> configured but not yet authenticated. This is the **validated prototype**
> lesson and is produced first, but nothing has been generated yet. All output
> is DRAFT until physician review and must not appear on the production learner
> route.

**Lesson id:** `mainstem-direction`
**Shot id convention:** `RB-NAV-<SIDE?>-<NNN>`
**Prompts:** see `../prompts/mainstem-direction.md` (verbatim RB-NAV-L-001).
**Content type:** external mechanics (generated) + validated synthetic internal
consequence (model/diagram, not free generation).

This lesson **supplements** supervised simulation and clinical instruction and
does **not** credential a learner to perform rigid bronchoscopy.

---

## Objective

The learner predicts and demonstrates the movement relationship for mainstem
selection: to align the distal tip toward a target mainstem, the head and the
proximal barrel move toward the **opposite** patient-anatomical side — and
advancement occurs **only** after confirming alignment under direct
visualization.

## Safety statement

External movement is shown slowly and continuously with the barrel rigid. The
operator does **not** lever on the incisors and does **not** advance blindly. No
clip claims that head movement alone guarantees mainstem entry.

## Key movement rule

Proximal barrel and head move **away** from the target side; the distal tip
aligns **toward** the target side. Advance only after alignment is confirmed under
direct visualization.

## Common error

Levering on the teeth, advancing before alignment/visualization, or assuming head
movement alone directs the tip into the mainstem.

---

## Orientation convention for this lesson

- All directions are **patient anatomical left/right**, never viewer left/right.
- **Camera location is recorded per shot** (field below).
- **RB-NAV-R** shots are separately authored and validated — **never** a flipped
  left clip. Flipping would reverse hand/equipment relationships. See
  `left-right-orientation-standard.md`.

---

## Shot-by-shot

### RB-NAV-001 — Neutral distal tracheal position (hero frame)

- **Description:** Scope centered in the distal trachea, head neutral, hands
  stable, no advancement, no rotation. Establishes the continuity baseline for
  every other shot.
- **Camera location:** External three-quarter **or** overhead; fixed.
- **Side:** not-applicable.
- **Left/right orientation check:** Confirm an asymmetrical reference landmark is
  in frame; confirm no mirroring versus the storyboard reference. Head neutral,
  no side selected.
- **Length:** 4–6 s.

### RB-NAV-L-001 — Prepare for LEFT-mainstem alignment (verbatim maneuver)

- **Description:** From the hero frame, small controlled adjustment of the
  patient's head toward the patient's anatomical **right** and movement of the
  proximal barrel toward the patient's anatomical **right**. No incisor levering,
  no blind advance, external movement only, rigid barrel preserved. (Prompt text
  is verbatim in `../prompts/mainstem-direction.md`.)
- **Camera location:** External; identical framing to RB-NAV-001; fixed.
- **Side:** **left** (target = patient's left mainstem).
- **Left/right orientation check:** Verify the head and proximal barrel move
  toward the patient's **right** (opposite the target). Confirm the asymmetrical
  landmark did not flip. Two-reviewer left/right confirmation required before
  approval.
- **Length:** 4–6 s.

### RB-NAV-L-002 — Validated internal consequence (LEFT)

- **Description:** Validated synthetic 3D airway model / vector diagram /
  deterministic animation: proximal barrel moving right, distal tip aligning
  toward the patient's **left** mainstem, airway wall stationary. No claim that
  head movement alone guarantees entry; advancement only after visualization and
  alignment.
- **Camera location:** Synthetic cutaway view (validated model), fixed
  orientation matched to the external panel.
- **Side:** **left**.
- **Left/right orientation check:** Confirm the modeled tip aligns to the
  patient's left and the direction agrees with the external panel. Source is a
  validated model, not free generation.
- **Overlay:** persistent **"Synthetic procedural visualization"**.
- **Length:** 4–6 s.

### RB-NAV-R-001 — Prepare for RIGHT-mainstem alignment (separately authored)

- **Description:** From the hero frame, small controlled adjustment of the head
  toward the patient's anatomical **left** and movement of the proximal barrel
  toward the patient's anatomical **left**. Same discipline (no levering, no blind
  advance, rigid barrel).
- **Camera location:** External; framing matched to RB-NAV-001; fixed.
- **Side:** **right**.
- **Provenance:** Produced from **separately validated right-sided references**,
  **not** by mirroring RB-NAV-L-001.
- **Left/right orientation check:** Verify head and proximal barrel move toward
  the patient's **left** (opposite the right target); confirm hand/equipment
  relationships are correct for a right-sided demonstration (not a mirror
  artifact). Two-reviewer confirmation required.
- **Length:** 4–6 s.

### RB-NAV-R-002 — Validated internal consequence (RIGHT, separately authored)

- **Description:** Validated synthetic model/diagram: proximal barrel moving
  toward the patient's left, distal tip aligning toward the patient's **right**
  mainstem, wall stationary. Same non-guarantee and visualization caveats.
- **Camera location:** Synthetic cutaway (validated model), fixed.
- **Side:** **right**.
- **Provenance:** Authored independently of the left content.
- **Overlay:** persistent **"Synthetic procedural visualization"**.
- **Length:** 4–6 s.

### RB-NAV-ERR-001 — Dental fulcrum error (synthetic controlled demo)

- **Description:** Clearly synthetic controlled demo; proximal barrel pressed
  against the dental guard in a fulcrum position; **FREEZE before force is
  applied**. Follow with corrected head/mouth alignment (barrel hand-supported).
- **Camera location:** External, close on the mouth; fixed.
- **Side:** not-applicable.
- **Left/right orientation check:** n/a for side; confirm no mirroring of the
  scene.
- **Overlay:** postproduction **"Do not use the incisors as a fulcrum."**
- **Length:** 3–5 s (freeze), then corrected clip.

### RB-NAV-QUIZ-001 — Retrieval freeze frame (no generated text)

- **Description:** Clean freeze of the neutral hero position, hands stable. **No
  generated text in the image.**
- **Camera location:** External, matched to RB-NAV-001; fixed.
- **Side:** not-applicable (answer references patient left).
- **Overlay (postproduction):** question **"The intended target is the left
  mainstem bronchus. Which direction should the patient's head and the proximal
  barrel move?"**
- **Length:** 3–4 s hold.

---

## External-view vs synthetic-view relationship

Each side pairs an **external panel** (generated hand/barrel mechanics:
`RB-NAV-L-001`, `RB-NAV-R-001`) with a **validated synthetic internal panel**
(model/diagram consequence: `RB-NAV-L-002`, `RB-NAV-R-002`). In postproduction the
panels are shown together so the learner links "proximal/head moves away from
target" to "distal tip aligns toward target." The internal panel always carries
"Synthetic procedural visualization" and is never presented as real footage.

## Assembly (postproduction)

Hero (RB-NAV-001) → predict → left external + left internal → right external +
right internal → error freeze (RB-NAV-ERR-001) with correction → retrieval freeze
(RB-NAV-QUIZ-001). Micro-lesson target ~45–120 s.

## Review gate

Route to `clinical-review-checklist.md` → **General review** and
**Mainstem-navigation review**, including the explicit left/right review. Only the
physician owner or a designated faculty reviewer may set
`medicalAccuracyVerified = true`.
