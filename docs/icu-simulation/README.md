# ICU Simulator

Working route: `/icu-simulation`  
Initial release stage: `private-development`

ICU Simulator is a browser-first, adult critical-care learning environment that combines the
existing ICU hemodynamics, mechanical ventilation, mechanical circulatory support, CARDIOHELP
ECMO, and Baxter CRRT educational systems around one synthetic patient state.

The integrated runtime is intentionally separate from the five source-module workbenches. It
reuses their reviewed calculations, content, control concepts, alarms, and visual assets through
therapy adapters, but owns one clock, one patient, one replay log, and one outcome model. This
prevents independent reducers from overwriting the same MAP, oxygenation, volume, acid-base, or
renal state.

## V1 learning experiences

- **Learn:** orientation to coupled cardiopulmonary and organ-support effects.
- **Practice:** six guided, longitudinal scenario families with hints and causal debriefs.
- **Assess:** masked seeded variants without answer cues.
- **Sandbox:** bounded experimentation from reviewed synthetic presets; never real-patient input.

The six scenario families are septic shock with ARDS and AKI, LV cardiogenic shock, massive PE
with RV shock, active hemorrhagic shock, evolving cardiac tamponade, and mixed
cardiogenic-vasodilatory shock.

Practice and Assess use a fixed six-domain score: assessment 15, prioritization 15, therapy 20,
device management 20, reassessment 20, and safety 10. Mastery requires at least 80 points, no
critical error, the authored longitudinal checkpoints, serial reassessment, and a case-specific
modeled-response gate. The response gate prevents action-only completion: a learner must also
demonstrate the reviewed synthetic physiologic response or one complete authored alternative path.
Alternative-path score substitutions never alter the learner's action history or replay.

## Educational boundary

This module is for supervised education with synthetic adult ICU patients. It is not a clinical
decision-support system, dosing reference, device operator manual, or substitute for local
protocols and expert teams. Device deployment represents a readiness and team-activation decision;
the module does not teach cannulation, vascular access, intubation, drain placement, or other
invasive technique.

Medication actions use relative educational tiers. Device settings may use sourced numeric controls
within bounded simulation ranges. No real-patient identifiers, clinical free text, waveforms, live
physiology, or detailed command histories may be sent to analytics.

## Future spatial and VR presentation

V1 is a browser bedside simulation, not a VR application. The optional focused 3D bedside is a
presentation layer over the same semantic commands, canonical patient, worker protocol, and replay.
Those presentation-independent boundaries are intended to support a later ICU-room VR interface
without creating a second clinical engine. A future spatial interface must retain the same
educational limits: abstract team/readiness decisions and setting adjustments, not invasive
procedural instruction.

## Evidence and review

Every scenario, device fact, physiologic effect, modeled-response predicate, score substitution, and
critical-error rule must reference versioned evidence and carry an explicit review status. Primary
evidence families include
the ESICM circulatory shock and hemodynamic-monitoring guideline, Surviving Sepsis Campaign adult
guidance, ELSO guidelines, ATS ARDS guidance, KDIGO AKI/AKD guidance, reviewed device manuals, and
the evidence registries already maintained by the five source modules.

The route must remain private and unlisted until the integrated engine, every released scenario,
and every enabled device path have the sign-offs in `review-checklist.md`.
