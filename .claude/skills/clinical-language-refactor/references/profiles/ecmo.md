# Critical care: ECMO language profile

## Scope and source status

CC-05 is an ECMO overview with circuit, cannulation, support-category, weaning, and historical outcomes/financial discussion. It supplies useful nomenclature, but is not a complete contemporary troubleshooting curriculum. Its device costs, numeric indications, local setup methods, cannula assumptions, and support-duration statements must not become defaults from a language pass.

## Source-anchored terminology

| Context                    | Vocabulary to prefer when the referent is established                                   | Source anchor                                |
| -------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| Support categories         | VV ECMO, VA ECMO; venovenous/venoarterial terminology as confirmed in module references | CC-05, 17:22–18:13, source lines 16283–16315 |
| Circuit components         | ECMO circuit, oxygenator, centrifugal pump, tubing                                      | CC-05, 15:12–16:09, 16209–16241              |
| Cannulation                | access/drainage cannula, return cannula, cannulation configuration                      | CC-05, 17:47–20:22, 16299–16395              |
| Recirculation              | recirculation, relationship of drainage and return                                      | CC-05, 18:13–20:22, 16315–16395              |
| Cardiac support discussion | afterload, ventricular decompression, native circulation                                | CC-05, 26:08–28:21, 16593–16681              |
| Gas-side control           | sweep gas; oxygen fraction when the device variable is identified                       | CC-05, 50:07–50:39, 17493–17513              |
| Purpose of support         | bridge to decision, bridge to transplant, recovery discussion                           | CC-05, 10:15–11:38, 16031–16083              |

This is normalized terminology. The editor should verify exact spelling and definitions against the target module's sources before teaching the term; the table does not endorse all surrounding source assertions.

## Do not import imaging vocabulary restrictions

**Sweep** is a legitimate term here. Do not replace it with “acquisition” or remove it because “the sweep” was a weak navigation title in a different module. Likewise, circuit, flow, pressure, support, access, and return can be precise terms rather than vague abstractions.

Prefer “sweep gas flow” on a control when the implemented variable is gas flow and has corresponding units. If the module has not established that meaning, inspect the binding before changing the label.

## Preserve device-side versus patient-side meaning

Describe which circuit or patient value is set, measured, estimated, or simulated. A pump-speed setting is not a measured blood-flow value; an oxygenator/circuit observation is not automatically a patient clinical outcome. These are editorial distinction checks that must be resolved from the module's existing model and references, not by adding new physiology.

Do not treat all venous-return configurations or all cannulation sites as interchangeable. Maintain the route, compartment, laterality, and sample location already shown. Avoid naming a pressure or saturation more specifically than the source/data allows.

Keep VV and VA contexts separate. Do not transfer a troubleshooting instruction, gas-setting rule, or support claim from one to the other simply to achieve uniform wording.

## Examples of the intended voice

Authored illustrations, not quotations or independent management advice:

- “Turn up the circuit's help” → name the actual existing control and action; otherwise flag ambiguity.
- “The number at the pump is flow” → “The pump-speed readout…” or “The measured circuit blood flow…” only after checking which quantity is displayed.
- “Recycled support” → “recirculation,” when that is the explicit phenomenon, with its existing explanation retained.
- “The machine fixes the lungs” → do not apply as a stylistic rewrite; this is an E2 content claim requiring review.
- “The gas control” → “sweep gas flow,” only for the corresponding implemented gas-flow control.

## Source claims that require a separate review

Do not import fixed ECMO eligibility criteria, recirculation percentages, an assumed maximum support duration, specific cannulation recommendations, anticoagulation doses, weaning steps, or absolute rules about mobility from this overview. Do not transfer the speaker's discussion of durable devices and destination therapy into a generic ECMO indication.

If the module already contains one of these claims and it appears questionable, cite its exact location and the conflicting/insufficient source context. Continue independent E0/E1 language work; leave the clinical determination to an authorized review.
