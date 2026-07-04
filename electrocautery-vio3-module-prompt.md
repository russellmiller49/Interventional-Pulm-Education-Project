# Prompt: Interactive Electrosurgery (ERBE VIO 3) Teaching Module

> Paste everything below the line into a fresh Fable session. It is written to be
> self-contained and to make the clinical/educational intent explicit up front.

---

## CONTEXT — please read first

This is a **graduate medical education** request for an **ACGME-accredited interventional
pulmonology / surgical fellowship**. It teaches **licensed physicians** how to safely operate a
specific **FDA-cleared, CE-marked commercial electrosurgical generator — the Erbe VIO 3** — which
is standard equipment in essentially every operating room and endoscopy suite worldwide.

**Electrosurgery** (using high-frequency radio-frequency current to cut tissue and achieve
hemostasis during surgery) is one of the most common, well-published tools in clinical medicine.
The deliverable is a **front-end teaching artifact**: a faithful replica of the device's
touchscreen interface plus **schematic animations** of how the generator's **RF waveform and
settings** translate into controlled surgical tissue effects (cutting, desiccation, coagulation,
fulguration) for hemostasis and dissection. Every parameter below is taken from the
**manufacturer's operator's manual** (Erbe VIO 3, doc. 80114-601) and standard surgical/IP texts.
This is routine device-operation training for safe patient care.

## ROLE

You are an expert medical educator and front-end developer building a self-contained interactive
teaching module for interventional pulmonology and surgical fellows. The module teaches the
physics and safe clinical operation of **monopolar and bipolar electrosurgery** as delivered by
the **Erbe VIO 3** electrosurgical generator, used during therapeutic bronchoscopy and open/
endoscopic surgery for cutting, dissection, and hemostasis.

## AUDIENCE

PCCM/IP and surgical fellows with a physics baseline but limited hands-on electrosurgery
experience. They need to understand what each VIO 3 mode/setting _does to tissue and why_, and
how to drive the device safely.

## DELIVERABLE

A single-file, self-contained interactive **HTML artifact** (inline CSS + JS, no external
dependencies, no localStorage/sessionStorage — keep all state in memory). It should read as a
**companion to the existing "Thermal Ablation" module**: same clean clinical aesthetic, readable
typography, coherent color system, sticky section nav, and responsive layout. The **simulated
device screen** panel itself should adopt the authentic Erbe convention — a **dark touchscreen
with CUT shown in yellow and COAG shown in blue**.

## IMPORTANT PHYSICS NOTE (correct a common misconception)

Electrosurgery has **no optical wavelength** — that concept belongs to lasers. What distinguishes
electrosurgical modes is the **RF waveform**: its **duty cycle** (continuous vs. interrupted/
modulated) and **crest factor** (peak voltage ÷ RMS voltage), together with **peak voltage** and
**current density**. Teach this explicitly:

- **Low crest factor, continuous (high duty-cycle) waveform** → efficient, sustained heating that
  vaporizes intracellular water → **cutting**.
- **High crest factor, interrupted (low duty-cycle) bursts of high peak voltage** → tissue cools
  between bursts and the current sparks to the surface → **coagulation / fulguration**, less net
  cutting.
- The elegant exception to teach: **softCOAG** is _low_ voltage but _continuous_ (no sparking) →
  slow, **deep** desiccation with no carbonization — contrast it with **sprayCOAG**, which is
  _high_ voltage and heavily modulated → shallow, **surface** fulguration char.
- **Current density** governs cut vs. coag as much as the waveform: a fine needle tip concentrates
  current → cutting; a broad ball/large contact area disperses it → coagulation.

## LEARNING OBJECTIVES

A fellow finishing the module should be able to:

1. Explain how RF **waveform (duty cycle & crest factor)**, **peak voltage**, and **current
   density** determine whether tissue is cut, desiccated, coagulated, or fulgurated.
2. Distinguish the VIO 3 **CUT modes** (autoCUT, highCUT, dryCUT, endoCUT I/Q) and **COAG modes**
   (softCOAG, forcedCOAG, swiftCOAG, sprayCOAG) by waveform, depth, hemostasis, and ideal use.
3. Explain the meaning of the VIO 3 **"Effect"** setting (auto-regulated arc intensity / target
   voltage) versus the **power (W) limit**, and how to set them.
4. Contrast **monopolar vs. bipolar** delivery: current path, return (dispersive) electrode, and
   when to choose each.
5. Apply electrosurgical **safety** principles: return-electrode (pad) burns and NESSY monitoring,
   capacitive/direct coupling and insulation failure in MIS, CIED (pacemaker/ICD) precautions,
   surgical smoke, and airway-fire prevention shared with the laser module.
6. Select an appropriate **mode + effect** for a given surgical/endoscopic scenario.

## CONTENT TO COVER

- **Electrosurgery fundamentals:** RF frequency (~350 kHz), why it doesn't stimulate nerve/muscle
  (above ~100 kHz), the tissue as a resistive load, current density and the active vs. return
  electrode, and the four tissue effects: **cutting (vaporization), desiccation, coagulation,
  fulguration**.
