# B5 novice think-aloud — facilitator guide

**Status: no human session has been run.** This guide, the participant sheet, the observation form,
the rubric, and the findings template are _readiness_ materials. Nothing in this packet records an
observation. Until sessions are actually run and written into
[`b5-novice-findings-template.md`](./b5-novice-findings-template.md), no claim that this module has
been validated with learners is true.

This guide contains expected observations and is **not** to be shown to a participant. The
participant sees only [`b5-novice-participant-tasks.md`](./b5-novice-participant-tasks.md).

---

## 1. Purpose and scope

This is **formative educational and usability testing**. It asks whether a novice can read the
guided ECMO Learn workspace and reason with the six pilot drill panels. It is explicitly **not** a
competency assessment, not an examination, and not a measure of any participant's readiness to
manage a patient. Nothing observed here should ever be reported as a judgement about a person.

**In scope:** the guided drill **Learn** route — the three-pane workspace (live simulator ·
teaching · current task) and these six drills:

| #   | Scenario id                  | Lesson title, as the lesson header shows it              | Pathway rail label     | Task |
| --- | ---------------------------- | -------------------------------------------------------- | ---------------------- | ---- |
| 1   | `startup-sensor-orientation` | Meet the console, the circuit, and the external controls | Console tour           | 1    |
| 2   | `preload-drainage-collapse`  | Flow falls and the drainage line judders                 | Flow falls             | —    |
| 3   | `vv-recirculation`           | Flow is up and the patient is worse                      | Flow up, patient worse | 2    |
| 4   | `gas-source-interruption`    | Gas transfer falls while flow holds                      | Sats fall, flow holds  | 3    |
| 5   | `arterial-bubble-stop`       | Bubble alarm: the pump stopped itself                    | Pump stopped           | 4    |
| 6   | `va-differential-hypoxemia`  | Right arm low, groin fine, circuit reassuring            | Two saturations        | 5    |

Open each lesson directly:
`/cardiohelp-ecmo/learn?lesson=<scenario id>&track=vv` — and `&track=va` for row 6.

> ### You open the lesson, and **do not read the lesson title aloud**
>
> As of R4 every lesson is presentation-named: the title says what the learner will see on the
> console, the circuit and the patient — "Flow is up and the patient is worse" — and no longer the
> mechanism, the move, or the ordering the task asks for. (Before R4 four of the six titles stated
> the answer outright; that is why this packet was built the way it is, and the rule stands.)
>
> The participant sheet still names no lesson at all, because a title read aloud is a frame put in
> the participant's ear before they have looked at anything, and the sheet's own task wording is
> written to overlap with no title. **Before each task you open the lesson yourself**, from the
> table above, and hand the screen over with it already loaded. Say "here's the next one" — not the
> title. The title is visible in the lesson header once the lesson is open, which is unavoidable and
> fine; what matters is that you do not put it in the participant's ear before they have looked at
> the circuit.
>
> Task 6 changes the viewport rather than the lesson, and runs on whichever lesson is already open.
>
> Row 2 (`preload-drainage-collapse`) has no task of its own. It is the optional contrast case in
> §8, task 2 — open it only if you use that contrast.

**Out of scope:** Practice, Assess, the ten foundation lesson panels, and the fourteen drills that
have no live teaching panel yet. Those fourteen show an explicit "no live teaching panel for this
case" card by design — if a participant reaches one, that card is correct behaviour, not a fault.
If a participant wanders into Practice, note it and bring them back.

## 2. Who to recruit

Learners who have **not** managed ECMO independently. The premise of the slice is that the panels
teach someone who cannot yet read the console, so an experienced ECMO clinician cannot falsify it.

Recruit across these categories and record which one applies (category only, never a name):

- **A** — no prior extracorporeal exposure at all (e.g. early resident, student)
- **B** — has seen ECMO at the bedside but never managed the circuit (e.g. ICU nurse, ward trainee)
- **C** — some formal teaching, no independent management (e.g. fellow early in training, perfusion student)
- **D** — manages other extracorporeal or mechanical support but not ECMO (e.g. CRRT, IABP)

Aim for **four to six** participants, at least two from categories A or B. Sessions run about 45–60
minutes including debrief.

## 3. Setup

- Route: `/cardiohelp-ecmo/learn`. Keep the six direct links from §1 open in your own window or on
  paper: **you** load each lesson, the participant never navigates to one by name.
- **No sign-in is required.** The module is reachable by direct link as unlisted tester access, and
  lesson history stays in the participant's own browser. Do not create an account for them, and do
  not sign in with your own — a signed-in session would attach their exploration to your record.
- Open the browser window at **1440 × 900** and leave it there. **Task 6 is the only task that
  changes the viewport**; you will resize to 1280 × 720 during it, and optionally 1024 × 768 after.
