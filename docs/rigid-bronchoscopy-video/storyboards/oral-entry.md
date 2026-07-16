# Storyboard — Oral Entry

> **Status: PLANNING / DRAFT.** No media has been generated. Higgsfield is
> configured but not yet authenticated. This storyboard plans shots to be
> generated once authorized. All output is DRAFT until physician review and must
> not appear on the production learner route.

**Lesson id:** `oral-entry`
**Shot id convention:** `RB-ORAL-<NNN>`
**Prompts:** see `../prompts/intubation.md`.
**Content type:** external mechanics on an adult airway training manikin.

This lesson **supplements** supervised simulation and clinical instruction and
does **not** credential a learner to perform rigid bronchoscopy.

---

## Objective

The learner demonstrates a controlled midline oral introduction of the straight
rigid bronchoscope with dental protection maintained and no levering on the teeth.

## Safety statement

Insertion is slow, midline, and controlled. Dental protection is present over the
upper incisors and is **never** a fulcrum. Movement stops if the view is not
maintained.

## Key movement rule

Introduce the beveled tip in the midline under control; the barrel remains
straight and constant in diameter throughout.

## Common error

Levering the barrel on the upper incisors, off-midline entry, or forceful
insertion.

---

## Shot list

| Shot id         | Description                                                                        | Camera location                  | Side | Length |
| --------------- | ---------------------------------------------------------------------------------- | -------------------------------- | ---- | ------ |
| RB-ORAL-001     | Controlled oral introduction of the beveled tip, dental protection present         | External, close on mouth + hands | n/a  | 4–6 s  |
| RB-ORAL-002     | Tongue control; midline advance toward the oropharynx                              | External, 3/4 from head          | n/a  | 4–8 s  |
| RB-ORAL-ERR-001 | Synthetic error demo: barrel begins to lever on incisors — **freeze before force** | External, close on mouth         | n/a  | 3–5 s  |

`RB-ORAL-ERR-001` freezes before any force; postproduction overlay: **"Do not use
the incisors as a fulcrum."** Follow with a corrected midline hand-supported entry.

Each shot: one movement, fixed documentary camera, deep focus, no generated text.

---

## Left/right orientation check

Oral entry is midline and not side-specific. Record camera location per shot and
keep an asymmetrical landmark in frame so mirroring is detectable. No side-specific
maneuver is demonstrated. See `left-right-orientation-standard.md`.

---

## External-view vs synthetic-view relationship

External only. No synthetic internal panel in this lesson; exact oropharyngeal
anatomy, if needed, is shown via a validated diagram in postproduction.

## Postproduction overlays (deterministic)

- "Midline", "Dental protection", error caption — all added deterministically.
- No generated text inside any clip.

## Review gate

Route to `clinical-review-checklist.md` → **General review** and **Intubation
review**. Only the physician owner or a designated faculty reviewer may set
`medicalAccuracyVerified = true`.