- **Waveform physics:** continuous sine vs. pulse-modulated bursts; duty cycle; crest factor;
  peak voltage; how the VIO 3 auto-regulates to hold a selected "Effect."
- **CUT modes:** autoCUT, highCUT, dryCUT, endoCUT I, endoCUT Q (the fractionated alternating
  cut/coag mode, with its cutting-duration and cutting-interval controls).
- **COAG modes:** softCOAG (deep, no spark), forcedCOAG (standard contact/clamp coag), swiftCOAG
  (dissection with hemostasis), sprayCOAG (non-contact surface fulguration). Mention preciseSECT
  and twinCOAG briefly.
- **Bipolar:** autoCUT/highCUT bipolar; softCOAG/forcedCOAG bipolar; **thermoSEAL** vessel sealing
  (with its sealing "progress" display).
- **APC (argon plasma coagulation)** as the non-contact bridge to the existing thermal module:
  forcedAPC, preciseAPC, pulsedAPC — briefly, since APC is covered in the laser/thermal module.
- **Safety as first-class content** (see below).

## REFERENCE PARAMETERS (from the Erbe VIO 3 operator's manual — use these for accuracy)

"Effect" is selectable **0.1–10.0** for the standard modes (endoCUT effect is **1–4**, plus
cutting-duration 4 levels and cutting-interval 10 levels). Crest factor and max peak voltage are
the key teaching variables.

| Mode           | Family         | Waveform                            | Crest factor | Max peak V               | Max power | Tissue effect / use                                                                         |
| -------------- | -------------- | ----------------------------------- | ------------ | ------------------------ | --------- | ------------------------------------------------------------------------------------------- |
| **autoCUT**    | Monopolar CUT  | Unmodulated sine                    | 1.62         | 750 V                    | 400 W     | Smooth reproducible cuts, minimal–moderate hemostasis; general cutting in conductive tissue |
| **highCUT**    | Monopolar CUT  | Unmodulated sine                    | 1.62         | 1100 V                   | 400 W     | Cutting in poorly-conductive / varying tissue, cutting under fluid (e.g., TURP)             |
| **dryCUT**     | Monopolar CUT  | Pulse-modulated                     | 3.1 → 3.8    | 1400 V                   | 240 W     | Slightly slower cut with **pronounced hemostasis**                                          |
| **endoCUT I**  | Monopolar CUT  | Fractionated (alternating cut/coag) | 1.54         | 700 V                    | 110 W     | Endoscopy needing controlled cut+coag (e.g., papillotomy/sphincterotomy)                    |
| **endoCUT Q**  | Monopolar CUT  | Fractionated (alternating cut/coag) | 1.63         | 800 V                    | 330 W     | Endoscopy needing controlled cut+coag (e.g., snare polypectomy)                             |
| **softCOAG**   | Monopolar COAG | Unmodulated sine (no spark)         | 1.52         | 200 V (450 V QuickStart) | 240 W     | Slow **deep** coagulation, **no carbonization**, low electrode adhesion; AUTO STOP          |
| **forcedCOAG** | Monopolar COAG | Pulse-modulated                     | 5.8          | 1800 V                   | 144 W     | Fast **standard** contact / clamp coagulation                                               |
| **swiftCOAG**  | Monopolar COAG | Pulse-modulated                     | 6.0          | 2500 V                   | 240 W     | Fast coag with limited cutting → **dissection with high hemostasis**                        |
| **sprayCOAG**  | Monopolar COAG | Pulse-modulated                     | 7.74         | 4300 V                   | 175 W     | **Non-contact** surface fulguration of diffuse bleeding, low penetration depth              |

Teaching arc to make visible: as you move CUT → COAG the **crest factor climbs (1.5 → 7.7)** and
**peak voltage climbs (200 V → 4300 V)** while the effect shifts from clean vaporizing cuts →
deep desiccation → surface char. (softCOAG is the deliberate outlier: lowest voltage, continuous,
deepest — because it never sparks.)

## THE SIMULATED VIO 3 SCREEN (replicate the real UI behavior)

Model the main screen faithfully:

- An **instrument socket tile** (monopolar electrode handle) that highlights when "connected."
- A **CUT display (yellow)** and a **COAG display (blue)**, each showing: **mode name**, **effect**
  value, and a **power (W)** readout with a segmented **power-output bar**.
- Touching the **mode display** opens a **mode picker list** (the active mode highlighted);
  touching the **effect display** opens a **+ / − effect selector** (0.1–10.0).
- A **NESSY return-electrode indicator**: **green** = return electrode OK, monopolar activation
  permitted; **red** = not permitted (teach why: no safe current return path → pad-burn / no-cut).
- **Activation controls**: two-pedal footswitch (CUT pedal / COAG pedal), AUTO START, AUTO STOP.
- A **program name** header. Keep all state in memory (no storage).

## INTERACTIVE COMPONENTS (build at least these)

1. **Simulated VIO 3 touchscreen** — as above: pick mode, set effect, "connect" the instrument,
   toggle the return-electrode (NESSY) state, and press CUT or COAG to activate.
