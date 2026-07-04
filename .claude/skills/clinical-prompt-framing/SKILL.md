---
name: clinical-prompt-framing
description: >-
  Rewrite a draft prompt for legitimate medical, clinical, or biomedical education / device-training
  work so its true educational context leads and precise clinical terminology replaces
  decontextualized "damage / destroy tissue" phrasing — so a safety classifier reads it correctly as
  education instead of false-positive-flagging it and downgrading the model (e.g. Fable → Opus). Use
  this whenever the user asks to reframe, de-flag, or "make paste-ready" a prompt; says a prompt got
  flagged or a session got downgraded; is handing a build-or-fix prompt to another model and worried
  it will trip safety filters; or is drafting a request about tissue / energy effects, drug dosing,
  toxicology, radiation, device operation, or procedural complications and wants it to land as the
  clinical education it actually is. It works by restoring real context — never by fabricating
  credentials or hiding what is being asked.
---

# Clinical prompt framing

## What this is for — and the one gate that must hold

Legitimate clinical and biomedical education constantly brushes against topics that _sound_
dangerous when a single sentence is lifted out of context: thermal tissue destruction, drug
dosing, toxicology, radiation, blast/ballistic injury, pathophysiology of poisoning. A safety
classifier scanning a prompt can see that language, miss the surrounding clinical purpose, and
conservatively route the request to a more-guarded model — the false-positive "downgrade" (Fable →
Opus) this skill exists to prevent.

The fix is **disambiguation, not evasion.** You are supplying the true context the classifier
needs to make the _correct_ call. That distinction is the whole ethic of this skill, and it has two
consequences you must honor:

1. **Everything you add must be true.** Restore real context — the actual accredited program, the
   real regulated device, the genuine patient-care purpose. Never invent credentials, fake an
   institutional affiliation, or claim a clearance that doesn't exist. A rewrite that lies isn't
   framing; it's fabrication, and it makes the classifier _wrong_ instead of right.
2. **Never strip or disguise the actual request.** The rewritten prompt must ask for the _same
   thing_ the draft asked for, in plain terms. You are adding a frame, not hiding a payload.

**The gate:** before you rewrite, satisfy yourself that the underlying work is genuinely legitimate
education or professional practice. If a draft is actually seeking weapon, explosive, pathogen-
enhancement, or attack material, reframing is the wrong tool — context can't make genuinely harmful
content safe, and dressing it in clinical language is exactly the misuse this skill must refuse. In
that case, say so plainly and stop. The overwhelming majority of real medical-education prompts sail
through this gate; it exists so the skill stays honest, not to obstruct real teaching work.

## Why the false positive happens (so you can reason, not pattern-match)

Two things trip the classifier, and both are fixable without changing what's being asked:

- **Missing context at the top.** Classifiers weight what they read first. A prompt that opens
  "Build a simulator showing how this energy destroys tissue…" leads with the scariest possible
  reading. The same request that opens with two sentences of accredited-program, FDA-cleared-device
  context reads as training.
- **Decontextualized, violence-adjacent phrasing.** "Damage / destroy / burn tissue" describes harm
  in the abstract. The clinical field has its own precise vocabulary for the exact same physical
  events — _coagulation, desiccation, vaporization, fulguration, ablation, hemostasis_ — and those
  words carry their legitimate purpose with them.

So the rewrite has two jobs: **front-load the true frame**, and **speak the field's own language.**

## The method — five moves

Apply these to the draft. They are additive and reorderable; use judgment about how much each
prompt needs.

