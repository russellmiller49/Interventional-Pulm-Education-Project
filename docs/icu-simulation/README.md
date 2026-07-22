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

## Educational boundary

This module is for supervised education with synthetic adult ICU patients. It is not a clinical
decision-support system, dosing reference, device operator manual, or substitute for local
protocols and expert teams. Device deployment represents a readiness and team-activation decision;
the module does not teach cannulation, vascular access, intubation, drain placement, or other
invasive technique.

Medication actions use relative educational tiers. Device settings may use sourced numeric controls
within bounded simulation ranges. No real-patient identifiers, clinical free text, waveforms, live
physiology, or detailed command histories may be sent to analytics.

## Evidence and review

Every scenario, device fact, physiologic effect, success predicate, and critical-error rule must
reference versioned evidence and carry an explicit review status. Primary evidence families include
the ESICM circulatory shock and hemodynamic-monitoring guideline, Surviving Sepsis Campaign adult
guidance, ELSO guidelines, ATS ARDS guidance, KDIGO AKI/AKD guidance, reviewed device manuals, and
the evidence registries already maintained by the five source modules.

The route must remain private and unlisted until the integrated engine, every released scenario,
and every enabled device path have the sign-offs in `review-checklist.md`.
