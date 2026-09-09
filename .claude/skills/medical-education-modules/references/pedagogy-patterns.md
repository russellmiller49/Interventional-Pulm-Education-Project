# Pedagogy patterns

Eight named patterns for making medical teaching content followable. Each was extracted from
high-performing live instruction (device provider courses, sim-lab teaching) and validated against
the recurring failure modes of written modules. Use the names in plans, commit messages, and
reviews so choices stay legible.

## P1 — Follow the path (the spine)

**What.** Organize the whole module around one traversable structure and introduce everything at
its location on it. Blood path for ECMO/CRRT/MCS (drainage → pump → membrane/filter → return).
Breath cycle for ventilation (trigger → target → cycle → expiration). Airway tree for bronchoscopy
(cords → carina → lobar → segmental). Procedure timeline for interventional work (indication →
setup → steps → recovery → complications).

**Why.** Spatial/temporal structure is the cheapest memory scaffold available; a signal learned at
its location survives, a signal learned from a table does not. It also makes later troubleshooting
teachable as *localization* rather than memorization.

**How.**
- The spine gets its own early unit: a guided walk, one stop per component, on a *normal, running*
  system — never a stopped or empty one (blank readouts read as equipment failure to novices).
- Each stop: highlight the component visually, name it (plain name first, console/standard label
  second), give its analogy and checklist, and where possible let the learner wiggle one control
  and predict the response.
- Build a persistent minimap (a small schematic of the spine with the current location lit) and
  reuse it in every later unit with the implicated segment highlighted.

**Anti-pattern.** A "components overview" table listing every sensor and pressure at once; a
console tour before the physiology; introducing all abbreviations in unit 1 "to get them out of
the way."

## P2 — Analogy → checklist → application

**What.** Every mechanical/physiologic concept in this order: (1) a concrete physical analogy,
(2) the precise statement, (3) a checklist of ≤4 items, (4) an immediate application.

**Why.** The analogy is retrieval glue; the checklist is what transfers to the bedside; the
application closes the loop before the next concept arrives. Precision-first prose is correct and
forgettable.

**Examples.**
- Drainage physics = drinking through a straw. Four things make you suck harder: a kinked straw, a
  clogged straw, an empty cup, the straw flat against the bottom. → **kink, clot, volume,
  position** — the exact shortlist reused in every drainage drill.
- Return pressure = pushing the drink back down the straw: kink and clot again, plus (arterial
  return only) the vessel pushing back — afterload.
- A membrane oxygenator = thousands of hollow fibers: blood weaves around the outside, gas blows
  through the inside, diffusion does the rest; a second bundle carries warm water.
- Auto-PEEP = trying to exhale through a narrow straw before the next breath arrives.

**Rules.** One analogy per component — competing analogies are worse than none. Keep analogies
culturally portable or mark them for localization if the module is translated. The checklist, not
the analogy, is the thing later units reference.

## P3 — The small control panel

**What.** Before any troubleshooting, state exactly what the learner can change, as a short
enumerated set: "You can only change three things on this circuit: pump speed, gas FiO₂, and sweep
rate. Everything else is monitoring."

**Why.** Novices experience a console as fifty things that might need action. Collapsing agency to
3–5 knobs converts every later alarm from "what do I touch?" into "which knob, if any?" — and
"if any" matters: many faults are cause problems no knob fixes, and the panel makes that a
teachable answer rather than a trick.

**How.** Introduce the panel as its own moment in the foundations. Then reuse it as a recurring
strip in every drill's debrief with each knob in one of three states: *this is the knob* / *not
this knob* / *no knob — find the cause*.

## P4 — Story-problem decoupling

**What.** Where two controls are habitually confused, author a pair of 60-second scenarios: one
where only the correct control works, one where the tempting wrong control visibly fails.

**Why.** "A controls X, B controls Y" is assertion; a scenario where cranking B does nothing for X
is experience. Confusions worth this treatment are the ones instructors report fielding
repeatedly.