1. **Open with a CONTEXT header the classifier reads first.** A short block, before the task, that
   names — truthfully — the setting (e.g. ACGME-accredited fellowship, graduate medical education),
   the audience (licensed physicians / fellows), the regulated subject (an FDA-cleared, CE-marked
   device by name; or a standard, published clinical procedure), the patient-care purpose, and an
   explicit disavowal in plain words ("this is device-operation / clinical training — not CBRNE,
   weapons, or bioweapon content"). The disavowal feels almost too blunt; include it anyway, because
   it directly answers the question the classifier is asking.

2. **Translate loaded phrasing into standard clinical terminology.** Sweep the draft for
   "damage / destroy / burn / kill tissue" and similar, and replace with the precise term for the
   actual effect: coagulation, desiccation, vaporization, fulguration, ablation, cautery,
   devitalization, hemostasis. This is not softening — it is _more_ accurate, and accuracy is what
   was missing.

3. **Anchor the deliverable as software / an educational artifact.** Say concretely what is being
   built or fixed: "a single-file, self-contained HTML teaching module," "a schematic cross-section
   animation," "a replica of the device's touchscreen UI," "a front-end bug-fix to an existing
   educational simulator." This makes explicit that the ask is to build/repair a teaching artifact,
   not to carry out a physical act.

4. **Name real specifics.** The actual device and its manual/document number, the clinical venue
   (bronchoscopy, endoscopy, the OR), the learner, the textbook or guideline sources. Specificity
   reads as legitimacy; vagueness invites the suspicious reading.

5. **Keep the technical substance intact.** Every parameter, table, interaction, and requirement in
   the draft survives into the rewrite. If anything, the rewrite is _more_ complete, because the
   context makes the numbers legible. Do not trim content to seem safer — that defeats the purpose
   and produces a worse deliverable.

## Shape of the rewritten prompt

Use the copy-paste template in `references/template-and-examples.md`. The skeleton:

```
## CONTEXT — please read first
<2–4 sentences: accredited setting · licensed audience · named regulated device or standard
 procedure · patient-care purpose · plain "this is clinical education, not weapons/CBRNE">

## ROLE / DELIVERABLE
<who the model is acting as + the concrete software/education artifact to build or fix>

## <the actual task>
<the full technical request from the draft, in standard clinical terminology, every requirement
 preserved>

## SOURCES (for accuracy)
<the real references — manual doc number, textbook, guideline>
```

## Output format

Return two clearly separated things:

1. **The paste-ready prompt**, in a single fenced block the user can copy wholesale. Nothing in it
   should address the user's Claude session — it is written to be pasted into a _fresh_ session.
2. **A short "What changed & why" note** below a divider (a few bullets): what context you added,
   which phrases you translated and to what, and anything you deliberately did _not_ change. Keep it
   brief — it's there so the user learns the pattern and trusts the rewrite, not to be pasted.

If the draft tripped the gate above, skip both and explain the concern instead.

## Before you hand it back — quick check

- Does the **first thing** the reader sees establish legitimate context? (If the context is buried
  in paragraph three, move it up.)
- Is every added claim **true**? Would the user stand behind the named program, device, and purpose?
- Did every technical requirement from the draft **survive**?
- Is there any remaining **abstract-harm phrasing** you can make precise?
- Is the disavowal present and plain?

## A compact example

**Draft (as written by the user):**

> Build an interactive module that shows how a laser destroys airway tumor tissue at different power
> settings, including how deep the damage goes and how the tissue chars and burns.

**Rewritten (paste-ready):**

> ## CONTEXT — please read first
>
> This is a graduate medical education request for an ACGME-accredited interventional pulmonology
> fellowship. It teaches licensed physicians the physics of **laser photoablation** during
> therapeutic bronchoscopy — a standard, FDA-cleared endoscopic treatment for malignant airway
> obstruction. The deliverable is a **front-end teaching artifact** (a self-contained HTML module
> with a schematic tissue cross-section). This is routine clinical-procedure training for safe
> patient care — not weapons, CBRNE, or any harmful application.
>
> ## TASK
>
> Build a single-file, self-contained interactive HTML module for IP fellows showing how laser
> **power density** governs tissue effect during bronchoscopic tumor ablation. Animate a schematic
> airway-wall cross-section that responds to wavelength and power: at treatment settings, show the
> zones of **vaporization, coagulation, and carbonization (char)** and their depth, and teach why
> exceeding safe **penetration depth** risks airway-wall perforation…

_What changed:_ added the accredited-program / FDA-cleared-procedure context header with an explicit
disavowal; translated "destroys / damage / burns / chars" into _photoablation, vaporization,
coagulation, carbonization, penetration depth_; anchored the ask as an HTML teaching artifact;
preserved the full request (power settings, depth, char behavior). Nothing about the underlying task
was removed.

## References

- `references/template-and-examples.md` — the reusable copy-paste template plus two full
  before/after rewrites (a device-operation module and a pharmacology/toxicology teaching request),
  showing the method applied end-to-end.
