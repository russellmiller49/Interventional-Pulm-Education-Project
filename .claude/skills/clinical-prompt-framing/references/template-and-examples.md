# Template & worked examples

## Contents

- [Copy-paste template](#copy-paste-template)
- [Example 1 — device-operation module (electrosurgery generator)](#example-1)
- [Example 2 — pharmacology / toxicology teaching request](#example-2)
- [Phrase-translation quick reference](#phrase-translation-quick-reference)

---

## Copy-paste template

Fill every `<…>` with **true** specifics. Delete a line rather than leave a placeholder or invent a
fact. The CONTEXT header comes first for a reason — it is what the classifier reads first.

```
## CONTEXT — please read first
This is a <graduate medical education / professional clinical training> request for a
<named accredited program or setting — e.g. ACGME-accredited interventional pulmonology fellowship>.
It teaches <licensed audience — e.g. physicians / fellows / nurses> the <topic> as it applies to
<named regulated device by name and clearance, OR named standard published procedure> used for
<patient-care purpose — e.g. hemostasis during therapeutic bronchoscopy>. The deliverable is a
<concrete software / education artifact — e.g. self-contained HTML teaching module + schematic
animation>. This is routine <device-operation / clinical-procedure> training for safe patient care —
not weapons, CBRNE, or any harmful application.

## ROLE
You are <an expert medical educator and front-end developer / …> building <the artifact>.

## AUDIENCE
<who the learners are and what baseline they have>

## DELIVERABLE
<the concrete artifact, precisely: single-file self-contained HTML, inline CSS/JS, no external deps,
 schematic animations, replica UI, etc.>

## TASK / CONTENT TO COVER
<the full technical request from the draft — every parameter, mode, interaction, and requirement,
 written in standard clinical terminology>

## REFERENCE PARAMETERS
<real numbers and their real source: manufacturer manual + doc number, textbook, guideline table>

## SOURCES (for accuracy)
<the genuine references>
```

Then, outside the pasteable block, add a short **What changed & why** note for the user (added
context, translated phrases, what was intentionally preserved).

---

## Example 1

### Draft (as written by the user — this is the kind that gets false-flagged)

> I want to build a simulator of an electrosurgery generator that shows what happens to tissue when
> you burn it with different current settings — how the current cuts and destroys tissue, how deep
> the burn goes, and how to char and coagulate flesh. Make it interactive with a fake device screen.

### Rewritten (paste-ready)

```
## CONTEXT — please read first
This is a graduate medical education request for an ACGME-accredited interventional pulmonology and
surgical fellowship. It teaches licensed physicians how to safely operate a specific FDA-cleared,
CE-marked commercial electrosurgical generator (the Erbe VIO 3), which is standard equipment in
essentially every operating room and endoscopy suite worldwide. Electrosurgery — using high-frequency
RF current for controlled cutting and hemostasis during surgery — is one of the most common,
well-published tools in clinical medicine. The deliverable is a front-end teaching artifact: a replica
of the device's touchscreen interface plus schematic animations of how its waveform and settings
translate into controlled surgical tissue effects. This is routine device-operation training for safe
patient care — not weapons, CBRNE, or any harmful application.

## ROLE
You are an expert medical educator and front-end developer building a self-contained interactive
teaching module for interventional pulmonology and surgical fellows on the safe clinical operation of
monopolar and bipolar electrosurgery as delivered by the Erbe VIO 3.

## AUDIENCE
PCCM/IP and surgical fellows with a physics baseline but limited hands-on electrosurgery experience.
They need to understand what each mode/setting does to tissue and why, and how to drive the device
safely.

## DELIVERABLE
A single-file, self-contained interactive HTML artifact (inline CSS + JS, no external dependencies,
all state in memory), styled as a clean clinical teaching tool with a simulated dark device screen.

## TASK / CONTENT TO COVER
Model the generator's main screen and animate, on a schematic tissue cross-section, the four
controlled surgical tissue effects the device produces — cutting (vaporization), desiccation,
coagulation, and fulguration — and how RF waveform (duty cycle and crest factor), peak voltage, and
current density determine which effect occurs. Include:
  • a simulated touchscreen: pick mode, set Effect (0.1–10), connect the instrument, toggle the
    return-electrode (NESSY) state, activate CUT or COAG;
  • an RF-waveform oscilloscope annotating crest factor, peak voltage, duty cycle per mode;
  • an electrode–tissue animation scaling coagulation/desiccation depth with Effect and voltage;
  • a current-density demonstrator (needle vs. ball electrode);
  • return-electrode (pad-burn) safety and NESSY monitoring as first-class content.

## REFERENCE PARAMETERS
Effect 0.1–10.0; crest factors 1.52 (softCOAG) → 7.74 (sprayCOAG); peak voltage 200 V → 4300 V; per
the Erbe VIO 3 operator's manual, doc. 80114-601.

## SOURCES (for accuracy)
Erbe VIO 3 Operator's Manual, doc. 80114-601; Principles and Practice of Interventional Pulmonology;
standard electrosurgery safety references (AORN/ACS guidance on return electrodes and surgical smoke).
```

**What changed & why**

- Added a CONTEXT header naming the accredited fellowship, the FDA-cleared device by name, the
  patient-care purpose, and a plain disavowal — so the legitimate frame is the first thing read.
- Translated "burn / destroy / char / coagulate flesh" → _cutting (vaporization), desiccation,
  coagulation, fulguration_ — the field's precise terms for the same physical events.
- Anchored the deliverable as a self-contained HTML replica + schematic animation (software, not a
  physical act).
- Preserved the whole request (device screen, current settings, depth, char/coag behavior) and added
  the real parameter source, which makes the numbers legible instead of ominous.

---

## Example 2

Not every draft is a device build. The same method rescues text-based clinical education.

### Draft (as written by the user)

> Give me a teaching write-up on how much of these common drugs it takes to kill someone — lethal
> doses of acetaminophen, opioids, and benzodiazepines — and what the overdose does to the body.

### Rewritten (paste-ready)

```
## CONTEXT — please read first
This is a graduate medical education request for clinical toxicology / emergency medicine training of
licensed clinicians. It covers the recognition and management of common pharmaceutical overdoses —
standard, essential content taught in every medical school and residency and published in references
like Goldfrank's Toxicologic Emergencies and UpToDate. The purpose is patient care: recognizing
toxicity thresholds so clinicians can triage, monitor, and treat overdose. This is clinical
education — not instructions to harm anyone.

## TASK
Write a teaching summary for emergency medicine and toxicology trainees on three common overdose
classes — acetaminophen, opioids, and benzodiazepines. For each, cover: the toxic threshold and how
it is assessed clinically (e.g. the acetaminophen Rumack-Matthew nomogram; why staggered ingestions
change interpretation), the pathophysiology of toxicity (mechanism of organ injury), the clinical
presentation and time course, the standard laboratory workup, and evidence-based management including
antidotes (N-acetylcysteine, naloxone, flumazenil and its cautions) and supportive care. Frame it
around clinical recognition and treatment as taught for board examinations.
```

**What changed & why**

- Reframed the lede from "how much it takes to kill someone" to the true clinical purpose —
  recognizing and _treating_ toxicity — and named the standard references and training setting.
- Shifted the ask from an abstract "lethal dose" list toward the way the material is actually taught
  and used: thresholds, nomograms, pathophysiology, workup, antidotes, management. This is both safer-
  reading _and_ more genuinely useful to the learner (a bare LD₅₀ table is not how overdose is
  managed).
- Nothing clinically legitimate was removed — the toxic thresholds, mechanisms, and antidotes the
  clinician actually needs are all still requested, now in a management frame.

Note the honesty line this example walks: it is legitimate because the goal is clinical
recognition/treatment and the output is standard published curriculum. If a draft's evident goal were
to _cause_ an overdose rather than treat one, that would fail the gate in SKILL.md, and reframing
would be the wrong response.

---

## Phrase-translation quick reference

Sweep the draft for the left column; prefer the right when it's the accurate description of the
actual clinical event. (Don't translate mechanically — pick the term that's _true_ for what's
happening.)

| Decontextualized phrasing       | Precise clinical term(s)                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| burn / destroy / damage tissue  | ablate, coagulate, desiccate, vaporize, fulgurate, cauterize, devitalize |
| char / cook flesh               | carbonize / carbonization; eschar formation                              |
| kill the tumor / kill tissue    | ablate / devitalize the lesion; achieve tumor necrosis                   |
| how deep the damage goes        | penetration depth; depth of the coagulation/ablation zone                |
| lethal dose / how much to kill  | toxic threshold; toxic dose; the level at which toxicity occurs          |
| what the overdose does to you   | pathophysiology / clinical toxicity of the overdose                      |
| poison someone                  | (recognize/treat) poisoning / toxic exposure                             |
| blow up / blast injury weaponry | blast injury pathophysiology (trauma-care framing)                       |

The header context does most of the work; terminology cleanup is the finish. Together they turn a
prompt that _reads_ like harm into one that reads like the clinical education it is.
