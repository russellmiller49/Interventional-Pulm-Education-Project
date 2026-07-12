# Prompt Set — Mainstem Direction (RB-NAV)

> **Status: PLANNING / DRAFT.** No media has been generated. Higgsfield is
> configured but not yet authenticated. These are prompt paragraphs to be used
> once generation is authorized. `mainstem-direction` is the **validated
> prototype** lesson and is produced first.

Every prompt below is **appended** to the verbatim global visual prompt and the
verbatim negative constraints in `global-style.md`. Do not restate anatomy from
generation alone — pair internal-consequence shots with a validated 3D airway
model or vector diagram.

**Lesson id:** `mainstem-direction`
**Shot id convention:** `RB-NAV-<SIDE?>-<NNN>`

---

## Orientation rule (applies to every shot here)

- Describe motion in **patient anatomical left/right**, never viewer left/right.
- Record the camera location for each shot (see storyboard and
  `left-right-orientation-standard.md`).
- **RB-NAV-R** shots are authored and validated **separately**. They are **never**
  a horizontally flipped left clip — flipping would reverse hand and equipment
  relationships and make the demonstration misleading.

---

## RB-NAV-001 — Neutral distal tracheal position (hero frame)

External three-quarter or overhead framing. Establishes the continuity baseline.

```
The rigid bronchoscope is centered in the distal trachea in a neutral,
resting position. The patient's head is neutral. The operator's hands are stable
on the barrel with correct hand-to-instrument contact. There is no advancement
and no rotation. Hold a calm, steady documentary frame that establishes the
baseline operator, manikin, bronchoscope, room, and camera orientation.
```

- Side: not-applicable. Camera: external 3/4 or overhead. Length: 4–6 s.

---

## RB-NAV-L-001 — Prepare for LEFT-mainstem alignment (verbatim maneuver)

Use this maneuver text **verbatim**, appended to the global base:

```
The target is the patient's anatomical left mainstem bronchus. Beginning with the
rigid bronchoscope centered in the distal trachea, the operator makes a small
controlled adjustment of the patient's head toward the patient's anatomical right
and moves the proximal end of the rigid bronchoscope toward the patient's
anatomical right. The operator does not lever against the upper incisors and does
not advance blindly. Show only the external movement, slowly and continuously,
while preserving the exact rigid shape of the barrel.
```

- Side: **left**. Camera: external. Movement: external only, no advancement.
- Continuity: identical barrel and hero framing from RB-NAV-001.

---

## RB-NAV-L-002 — Validated internal consequence (LEFT)

**Do not generate free-form endoluminal anatomy for this shot.** Drive it from a
validated 3D airway model, vector diagram, or deterministic animation. Carries
the persistent postproduction label **"Synthetic procedural visualization"**.

```
Validated synthetic 3D airway-training cutaway of the distal trachea, carina, and
mainstem bronchi. As the proximal barrel moves toward the patient's anatomical
right, the distal tip aligns toward the patient's anatomical left mainstem
bronchus. The airway wall is stationary; only the instrument moves. No claim is
made that head movement alone guarantees entry. No advancement is shown; any
advancement would follow only after direct visualization and confirmed alignment.
```

- Side: **left**. Source: validated model/diagram (not free generation).
- Overlay: "Synthetic procedural visualization" (postproduction, persistent).

---

## RB-NAV-R-001 — Prepare for RIGHT-mainstem alignment (separately authored)

> **Not a flip of RB-NAV-L-001.** Authored and validated independently against
> right-sided references. The proximal-barrel and head directions reverse
> relative to the left variant, and hand/equipment relationships must be
> re-verified for the right-sided demonstration.

```
The target is the patient's anatomical right mainstem bronchus. Beginning with
the rigid bronchoscope centered in the distal trachea, the operator makes a small
controlled adjustment of the patient's head toward the patient's anatomical left
and moves the proximal end of the rigid bronchoscope toward the patient's
anatomical left. The operator does not lever against the upper incisors and does
not advance blindly. Show only the external movement, slowly and continuously,
while preserving the exact rigid shape of the barrel.
```

- Side: **right**. Camera: external. Produced from separate right-sided
  references, **never** by mirroring a left clip.

---

## RB-NAV-R-002 — Validated internal consequence (RIGHT, separately authored)

```
Validated synthetic 3D airway-training cutaway of the distal trachea, carina, and
mainstem bronchi. As the proximal barrel moves toward the patient's anatomical
left, the distal tip aligns toward the patient's anatomical right mainstem
bronchus. The airway wall is stationary; only the instrument moves. No claim is
made that head movement alone guarantees entry. No advancement is shown; any
advancement would follow only after direct visualization and confirmed alignment.
```

- Side: **right**. Source: validated model/diagram, authored independently of
  the left content. Overlay: "Synthetic procedural visualization".

---

## RB-NAV-ERR-001 — Dental fulcrum error (synthetic controlled demo)

Clearly synthetic controlled demonstration. **Freezes before force is applied.**

```
Clearly synthetic controlled demonstration. The proximal barrel of the rigid
bronchoscope is resting against the dental guard over the upper incisors in an
incorrect position that would use the teeth as a fulcrum. The scene holds and
freezes before any force is applied. No levering motion is completed and no
injury is shown.
```

- Freeze before force. Postproduction overlay: **"Do not use the incisors as a
  fulcrum."**
- Follow immediately with a corrected clip: proper head/mouth alignment with the
  barrel supported by hand position rather than the teeth.

---

## RB-NAV-QUIZ-001 — Retrieval freeze frame (no generated text)

```
A clean, steady freeze frame of the neutral distal tracheal hero position with
the operator's hands stable on the barrel. No text of any kind appears in the
image.
```

- Postproduction question overlay: **"The intended target is the left mainstem
  bronchus. Which direction should the patient's head and the proximal barrel
  move?"**
- No generated text in the frame; the question is added deterministically.

---

## Hedged-language reminders for narration (authored separately)

- "One commonly taught approach is to move the proximal barrel and the head away
  from the target side to align the distal tip toward the target mainstem."
- "This representation simplifies the anatomy to demonstrate the movement
  relationship."
- "Advance only after confirming alignment under direct visualization."
