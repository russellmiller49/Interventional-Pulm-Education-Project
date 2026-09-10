# Critical care: mechanical ventilation, ARDS, and APRV

## Sources

CC-03: ARDS discussion. CC-04: APRV discussion and debate. CC-06: mechanical-ventilation resident bootcamp explicitly introduced as 2022. All support language calibration; none substitutes for current validation of a ventilation protocol.

## Core terminology

Use the terms already represented in the sources and target module: tidal volume, respiratory rate, minute ventilation, FiO2, PEEP, plateau pressure, driving pressure, compliance, resistance, oxygenation, ventilation, recruitment, work of breathing, ventilator mode, control variable, trigger, cycling, mandatory/spontaneous breath, and measured versus set values.

Source anchors:

- CC-03, 35:50–39:17, lines 8925–9053: tidal volume, plateau pressure, PEEP, ventilation and oxygenation discussion.
- CC-03, 47:39–49:50, 9381–9469: driving pressure and explicit discussion of the strength/status of outcome evidence.
- CC-06, 6:49–10:55, 18819–19323: control variables and modes.
- CC-06, 11:03–12:49, 19339–19551: triggering versus cycling.
- CC-06, 13:05–14:07, 19585–19705: breath types versus breath sequences, including a spoken correction.
- CC-06, 15:07 onward, 19835 onward: input settings versus readouts and console use.

These terms are not “too technical” for the target audience. Define a specialized term briefly when needed, instead of making a nickname the only label.

## Keep distinctions that prevent meaning drift

The editor must preserve, and consult the module's own sources for, distinctions such as:

| Distinction                                                 | Editorial consequence                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A setting versus the resulting measurement                  | Do not rename a configured value to imply actual delivery.                                           |
| Oxygenation versus ventilation                              | Do not rewrite either as a generic “breathing status.”                                               |
| Trigger versus cycle                                        | Do not use “start a breath” for the event ending inspiration.                                        |
| Breath type versus breath sequence                          | Do not collapse the taxonomy into “machine versus patient.”                                          |
| Mandatory breath versus ventilator-triggered breath         | The source explicitly includes cycling in its definition; do not equate the two terms automatically. |
| Pressure-control setting versus plateau or driving pressure | Inspect the mode and data binding; do not apply a familiar equation to the wrong control.            |
| Compliance versus resistance                                | Preserve which mechanical property is being discussed.                                               |
| Immediate response versus a subsequent trend                | Do not delete the time qualifier or imply a sustained result.                                        |
| Physiologic rationale versus outcome evidence               | Do not convert a plausible mechanism or observational association into proven benefit.               |

The last distinctions are editing guardrails, not a complete ventilator manual. When a proposed replacement would require adding a new physiology claim, classify it E2.

## APRV-specific vocabulary

Use **airway pressure release ventilation (APRV)** and retain the actual mode's parameter names: P high/P low, T high/T low, release, spontaneous breathing, and the relevant waveform or pressure measurement. Normalize subscripts or spelling only if it preserves the existing data contract and visual accessibility.

Anchor: CC-04, 35:34–36:12, lines around 13471–13495, and the broader session. The transcript contains variants such as APRV/APV and inconsistent spacing; resolve only with the explicit local context.

The discussion is not one undifferentiated consensus. Later remarks explicitly separate mechanistic enthusiasm from an awaited clinical-outcome answer: CC-04, 1:25:06–1:28:13, 15407–15531. Preserve that distinction.

Do not make anecdotal setting relationships, patient-size heuristics, a particular release-time approach, or an outcome superiority claim into defaults. This is a terminology pass, not an APRV protocol migration.

## Word choice and examples

Illustrations below are authored style examples, not transcript quotations or verified repository defects.

- “The breath packet” → “tidal volume,” only when the modeled quantity is actually tidal volume.
- “How often the machine delivers breaths” → “set respiratory rate,” only when it is a set rate, not the total observed rate.
- “When the machine hands the breath back” → “cycling from inspiration to expiration,” if that is the event being described.
- “The machine takes over” → name the actual mode or supported variable. Do not assume the patient is passive or apneic.
- “Keep the lung open” can remain a short explanation beside “PEEP” or “recruitment” when the lesson already supports the mechanism. Do not use it as a dose-setting instruction.
- “Improve the respiratory story” → specify the already-stated oxygenation, ventilation, effort, or waveform problem.

The bootcamp's machine analogy can remain optional. The primary concept is the **control variable**; a learner should be able to discuss it without remembering the analogy.

## Titles, questions, and visualizations

Good topic headings name real concepts: “Ventilator settings and measurements,” “Triggering and cycling,” or “Interpreting plateau pressure.” Keep the local instructional order when it already works.

For a question testing waveform interpretation, do not rename the case “Auto-PEEP” or “Double triggering” before the learner identifies it. A neutral title such as “The expiratory flow waveform has changed” is preferable when that matches the actual shown finding. The answer and explanation can use the mechanism name afterward.

Never add waveform features to a stem because a diagnosis seems likely. Inspect the actual scenario and diagram source. A screenshot, caption, and answer must refer to the same breath, axis, unit, and time window.

## Protected clinical fields

Do not change ventilator mode logic; inspiratory/expiratory timing; actual versus predicted/indexed body size fields; formula inputs; PEEP or driving-pressure definitions; dose/pressure/volume thresholds; escalation criteria; alarm logic; or answer scoring. Flag clinical-source conflicts and numerical anomalies separately.
