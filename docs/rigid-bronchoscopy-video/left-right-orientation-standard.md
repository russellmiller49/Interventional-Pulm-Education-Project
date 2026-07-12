# Left/Right Orientation Standard

> **Status: PLANNING / DRAFT.** No media has been generated. Higgsfield is
> configured but not yet authenticated. This standard governs how side is
> described, generated, and reviewed once generation is authorized.

Side errors are among the most dangerous failures in procedural media. This
standard is **mandatory** for every side-specific clip in the module. A clip that
cannot pass the left/right review below is **rejected**.

---

## Core convention

1. **Always describe patient anatomical left/right — never viewer left/right.**
   Every prompt, storyboard field, narration line, and overlay uses the patient's
   anatomical side. When in doubt, name the landmark (e.g., "the patient's left
   mainstem bronchus"), not a screen direction.

2. **Record the camera location for every shot.** Each storyboard shot carries a
   camera-location field (e.g., "external overhead", "external 3/4 from head",
   "synthetic cutaway, fixed"). Because patient left can appear on either side of
   the frame depending on camera placement, the camera location is required to
   interpret the image correctly.

3. **Add L/R overlays only in postproduction.** No left/right markers, letters, or
   arrows are ever generated inside the image. Any L/R indicator is added
   deterministically in postproduction after the side has been verified.

4. **Use asymmetrical reference landmarks to detect mirroring.** Keep at least one
   deterministic asymmetrical landmark in frame (a consistently placed table
   accessory, port orientation, or wardrobe detail) so that an unintended
   left-right flip is immediately visible. If the landmark appears on the wrong
   side, the clip was mirrored and is rejected.

5. **Require explicit left/right review before approval.** Every side-specific clip
   needs a documented left/right orientation check with **two-reviewer**
   confirmation. The reviewer records: intended patient side, camera location,
   observed proximal/head direction, observed distal-tip direction, and landmark
   position. See `clinical-review-checklist.md` → **Mainstem-navigation review**.

6. **RB-NAV-R (and any right-side) shots are separately validated — never a flipped
   left clip.** Horizontally mirroring a left clip reverses hand and equipment
   relationships and would teach a misleading motor pattern. Right-side content is
   authored and validated against separate right-sided references.

---

## The movement relationship (stated in patient terms)

To align the distal tip toward a **target** mainstem, the head and the proximal
barrel move toward the **opposite** patient-anatomical side:

| Target mainstem   | Head moves toward | Proximal barrel moves toward | Distal tip aligns toward |
| ----------------- | ----------------- | ---------------------------- | ------------------------ |
| Patient **left**  | Patient **right** | Patient **right**            | Patient **left**         |
| Patient **right** | Patient **left**  | Patient **left**             | Patient **right**        |

Hedged framing for narration (authored separately): "One commonly taught approach
is to move the proximal barrel and head away from the target side to align the
distal tip toward the target mainstem. This representation simplifies the anatomy
to demonstrate the movement relationship. Advance only after confirming alignment
under direct visualization." Head movement alone does not guarantee mainstem entry.

---

## Per-shot orientation record (fill for every side-specific clip)

- **Shot id:**
- **Intended patient side (left/right):**
- **Camera location:**
- **Observed proximal-barrel direction (patient terms):**
- **Observed head-adjustment direction (patient terms):**
- **Observed distal-tip direction (patient terms):**
- **Asymmetrical landmark and its expected side:**
- **Landmark appears on expected side? (Y/N):**
- **Separately validated (not a flipped clip)? (Y/N):**
- **Reviewer 1 / date:**
- **Reviewer 2 / date:**
- **Left/right verdict (pass / reject):**

Any "N" on landmark position, or any evidence of mirroring, forces rejection.

---

## Non-side-specific shots

Axial advance/withdraw, rotation, oral entry, glottic rotation, and coring are not
patient left/right maneuvers. They still record camera location and keep an
asymmetrical landmark in frame so incidental scene mirroring is caught, but they do
not assert a patient side.
