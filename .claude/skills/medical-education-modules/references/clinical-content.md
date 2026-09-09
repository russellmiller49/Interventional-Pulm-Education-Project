# Clinical content standards

Rules for claims, numbers, terminology, safety-critical content, and the honesty of simulations.
These exist because medical education carries a duty of accuracy that general courseware does not:
a confidently wrong module trains a confidently wrong clinician.

## Claims and sources

Every teachable claim belongs to a **claim class**, and the class determines how it is presented:

| Class | Example | Presentation |
|---|---|---|
| Guideline/consensus | ELSO adult VV guideline recommendation | State it; cite it; note the year |
| Textbook/physiology | Centrifugal pumps are preload dependent, afterload sensitive | State it; cite the reference work |
| Primary literature | A trial result | State with the study's scope; do not generalize past it |
| Institution practice | "We check a post-oxygenator gas daily on VA" | Teach it *as* practice: "a common approach at high-volume centers…"; flag institution variation |
| Authored teaching construct | A numbered-zone scaffold; a simulation's fault magnitudes | Label it as a construct built for teaching; never present as published taxonomy or measured data |

Maintain the source list per unit (a simple `sources:` field is enough; a project-level evidence
registry is better). A claim with no assignable class is a claim to cut. When authorities
genuinely disagree (target saturations on support, anticoagulation strategies), render the
disagreement *as* a disagreement — positions attributed, no synthetic middle number — rather than
silently picking a side.

## The numbers policy

- **Default to trend, direction, and pattern.** "The inlet pressure becomes progressively more
  negative and flow falls" teaches the skill; "keep it above −80" teaches a number that is wrong
  at the next institution.
- **Baseline-relative rules are the honest quantitative layer**: alarms and worry thresholds are
  set around *this patient's optimized baseline* (a common convention: a set percentage off
  baseline), and a value that doubles over a shift means something a static value does not. Teach
  that explicitly — it is how experienced clinicians actually operate.
- A **numeric band** may appear only when all three hold: it has a citable source or is flagged
  as institution practice; it carries an institution-variation note; and the surrounding copy
  still leads with the trend skill. Never insert a cutoff to make prose feel authoritative, and
  never resolve a source conflict by averaging.
- **Flow/state dependence is part of the number.** If a parameter varies with operating point
  (a membrane pressure drop rises with flow), teaching the number without the dependence teaches
  a false alarm.

## Terminology

- Use current society nomenclature as primary (e.g., *drainage/return* cannulas, *dual
  circulation*), and retire legacy terms exactly once with a parenthetical — "dual circulation
  (older sources: North–South or Harlequin syndrome)" — because learners will meet the old terms
  in the wild.
- Plain name first, standard label second, then pick one and hold it: "drainage pressure — the
  console calls it pVen; ELSO calls it P1."
- Watch for label/anatomy traps and defuse them in copy the first time they appear (an "arterial"
  bubble detector on a circuit returning to a vein; "wedge" vs "occlusion" pressure).
- One term per concept module-wide; run a vocabulary check across surfaces (see
  `module-structure.md`).

## Model boundaries

Every simulation and every simplified explanation states what it does not represent, in learner
language, at the point of use — not in a distant disclaimer.

- Boundaries name **what is omitted**, never the withheld answer ("this model does not represent
  clot formation over time" is a boundary; "the resistance you're seeing is a clot" is a leak —
  see `assessment-design.md`).
- Unavailable values are honestly unavailable: a dash means "not modeled/measured here," and the
  copy says so; do not describe an unmodeled state with physical-sounding absolutes
  ("unpressurized") that a learner will remember as fact.
- Authored quantities (fault magnitudes, response curves, chatter thresholds) are labeled as
  authored wherever a learner might mistake them for measurement, and a "simulated values" badge
  must survive every viewport.
- **Recognition is not treatment.** If the learner's available action is assessment, escalation,
  verification, or documentation, the simulated physiology does not improve in response.
  Improvement is reserved for actions that represent completed interventions, and then the action
  label says so. Nothing teaches a false lesson faster than a patient who gets better because the
  learner "escalated."
- Simulations never show benefit from an action the copy calls harmful. If the engine cannot
  represent the harm, the action is blocked, penalized, or the scenario is redesigned — the model
  must not quietly reward it.

## Safety-critical content

For content where a wrong specific could cause patient harm (isolation/clamp sequences, device
resets and resumption, energy settings, drug dosing, sterile technique):

- Teach the **principles and the why** (why both limbs must be isolated; why cause precedes
  reset), and defer exact choreography to "the current IFU and your approved local protocol."
  Never invent a universal step order the sources don't authorize — a confident invented sequence
  is worse than an honest deferral.
- Where a sequence *is* source-authorized, the simulation's required order matches the copy's
  order exactly, and the scoring requires it (see scoring honesty in `assessment-design.md`).
- Emergency content states its scope: what this module prepares the learner to do, and which
  competencies (hand-cranking, cannulation, exchange procedures) require supervised hands-on
  training it cannot substitute for.
- Contraindications and patient-selection content avoids absolutes that practice has outgrown;
  where a field is moving (relative contraindications, expanding indications), say the direction
  of movement and date it.

## Professional register

- No hype, no fear appeals, no editorializing about other specialties or products. Comparative
  device statements are factual and sourced.
- Constructed vignettes are explicitly constructed; no real patient details, ever, even
  de-identified-looking ones.
- Humility is part of accuracy: "the data here are limited," "practice varies," and "this is our
  institution's approach" are professional sentences, not weaknesses. A module that admits the
  edges of its knowledge is trusted at its center.
