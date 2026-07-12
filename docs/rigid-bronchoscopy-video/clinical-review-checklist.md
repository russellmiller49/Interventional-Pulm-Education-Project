# Clinical Review Checklist

> **Status: PLANNING / DRAFT.** No media has been generated. Higgsfield is
> configured but not yet authenticated. This checklist is the review gate to be
> applied to each DRAFT clip once generation is authorized. It is a production
> gate, not a record of approval.

**All generated content is DRAFT until physician review and must never be
published on the production learner route before sign-off.** This module
**supplements** supervised simulation and clinical instruction and does **not**
independently credential a learner to perform rigid bronchoscopy.

**Authority:** Only the **physician owner or a designated faculty reviewer** may
set `medicalAccuracyVerified = true`. No automated step, and no non-designated
reviewer, may set this flag.

---

## Reviewer actions (choose one per clip)

- **Approve** — meets all applicable criteria; may proceed toward production.
- **Approve with minor revisions** — approvable after small, enumerated
  postproduction fixes (e.g., overlay wording/placement) that do not require
  regeneration.
- **Revision required** — must be regenerated or re-edited and re-reviewed before
  approval.
- **Reject** — not usable; discard. (Any hard-rejection trigger below forces this.)

Record for each clip: shot id, reviewer name, role, date, action, and notes.

---

## Hard-rejection triggers (any one forces Reject)

- Flexible/bending metal barrel, or changing instrument length or diameter.
- Duplicated instruments, extra fingers, fused hands, or an instrument passing
  through hands or tissue; hands morphing.
- Anatomical mirroring or left-right reversal of the scene.
- Teeth used as an uncontrolled fulcrum.
- Operator advances after losing visualization.
- Any generated text, label, caption, letter, number, arrow, L/R marker, logo, or
  watermark inside the image.
- Generated endoluminal anatomy presented as actual procedural footage, or a
  synthetic view missing the "Synthetic procedural visualization" label.
- Generated speech or dialogue.
- A right-side navigation clip produced by flipping a left clip.

---

## Section 1 — General review (every clip)

- [ ] Patient position plausible.
- [ ] Operator position plausible.
- [ ] Instrument geometry correct.
- [ ] Instrument remains rigid.
- [ ] Hand contact plausible.
- [ ] Dental protection present when relevant.
- [ ] No dental levering normalized.
- [ ] Visualization maintained before advancement.
- [ ] Left/right anatomy correct.
- [ ] Scope movement matches the narrated explanation.
- [ ] No generated text visible.
- [ ] Synthetic footage labeled "Synthetic procedural visualization".
- [ ] Narration does not imply universal applicability.

---

## Section 2 — Intubation review (`oral-entry`, `glottic-passage`, `tracheal-advancement`)

- [ ] Oral entry controlled.
- [ ] Epiglottic exposure plausible.
- [ ] Glottic passage sequence plausible.
- [ ] Rotation timing appropriate (≈90° immediately before passage).
- [ ] Return to working orientation shown.
- [ ] No forceful passage.
- [ ] Loss of visualization triggers stopping or repositioning.

---

## Section 3 — Mainstem-navigation review (`mainstem-direction`, side-specific `scope-manipulation`)

- [ ] Patient anatomical side documented.
- [ ] Camera orientation documented.
- [ ] Head movement correct for the intended demonstration.
- [ ] Proximal-barrel movement correct.
- [ ] Distal-tip consequence correctly represented.
- [ ] Advancement only after alignment and visualization.
- [ ] Teeth not used as a fulcrum.
- [ ] Explicit two-reviewer left/right confirmation completed (see
      `left-right-orientation-standard.md`).
- [ ] Right-side content is separately validated, not a flipped left clip.
- [ ] No claim that head movement alone guarantees mainstem entry.

---

## Section 4 — Apple-coring review (`apple-coring`, coring-related `unsafe-mechanics`)

- [ ] Lesion predominantly intraluminal in the synthetic example.
- [ ] Airway wall distinguishable from the lesion.
- [ ] Intended direction visible.
- [ ] Movement short and controlled.
- [ ] Rotation controlled.
- [ ] Normal wall remains stationary.
- [ ] Operator pauses and reassesses.
- [ ] Fragment removal shown.
- [ ] Suction and reinspection shown.
- [ ] Unsafe-plane examples clearly trigger stopping.
- [ ] Video does not encourage blind or indiscriminate coring.

---

## Section 5 — Unsafe-mechanics review (`unsafe-mechanics`)

- [ ] Example is clearly synthetic and freezes **before** any serious injury.
- [ ] No harm is depicted; no gore.
- [ ] Any synthetic bleeding is a clinically reviewed complication illustration and
      stops before graphically obscuring the plane.
- [ ] Recovery overlay present and correct: **Stop / Withdraw / Suction /
      Re-establish anatomy / Reassess the tissue plane.**
- [ ] The unsafe pattern is framed as an **error**, not as valid technique.

---

## Sign-off

- **Shot id(s) reviewed:**
- **Reviewer name and role:**
- **Date:**
- **Action:** Approve / Approve with minor revisions / Revision required / Reject
- **Enumerated revisions (if any):**
- **`medicalAccuracyVerified` set to true?** (Y/N) — permitted **only** for the
  physician owner or a designated faculty reviewer.
- **Reviewer signature:**

Approval here authorizes progression toward production; it does not by itself
publish anything. Publication to the learner route requires all applicable gates to
pass and remains subject to the DRAFT-until-review rule.
