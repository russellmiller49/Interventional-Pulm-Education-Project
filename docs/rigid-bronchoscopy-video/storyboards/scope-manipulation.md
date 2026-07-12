# Storyboard — Scope Manipulation (Movement Map)

> **Status: PLANNING / DRAFT.** No media has been generated. Higgsfield is
> configured but not yet authenticated. This storyboard plans shots to be
> generated once authorized. All output is DRAFT until physician review and must
> not appear on the production learner route.

**Lesson id:** `scope-manipulation`
**Shot id convention:** `RB-MOVE-<SIDE?>-<NNN>`
**Content type:** external mechanics (generated) + validated synthetic distal
response (model/diagram, not free generation).

This lesson **supplements** supervised simulation and clinical instruction and
does **not** credential a learner to perform rigid bronchoscopy.

---

## Objective

The learner predicts the distal-tip response to each isolated proximal movement of
the straight rigid bronchoscope and states one clinical application of each.

## Safety statement

Each movement is isolated, slow, and controlled with the barrel rigid and constant
in diameter. No advancement occurs beyond loss of visualization; the teeth are
never a fulcrum. Distal responses are shown via validated models, not free
generation.

## Key movement rule

Change **one variable at a time**. Predict the distal response before revealing
it, and confirm alignment/visualization before any advance.

## Common error

Combining movements, over-rotating, or advancing before the distal response is
understood.

---

## Uniform beat structure (every movement below)

1. **Show proximal movement** — external clip of one isolated movement.
2. **Pause** — brief hold at the end of the movement.
3. **Predict distal response** — retrieval prompt added in postproduction (no
   generated text in the clip).
4. **Reveal validated distal response** — validated synthetic model/diagram panel
   labeled **"Synthetic procedural visualization"**.
5. **Short clinical application** — one-line narration (authored separately).

---

## Movement catalog

| Shot id           | Proximal movement                                                           | Predicted distal response (revealed via validated model)                                      | Side                        | Camera location                |
| ----------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------ |
| RB-MOVE-001       | Axial **advance**                                                           | Tip travels distally along the lumen                                                          | n/a                         | External, 3/4 from head        |
| RB-MOVE-002       | Axial **withdraw**                                                          | Tip travels proximally along the lumen                                                        | n/a                         | External, 3/4 from head        |
| RB-MOVE-003       | **Clockwise** rotation                                                      | Beveled tip orientation rotates clockwise (bevel face turns)                                  | n/a                         | External, close on barrel      |
| RB-MOVE-004       | **Counter-clockwise** rotation                                              | Beveled tip orientation rotates counter-clockwise                                             | n/a                         | External, close on barrel      |
| RB-MOVE-R-001     | Proximal barrel moves to patient's **right**                                | Distal tip aligns toward patient's **left**                                                   | left target                 | External, matched hero framing |
| RB-MOVE-L-001     | Proximal barrel moves to patient's **left**                                 | Distal tip aligns toward patient's **right**                                                  | right target                | External, matched hero framing |
| RB-MOVE-005       | Small **head adjustment** (isolated)                                        | Airway axis shifts; tip relationship changes modestly — **not** a guarantee of mainstem entry | n/a (record head direction) | External, overhead             |
| RB-MOVE-COMBO-001 | **Combined** head + proximal-barrel adjustment toward the same patient side | Distal tip aligns toward the opposite mainstem, as in `mainstem-direction`                    | side per demo               | External, matched hero framing |

Each proximal-movement clip: one movement, fixed documentary camera, deep focus,
barrel rigid, no generated text. Each distal-response panel: validated model,
persistent "Synthetic procedural visualization" label.

> **Note on proximal-barrel and combined shots.** Because these are
> patient-side-specific, the distal-response panels are drawn from **separately
> validated** left and right references — never by mirroring one another (same
> rule as `mainstem-direction`).

---

## Left/right orientation check (per side-specific shot)

For `RB-MOVE-R-001`, `RB-MOVE-L-001`, `RB-MOVE-005`, and `RB-MOVE-COMBO-001`:

- State the target side in **patient anatomical** terms.
- Record the camera location (field above).
- Confirm proximal/head direction and the revealed distal direction are opposite
  and consistent across the external and validated panels.
- Keep an asymmetrical landmark in frame; require two-reviewer left/right
  confirmation before approval.

Axial and rotational shots are not patient-side maneuvers; still record camera
location and check for scene mirroring. See `left-right-orientation-standard.md`.

---

## External-view vs synthetic-view relationship

Every movement pairs a **generated external panel** (proximal mechanics) with a
**validated synthetic distal-response panel** (model/diagram). The prediction step
sits between them so the learner commits before the distal response is revealed.
The internal panel is always labeled and never presented as real footage.

## Postproduction overlays (deterministic)

- Prediction prompts and clinical-application captions added deterministically.
- Persistent "Synthetic procedural visualization" on every distal-response panel.
- No generated text inside any clip.

## Review gate

Route to `clinical-review-checklist.md` → **General review**, plus
**Mainstem-navigation review** for the side-specific movements. Only the physician
owner or a designated faculty reviewer may set `medicalAccuracyVerified = true`.
