# CARDIOHELP-i Adult VV & Peripheral VA ECMO Lab Review Checklist

Status: draft-only. The route must remain behind the site draft-module guard until both reviewer groups sign off.

## Fixed target profile

- Device: CARDIOHELP-i, United States configuration.
- IFU: revision 2.3, January 2025.
- Software: 03.04.10.00 or higher.
- thApp: Cardiopulmonary Support.
- Draft clinical content: adult VV ECMO and peripheral femoral VA ECMO.

The supplied U.S. labeling covers partial cardiopulmonary bypass or temporary surgical circulatory bypass for less than six hours. The IFU is used only to reproduce console behavior. Adult ECMO physiology and management reasoning must be reviewed against the supplied textbook chapters, current ELSO guidance, and local protocols.

## CARDIOHELP-trained device reviewer

- [ ] Confirm startup/self-test sequence and learner lockouts.
- [ ] Confirm startup, parameter-list, blood-parameter, transport, intervention, timer, menu, and six-item alarm-history screens.
- [ ] Confirm physical lock, zero-flow, safety, power, battery, and rotary-control behavior.
- [ ] Confirm touch requires a simultaneous Safety-plus-control hold and the documented keyboard chord (hold Space, then Z/G) preserves the same interlock without implying a timed latch.
- [ ] Confirm RPM/LPM behavior and automatic RPM fallback after flow-sensor failure.
- [ ] Confirm pVen, pInt, and pArt pressure-intervention warning, RPM-adjustment, pump-stop, and recovery behavior.
- [ ] Confirm backflow alarm escalation and automatic zero-flow protection.
- [ ] Confirm timers require explicit start/stop/reset actions.
- [ ] Confirm alarm acknowledgement does not imply correction.
- [ ] Confirm arterial-bubble cause-before-reset and pump-restart workflow.
- [ ] Confirm transport battery escalation and backup-readiness language.
- [ ] Confirm Global Override remains visibly hazardous and is never presented as routine troubleshooting.
- [ ] Confirm service/password surfaces and unsupported thApps are absent.
- [ ] Confirm the module does not encode a numerical bubble-size threshold.
- [ ] Confirm delta-p is taught as a trend without a fixed alarm-priority claim.
- [ ] Confirm original CSS/SVG artwork does not reproduce manual screenshots or manufacturer artwork.
- [ ] Confirm the visible module-level statement says this independent educational work is not manufactured, sponsored, or endorsed by Getinge.

## Adult ECMO clinician reviewer

- [ ] Confirm the audience and supervised-training disclaimer.
- [ ] Confirm Learn walks through observation, interpretation, safe response, and three-domain reassessment without scoring or changing Practice mastery.
- [ ] Confirm Practice removes answer cues and still requires the learner to choose and adjust controls independently.
- [ ] Confirm every scenario requires a patient/safety goal before a control change.
- [ ] Confirm preload-limited drainage pattern, corrective sequence, and critical RPM-escalation error.
- [ ] Confirm return obstruction versus oxygenator-resistance pressure patterns.
- [ ] Confirm VV recirculation uses effective support rather than displayed flow alone.
- [ ] Confirm VV and VA use separate scenario, lesson, assessment, and mastery registries.
- [ ] Confirm the femoral-femoral schematic distinguishes venous drainage, VV venous return, and VA arterial return without teaching cannulation technique.
- [ ] Confirm circuit pArt is clearly separated from patient arterial-line pressure and MAP.
- [ ] Confirm peripheral VA differential oxygenation uses right-arm data, post-oxygenator data, native ejection, and lung status without prescribing one universal correction.
- [ ] Confirm VA LV-loading recognition uses pulsatility, aortic-valve opening, pulmonary/echo findings, and expert escalation without selecting an unloading device.
- [ ] Confirm VA cannulated-limb perfusion is explicitly independent of stable console flow and no procedural correction is simulated.
- [ ] Confirm acute and compensated hypercapnia cases are phase-aware and use pH/bicarbonate context.
- [ ] Confirm sweep flow and sweep-gas FiO2 are clearly separate external controls.
- [ ] Confirm gas-source interruption and independent patient reassessment sequence.
- [ ] Confirm the unseen VV off-sweep capstone maintains circuit blood flow and assesses SpO2, work of breathing, then PaCO2/pH.
- [ ] Confirm the unseen VA capstone never transfers the VV off-sweep sequence into VA management.
- [ ] Confirm VA cannulation, distal-perfusion procedures, unloading-device selection, numeric treatment targets, and VA weaning remain outside this draft simulator.
- [ ] Confirm bounded response curves are directionally useful and visibly labeled as simulated, not patient-specific.
- [ ] Confirm mastery rules: at least 80 percent and no critical safety error.

## Accessibility, localization, and release

- [ ] Keyboard-test touchscreen navigation and rotary Arrow keys.
- [ ] Verify 44-pixel minimum touch targets and visible focus states.
- [ ] Verify alarm severity is conveyed by text/icon as well as color and optional audio.
- [ ] Verify reduced-motion mode stops alarm flashing, tubing motion, and rotor motion.
- [ ] Verify screen-reader alarm announcements and SVG text equivalents.
- [ ] Verify Spanish and Simplified Chinese routes show the reviewed-English fallback until translated clinical review is signed.
- [ ] Verify progress contains no PHI and remains in `cardiohelp-ecmo-progress-v1` only.
- [ ] Verify Learn completion is session-only and cannot unlock the unseen Practice capstone.
- [ ] Verify only aggregate analytics events are sent.
- [ ] Verify the module remains absent from homepage and primary navigation before publication approval.

## Sign-off

- CARDIOHELP-trained reviewer: ********\_\_\_\_******** Date: ****\_\_****
- Adult ECMO clinician reviewer: ********\_\_******** Date: ****\_\_****
- Accessibility/localization reviewer: ******\_****** Date: ****\_\_****
- Publication approval: ************\_\_\_\_************ Date: ****\_\_****
