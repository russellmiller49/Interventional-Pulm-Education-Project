# CRRT C0/C1 novice think-aloud script

**Status: no novice testing has yet occurred.** This document is the protocol, not a report. No
learner has run these tasks against the universal circuit, and nothing in the C0/C1 package should be
described as validated until they have.

## What is being tested

The C0/C1 package rebuilt `CrrtPilotCircuit` into one universal circuit with a fixed orientation and
nine learner-operable views. The claim under test is narrow and checkable:

> A first-year fellow who has never prescribed CRRT can trace every fluid on this picture, say which
> ones reach the patient, explain why the effluent bag is much larger than the patient's fluid loss,
> and tell a pressure they could walk over and inspect from a number that is only arithmetic.

If a participant cannot do that, the circuit has failed regardless of how the diagram looks.

## Participants

Three to five learners who have not previously used this module. Prioritise first-year fellows and
residents rotating through the ICU. Record the participant's prior CRRT exposure before starting; a
participant who already manages CRRT independently is testing recall, not the diagram.

## Setup

Open the CRRT Learn section `crrt-circuit-pressures`. The circuit figure opens on the CVVHD view.
Give the participant control of the view buttons and say nothing about what they do.

Ask the participant to think aloud continuously. Do not answer questions during a task; note the
question and answer it in the debrief. Record where they hesitate, what they point at, and the exact
words they use for each fluid — the vocabulary they reach for matters as much as the answer.

## Tasks

### 1. Trace the access and return blood paths

> Starting at the patient, follow the blood all the way around and back. Say each part out loud as
> you reach it.

Watch for: whether they notice the two lumens are different; whether they say "in" and "out" or
confuse the direction; whether they treat the filter as one compartment or two.

**Failure to record:** the participant cannot find where blood leaves the patient, or believes blood
returns through the same lumen it left by.

### 2. Show where every fluid travels

> Show me where the dialysate goes. Now the pre-filter replacement, the post-filter replacement, the
> pre-blood-pump and citrate line, the calcium, and the effluent. Use the view buttons if they help.

Watch for: whether they discover the view buttons unprompted; whether they can find pre- versus
post-filter replacement without being told the ports exist; whether they treat the effluent line as
an output of the patient rather than of the filter.

**Failure to record:** the participant cannot locate a fluid, or places a fluid on the wrong side of
the membrane.

### 3. Identify which fluids enter the patient

> Of everything you just traced, which fluids actually get into the patient, and which never do?

Expected: pre-blood-pump/citrate, pre-filter replacement, post-filter replacement, and calcium enter
the patient. Dialysate does not. Effluent leaves and does not return.

**Failure to record:** the participant says dialysate enters the patient, or cannot say why not.
This is the single most important discrimination in the package.

### 4. Explain why effluent greatly exceeds net patient removal

> The effluent bag is filling at 2,100 mL an hour. The patient is losing 100 mL an hour. Where did
> the other 2,000 mL come from?

Expected reasoning: 1,000 mL an hour is dialysate that was never inside the patient, and 1,000 mL an
hour was pulled across the membrane only to be handed straight back as replacement fluid.

**Failure to record:** the participant says the patient lost 2,100 mL, or cannot separate the
dialysate from the ultrafiltrate. Note whether they reach the answer from the picture, from the
ledger, or only after prompting.

### 5. Distinguish a modelled pressure site from TMP and filter pressure drop

> Which of these six numbers could you walk over to the circuit and inspect the source of? Which
> could you not, and why?

Expected: access, filter, return, and effluent have a physical location. TMP and filter pressure drop
have none — they are arithmetic over the other four.

Then:

> Blood flow is turned up and nothing else changes. Which of these six numbers move?

Expected: access becomes more negative; filter and return rise; TMP and filter pressure drop rise
because their inputs did. No new obstruction has appeared.

**Failure to record:** the participant looks for a TMP transducer on the diagram, or interprets a
rising pressure drop after a blood-flow increase as evidence of a clotting filter.

### 6. Compare the same circuit across five therapies

> Switch between SCUF, CVVHD, CVVH pre-filter, CVVH post-filter, and CVVHDF. What changes, and what
> stays the same?

Expected: the circuit is identical every time; only which fluids run changes. SCUF is the one view
where effluent and patient loss are nearly the same number.

**Failure to record:** the participant believes the machine or the circuit is physically different
between modalities, or cannot say what distinguishes CVVH-pre from CVVH-post.

## Debrief questions

1. Was anything on the picture that you could not name?
2. Was any label hard to read, or did any two labels run together?
3. Did the view buttons do what you expected before you pressed them?
4. Which single part of this would you have wanted explained first?
5. Was there anywhere you felt the module was telling you what to do at the bedside?

Question 5 is a safety check. Nothing in this package supplies a pressure target, an alarm
threshold, a citrate dose, or a calcium goal, and a participant who came away believing otherwise is
a finding that must be recorded and fixed before release consideration.

## What a passing result looks like

Every participant completes tasks 1, 3, 4, and 5 without prompting. Task 2 may need one prompt to
discover the view buttons. Task 6 may need one prompt to try more than one view.

Any participant who fails task 3 or task 4 blocks the package: those two are the reason the
conservation ledger exists.

## Recording

Keep notes per participant against these task numbers, and record verbatim any sentence in which a
participant describes effluent volume as patient fluid loss, or describes TMP as something measured.
Those two sentences are the module's own spine restated as a misconception, and they are what the
next package has to design against.