**Canonical examples.**
- ECMO transport: the wall blender stays behind; the tank is always 100% oxygen; you match the
  sweep rate and give up FiO₂ titration. (Teaches: FiO₂ and sweep are separate axes.)
- The cranked sweep: during a desaturation someone quadruples the sweep — CO₂ plummets,
  saturation doesn't move.
- Ventilation: raising FiO₂ for a high PaCO₂; raising rate into auto-PEEP.

**Form.** Predict → run/reveal → one-line verdict naming the axis each control lives on.

## P5 — One diagnostic grammar

**What.** The module's core decision logic — usually *which signal moved → where the problem lives
→ cause shortlist* — is built once as a named table and reused by reference everywhere.

**Example (extracorporeal circuits).**

| What moved | Where the problem lives | Shortlist |
|---|---|---|
| Inlet pressure more negative, flow falling | Upstream — drainage | kink · clot · volume · position |
| Both post-pump pressures rise together, ΔP flat | Downstream — return path | kink · clot · (VA: afterload) |
| ΔP widening at matched flow | The membrane/filter itself | progressive thrombosis — trend it |
| Pressures quiet, gas/solute values worsening | Not the blood path — the gas/fluid path | source → blender/lines → membrane |

**Rules.** Teach the grammar immediately after the spine walk, assembled from experiments the
learner just performed. Every later drill highlights its row; no drill restates the table in new
words (paraphrase drift is how grammars die). Footnote the grammar with the trend rule (P7 in
`clinical-content.md`): compare against this patient's/circuit's own baseline.

## P6 — Named increments

**What.** Every step up in complexity announces its size: "VA is VV plus exactly two new ideas:
the artery pushes back, and there are now two circulations." "Pressure-support adds one idea to
what you know: the patient, not the timer, ends the breath."

**Why.** Unquantified difficulty is what makes learners feel a module "escalates suddenly." A
counted increment tells them precisely how much attention to allocate and reassures them the rest
is already theirs.

**How.** The sentence goes first in the new track/unit's intro, and the module's track-chooser or
navigation copy repeats it ("Do VV first — VA is VV plus two ideas").

## P7 — Trend over threshold

Teach direction, pattern, and baseline-relative change as the primary skill; treat memorized
cutoffs as the fragile exception. Full policy and phrasing rules in `clinical-content.md`. The
pedagogical half: make "alarms are set around *this patient's* optimized baseline" an explicit
learner-facing lesson, not just an authoring constraint — it is itself how experienced clinicians
think, and saying so builds trust in the module's refusal to hand out magic numbers.

## P8 — Micro-case retrieval

**What.** Immediately after each mechanism, 1–2 micro-cases: a static signal set and one decision,
answerable in under two minutes. Rich multi-step cases live in a separate practice layer.

**Form.** Signals (3–5 values, ideally the same triad every time for that mechanism) → one
question ("where is the watershed, and which control reaches the brain — ventilator or circuit?")
→ committed answer → two-sentence debrief. Rotate the correct answer's position and keep option
lengths comparable (see `assessment-design.md`).

**Why.** Retrieval within minutes of learning is the highest-yield rep available, and micro-cases
train the *triad* (which signals to look at) as much as the answer. Full cases arriving later then
feel like assembly of known parts rather than a difficulty cliff.

## Copy voice (applies to all patterns)

- Second person, present tense, imperative for actions. "You are standing at the pump inlet"
  beats "the pump inlet is now considered."
- Paragraphs ≤4 sentences; a prose unit ≤6 minutes reading time; anything longer splits or moves
  detail to an optional side panel.
- Plain name first, label second: "drainage pressure — the console calls it pVen; ELSO calls it
  P1." Thereafter use one of them consistently (pick the one the learner will see on the device).
- One short illustrative vignette per unit maximum (≤3 sentences), explicitly framed as
  constructed illustration, never as patient data.
- Objectives name the *discrimination* the learner will be able to make, never the answer:
  "distinguish a drainage limit from a return obstruction using the pressure pattern" — not
  "reduce pump speed before correcting the drainage cause."
