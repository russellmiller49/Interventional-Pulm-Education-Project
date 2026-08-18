# R2 — persistent circuit map and shared localization grammar

What shipped, what it is allowed to say, and which decisions it took. The approved plan is the
package's scope statement; this records the parts that changed on contact with the code, so a
reviewer reading the diff does not have to reconstruct why.

Base: `origin/main` at `4f232450` (R0 = PR #108, R1 = PR #109, both ancestors).

---

## 1. What R2 adds

Four content modules and two teaching components, plus the integration of a deliberately small
slice of lessons.

| File                                           | What it is                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `content/circuitSegments.ts`                   | The canonical circuit: nine segments, seven sensor sites, three pressure-comparison zones |
| `content/localizationCards.ts`                 | The four recurring patterns, authored once, with their sources and boundaries             |
| `content/circuitPresentation.ts`               | What the map is showing, and the engine-gated derivation of it                            |
| `content/circuitSceneAnchors.ts`               | Segment → bedside-scene label ids, as strings only (the R3 seam)                          |
| `components/teaching/EcmoCircuitMinimap.tsx`   | The schematic                                                                             |
| `components/teaching/EcmoLocalizationCard.tsx` | The grammar at two depths, plus the drill gate                                            |

Integrated into two foundation sections (`circuit-flow-path`, `pump-and-pressure-zones`) and three
pilot drills (`startup-sensor-orientation`, `preload-drainage-collapse`, `gas-source-interruption`).

Untouched: the engine, every scenario and prediction item, Practice, Assess, progress, routes, the
entry surfaces R1 built, the shared drill primitives, the bedside 3D scene, the large pressure-zone
schematic, and the three pilot drills the plan excluded.

## 2. Owner decisions, as taken

The plan listed eight. Their disposition in the shipped code:

- **R2-OD-1 (claim wording)** — taken as drafted. Every row cites sources whose registered
  `supports` cover the claim made, and the claim text is narrower than the record in each case.
  One claim was reworded during implementation: "independent patient assessment belongs beside the
  circuit data" became "what you find at the patient belongs beside what the circuit is reporting",
  because `assessment` is on the static-copy ban list and the scan caught it.
- **R2-OD-2 (membrane wording)** — taken. The row names progressive clot or fibrin burden as the
  leading clinical cause of a genuinely widening gradient and requires the look-alikes (higher
  flow, changed viscosity or temperature) to be excluded first. It states no threshold and no
  exchange decision, and its boundary says clot burden is not modelled.
- **R2-OD-3 (D-3 coverage of the pilots)** — taken. Each of the three pilot files gains one figure
  and, where a row applies, one line inside the existing `AfterCommitment`. No identifier,
  prediction, choice, scoring rule, engine call or existing block changed in any of them.
- **R2-OD-4 (ELSO P1/P2/P3)** — excluded, as planned. The naming appears nowhere in the module, and
  the registered ELSO circuits record has not been verified to authorise it. Plain name first,
  manufacturer label second, which is what the circuit-walk panel already did.
- **R2-OD-5 (slice)** — taken as planned. `vv-recirculation`, `arterial-bubble-stop` and
  `va-differential-hypoxemia` carry neither component; see §4.
- **R2-OD-6 (drainage shortlist)** — shipped panel-aligned: cannula position, a kinked or
  compressed limb, coughing/straining/pressure around the vessel, volume state. "Clot" remains
  available to add later with its own claim.
- **R2-OD-7 (act-phase copy)** — taken. The instruction that told a learner to "select pVen, pInt,
  pArt, or ΔP to highlight its measurement zone" described an interaction that existed nowhere; it
  now describes the map that is on the screen.
- **R2-OD-8 (four rows in the scaffold)** — taken. All four, at pattern-and-location depth.

## 3. Decisions taken during implementation

Recorded because they are not in the plan and a reviewer will see them in the diff.

**The segment record does not own its sensor list.** A site names its segment; the segment derives
its sites. One relation, one place. The visible consequence is that the circuit-walk stop list now
names the flow and bubble sensor on the return-limb location, which it had always omitted — an odd
gap in a lesson whose stated subject is every console signal placed where it physically sits.

**The gas path is two segments, not four.** The four stations the gas drill inspects — source,
blender, line, membrane gas side — are the teaching, and they live in the row's cause list where a
learner reads them. Drawing four nodes would not survive the narrowest teaching pane. The id union
is additive, so a later package can subdivide `gas-supply` without renaming anything.

**A zone is where a pattern shows; a row says where the problem lives.** These are not the same
place, and the return row is why: the pressures move downstream of the pump and the obstruction
sits beyond the membrane. Keeping them as separate fields is what lets the map mark
`post-membrane` and `return` while the card names the downstream zone as where to read.

**Scaffolds annotate; only an implicated state marks.** Nothing in a scaffold sets
`data-circuit-implicated`, which keeps the two vocabularies disjoint and lets the leak test assert
an absent attribute rather than weigh degrees of emphasis.

**`ecmo-book-ch16` was dropped from the segment sources.** The circuit-walk section cites it, but
that record supports naming a patient-centred endpoint before changing support — a management
claim, not an anatomical one. `ecmo-book-ch9` and `elso-circuit-2022` cover every claim a segment
record makes.

## 4. Why three pilots and not six

- `vv-recirculation` — the mechanism is patient-and-cannula geometry while every circuit segment
  is working. Marking a segment would teach the wrong localization.
- `arterial-bubble-stop` — the teaching is the safety chain, an event and response sequence. The
  card's action classes do not apply to it, and the registry deliberately does not model clamps.
- `va-differential-hypoxemia` — the mechanism is the patient-side mixing watershed, which this
  circuit map cannot draw and which the drill's own boundary says is not modelled as movable.

The two rows without a pilot consumer are authored, validated, and visible in the foundation
scaffold. Each row carries the drill family that owns it, so a later package adapting the held
panels selects a row rather than renaming anything.

## 5. What the tests pin

New: `circuit-segment-model.test.ts`, `localization-cards.test.ts`, `circuit-minimap.test.tsx`,
`localization-card.test.tsx`. Extended: `foundation-lesson.test.tsx`,
`drill-teaching-panels.test.tsx`, `resumption-copy-contract.test.ts`, and the critical-care
accessibility suite.

The checks worth knowing about:

- **The order pin is unchanged and still passes.** `foundation-lesson.test.tsx` asserts the six
  stop ids against a literal array the registry does not get a vote on. That is the evidence the
  promotion changed nothing a learner sees.
- **The copy scan the move would otherwise have escaped.** These sentences used to live under a
  `components/` root that the critical-care AST scan walks. `localization-cards.test.ts` applies
  the same term list to the registry, reading it out of that test's own source so the two cannot
  drift apart.
- **The precommit scan runs over the serialised DOM**, because an answer hidden in an `aria-label`
  or an SVG `<title>` is still an answer. It scans for the row as composed rather than for single
  cause items: those are two-word clinical nouns, and the recirculation panel has always listed
  several in its own model boundary as things the simulation does _not_ represent.
- **Foundation panels now have axe coverage**, which they did not before. An `<svg role="img">`
  without an accessible name is a violation, and the map's name is a generated id.

## 6. Verified

- `npx jest src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' --runInBand` — green.
- `npm run type-check`, `npm run lint`, `npm run test:a11y` — green.
- `npm run render:ecmo-teaching` — the drainage drill renders neutral with no row before a
  commitment, and marked on `drainage` with the row inside the gate after it. The map was reviewed
  in a browser at both pane widths and in every state.

Two defects were found by rendering rather than by unit tests, and both are fixed: React joins an
array of `<title>` children into a warning, and the implicated "texture" was a thin dashed stroke
laid over a thicker stroke of the same colour, which is invisible by construction.

## 7. Still open

- The fourteen held drill panels on PR #94 remain held. Nothing here was cherry-picked from that
  branch; its shared primitives were read as a design reference and the parts already on `main`
  were reused from `main`.
- The capstone hypothesis matrices still paraphrase the grammar in their own per-signal cells.
  They are a different granularity and rewriting them was outside this slice.
- `pre-membrane` and `post-membrane` have no distinct bedside-scene anchors, because the scene
  builds none: the pump, both pressure locations and the membrane's gas side all resolve to
  `hls-module`, which is one integrated disposable on this device. R3 may add anchors under the
  scene's own separation contract.