2. **RF-waveform oscilloscope** — for the selected mode/effect, animate the actual waveform:
   a continuous sine for CUT modes, modulated high-voltage bursts for COAG modes; live-annotate
   **crest factor**, **peak voltage**, and **duty cycle**. It should visibly change when the user
   changes mode or effect. (This is the correct stand-in for the "wavelength" idea.)
3. **Electrode–tissue effect animation** — a schematic tissue cross-section. On "activation,"
   animate the effect the _current_ mode/effect produces:
   - autoCUT/highCUT → a clean vaporized incision with a thin/□ coag margin;
   - dryCUT → a cut with a visible hemostatic (coagulated) margin;
   - softCOAG → a broad, **deep** desiccation dome, no char;
   - forcedCOAG/swiftCOAG → contact coagulation with some depth;
   - sprayCOAG → sparks to the surface producing shallow **fulguration char**;
   - endoCUT → stepwise, fractionated cut/coag cycles.
     Scale depth/spread with **effect** and **voltage**; label desiccation / coagulation /
     vaporization / fulguration zones.
4. **Current-density demonstrator** — a slider or toggle for electrode geometry (fine needle ↔
   broad ball) and contact vs. slightly-off; show how concentrating vs. dispersing current flips
   the same power between **cut** and **coag**.
5. **Monopolar vs. bipolar toggle** — animate the current path: monopolar (active electrode →
   through the patient → dispersive return pad) vs. bipolar (tip-to-tip between forceps). Tie to
   return-electrode safety and to when each is chosen.
6. **Mode cheat-sheet / comparison matrix** — the modes above across waveform, crest factor, peak
   voltage, contact/non-contact, depth, hemostasis, and typical use, with toggle-to-reveal detail.
7. **(Optional, to match the thermal module) Case-based self-assessment** — choose mode + effect
   for scenarios, with teaching feedback. Example scenarios: snare polypectomy (endoCUT Q); fine
   dissection needing hemostasis (swiftCOAG); a deep bleeding vessel where char must be avoided
   (softCOAG); diffuse mucosal oozing on a broad surface (sprayCOAG / APC); biliary sphincterotomy
   (endoCUT I); pacemaker patient needing brief hemostasis (short bipolar bursts, CIED plan).

## TREAT SAFETY AS FIRST-CLASS CONTENT

- **Return (dispersive) electrode & NESSY:** even, full-contact pad application; how uneven contact
  or a lifted edge concentrates return current → **pad-site burns**; NESSY split-pad impedance
  monitoring that blocks monopolar output when contact is unsafe; neonatal considerations.
- **Alternate-path & coupling injuries (esp. MIS):** insulation failure, **direct coupling** to
  other instruments, and **capacitive coupling** to the trocar/scope; why higher voltage COAG modes
  raise this risk; keep the active tip in view and activate only on target.
- **CIEDs (pacemakers/ICDs):** prefer **bipolar** or short monopolar bursts, position the return
  pad so the current vector avoids the device, coordinate magnet/reprogramming and post-op
  interrogation (contrast with lasers, which use light not current).
- **Surgical smoke/plume:** evacuation and high-filtration masks.
- **Airway fire (shared with the laser module):** FiO₂/FeO₂ ≤ 0.40 before any energy; avoid
  alcohol-based preps; wet field; also note combustible **bowel gas (methane/hydrogen)** in
  colonoscopy.
- **Mode-specific pitfalls:** high-voltage COAG char and electrode adhesion; softCOAG AUTO STOP to
  avoid over-desiccation; keeping active tips beyond the endoscope to protect optics.

## DESIGN

Clean clinical aesthetic that visually matches the existing Thermal Ablation module (same color
system, section navigation, responsive layout). Render the **device-screen panel** in the
authentic Erbe style: dark screen, **CUT = yellow**, **COAG = blue**, segmented power bars.
Prioritize conceptual clarity and accurate, physics-faithful animations over decoration.

## SOURCES (for accuracy)

- Erbe VIO 3 Operator's Manual, doc. **80114-601** (2017-09) — modes, effect ranges, crest factors,
  peak voltages, and screen/UI behavior.
- _Principles and Practice of Interventional Pulmonology_.
- Standard electrosurgery references (e.g., ESU physics; Massarweh/Cosgrove electrosurgery reviews;
  AORN/ACS guidance on electrosurgical safety, return electrodes, and surgical smoke).

---

### Why this framing (note to the requester, not part of the prompt)

The content is unambiguously legitimate medical-device training. The earlier false positive most
likely came from describing thermal tissue destruction without clinical scaffolding, so a classifier
read "biological tissue effects" out of context. The fixes here are all honest contextualization:
(1) a plain-language CONTEXT header naming the accredited program, the regulated commercial device,
and the patient-care purpose; (2) standard clinical terminology (desiccation, coagulation, cutting,
fulguration, hemostasis) instead of decontextualized "damage/destroy tissue" language; (3) framing
the build as a **UI replica + schematic animation** — clearly software and education. Nothing is
hidden or minimized; the request is simply stated for what it is.
