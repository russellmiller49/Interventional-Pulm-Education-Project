# Module structure, sequencing, and navigation

How to arrange units so basics build toward complexity, and how to make the arrangement legible in
the interface. Most "this module is confusing" feedback is structural, not content-level, and it
usually reduces to one of three defects: competing tables of contents, an entry point that skips
the runway, or difficulty that jumps without warning.

## The stage ladder

Every unit belongs to exactly one stage, and stages appear in this order. The ladder is the single
ordering authority for every surface that lists content.

| Stage | Job | Typical forms |
|---|---|---|
| **Orientation** | Why this therapy/device exists; what it substitutes for; what it cannot do | Short prose (≤6 min), one prediction |
| **Foundation** | Walk the spine; the normal state; the control panel | Guided tour on a running system; live micro-interactions |
| **Mechanism** | The load-bearing physiologic distinctions (flow vs sweep; series vs parallel; trigger vs cycle) | Prose + story-problems + the diagnostic grammar |
| **Application** | One fault at a time on the live system | Predict-commit-reveal drills, each = one lesson-spec |
| **Integration** | One presentation, several explanations; combine the grammar rows | Capstone challenge, unlocked by the track's drills |
| **Practice/Cases** | Full clinical scenarios applying the same mechanisms | Scored cases, paired to drills by mechanism |

Sequencing rules:

- **Prerequisite closure.** Every concept a unit relies on has an earlier unit that taught it, and
  the lesson spec names which one. Audit this as a graph, not by feel — the classic silent failure
  is drill 1 assuming vocabulary the skipped foundations carried.
- **One new concept per unit.** If a unit needs two, it is two units.
- **Normal before broken; whole before parts before whole.** Walk the spine end-to-end once at low
  resolution, then per-component, then reassemble in the normal-state unit.
- **Parallel tracks share their shared foundations literally** (same units, not copies), and each
  track's first unique unit opens with the named-increment sentence (pedagogy P6).
- **Track-to-track repetition must earn its place.** When a second track revisits a mechanism
  (e.g., hypercapnia on VA after VV), the unit's new concept is the *track-specific reassessment
  obligation*, and its copy leads with what is different — a re-nouned copy of the first track's
  unit is duplication, not spaced repetition.
- **Minutes are honest.** Every unit carries an estimated duration; a stage's total appears on the
  pathway. If foundations total more than ~30–40 minutes before the first interactive unit,
  convert prose to interaction or move depth to side panels — nobody assigned "read six essays"
  finishes them.

## One door

- Exactly **one primary CTA** on every entry surface: "Continue — [next incomplete unit title]",
  resolving through the same function everywhere. For a fresh learner that is stage 1, unit 1 —
  never a mid-ladder unit that happens to be the flagship interactive.
- Secondary affordance: "Browse all N units," where N and its composition ("17 sections:
  6 foundations · console orientation · 9 drills · capstone") are **derived from the content
  registry at render time**. Hardcoded counts drift, and drifted counts read as broken curriculum.
- If both a grouped view (units/chapters) and a linear view (pathway) exist, one is canonical for
  ordering and the other is a *presentation* of it, sourced from the same registry. Add a test:
  fresh-learner CTA target == first unit of the canonical order; every unit appears in exactly one
  group; group order flattens to canonical order.

## One map

- The spine minimap (pedagogy P1) is the module's wayfinding inside units; the pathway rail is the
  macro progress view. Do not add a third.
- **One term per concept, everywhere.** Fix the vocabulary in the plan and enforce it across hub,
  landing, rail, breadcrumbs, and buttons. A workable default:

| Term | Meaning |
|---|---|
| module | the whole subject (e.g., "CARDIOHELP ECMO") |
| track | a parallel variant (VV / VA; PrisMax / Prismaflex) |
| section / unit | one pathway entry |
| drill | a guided sim lesson |
| case | a scored practice scenario |
| challenge / capstone | the integration assessment |

- Buttons say what happens ("Start drill," "Resume case"), the same verb through the whole flow,
  and a completed action confirms in the same words.

## Learn / Practice / Assess separation

- **Learn** teaches with scaffolding and immediate feedback; **Practice** applies with scoring;
  **Assess** integrates with prerequisites gated on the learn layer. Keep the boundaries visible
  to the learner — scaffolded content must not silently count as demonstrated mastery, and a
  practice case must not teach a mechanism the learn layer never covered.
- Every drill pairs to at least one practice case **by mechanism**, and every "apply this in a
  case" CTA resolves to a mechanism match — or its copy truthfully says "next case in this unit."
  A CTA that promises transfer and delivers a different mechanism erodes trust in the whole
  pathway. Track unpaired mechanisms as an explicit gap list.
- Capstone unlock criteria are stated where the capstone is shown ("complete the track's drills"),
  and remaining prerequisites are listed by name, not count.

## Accessibility and rendering baseline

Professional courseware quality includes:

- Full keyboard operability: every tab row is a real tablist with arrow-key movement; every
  horizontal scroller is focusable with arrow-key scrolling; focus visible throughout.
- Nothing meaningful conveyed by color alone; units on every displayed value (visually and to
  screen readers).
- Content fits its pane at the smallest supported viewport with zero clipping — scale-to-fit
  rather than overflow-hide, and never nest a fourth scroller around panes that already scroll.
- Simulated or authored values are visibly badged as such wherever a learner might mistake them
  for device output, and the badge must survive every viewport.

## Restructuring an existing module

When the task is "make this existing module flow better" rather than greenfield:

1. Inventory before proposing: extract the current ordering registry/-ies, entry CTAs, counts,
   and stage labels. Diagnose against the three defects (competing maps, runway-skipping entry,
   unannounced difficulty jumps) plus prerequisite closure.
2. Prefer **reframe over rebuild**: keep unit ids and assessment contracts stable; change
   sequence, stage labels, interactivity, and copy. Renamed ids orphan learner progress.
3. Ship the one-door fix first — it is almost always the highest confusion-per-effort win and it
   is independent of content work.
4. Respect declared freezes (frozen panels, locked scoring, human-testing baselines): route
   changes those areas need into an owner-decision list instead of editing around the freeze.