- Use a fresh browser profile or clear site data between participants, so lesson progress from the
  previous session does not pre-open steps.
- Have the participant sheet open in a separate window or on paper. Do **not** have this guide
  visible on the shared screen.
- Recording: audio or screen capture only with explicit consent. If consent is declined, take
  written notes — the session still runs.

### If the participant works by keyboard

The Clinical context row across the top holds more than fits at every one of these window sizes, so
part of it sits off the right-hand edge. It is a focusable scrolling region: **Tab to the Clinical
context strip and use the left and right arrow keys to review the information outside the visible
area, or Home and End for the first and last items.**

Say this only if the participant is working by keyboard and only as a mechanical fact about the
window, in the same register as "you can scroll this page". It names no pane, no control and no
finding, so it is not coaching — but do not volunteer it as a hint when someone is stuck on a task.
If a participant never discovers the strip scrolls, record that: it is a discoverability finding.

## 4. Standardized introduction

Read this close to verbatim, so every participant starts from the same frame:

> "Thanks for helping with this. We're testing a teaching module about ECMO — the machine that takes
> over heart or lung function. We are testing the module, not you. There's no score, nothing is
> recorded against your name, and there are no right answers I'm waiting for.
>
> What helps me most is if you think out loud the whole time: tell me what you're looking at, what
> you're reading, what you expect to happen, and anything that confuses you. If you go quiet I'll
> ask you what you're looking at — that's just to keep you talking, it doesn't mean anything's
> wrong.
>
> I'm going to be quite boring on purpose: I won't answer questions about the content while we go,
> because the moment I explain something I've stopped testing whether the module explains it. I'll
> answer everything at the end.
>
> You can stop at any time for any reason. Please don't type any real patient details or your own
> health details anywhere in it. Any questions before we start?"

## 5. Think-aloud instructions

Give these once, at the start:

- Narrate continuously, including dead ends and second thoughts.
- Read aloud anything you actually read on screen — that tells us what got noticed.
- Say when you are guessing, and say when you are confident.
- Being stuck is a useful result; say you are stuck and keep going.

## 6. When the facilitator may speak

You may prompt **only** to restart narration or to move the session along. Use these, and prefer
them close to verbatim:

- "What are you looking at?"
- "What do you expect to happen?"
- "What are you thinking right now?"
- "Say a bit more about that."
- "What would you do next?"
- "Is there anything on the screen you haven't looked at?" _(only after ≥60 s of being stuck)_

### The no-coaching boundary

Do **not**, at any point before the debrief:

- name a pane, tab, control, panel, or button the participant has not already found;
- confirm or deny a piece of reasoning ("yes, exactly", "hmm, not quite", or a tone that carries it);
- explain any physiology, or define any term, including ones they ask about;
- point at the screen, or move the mouse or window on their behalf (except the Task 6 resize);
- tell them a lesson is the wrong one, unless they have left the six in scope entirely.

If asked a content question, use: **"I want to see what the module tells you — hold that and I'll
answer it at the end."** Then write the question down; an unanswerable question _is_ a finding.

If asked a mechanical question ("how do I go back?"), you may answer only after they have tried for
about 30 seconds, and you must record that you did — that is an interface-help outcome in the
rubric, not an independent success.

## 7. Task order

Run tasks **1 → 6 in order**. The order is deliberate: task 1 establishes what a trustworthy signal
looks like, tasks 2–5 rely on that, and task 6 tests the layout after the participant has state
worth losing.

Before each of tasks 1–5, load that task's lesson from the §1 table and hand the screen over with it
open. Task 6 runs on whatever is already on screen; you resize, they look.

If time runs short, drop task 5 before task 4 — the bubble sequence carries the safety-critical
reading and should not be skipped.

Between tasks, ask the participant to say in one sentence what they think that lesson was about,
before moving on.

## 8. Expected observations

_(Facilitator only. These describe what the module intends, so you can recognize a divergence. They
are not a marking scheme, and a participant reaching a different defensible answer is data, not an
error.)_

**Task 1 — pump stopped, which channels are believable.**
Intended: the participant separates a flow of zero (a real measurement of no flow) from the pressure
channels, which render as unavailable because the simulation does not model pressures with the pump
stopped. Watch whether they read the reason text or only see dashes. **The failure mode to catch is
a participant concluding the console is "broken" or "still loading"** — that would mean the
unavailable state reads as a fault rather than an honest gap. Also watch whether a passed self-test
is taken as covering the whole circuit.

**Task 2 — recirculation.**
Intended: the participant notices the drainage-line saturation, connects rising displayed flow with
worsening patient oxygenation, and does **not** reach for more pump speed. If they commit to raising
speed, let them do it and watch whether the live response — displayed flow up, effective flow down —
lands. **This is the single most important observation in the packet.** A participant who leaves
believing more speed treats recirculation is a curriculum failure.

