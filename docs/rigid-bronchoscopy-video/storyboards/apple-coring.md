# Storyboard — Apple-Coring

> **Status: PLANNING / DRAFT.** No media has been generated. Higgsfield is
> configured but not yet authenticated. This storyboard plans shots to be
> generated once authorized. All output is DRAFT until physician review and must
> not appear on the production learner route.

**Lesson id:** `apple-coring`
**Shot id convention:** `RB-CORE-<NNN>`
**Prompts:** see `../prompts/apple-coring.md` (verbatim synthetic prompt).
**Content type:** two **separately produced** views — external mechanics
(generated) and synthetic internal mechanics (validated 3D visualization).

This lesson **supplements** supervised simulation and clinical instruction and
does **not** credential a learner to perform rigid bronchoscopy.

---

## Objective

The learner demonstrates the controlled apple-coring motion — a short axial
advance combined with slow deliberate rotation of the beveled tip — while keeping
the normal airway wall stationary, then pauses, removes the fragment, suctions,
and reinspects.

## Safety statement

Coring uses a **short, controlled** advance, never a forceful thrust. The normal
airway wall must remain stationary; if the wall moves with the lesion, **stop**.
No blind advancement, no bending of the rigid barrel, no gore or plane-obscuring
bleeding. The synthetic lesion is a simplified training model, not a real patient.

## Key movement rule

Short controlled axial advance + controlled rotation engages the lesion; the
normal wall stays stationary. Pause → withdraw → remove fragment → suction →
recenter → reinspect.

## Common error

Forceful or deep advance, uncontrolled rotation, coring while the wall moves with
the lesion, or failing to remove the mobile fragment before continuing.

---

## Two separately produced views

### View A — External mechanics (generated)

| Shot id         | Description                                                                                                                     | Camera location                  | Length |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------ |
| RB-CORE-EXT-001 | External hand/barrel mechanics of a short controlled axial advance + slow rotation; barrel rigid; dental protection, no fulcrum | External, close on hands + mouth | 4–8 s  |
| RB-CORE-EXT-002 | Pause, controlled withdraw, mobile fragment removed with a grasping instrument                                                  | External, 3/4 from head          | 4–8 s  |

### View B — Synthetic internal mechanics (validated 3D visualization)

| Shot id         | Description                                                                                                                                                                                                        | Camera location                       | Length |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ------ |
| RB-CORE-INT-001 | Verbatim synthetic prompt: beveled edge separates a central portion of the simplified intraluminal lesion while the normal wall remains stationary; pause, withdraw, remove fragment, suction, recenter, reinspect | Synthetic internal (validated), fixed | 6–10 s |

**View B carries the persistent postproduction label "Synthetic procedural
visualization" for its full duration** and is never presented as real footage.
Exact airway anatomy is driven by the validated model, not free generation.

Each shot: one primary movement, fixed documentary camera, deep focus, no
generated text.

---

## Left/right orientation check

Apple-coring is demonstrated on a centered tumor-lumen interface and is not a
patient left/right maneuver, so no side-specific direction is taught. Still record
camera location per shot, keep an asymmetrical landmark in frame, and confirm the
external and internal panels are not mirrored relative to each other. See
`left-right-orientation-standard.md`.

---

## External-view vs synthetic-view relationship

- **External (View A)** shows the operator's body mechanics of the coring motion —
  it does **not** claim to show the internal cutting result.
- **Synthetic internal (View B)** shows the beveled edge engaging the simplified
  lesion with the normal wall stationary — labeled and never real footage.
- Postproduction pairs A and B so the learner links the external motion to the
  intended internal effect. The two are produced **separately**, not stitched from
  one generation.

## Postproduction overlays (deterministic)

- Persistent "Synthetic procedural visualization" on View B.
- Step captions ("Short controlled advance", "Wall stationary", "Remove fragment",
  "Suction and reinspect").
- No generated text inside any clip.

## Review gate

Route to `clinical-review-checklist.md` → **General review** and **Apple-coring
review**. Only the physician owner or a designated faculty reviewer may set
`medicalAccuracyVerified = true`.
