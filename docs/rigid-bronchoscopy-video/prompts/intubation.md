# Prompt Set — Intubation (Oral Entry, Glottic Passage, Tracheal Advancement)

> **Status: PLANNING / DRAFT.** No media has been generated. Higgsfield is
> configured but not yet authenticated. These prompts are for use once
> generation is authorized.

Every prompt is **appended** to the verbatim global visual prompt and negative
constraints in `global-style.md`. One major movement per clip. Any internal /
glottic representation is **synthetic training content**, never real footage, and
combines with validated airway assets for exact anatomy.

Covers lesson ids `oral-entry`, `glottic-passage`, `tracheal-advancement`.
Shot id convention: `RB-ORAL-<NNN>`, `RB-GLOTTIS-<NNN>`, `RB-TRACH-<NNN>`.

---

## Oral entry — `oral-entry`

### RB-ORAL-001 — Controlled oral introduction

```
External documentary framing of the operator's gloved hands and the straight
rigid bronchoscope at the mouth of the adult airway manikin. The operator
introduces the beveled distal tip into the mouth in the midline, slowly and under
control, with dental protection present over the upper incisors. The barrel stays
perfectly straight and constant in diameter. Hands maintain continuous, accurate
contact with the instrument. No forceful insertion; no levering on the teeth.
```

- One movement: oral introduction only. Camera: fixed, hands + mouth + barrel in
  frame. Dental protection visible, not a fulcrum.

### RB-ORAL-002 — Tongue control and midline advance

```
Continuing from the introduced position, the operator keeps the tongue controlled
and advances the straight rigid bronchoscope in the midline toward the
oropharynx, slowly and deliberately, with dental protection maintained. The barrel
remains straight and constant in diameter; hands stay in continuous contact.
Movement stops if the view is not maintained.
```

- One movement: midline advance. Emphasize stop-if-not-visualized discipline.

---

## Glottic passage — `glottic-passage`

### RB-GLOTTIS-001 — Glottic passage sequence (verbatim movement prompt)

Use this movement text **verbatim**, appended to the global base. This is
**synthetic training content**; pair with validated glottic references and label
any internal view **"Synthetic procedural visualization"** in postproduction.

```
Begin with the epiglottis and glottic opening already identified in a synthetic
training representation. The operator performs a small deliberate lifting movement
while maintaining protection of the upper teeth. Immediately before passing the
glottic opening, the operator rotates the straight rigid bronchoscope
approximately 90 degrees so the narrower dimension is aligned with the opening.
After controlled passage into the trachea, the operator returns the barrel to the
intended working orientation. The sequence is slow, atraumatic, continuously
visualized, and contains no forceful advancement.
```

- Content type: synthetic training representation. Overlay any internal view with
  "Synthetic procedural visualization".
- Key beats to preserve: lifting movement with tooth protection → ~90° rotation
  to align the narrower dimension → controlled passage → **return to working
  orientation**.
- Reject: forceful advancement, loss of visualization without stopping, any
  barrel bend or diameter change, use of teeth as a fulcrum.

> **Anatomy caveat.** Do not rely on generation for the exact glottic anatomic
> relationship. Combine with validated 3D airway assets, diagrams, or manikin
> footage for the authoritative view; the generated clip demonstrates the
> **movement**, not the definitive anatomy.

### RB-GLOTTIS-002 — Return to working orientation (isolated)

```
Immediately after controlled passage through the glottic opening into the
trachea, the operator rotates the straight rigid bronchoscope back to the intended
working orientation, slowly and under control. The barrel remains straight and
constant in diameter. Continuous visualization is maintained; no forceful motion.
```

- One movement: de-rotation to working orientation. Reinforces that the ~90°
  rotation is transient.

---

## Tracheal advancement — `tracheal-advancement`

### RB-TRACH-001 — Midline tracheal advance under visualization

```
The straight rigid bronchoscope is within the trachea, centered in the lumen. The
operator advances slowly and deliberately in the midline while maintaining
continuous visualization of the lumen ahead. The barrel remains perfectly
straight and constant in diameter; hands stay in continuous, accurate contact.
Advancement is smooth and unhurried and stops if the lumen is not clearly seen.
```

- One movement: axial tracheal advance. Emphasize lumen-in-view before every
  increment.

### RB-TRACH-002 — Approach to the carina (neutral, pre-navigation)

```
The straight rigid bronchoscope advances to a neutral distal tracheal position
approaching the carina, centered in the lumen, with the head neutral and the
barrel straight and constant in diameter. The operator pauses in a stable neutral
position without selecting a side. Continuous visualization is maintained.
```

- One movement: settle to neutral distal-tracheal hero position. This frame is
  the continuity handoff into `mainstem-direction` (RB-NAV-001).

---

## Shared narration framing (authored separately)

- "Advance only after confirming the lumen under direct visualization."
- "Rotate to align the narrower dimension with the glottic opening, then return
  to the working orientation."
- "Protect the upper teeth; do not use the incisors as a fulcrum."
- "If you lose the view, stop and reestablish it before advancing."