Optionally contrast with the drainage drill, where the model behaves the opposite way: past the
drainage the case can supply, more speed makes displayed flow _fall_. Watch whether a participant
carries one answer into the other case or reads each circuit on its own.

**Task 3 — gas-source interruption.**
Intended: the participant separates the blood path from the gas path, and is not reassured by an
unchanged flow number. Watch how long before they look at the gas panel rather than the console, and
whether they reach for sweep before checking the supply.

**Task 4 — bubble intervention.**
Intended: the participant distinguishes **device stop**, **patient isolation**, **source
correction**, **de-airing**, and **resumption** as separate acts rather than collapsing them into
"deal with the alarm". Watch whether they believe a stopped pump has isolated the patient, and
whether falling saturation pushes them to resume early — let them try; the safety response is part
of what is being tested.

Then, specifically: the module hands the learner one bounded action for restarting — resume per the
current instructions for use and approved local protocol — instead of a clamp/pump/reset order.
**At debrief, ask whether they understood that the lab deliberately did not teach an order.**
Understanding that is the intended reading; coming away thinking _there is no order to know_ is a
failure of the abstraction and must be recorded as one.

If they try to open the last clamp by hand after correcting the source, the model refuses. They
should be able to say why.

**Task 5 — differential hypoxemia.**
Intended: the participant treats the right-wrist and groin saturations as reporting **different
territories**, not one number measured twice, and can say roughly which each represents. Watch
whether they reach for pump speed. Critically: the panel says _this simulation_ does not move the
mixing point. **Watch whether they instead come away believing circuit flow is clinically irrelevant
to the mixing point** — that is the panel being misheard and is a finding.

**Task 6 — 1280 × 720.**
Intended: the simulator stays on screen; the participant finds the Teaching / Current task switcher
unaided; switching loses neither their step, their committed answer, the verdict, nor their scroll
position; and the module's "show me" reveals the right control. At 1024 × 768 all three panes become
tabs — note whether the switcher is discoverable there.

Also note whether the switcher is operated by mouse only. The tabs support arrow keys; if a
keyboard-preferring participant never discovers that, record it as a discoverability finding rather
than an access failure.

## 9. Answer key location

There is **no answer key in the participant materials**, and there must never be one. The intended
readings live in §8 of this guide only. An automated contract in
`src/features/cardiohelp-ecmo/__tests__/b5-vertical-slice-validation.test.tsx` fails the build if
answer-key vocabulary appears in the participant sheet.

## 10. Stopping criteria

Stop the session, or the task, when any of these occur:

- **Distress.** Any sign of embarrassment, frustration directed at themselves, or anxiety about
  being judged. Stop the task, reset the frame explicitly ("this is the module failing, not you"),
  and offer to end the session with no consequence.
- **Sustained confusion.** More than ~5 minutes stuck on one task with no new ground. Move on and
  record it; grinding produces frustration, not data.
- **A safety-critical misunderstanding stated with confidence.** Do not leave it standing. Finish
  the task, then correct it explicitly at debrief before the participant leaves. Record it at the
  highest severity. This is the one case where the no-coaching boundary is lifted — at debrief only.
- **Fatigue.** Sessions over ~60 minutes stop producing usable narration.
- **Any request to stop**, for any reason or none.

## 11. No PHI

No real patient data, identifiers, images, or clinical documents may enter the session, the module,
the observation form, or any recording. Identify participants by **code only** (`P01`, `P02`, …).
Keep the code-to-person mapping outside this repository. Do not record the participant's name,
institution, or role in free text on the observation form.

## 12. Post-session debrief

Ask, in this order, after all tasks:

1. What do you think this module was trying to teach you?
2. Was there anything on screen you never used, or never understood what it was for?
3. Was there a moment you felt lost? What were you looking at?
4. _(Task 4)_ When it told you to restart per the instructions for use and local protocol — what did
   you take that to mean? Did you think there was a specific order to learn, or not?
5. _(Task 5)_ Do you think how fast the pump runs matters to which blood reaches the right arm?
   Where did you get that from?
6. _(Task 1)_ When the pressure readings showed nothing — what did you think that meant?
7. Was there anything you thought the machine was telling you that turned out to be something else?
8. If you had to explain this to someone starting tomorrow, what would you say?
9. What would you change about it?

Then answer everything you deferred, and correct any safety-critical misunderstanding explicitly.

## 13. After the session

1. Complete one [`b5-novice-observation-form.md`](./b5-novice-observation-form.md) per participant.
2. Classify each task outcome with [`b5-novice-scoring-rubric.md`](./b5-novice-scoring-rubric.md).
3. Write consolidated findings into
   [`b5-novice-findings-template.md`](./b5-novice-findings-template.md) — that file is the only
   place a human finding becomes part of this repository's record.
4. Do not describe the module as validated until step 3 exists with real observations in it.
