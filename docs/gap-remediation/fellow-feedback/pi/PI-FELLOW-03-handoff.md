# PI-FELLOW-03 — Peripheral Imaging: teaching clarity

Implementation: September 21, 2026. Prepared by Claude (AI implementation).

**Result: all thirty-seven assigned findings were read and dispositioned. Thirty-three were
reproduced on the current build and repaired; none was already resolved; none failed to reproduce;
four (1.3 with 3.10's clinical half, 2.7's ownership map, 3.2 and 2.6's clinical labels) are held for
the source owner**, with the safe part of each of those four still repaired here. Every hold is
written up as a decision packet in [PI-FELLOW-owner-decisions.md](PI-FELLOW-owner-decisions.md), and
every wording change is in the source-linked [text map](PI-FELLOW-03-text-map.md).

The change is PI-local and about **where teaching is said, how it is ordered and what its words
mean**: definitions at the point of need, honest labels on reused questions and reused
demonstrations, the opening question shown where it is asked, a concise recap with the full feedback
one disclosure away, one general provenance statement instead of five repeats, and supported
distinctions ahead of arithmetic. No question, option, answer key, item id, storage key, engine
value, equation, unit, coordinate, camera preset, image asset, release flag or self-paced affordance
was changed; no learner state is read, reset or written differently. Section 9's radial EBUS
limitation now also appears in Section 1 in its own words with its own sources; that is the only
clinical sentence that moved, and it moved without changing.

**Evidence provenance.** Every source row comes from _Peripheral Bronchoscopy Imaging — First-Year
Fellow Walkthrough Feedback Log.pdf_ (48 pages, dated September 18, 2026), an **AI-assisted browser
walkthrough written in a first-year-fellow persona**. It is not a learner study, not participant
data, and not clinical, media or device approval. "Reproduced" below means an agent reproduced the
application behaviour on a local build at the SHA below — not that a human learner met it.

## Scope and baseline

- Task file `03_PI_TEACHING_CLARITY.md`, with `00_START_HERE.md`, `FEEDBACK_LEDGER.md`/`.json`,
  `SOURCE_CONTEXT.md`, `OWNER_DECISIONS.md` and the PDF, read at
  `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/module_update_9_19/PI_Claude_Implementation_Pack`,
  after `/Users/russellmiller/Downloads/PI_MODULE_HANDOFF_2026-09-21.md`, which controls where the
  pack is stale (it is: the pack still lists Prompt 01 and 02 rows as not started; both are merged).
- Branch `claude/pi-2-9-21`, worktree `Interventional-Pulm-Education-Worktrees/claude-pi-2-9-21`.
  Starting SHA **`2124cd0f3483db6534ab65bf6dd3730b59fee463`** (`origin/main` after PR #256, which
  is MCS-only and touches no PI path). The worktree was clean, level with `origin/main`, and owned
  by no other session; `git worktree list` showed forty other checkouts, none on this branch.
- Ports at the start: 3120 (the permanent `claude` worktree's dev server, another session's), 3131
  and 3133 (other sessions). This batch used **3168**, started from this worktree with
  `next dev --port 3168 --webpack` and confirmed by the process's working directory before the
  browser suite ran. No other server was touched. Playwright ran with its own browser profile.
- Read before implementing: [PI-FELLOW-01](PI-FELLOW-01-handoff.md),
  [PI-FELLOW-02](PI-FELLOW-02-handoff.md) and the systemic-UX and PI-FOCUS/OUTLINE/WRAP/HELP handoffs
  they cite. Prompt 01/02 work is preserved as listed under [Preserved](#preserved-not-reimplemented).
- Storage mode for every finding: anonymous, local, `ip-peripheral-imaging-self-paced-v1` only. No
  finding here involves stored state, and no probe seeded any.
- Evidence retained outside Git in the session scratchpad (`evidence/before/data-repro.json` —
  the pre-change reproduction of every data-level finding; `evidence/after/` — Jest, type-check,
  ESLint, Playwright logs and the Playwright screenshots).

## Disposition of every assigned source ID

All rows: direct route on a local build, anonymous, 1280 × 900, dark, unless the row says otherwise.
"Repaired" rows point to the section of this document that describes the change.

| ID       | PDF page | Where                                                      | Status                                  | What the current build did → what changed                                                                                                                                                                                                                                                                                               |
| -------- | -------: | ---------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O2**   |        4 | `/peripheral-imaging`, `/learn`, Section 1                 | **Reproduced → repaired**               | "DTS" first appeared at character 473 of the hub lede and "CBCT" at 534, neither expanded; Section 1's modality block also used the bare acronyms. All three now spell the name out at first use; the hub lede links the existing glossary. [A](#a-vocabulary-at-the-point-of-need)                                                     |
| **CW1**  |        6 | every section's closing question                           | **Reproduced → repaired**               | 17 of 19 closing questions are an earlier section's check question, all titled "Apply it to another situation" with "Use the stated evidence in this different situation." Each is now "Optional review · _Section_", says which section it came from, and links it. Identity untouched. [B](#b-honest-review)                          |
| **CW2**  |        7 | every interactive step                                     | **Reproduced → repaired**               | One screen carried the shared model sentence, a section-specific limit, a "fictional state" legend, an "authored teaching example" kicker and the figure's own note. Four classes inventoried; only the general class consolidated. [C](#c-warnings-classed-not-counted)                                                                |
| **CW3**  |        7 | every section                                              | **Reproduced → repaired**               | 12 terms the walkthrough met undefined were absent from the course glossary (binning, anisotropy, missing wedge, regularization, iterative reconstruction, sampling component, side-cutting window, thin reformats, scatter, quantum noise, tool-plane spread, VESPA). Now defined per section. [A](#a-vocabulary-at-the-point-of-need) |
| **CW4**  |        8 | every section, first step                                  | **Reproduced → repaired**               | The framing question lived only in a closed disclosure and the recap said "Earlier question, revisited." It is now printed on the first step outside any disclosure, asking nothing; the recap restates it. [B](#b-honest-review)                                                                                                       |
| **CW5**  |        8 | every section, explain step                                | **Reproduced → repaired**               | The explain step re-rendered the whole verdict panel. It now shows the choice, the best-supported reading and the takeaway, with the full verdict in a closed disclosure. Rhythm and navigation unchanged. [B](#b-honest-review)                                                                                                        |
| **1.1**  |       10 | Section 1, figure panel 2                                  | **Reproduced → repaired**               | The teal segment was unlabelled and "sampling component" undefined. The figure now labels "tip" and "sampling component (teal)"; Section 15's definition is printed under it with a link to Section 15. Instrument differences kept. [A](#a-vocabulary-at-the-point-of-need)                                                            |
| **1.3**  |       11 | Section 1 vs Section 15 rEBUS wording                      | **Held for the owner** (safe part done) | Side-by-side of every concentric-view sentence in the packet. The existing Section 9 limitation was brought forward to Section 1 unchanged, with its sources. No new clinical conclusion. [Owner packet](PI-FELLOW-owner-decisions.md#13--310-what-a-concentric-radial-ebus-view-establishes)                                           |
| **1.6**  |       12 | Section 1, first step                                      | **Reproduced → repaired**               | Same mechanism as CW4: the opening question is shown, the source item is not duplicated.                                                                                                                                                                                                                                                |
| **1.8**  |       13 | Section 1                                                  | **Reproduced → repaired**               | "Thin reformats" (MPR), "side-cutting window" and "sampling component" glossed on first use from Section 15's teaching; not every tool has a side window, and the definition says so. [A](#a-vocabulary-at-the-point-of-need)                                                                                                           |
| **2.6**  |       18 | Section 2, C-arm controls                                  | **Reproduced → repaired** (labels held) | Slider said "C-arm obliquity", monitor said "Orbit 30°", caption said "Orbit and tilt". One name now; the model's sign convention is stated in patient terms and pinned by a geometry test. LAO/RAO not inferred. [Owner packet](PI-FELLOW-owner-decisions.md#26--32-lao-rao-and-cranial-caudal-labels)                                 |
| **2.7**  |       19 | Section 2, tube and detector cards                         | **Held for the owner** (safe part done) | Tube card: pulse rate is "nothing you adjust". Detector card: pulse rate is yours. Both now say the generator produces pulses at the console-selected rate, and that pulse-width selectability is system-dependent. The ownership map is in the packet.                                                                                 |
| **2.8**  |       19 | Sections 3, 5, 7, 11, 13, 14, 16 opening demonstrations    | **Reproduced → repaired**               | Seven demonstrations reuse an earlier section's examples with no sign of it. Each is now "Worked demonstration · reminder", names the first section, links it and states what is new here. Full example still shown. [B](#b-honest-review)                                                                                              |
| **2.11** |       20 | Section 3 title, question, readouts                        | **Reproduced → repaired**               | Activity title "Change the image by changing the projection" while the block and check start from the baseline image; three readouts unexplained. Title now "Start from the baseline image, then change the projection"; every readout has a one-sentence meaning from its own arithmetic. [D](#d-source-bound-alignment)               |
| **2.14** |       21 | Section 4 controls and readouts                            | **Reproduced → repaired**               | "Stored augmented contour", "teaching contour", "saved contour" and "stored contour" named one state. One name, "stored contour", where the construct is identical; the worked example leads. [D](#d-source-bound-alignment)                                                                                                            |
| **3.2**  |       28 | Section 6                                                  | **Held for the owner**                  | Same packet as 2.6. Acronym expansion alone does not validate a sign mapping, so none is offered to the learner.                                                                                                                                                                                                                        |
| **3.3**  |       29 | Section 7, "Display zoom versus acquisition magnification" | **Reproduced → repaired**               | The usable rule was the block's last sentence, after the device caveats. It now leads; the caveats are a titled detail on the same block, with binning glossed. Nothing removed. [B](#b-honest-review)                                                                                                                                  |
| **3.4**  |       29 | Section 7, crop/zoom/collimation demonstration             | **Reproduced → repaired**               | Same mechanism as 2.8: Section 7's "display" demonstration is framed as a reminder of Section 3 with the new objective named.                                                                                                                                                                                                           |
| **3.6**  |       30 | Section 6, target-ray readouts                             | **Reproduced → repaired** (meaning)     | The strip listed density classes and millimetres with no sentence about what they were. One now says what a ray is and that the model names density classes, not organs. The default camera is Prompt 02's preset set and is not changed here. [D](#d-source-bound-alignment)                                                           |
| **3.9**  |       31 | Section 8, tube-load readout                               | **Reproduced → repaired**               | "mAs per second" arrived with a dock footnote only. The dock now says what the number is (rate × width × 20 mA), why halving one term can leave it unchanged, and that it is not patient dose. No new target. [D](#d-source-bound-alignment)                                                                                            |
| **3.10** |       32 | Section 9 rEBUS/atelectasis passage                        | **Reproduced → repaired** (with 1.3)    | The passage a learner needs on Section 1's screen sat in Section 9. It is now also in Section 1 with `ilocate` and `mobile` cited; the Section 9 block is unchanged. Clinical reconciliation is in the 1.3 packet.                                                                                                                      |
| **3.11** |       32 | Section 9, biopsy-permission rationale                     | **Reproduced → repaired**               | "The module never grants permission to biopsy." → "A teaching image cannot clear a biopsy: that decision stays with the procedure team…". Limit preserved; the keyed answer is unchanged. [Text map](PI-FELLOW-03-text-map.md)                                                                                                          |
| **4.1**  |       33 | Section 10, reconstruction comparison                      | **Reproduced → repaired**               | Two long narrow columns with 96-px figures. Now: the analogy first (the course's own transparencies / sculptor images), two readable figures with legends, a five-row table, and the full account in a disclosure. Limits kept. [B](#b-honest-review)                                                                                   |
| **4.4**  |       34 | Sections 10 and 11 reconstruction jargon                   | **Reproduced → repaired**               | Anisotropy, regularization, iterative reconstruction and "validated endpoint" glossed in the sentences that use them; the worked example leads Sections 10 (planes) and 11 (prior). No reconstruction claim endorsed. [A](#a-vocabulary-at-the-point-of-need)                                                                           |
| **4.6**  |       35 | Section 10, spread readout                                 | **Reproduced → repaired**               | Read from `smearWidth`: the difference of the shift-and-add displacement at the two ends of the arc, zero on the object's plane. That is now printed under the readout and pinned numerically by test. The persona's guess was not adopted. [A](#a-vocabulary-at-the-point-of-need)                                                     |
| **5.1**  |       39 | Section 12, CBCT introduction                              | **Reproduced → repaired**               | Section 12 repeated the whole DTS/CBCT comparison. It now leads with CBCT (analogy, figure, table) and links Section 10 for the DTS side; the comparison stays one disclosure away. [B](#b-honest-review)                                                                                                                               |
| **5.3**  |       39 | Section 12, scout legend                                   | **Reproduced → repaired**               | "teal cylinder: authored field of view · small box: teaching centre tolerance · blue shell: drawn swept envelope, not a clearance test." Plain sentences now, keeping the teaching tolerance and the not-a-clearance-check limit. [C](#c-warnings-classed-not-counted)                                                                  |
| **5.4**  |       40 | Section 14, provenance flow                                | **Reproduced → repaired** (confirm)     | The mobile CBCT section rendered Section 11's DTS provenance flow ("limited-angle projections"). The flow now takes its modality from the section; the CBCT wording is drawn from Section 12's own account. Confirmation requested in the packet.                                                                                       |
| **6.1**  |       40 | Section 1 (from Section 15)                                | **Reproduced → repaired**               | Same source-forwarding as 1.1; Section 15's tri-planar demonstration is untouched.                                                                                                                                                                                                                                                      |
| **6.3**  |       41 | Section 15, readouts and legend                            | **Reproduced → repaired** (copy only)   | Readouts said "sphere" while the teaching said "lesion". Both now say "modeled lesion"; the legend says the CT is low-resolution context. Media unchanged: no detail added to the CT. [D](#d-source-bound-alignment)                                                                                                                    |
| **6.5**  |       41 | Section 16, VESPA                                          | **Reproduced → repaired**               | VESPA named with no description. The registered record (Chest 2022;162:1393, in Local-Data) was read; the block and a glossary entry now describe the trial from it. The clause is offered for the owner's confirmation. [A](#a-vocabulary-at-the-point-of-need)                                                                        |
| **7.1**  |       42 | Section 18, KAP panel                                      | **Reproduced → repaired**               | Two planes of 2-dp kerma × 2-dp area = 4-dp KAP arithmetic led the panel. The rule now leads (same product on both planes, why), display precision is readable, exact values sit in a disclosure. Stored values unchanged. [D](#d-source-bound-alignment)                                                                               |
| **7.2**  |       43 | Section 18                                                 | **Reproduced → repaired**               | The four quantities were one paragraph. Now a table (quantity, unit, what it tells, what it does not, from the section's own blocks) and a copyable note template with no value in it. [D](#d-source-bound-alignment)                                                                                                                   |
| **7.3**  |       43 | Section 17, scatter scene                                  | **Reproduced → repaired**               | The practical point (detector side often lower than tube side, changing throughout a spin) was absent from the panel. It now leads the panel and the example cue, with its projection and spin qualifications. Scene size is a Prompt 02 layout and unchanged.                                                                          |
| **7.4**  |       43 | Section 17, "Keep hands out of the primary beam"           | **Reproduced → repaired**               | The warning was the middle sentence of a paragraph. It is now its own callout, printed before the body; a test holds it out of the CW2 consolidation. [C](#c-warnings-classed-not-counted)                                                                                                                                              |
| **PR4**  |       46 | Section 1 closing question → practice case                 | **Reproduced → repaired**               | The praised eccentric rEBUS case was reachable only from Practice. Section 1's closing step now offers it as an optional link; the case, its wording and its place in Practice are unchanged. [B](#b-honest-review)                                                                                                                     |
| **IC4**  |       48 | Integrated cases landing and the two safety cases          | **Reproduced → repaired**               | The "Safety decision" tag had no explanation. The landing and each tagged case now say it is a teaching emphasis only: no weight, no score, no penalty, nothing recorded, no restriction. [B](#b-honest-review)                                                                                                                         |

Counts: **33 reproduced and repaired** (four of them with a held clinical half: 2.6, 2.7, 3.10, 5.4
confirmation), **4 held for the owner** (1.3, 2.7 ownership map, 3.2, 2.6 clinical labels), **0
already resolved**, **0 not reproduced**.

## A. Vocabulary at the point of need

**Registry.** `content/glossary.ts` holds every term the walkthrough met undefined, plus the course
glossary's own entries reused by key. Each entry records its **provenance** as data:
`course-glossary` (reused from `data/resources.ts`), `section-teaching` (a named block of a named
section), `chain-stop`, `control-panel`, `implementation` (file and symbol), `registered-source`
(a `SourceId`) or `drafted`. Exactly two entries are `drafted` — **binning** and **stored
contour** — and both carry the basis they were drafted from and are in the owner packet. The
validator throws at import if a term matches no section's text and names no section that uses it,
if a `taughtIn` section does not exist, or if a definition trips the learner-copy gate.

**Where a learner meets it.** `termsForSection(sectionId)` scans the section's own text (teaching
blocks, activities, demonstration cues, check stems, choices and rationales) so a section lists the
terms it actually uses. The list renders as a closed "Terms used in this section" disclosure on the
first step (where a deep link lands) and in Help on every step. A term taught in full elsewhere
links that section. Help keeps its navigation paragraph first; the terms follow, then one sentence
about the models. **Deep links** are the tested path: `learn?section=dts-acquisition` lists DTS,
missing wedge, anisotropy and tool-plane spread on arrival, in Jest and in the browser.

**In the sentence itself** where a term is used once and a gloss reads better than a lookup:
anisotropy "(resolution that differs by direction)", regularization "— an added rule that favours
one solution —", "the independently validated endpoint: the outcome measured in its own study",
"binning (combining adjacent detector pixels at readout)", "KAP: the air kerma multiplied by the
beam area". Each is the section's own explanation moved next to its word.

**Section 1's figure** (1.1, 6.1, 1.8) labels the tip and the teal sampling component in the
drawing's coordinates, prints Section 15's definition under the panel — "a needle's side-cutting
window, forceps jaws or a cryoprobe's active segment, depending on the instrument" — and links
Section 15. The figure's legend names the amber circle, the teal segment and the white tip.

**Two terms from the implementation, not from a guess.** _Tool-plane spread_ (4.6) is read from
`dtsModel.ts`: `smearWidth = |dtsShift(object, plane, +s/2) − dtsShift(object, plane, −s/2)|`,
which equals 2·|object − plane|·tan(s/2); the printed sentence says exactly that and the node test
pins it numerically, including zero on the object's plane. _C-arm obliquity and beam tilt_ (2.6)
is read from `suiteModel.ts`: with x = patient left and z = superior, positive obliquity moves the
detector to the patient's right and positive tilt moves it toward the head. The sentence says that
and says it is **not** a console's LAO/RAO or cranial/caudal label; the test pins the geometry.

**VESPA** (6.5) is described from the registered record, PMID 35803302 (Chest 2022;162:1393–1401),
read in Local-Data: a multicenter randomized trial; an endotracheal tube with a recruitment
maneuver, FiO₂ below 1.0 and PEEP 8–10 cm H₂O against a laryngeal mask, full oxygen and no PEEP;
any atelectasis on chest CT at 20–30 minutes; no difference in complications. The Section 16
sentence and the glossary entry say the bundle reduced atelectasis and that the study does not say
which part did the work. They do not restate the percentages: the section teaches the limit of the
evidence, not the effect size, and the owner may prefer the numbers (packet).

## B. Honest review

**CW1 — which closing questions are reused.** `content/transferOrigins.ts` derives, per section,
the lesson that authored the closing question (the one whose first check it is) and the sections
that rendered it before. The result, pinned as a table in `teaching-clarity.test.ts`:

| Section                             | Closing question is | Seen before in |
| ----------------------------------- | ------------------- | -------------- |
| 1 Imaging questions, 19 Suite cases | its own (unchanged) | —              |
| 2, 4                                | Section 1's check   | 1 (4: 1 and 2) |
| 3                                   | Section 2's check   | 2              |
| 5, 11                               | Section 4's check   | 4 (11: 4, 5)   |
| 6, 10, 15                           | Section 5's check   | — / 6 / 6, 10  |
| 7                                   | Section 6's check   | —              |
| 8, 13, 17                           | Section 7's check   | — / 8 / 8, 13  |
| 9, 18                               | Section 8's check   | — / 9          |
| 12                                  | Section 10's check  | 10             |
| 14                                  | Section 12's check  | 12             |
| 16                                  | Section 11's check  | 11             |

Wording is chosen by that data: "This is the check question from Section 5 (Projection & depth),
asked again." when the origin itself rendered it, or "This question reviews Section 5 (Projection
& depth); you first met it at the end of Section 6 (Signal & superimposition)." when the learner
met it only as an earlier review. Every review step ends "It is optional review: answer it, show the
explanation, or continue without answering." The step title is "Optional review · _short title_"
(the copy gate forbids digits in titles, so the section number is in the instruction and the link
text). The stage prints a link to the originating section above the choices. **Nothing about the
question changed**: item id `${sectionId}:${questionId}`, `transferVariantId`, phase, round, step id,
gate and choices are asserted unchanged for all nineteen sections; reveal before an answer, retry,
"Continue/Finish without answering" and no stored answer are asserted in Jest and in the browser.
No question was manufactured. Sections 1 and 19 keep "Apply it to another situation".

**CW4 / 1.6 — the opening question.** The `@purpose` panel now prints the section's framing question
outside the details, with "No answer is needed now; the section answers it." It has no control.
The `@summary` recap says "The opening question, revisited." and restates the prompt before the
answer; it never says the learner answered it.

**CW5 — the recap.** The explain step's `CheckRecap` shows the learner's choice, "That is the
best-supported reading." or "Best-supported reading: …", and the item's takeaway; the full verdict
(rationales for the other choices, sources) is inside "Full feedback for this question", closed by
default. The what-changed table, sources and Continue are where they were.

**2.8 / 3.4 — reused demonstrations.** `content/demonstrationOrigins.ts` finds the first earlier
section that showed any of a demonstration's examples (by title). Seven reuses, one reminder each:
3 ← 2, 5 ← 2, 7 ← 3, 11 ← 10, 13 ← 12, 14 ← 12, 16 ← 4. The kicker reads "Worked demonstration ·
reminder", a dashed note says "First shown in Section N, _title_. New here: _the section's new
concept_" with a link, and the demonstration itself is shown in full. The originals are unframed.

**3.3 / 4.4 — rule first.** Section 7's magnification block leads with "Ask whether a control changes
the X-ray acquisition, the detector readout, or only the display."; the image-intensifier and
flat-panel caveats are a titled detail on the same block. Sections 4, 10 and 11 put the worked
example first in the activities the walkthrough named.

**4.1 / 5.1 — the reconstruction comparison.** Each account gained an `analogy` in the course's own
images: DTS "sliding a stack of transparencies until one object lines up", CBCT "a sculptor working
from photographs taken all the way around". `ReconstructionComparison` in lead mode renders analogy,
two figures with HTML legends, a five-row table (in short, what is collected, what comes out, how
much was acquired, its visible limit) and "Full account…" as a disclosure with the whole prior
component inside — model boundary included. Section 10 leads with DTS; Section 12 leads with CBCT
and says "The Digital tomosynthesis side is taught in Section 10; it is kept here for the
comparison." No paragraph was deleted.

**PR4** — Section 1's closing step offers "Optional, whenever you like: a short practice case on
reading an eccentric radial EBUS view, paired with Section 9 — Eccentric radial EBUS view." The
link opens the case in Practice, where nothing about it changed.

**IC4** — "Safety decision" is explained on the landing and on each tagged case as a teaching
emphasis: the feedback names an unsafe choice at once; no case carries more weight, nothing about
the answer is recorded, no case is restricted. The tests grep the note for score/grade/weight.

## C. Warnings classed, not counted

`content/warningInventory.ts` lists eleven learner-facing caveat surfaces with a category and a
treatment, and a test holds every surface in classes 2–4 to a treatment other than
"consolidated".

| Category                | Surface                                                   | Treatment     |
| ----------------------- | --------------------------------------------------------- | ------------- |
| 1 general provenance    | shared model sentence in the "Model limitations" aside    | consolidated  |
| 1 general provenance    | "Worked demonstration · authored teaching example" kicker | consolidated  |
| 1 general provenance    | "fictional" in example titles, cues, control legends      | reworded      |
| 2 figure-specific limit | section-specific limit in the aside                       | kept          |
| 2 figure-specific limit | banner over a check's held image (PI-FELLOW-01)           | kept          |
| 2 figure-specific limit | DTS overlay note (PI-FELLOW-02)                           | kept          |
| 2 figure-specific limit | CBCT scout legend                                         | reworded      |
| 3 immediate safety      | "Before an exposure" cue on the first step                | kept          |
| 3 immediate safety      | Section 17 primary-beam warning                           | kept, callout |
| 3 immediate safety      | CBCT checklist "learner-declared" note                    | kept          |
| 4 unresolved status     | draft illustrations, fictional dose record                | kept          |

**What consolidation means here.** The shared sentence ("The CT anatomy is real; the target,
instrument and numbers are authored teaching values, not equipment settings, patient measurements
or dose.") is printed **in full on a section's first step** (where a deep link lands) and in Help,
and on later steps the aside keeps the section's specific limit plus a one-line reminder that points
to both. Nothing in classes 2–4 was removed or merged. "Fictional" became "modeled", the word the
overlay already used. The demonstration kicker no longer repeats the scene header on the same
screen. The two overlapping caveats on the signal illustrations became one sentence that keeps both
statements. **5.3**'s legend became sentences that still say "teaching tolerance and not a device
specification" and "not a collision or clearance check".

## D. Source-bound alignment

- **2.14 / 6.3** — one name only where the construct is the same object: the registration lab's
  toggle, capture action, readouts and example titles all describe the one stored contour, so all
  say "stored contour". The sampling readouts and the sampling teaching describe the one modeled
  lesion, so `windowRelationship`'s labels say "modeled lesion" (label only; geometry untouched).
  The DTS overlay labels say "(model position)" — the carried-forward editorial note.
- **2.11** — `LAB_METRIC_MEANINGS` gives every readout id one sentence read from `labReadouts`'
  arithmetic (e.g. "Always no: display zoom re-displays acquired pixels and delivers no X-rays.");
  the dock lists them under "What the readouts mean". The generated "· changed" mark now reads
  "· moved by your last change" (carry-forward, copy only).
- **7.1** — the KAP panel leads with the rule and its reason, prints kerma to 0–1 dp, area to 1 dp
  and KAP to 2 dp, and keeps distance, kerma, area and the 4-dp product in "Exact values". The
  engine's numbers are not rounded; only the displayed strings are. A test asserts both planes
  print the same KAP and that the exact disclosure carries the full-precision product.
- **7.2** — `DOSE_QUANTITIES` and `DOSE_NOTE_TEMPLATE_LINES` are data; the validator rejects any
  digit in the template. The "Copy the template" button copies the same lines and reports if the
  clipboard is unavailable.
- **3.6 / 3.9 / 7.3** — one sentence each, from the model's own definition, with the qualification
  that the model names density classes not organs (3.6), that tube load is not patient dose (3.9),
  and that a CBCT spin changes directions throughout (7.3).

## Held for the owner

Six packets in [PI-FELLOW-owner-decisions.md](PI-FELLOW-owner-decisions.md), each with the exact
current wording, the exact proposed wording, the evidence and the decision needed: (1) 1.3/3.10
what a concentric radial EBUS view establishes; (2) 2.6/3.2 LAO/RAO and cranial/caudal labels for
the model's signed angles; (3) 2.7 who owns pulse rate and pulse width; (4) 5.4 the CBCT provenance
wording; (5) 6.5 the VESPA clause; (6) the two drafted definitions. None blocks this PR; each is a
copy change on data a test already covers.

## Tests and validation

Failures and reruns are listed as they happened.

**Jest, PI + learning-module + PI routes** (`--runInBand`):

| Run                       | Result                               | Note                                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| baseline, before any edit | 57 suites / 468 tests pass           | `evidence/before/jest-baseline.log`                                                                                                                                                                                                                                   |
| after the edits (run 1)   | **1 failed**, 56 passed / 467 of 468 | `truthful-surfaces.test.ts` asserted the old transfer instruction ("stated evidence"); an expected failure of the assertion the batch replaces. Updated to assert the review wording.                                                                                 |
| new suites, first run     | **1 failed** of 79                   | `teaching-clarity.test.ts` caught "saved contour" still in Section 4's example cue; fixed in `teachingExamples.ts`.                                                                                                                                                   |
| rerun (run 2)             | **60 suites / 544 tests pass**       | 57 + `teaching-clarity.test.ts` (43) + `teaching-clarity.rendered.test.tsx` (24) + `routes.test.tsx` (9), which the baseline pattern had not matched. Rerun after each browser-found fix below: same result (`jest-3.log`, `jest-4.log`). `evidence/after/jest-2.log` |

New tests cover the changed behaviour named in the task: first-use and deep-linked definitions,
review labels/links and the full origin table, opening-question visibility outside any disclosure,
recap access with the full verdict folded, warning availability (callout, boundary full then
reminder, inventory classes), no-answer navigation, reveal/retry, unchanged item/key/storage
identity, Help order, the provenance flow's modality, the reconstruction lead, the dose table and
template, and the readout meanings covering every printed readout.

**Type-check**: `npm run type-check` exit 0 after the last source edit. One earlier attempt aborted with a V8 heap out-of-memory while the browser suite and the dev server were running alongside it; the rerun with `--max-old-space-size=8192` reported no error (`type-check-3.log`), and the check was repeated after the last source and spec edits (`type-check-4.log`, `type-check-5.log`, both exit 0).
**ESLint** on every changed `.ts/.tsx` path: first run 2 warnings (two unused imports in the new
rendered test), removed; rerun clean. **Prettier** on every changed path: 13 files reformatted,
`--check` clean; `git diff --check` clean. No production build: no wiring, route or configuration
changed.

**Playwright** (`playwright.peripheral-imaging.config.ts`, base URL `http://localhost:3168`, this
worktree's server, own browser profile, 1440 × 1050 default), 62 tests:

| Run                                    | Result                            | What failed, and what was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| run 1 (`playwright-1.log`)             | **13 failed**, 49 passed, 7.8 min | (a) The eight existing "Help presentation and dismissal" conditions and "Help keeps longer existing content reachable": the `helpTextReachability` helper walked the text inside the new, **closed** terms disclosure and, because Chrome still reports layout rectangles for collapsed `<details>` content, counted it as unreachable. The helper now skips text inside a closed disclosure — collapsed content is neither clipped nor unreachable — and the open state is checked by the new tests at seven conditions. (b) "report 2.4 and 2.5" labels: `pin-source in Head` outside the scene viewport once; a probe of the same preset showed every label inside, and the test **passed on an isolated rerun** (`playwright-labels-rerun.log`) — a timing flake, not reproduced. (c) My "PR4 and CW5" test: `summary` matched the verdict's nested disclosure too; scoped to the direct child. (d) My reflow test at 1280 × 900 / 200 % root text: horizontal overflow from a **shared site-header link** (outside this module, see Limitations); the test now holds the module's stage and its new surfaces to the viewport at enlarged text, and keeps the whole-page check at normal text. (e) My reflow test at 320 × 740 / 200 % root text: a real finding — the four-column dose table forced the teaching column 5 px past the viewport. The table now uses fixed layout and stacks one labelled block per quantity at phone widths. |
| labels test, isolated rerun            | 1 passed                          | `playwright-labels-rerun.log`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| run 2, full suite (`playwright-2.log`) | **4 failed**, 58 passed, 7.8 min  | The eight Help conditions now pass. (a) "Help keeps longer existing content reachable and keyboard navigation modal": Tab from Close reached the new terms disclosure's summary before "Show me where". The dialog's order was changed so its navigation text **and its action** come first and the terms and the models sentence follow; Close → Show me where is as it was. (b) "report 2.3" walk at 1024 × 768: the scene selector returned nothing at one instant; passed 6 of 6 on isolated reruns (`playwright-flake-rerun.log`) — not reproduced. (c) "report 2.4 and 2.5" labels again (`pin-source in Target`), and 0 of 2 on isolated reruns with the failure screenshot showing every label inside the figure: a label's box is applied a frame behind the camera, so during a preset's animation the one-shot read of `inside` can land mid-transition. The test's own `settled()` helper (which already polled for count and overlaps) now also waits until two consecutive reads agree and every label is inside, and judges that snapshot. Same property, deterministic timing. (d) My "PR4 and CW5" test asserted the what-changed table, which only renders when the lab task was performed (my walk skipped it; Jest covers the performed path); replaced with the Continue check.                                                                                                                                             |
| run 3, full suite (`playwright-3.log`) | **1 failed**, 61 passed, 8.0 min  | "report 2.4 and 2.5" once more (`pin-reconstruction in Side`): the first version of the settle-poll returned a fresh read taken after the poll. It now returns the read that satisfied it, with the stability condition above. Then 3 of 3 on isolated reruns (`playwright-labels-rerun-2.log`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| run 4, full suite (`playwright-4.log`) | **62 passed**, 0 failed, 7.7 min  | The result this PR is submitted on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Browser checks added for this batch: glossary and Help order at 1280 × 900 dark; the review label,
origin link navigation, reveal, retry and finish-without-answering; the practice-case link opening
the unchanged case; the recap and its disclosure; and a reflow pass over the new surfaces (Section
10 glossary, opening question and reconstruction lead; Help with the terms open; Section 18 table
and template; Section 1 figure labels and definition) at 1440 × 900, 1024 × 768, 390 × 844, 320 × 740,
1280 × 900 at 200 % root text and 320 × 740 at 200 % root text, each asserting no horizontal
overflow, every new table and figure inside the viewport, and no clipped or unreachable Help text.
The existing Help-presentation, outline, focus-clearance and workbench-stacking tests ran unchanged
against the new content.

## Limitations

- "Reproduced" is an agent's reproduction, not a learner's. The walkthrough's judgments about
  clarity are a persona's; what this batch verifies is that the defined, labelled, ordered surfaces
  exist and behave as described.
- The glossary lists a section's terms by scanning its text; a term used only in a suite panel is
  attached with `alsoUsedIn`. New copy that uses a registered term without matching its pattern
  would simply not list it — the validator catches an unused term, not an unlisted use.
- The VESPA description does not state effect sizes; see the packet.
- 1280 × 900 beam-stop, 1024 × 768 and beta-wrapper limitations recorded by PI-FELLOW-01/02 remain
  known tradeoffs and were not reopened.
- Unrelated debt noticed and **not** changed: the pack's ledger statuses for Prompt 01 and 02 are
  stale (both merged); `data/resources.ts`'s glossary and the course's pathway share terms by text
  only, with no key linking the two; at 1280 × 900 with 200 % root text a **shared site-header
  link** (`a.transition-colors` in the global shell, not a PI file) extends to 1331 px and gives
  the page a horizontal scrollbar on every route — present before this batch, outside its scope.

## Preserved (not reimplemented)

Prompt 01 and 02 work is intact: total authored fixed-example state; acquisition, baseline and
display boundaries; truthful task and navigation wording; exactly three illustrative-only identities
(`current-anatomy:example:0`, `changing-anatomy:example:0`, `staff-protection:example:0`);
projection enlargement focus and dismissal; touch scrolling; live per-axis thin sections; camera
presets and the Anterior explanation; optional DTS overlays and their model-derived semantics;
equations, coordinates, units, provenance and storage identities. Their tests ran unchanged and
pass. No workbench was redesigned; no blanket scenario label was added.

**Self-paced contract**: no gate, mandatory attempt, score, penalty, mastery, first-try history,
weighting, assistance tracking, unsafe-answer acknowledgement or forced acknowledgement was added;
explanation, retry, skip and leave remain on every step they were on.

## Files

New: `content/glossary.ts`, `content/transferOrigins.ts`, `content/demonstrationOrigins.ts`,
`content/relatedCases.ts`, `content/doseQuantities.ts`, `content/warningInventory.ts`,
`components/stage/SectionGlossary.tsx`, `__tests__/teaching-clarity.test.ts`,
`__tests__/teaching-clarity.rendered.test.tsx`, this handoff, the text map and the owner packet.

Edited (all under `src/features/peripheral-imaging/` unless noted): `types.ts`, `data/lessons.ts`,
`data/resources.ts`, `content/{sectionSpecs,learningActivities,stageLessons,imagingChain,teachingExamples,reconstruction,interpretationChecks}.ts`,
`engine/labMetrics.ts`, `lib/physics.ts`, `components/{PeripheralImagingHub,PeripheralImagingLearnLanding,PeripheralImagingIntegratedCasesLanding,ImagingIntegratedCaseActivity}.tsx`,
`components/stage/{ImagingStageHost,ImagingTeachingColumn,ImagingActivityShell,ChainWalkCard,LessonDemonstration,ReconstructionComparison,TeachingPanels}.tsx`,
`components/stage/imaging-stage.module.css`,
`components/suite/{SuiteScene,Monitor,LabDock}.tsx`, `components/suite/dtsModel.ts`,
`components/suite/suite-scene.module.css`,
`components/suite/views/{ConeBeamView,DoseView,SamplingView,SignalView,StaffView,TomosynthesisView}.tsx`,
`__tests__/truthful-surfaces.test.ts`, `e2e/peripheral-imaging.spec.ts`.
