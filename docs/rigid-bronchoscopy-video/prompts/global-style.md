# Global Style — Rigid Bronchoscopy Technique Videos

> **Status: PLANNING / DRAFT.** No media has been generated. The Higgsfield
> generative-media MCP server is configured but **not yet authenticated**, so
> nothing has been produced. This file defines the reusable prompt base and
> visual identity to be used **once generation is authorized**. Do not treat any
> language here as evidence that a clip exists.

This module **supplements** supervised simulation and clinical instruction. It
does **not** independently credential any learner to perform rigid bronchoscopy.
All generated content is **DRAFT until physician review** and must never be
published on the production learner route before sign-off.

---

## Global visual prompt (use verbatim as the base of every prompt)

```
High-fidelity clinical procedural education scene in a modern bronchoscopy
operating room. Adult airway training manikin positioned supine on an operating
table. An experienced interventional pulmonologist stands at the head of the bed
wearing standard procedural attire and gloves. A realistic straight
stainless-steel rigid bronchoscope has a clearly defined beveled distal tip,
constant barrel diameter, correct proximal ports, and mechanically rigid form.
Neutral documentary lighting, fixed instructional camera, deep focus, accurate
hand-to-instrument contact, restrained deliberate movement, medically
professional setting, clean uncluttered background, no logos, no visible patient
identifiers, no dramatic acting. Maintain exact continuity of the operator,
manikin, bronchoscope, room, camera orientation, hand positions, instrument
dimensions, and patient anatomical left-right orientation.
```

Prepend this paragraph to every maneuver-specific prompt. Maneuver text is
**appended**, never substituted.

---

## Global negative / rejection constraints (include verbatim in every prompt)

```
No flexible or bending metal barrel. No changing instrument length or diameter.
No duplicated instruments. No extra fingers. No fused hands. No instrument
passing through hands. No anatomical mirroring. No left-right reversal. No
uncontrolled levering on teeth. No unexplained scope motion. No generated labels,
captions, letters, numbers, logos, or watermarks. No cinematic camera orbit. No
dramatic depth of field. No blood or gore unless explicitly required for a
separate clinically reviewed synthetic complication illustration. No spontaneous
dialogue. No speech.
```

---

## Reusable visual identity

A **consistent operator face is not important**. Instrument geometry, hand
position, and patient anatomical orientation matter far more than facial
continuity. Favor **cropped operator views** (torso-and-hands framing), gloved
hands, and repeated wardrobe / room / camera so continuity reads through the
instrument and setting rather than the face.

| Element                                | Description to hold constant                                                                                                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Operator**                           | Experienced interventional pulmonologist at the head of the bed, standard procedural attire, gloved. Prefer cropped framing; face need not repeat exactly.                              |
| **Assistant**                          | Optional second gloved provider to the operator's side for instrument hand-off only. Never obstructs the mouth, barrel, or hands.                                                       |
| **Manikin**                            | Adult airway **training manikin**, supine, neutral head position at baseline. Explicitly synthetic; no identifiable-patient features.                                                   |
| **Dental guard**                       | Protective guard/roll over the upper incisors, present whenever the barrel is near the mouth. Signals dental protection; is **not** a fulcrum.                                          |
| **Rigid bronchoscope**                 | Straight stainless-steel barrel, **constant diameter and length**, defined beveled distal tip, correct proximal ports/caps, mechanically rigid at all times.                            |
| **OR environment**                     | Modern bronchoscopy suite, neutral documentary lighting, clean uncluttered background, no logos or identifiers.                                                                         |
| **Synthetic central-airway tumor**     | Simplified polypoid intraluminal lesion in a central airway, clearly distinguishable from normal wall. Used only in synthetic cutaway/coring content.                                   |
| **Synthetic tracheobronchial cutaway** | Simplified 3D airway-training cutaway (trachea → carina → mainstem bronchi) used for internal-consequence views. Always a **validated model/diagram**, never presented as real footage. |

### Consistency anchors (repeat across generations)

- Same manikin, table height, and supine pose.
- Same barrel dimensions and bevel geometry in every clip.
- Same fixed camera location per shot (documented per shot in the storyboards).
- Same wardrobe and glove color.
- Same neutral background dressing.
- Same patient anatomical left-right orientation (see
  `left-right-orientation-standard.md`).

---

## Labeling and postproduction rules

- **No generated text of any kind** inside the image — no labels, captions,
  letters, numbers, arrows, L/R markers, logos, or watermarks. Every overlay is
  added **deterministically in postproduction**.
- Any generated intraluminal / cutaway view must carry the postproduction label,
  worded exactly: **"Synthetic procedural visualization"**.
- Generated endoluminal anatomy is **never** presented as actual procedural
  footage.
- Narration is authored and recorded **separately** with exact wording;
  Higgsfield must **not** generate speech, dialogue, or on-screen text.

---

## Production specs

| Spec                      | Value                                                |
| ------------------------- | ---------------------------------------------------- |
| Aspect ratio              | 16:9                                                 |
| Final resolution          | 1080p                                                |
| Draft resolution          | Lowest practical preview resolution                  |
| Individual clip length    | ~4–10 s                                              |
| Final micro-lesson length | ~45–120 s                                            |
| Camera                    | Fixed or slowly moving documentary camera; no orbit  |
| Focus                     | Deep focus keeping hands, barrel, and mouth visible  |
| Lighting                  | Neutral OR lighting; no dramatic depth of field      |
| Audio                     | Disabled during generation                           |
| On-screen text            | None generated; all overlays added in postproduction |

### One-movement rule

Generate **one major movement per clip**. Never combine oral insertion + cord
passage + mainstem direction + coring in a single generation. Sequencing is
assembled in postproduction from single-movement clips.

### Do not rely on generative video for authoritative anatomy

Generative video must **not** be the authority for internal airway anatomy.
Combine it with **validated 3D airway assets, diagrams, or manikin footage** for
exact internal anatomic relationships. External-mechanics clips may be generated;
internal-consequence content should be driven by validated references.

---

## Reviewer note

Only the physician owner or a designated faculty reviewer may mark a clip
`medicalAccuracyVerified = true`. See `clinical-review-checklist.md`.
