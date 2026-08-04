# Novice think-aloud script — ECMO Learn workspace and the six pilot drill panels

**Status: this is a test script, not a result.** No novice validation has been run on this vertical
slice. Nothing below records an observation; every line describes something still to be watched for.
Any claim that the workspace or the panels have been validated with learners would be false until
this script has actually been run and its findings written up separately.

## What is being tested

The B3/B4 vertical slice: the guided ECMO drill **Learn** route rebuilt as three panes (live
simulator · teaching · current task), and six of the twenty drills given a live teaching panel.

Out of scope for this session: Practice, Assess, the ten foundation lesson panels, and the fourteen
drills that have no panel yet. If a participant wanders into Practice, note it and bring them back —
that surface is deliberately unchanged and is not what is being examined.

## Who to recruit

Learners who have **not** worked ECMO independently: junior ICU or pulmonary trainees, perfusion
students, ICU nurses new to extracorporeal support. The whole premise of the package is that the
panels teach someone who cannot yet read the console, so an experienced ECMO clinician cannot
falsify it.

Aim for four to six participants. Sessions run about 45 minutes.

## Setup

- Route: `/cardiohelp-ecmo/learn`. Sign-in is required; have the participant's account ready before
  the session starts rather than during it.
- Start each participant at **1440 × 900** unless the task says otherwise. Task 6 changes the window
  deliberately; nothing else should.
- Ask for continuous think-aloud. Prompt with "what are you looking at?" and "what would you do
  next?" — never with "do you see the X panel?", which supplies the answer being tested.
- Record which pane the participant is looking at when they speak. That is the primary measure: the
  package exists to stop the simulator, the explanation, and the task competing for one screen.

## Tasks

Each task names what to watch for. None of them should be read aloud as a hint.

### 1. Pump stopped: which channels are believable, and why?

Open **Startup, self-test, and sensor orientation** and stop before touching anything.

Ask: _which numbers on this screen would you trust right now, and which would you not?_

Watch for: whether the participant distinguishes a flow of zero from a pressure channel showing
nothing; whether they can say **why** the pressure channels are blank; whether they read the reason
text or only the dashes; whether they treat a passed self-test as covering the circuit.

The failure this is looking for is a participant who says the console is "broken" or "still loading".

### 2. Rising displayed flow, rising drainage saturation, worsening oxygenation

Open **High displayed flow with limited oxygenation response** and let them read it.

Ask: _what should happen to the pump speed here, and why?_

Watch for: whether they reach for speed; whether they notice the drainage-limb saturation at all;
whether they compare it with the patient's arterial value or read each alone; whether, after
committing, the withheld quantities change their account.

If they commit to raising speed, let them do it on the rotary control and watch whether the panel's
live line — displayed flow up, effective flow down — lands. That is the single most important
observation in this script.

**Then do the same in the drainage drill** (_Falling flow with increasingly negative pVen_), where
the model now behaves the opposite way: past the drainage the case can supply, raising speed makes
displayed flow _fall_, the suction deepen, and the judder appear. Two drills, two different answers
to "what does more speed buy you" — watch whether a participant carries the recirculation answer
into the drainage case, or reads each circuit on its own.

### 3. Gas-source loss with preserved blood flow

Open **Gas transfer falls while blood flow persists** and advance to the event.

Ask: _localize the problem. Which part of this circuit has failed?_

Watch for: whether they separate the blood path from the gas path at all; whether an unchanged flow
number reassures them; whether they reach for sweep before checking the supply; how long it takes
them to look at the gas panel rather than the console.

### 4. Bubble intervention: four different acts

Open **Arterial bubble alarm with pump stop** and advance to the event.

Ask: _the pump has stopped on its own. What has that achieved, and what has to happen before this
circuit carries blood again?_

Watch for: whether they distinguish **circuit isolation**, **source correction**, **de-airing**, and
**resumption** as separate acts, or collapse them into "deal with the alarm"; whether they believe a
stopped pump has isolated the patient; whether the falling saturation pushes them toward resuming
early. Let them attempt an early resume if they choose to — the safety response is part of what is
being tested.

Then watch the resumption step specifically. The module teaches isolation and source control, and
then hands the learner one bounded action — _resume support per the current IFU and approved local
protocol_ — rather than a clamp, pump and reset order. **The question to ask afterwards is
whether they understood that the lab deliberately did not tell them the order**, or whether they
came away thinking there was no order to know. The first is the intended reading; the second is a
failure of the abstraction and should be recorded as one.

Also try to open the last clamp by hand after correcting the source. The model refuses, and the
learner should be able to say why — the patient would be back on both limbs of a circuit that is not
moving blood.

### 5. Right radial low, femoral preserved

Open **Peripheral VA: upper-body oxygenation falls despite oxygenated return blood**.

Ask: _what does each of these three readings represent? And can you move the mixing point from this
console?_

Watch for: whether they treat the two arterial saturations as one number measured twice; whether
they can say which territory each site reports; whether they reach for pump speed; and — critically
— whether they come away believing that flow does not matter clinically, or that **this simulation**
does not model it. The panel says the second; the risk is that they hear the first.

### 6. At 1280 × 720: find everything without losing your place

Resize the window to **1280 × 720** mid-lesson, ideally just after a prediction has been committed.

Ask: _find the live signal, the current task, the teaching explanation, and the help target — without
losing what you had._

Watch for: whether the simulator stays visible; whether they find the Teaching / Current task
switcher without being told; whether switching loses their step, their committed answer, the verdict,
or their scroll position; whether "Show me where" brings the right control into view.

Then repeat briefly at **1024 × 768**, where all three panes become tabs, and note whether the
switcher is discoverable there.

## Viewport arrangements to expect

The workspace measures its own box, not the window, so these are the arrangements each viewport
produces once the module chrome is taken off:

| Viewport   | Arrangement                             | What the learner should always be able to see          |
| ---------- | --------------------------------------- | ------------------------------------------------------ |
| 1600 × 900 | Three panes, both separators draggable  | Simulator, teaching, and task at once                  |
| 1440 × 900 | Simulator plus one context pane, tabbed | Simulator always; teaching or task by tab              |
| 1280 × 720 | Simulator plus one context pane, tabbed | Simulator always; teaching or task by tab              |
| 1024 × 768 | All three panes as tabs                 | One pane at a time; help requests reveal the simulator |

A hidden pane is never unmounted, so a context switch keeps the step, the committed answer, the
verdict, the simulator state, and each pane's scroll position.

## What would count as a failure of this slice

- A participant cannot say why a channel is blank after task 1.
- A participant leaves task 2 believing more speed is the treatment for recirculation.
- A participant collapses the bubble acts into one after task 4, or leaves believing there is no
  clamp/pump/reset order to learn at all rather than that this lab declines to teach one.
- A participant leaves task 5 believing circuit flow is clinically irrelevant to the mixing point.
- A participant loses their answer, their step, or their place when the window changes in task 6.
- A participant reads the mechanism before committing a prediction. This should be structurally
  impossible — the mechanism is gated on the engine's own commitment flag and the gate has an
  injected-defect test behind it — so an observation of it is a bug report, not a finding.

## What this script cannot tell you

It cannot tell you whether the clinical content is correct; that needs review by an ECMO clinician
against the sources, not by novices. It cannot tell you whether the fourteen unwritten drill panels
would work the same way. And it cannot tell you anything about Practice or Assess, which this
package deliberately did not touch.
