import type {
  ReassessmentOption,
  ScenarioDefinition,
  ScenarioHint,
  ScenarioReassessmentDefinition,
} from '../engine/types'

interface ClinicalPracticeSupport {
  reassessment: ScenarioReassessmentDefinition
  hints: readonly ScenarioHint[]
}

/**
 * One reassessment choice.
 *
 * The rationale is rendered only in the debrief, beside the option the learner recorded and the
 * one the model expected, so it may name the diagnosis and the mechanism. It never appears before
 * the reveal. Every authored option carries one; the key is omitted rather than set to undefined
 * so an option without a rationale is shaped exactly as before.
 */
const option = (id: string, label: string, rationale?: string): ReassessmentOption =>
  rationale === undefined ? { id, label } : { id, label, rationale }

export const clinicalPracticeSupportByScenarioId: Readonly<
  Record<string, ClinicalPracticeSupport>
> = {
  'clinical-vv-initiation-ards': {
    reassessment: {
      instruction:
        'Select the post-initiation finding in each domain that best demonstrates effective VV support.',
      device: {
        prompt: 'Which console finding is most consistent with the intended response?',
        options: [
          option(
            'vv-init-device-correct',
            'Ordered RPM is set, the pump is running, and forward flow is established.',
            'With the circuit connected and the ordered RPM set, Start ECMO produces a running pump and measured forward flow. That is the console picture the modeled initiation produces.',
          ),
          option(
            'vv-init-device-stopped',
            'The pump remains stopped with zero forward flow.',
            'A prepared circuit left idle while ventilator pressure is escalated is the harmful path in this case: airway pressure climbs and gas exchange keeps worsening. A stopped pump moves no blood.',
          ),
          option(
            'vv-init-device-rpm-only',
            'RPM is increased repeatedly without checking drainage or measured flow.',
            'Turning the speed up without watching drainage or measured flow treats RPM as if it were flow. Speed is the order; flow is the response, and only the flow reading shows that blood is moving.',
          ),
        ],
        correctOptionId: 'vv-init-device-correct',
      },
      circuit: {
        prompt: 'Which circuit finding should be documented?',
        options: [
          option(
            'vv-init-circuit-correct',
            'VV drainage and return are connected with stable forward flow and plausible pressures.',
            'Connected drainage and return limbs with steady forward flow and plausible pVen, pInt, and pArt are the circuit-side evidence that support is running rather than merely ordered.',
          ),
          option(
            'vv-init-circuit-no-return',
            'The drainage limb fills, but no return flow reaches the patient.',
            'A filling drainage limb with no return flow would mean an obstruction or an unopened path downstream of the pump. The model shows return flow reaching the patient once the pump starts.',
          ),
          option(
            'vv-init-circuit-console-only',
            'The displayed RPM alone confirms that the entire circuit is functioning, because a pump that is turning must be moving blood.',
            'A turning impeller is not proof of flow: a centrifugal pump can spin against a clamp or an empty inlet and move little blood. The flow probe and the limb pressures show whether the circuit is working.',
          ),
        ],
        correctOptionId: 'vv-init-circuit-correct',
      },
      patient: {
        prompt: 'Which patient response best supports successful initiation?',
        options: [
          option(
            'vv-init-patient-correct',
            'SpO₂ improves and PaCO₂/pH begin correcting while work of breathing eases.',
            'The modeled patient responds to forward VV flow with a rising SpO₂ and a PaCO₂ and pH that drift toward the case targets over simulated time, easing the work of breathing.',
          ),
          option(
            'vv-init-patient-map-only',
            'MAP is unchanged, so gas-exchange support has failed.',
            'MAP was never the problem here; this patient has preserved circulatory pressure and a gas-exchange deficit. VV support does not target MAP, so an unchanged MAP says nothing about whether it is working.',
          ),
          option(
            'vv-init-patient-flow-only',
            'Displayed circuit flow improves; no bedside or blood-gas reassessment is needed.',
            'Displayed flow shows that blood is moving through the circuit, not that the patient is better. The case judges success from oxygenation, PaCO₂/pH, and work of breathing at the bedside.',
          ),
        ],
        correctOptionId: 'vv-init-patient-correct',
      },
    },
    hints: [
      {
        id: 'vv-init-pattern',
        title: 'Clue 1 · Separate the orders from the response',
        text: 'The case supplies three machine orders, but success must still be confirmed from forward flow, pressures, oxygenation, PaCO₂/pH, and work of breathing.',
        penalty: 5,
        target: 'patient-monitor',
        controlId: 'cardiohelp-patient-monitor',
        focusId: 'cardiohelp-patient-monitor',
      },
      {
        id: 'vv-init-action',
        title: 'Clue 2 · Configure before starting',
        text: 'Complete readiness and connection, then set the ordered RPM on the console and the ordered sweep and FiO₂ on the gas blender before selecting Start ECMO.',
        penalty: 10,
        target: 'console',
        controlId: 'cardiohelp-rpm-control',
        focusId: 'cardiohelp-rpm-control',
      },
    ],
  },
  'clinical-vv-occult-hemorrhage': {
    reassessment: {
      instruction:
        'Select the findings that demonstrate safer drainage, restored circulating volume, and improving perfusion after hemorrhage control.',
      device: {
        prompt: 'Which console response is most appropriate?',
        options: [
          option(
            'hem-device-correct',
            'Pump demand was reduced on the console and pVen becomes less negative without chasing RPM.',
            'Reducing pump demand on the console is the modeled first move: pVen becomes less negative and chatter eases, while the volume deficit is treated separately.',
          ),
          option(
            'hem-device-increase',
            'RPM was increased until the displayed flow briefly rose.',
            'Chasing the flow number with more RPM is the drainage-collapse reflex. The pump pulls harder on an empty vein, so pVen goes more negative and chatter worsens; any rise in displayed flow is brief.',
          ),
          option(
            'hem-device-ack',
            'The low-flow alarm was acknowledged; no machine or patient change was needed.',
            'Acknowledging the alarm silences the console and changes nothing in the patient. Hemoglobin, CVP, and pVen were all moving in the same direction, so a machine or patient action was needed.',
          ),
        ],
        correctOptionId: 'hem-device-correct',
      },
      circuit: {
        prompt: 'Which circuit response supports recovery?',
        options: [
          option(
            'hem-circuit-correct',
            'Drainage chatter eases, pVen recovers, and effective flow improves after resuscitation and source control.',
            'Once blood products restore preload and the source is controlled, the modeled circuit shows chatter easing, pVen recovering, and effective flow returning without extra RPM.',
          ),
          option(
            'hem-circuit-worse',
            'pVen becomes more negative and chatter persists despite higher RPM — the expected cost of holding flow while circulating volume is still low.',
            'Holding flow with higher RPM while circulating volume is low does not buy stability; it deepens the suction events. Worsening pVen and chatter are the signal that the pump is fighting an empty vein.',
          ),
          option(
            'hem-circuit-pressure-only',
            'pArt alone normalizes, proving that blood loss has stopped.',
            'pArt reflects return-side resistance and pump output, not the patient’s blood volume. It can look normal while the drainage limb chatters and hemoglobin keeps falling.',
          ),
        ],
        correctOptionId: 'hem-circuit-correct',
      },
      patient: {
        prompt: 'Which patient trend demonstrates meaningful improvement?',
        options: [
          option(
            'hem-patient-correct',
            'Hemoglobin and MAP recover and lactate begins falling after hemostatic resuscitation and bleeding control.',
            'After hemostatic resuscitation and source control the model shows hemoglobin and MAP recovering and lactate starting to fall — perfusion improving, not just pressure.',
          ),
          option(
            'hem-patient-pressor-only',
            'MAP rises briefly with vasopressor alone while hemoglobin and lactate worsen, a sign that perfusion pressure has been secured.',
            'Vasopressor alone raises MAP for a moment while hemoglobin and lactate keep worsening. A pressure gained by squeezing an empty circulation is not perfusion; the case treats it as an ineffective delay.',
          ),
          option(
            'hem-patient-volume-only',
            'A transient volume response confirms definitive hemorrhage control.',
            'Crystalloid gives a brief rise in flow and MAP that falls away again because bleeding continues. A transient volume response shows preload was low; it says nothing about whether the source is controlled.',
          ),
        ],
        correctOptionId: 'hem-patient-correct',
      },
    },
    hints: [
      {
        id: 'hem-pattern',
        title: 'Clue 1 · Link drainage to the patient',
        text: 'Falling hemoglobin, low CVP and MAP, increasingly negative pVen, and chatter point to lost preload—not a need for more pump speed.',
        penalty: 5,
        target: 'circuit',
        controlId: 'cardiohelp-circuit-panel',
        focusId: 'cardiohelp-circuit-panel',
      },
      {
        id: 'hem-action',
        title: 'Clue 2 · Protect drainage while treating the cause',
        text: 'Temporarily reduce pump demand with the console, then identify the bleeding source, provide hemostatic blood support, and obtain definitive control.',
        penalty: 10,
        target: 'console',
        controlId: 'cardiohelp-rpm-control',
        focusId: 'cardiohelp-rpm-control',
      },
    ],
  },
  'clinical-vv-tension-pneumothorax': {
    reassessment: {
      instruction:
        'Select the findings expected after definitive pleural decompression rather than temporary preload support.',
      device: {
        prompt: 'Which device response is most consistent with correction?',
        options: [
          option(
            'tension-device-correct',
            'Flow recovers without escalating RPM as venous return improves.',
            'The model recovers flow after decompression at the same RPM, because venous return comes back once intrathoracic pressure falls. No pump change was needed.',
          ),
          option(
            'tension-device-rpm',
            'Higher RPM is required to overcome the obstructive physiology.',
            'Higher RPM cannot pull blood through an obstruction to venous return; it only makes pVen more negative and adds chatter. The obstruction is in the chest, not in the pump.',
          ),
          option(
            'tension-device-alarm',
            'Silencing the low-flow alarm resolves the obstruction.',
            'Silencing the low-flow alarm removes the sound and leaves the tension physiology in place. Flow keeps falling and CVP stays high after the acknowledgement.',
          ),
        ],
        correctOptionId: 'tension-device-correct',
      },
      circuit: {
        prompt: 'Which circuit change should follow decompression?',
        options: [
          option(
            'tension-circuit-correct',
            'Drainage stabilizes, pVen becomes less negative, and chatter resolves.',
            'Once the pleura is decompressed, drainage steadies, pVen becomes less negative, and chatter stops — the circuit response to restored venous return.',
          ),
          option(
            'tension-circuit-static',
            'Circuit pressures remain severely drainage-limited despite correction.',
            'Persistently drainage-limited pressures after decompression would mean the obstruction was not relieved or another cause is present. The modeled response to decompression is recovery.',
          ),
          option(
            'tension-circuit-oxygenator',
            'A rising oxygenator pressure gradient confirms successful decompression.',
            'The oxygenator gradient tracks membrane resistance and flow, not intrathoracic pressure. A rising Δp would signal a clotting membrane, which is unrelated to pleural decompression.',
          ),
        ],
        correctOptionId: 'tension-circuit-correct',
      },
      patient: {
        prompt: 'Which bedside response is most important?',
        options: [
          option(
            'tension-patient-correct',
            'Lung sliding returns, airway pressure and CVP fall, and MAP improves.',
            'Bilateral lung sliding returns and airway pressure falls in the modeled response, and CVP falls as MAP rises — the bedside picture of relieved obstruction.',
          ),
          option(
            'tension-patient-volume',
            'MAP rises briefly after volume while unilateral absent sliding persists.',
            'Volume produces a brief, minimal rise in MAP while the right hemithorax still shows no sliding. A short-lived response with a persistent obstructive sign means the cause is untreated.',
          ),
          option(
            'tension-patient-spo2-only',
            'A single SpO₂ value excludes persistent obstructive shock.',
            'One SpO₂ reading cannot exclude obstructive shock: on VV support the membrane can hold saturation up while venous return and MAP collapse. Sliding, CVP, and airway pressure carry the diagnosis.',
          ),
        ],
        correctOptionId: 'tension-patient-correct',
      },
    },
    hints: [
      {
        id: 'tension-pattern',
        title: 'Clue 1 · Look beyond the drainage limb',
        text: 'Abrupt low flow plus rising airway pressure, unilateral absent sliding, hypotension, and elevated CVP is an obstructive patient problem.',
        penalty: 5,
        target: 'patient-monitor',
        controlId: 'cardiohelp-patient-monitor',
        focusId: 'cardiohelp-patient-monitor',
      },
      {
        id: 'tension-action',
        title: 'Clue 2 · Temporary support is not definitive care',
        text: 'Volume or vasopressor may briefly support pressure, but the required action is urgent pleural decompression through the supervised local pathway.',
        penalty: 10,
        focusId: 'practice-treatment',
      },
    ],
  },
  'clinical-vv-recirculation-migration': {
    reassessment: {
      instruction:
        'Select evidence that effective systemic VV support improved after correcting the cannula relationship.',
      device: {
        prompt: 'Which console observation is most useful?',
        options: [
          option(
            'recirc-device-correct',
            'Displayed flow remains adequate without escalating RPM to chase the number.',
            'After repositioning, the model improves systemic saturation at a similar displayed flow. The console number barely changes; what changed is how much of that flow reaches the patient.',
          ),
          option(
            'recirc-device-rpm',
            'A higher RPM and higher displayed flow prove systemic support improved.',
            'More RPM raises displayed flow and, in this case, lowers SpO₂: the extra return blood is recaptured by the nearby drainage cannula. Displayed flow rising while saturation falls is the recirculation signature.',
          ),
          option(
            'recirc-device-flow-only',
            'The flow number alone excludes recirculation.',
            'The flow probe measures blood moving through the circuit, including the fraction that loops straight back to the drainage cannula. Displayed flow cannot see recirculation at all.',
          ),
        ],
        correctOptionId: 'recirc-device-correct',
      },
      circuit: {
        prompt: 'Which circuit finding supports correction?',
        options: [
          option(
            'recirc-circuit-correct',
            'Cannula separation and return direction are restored and pre-oxygenator saturation moves toward a venous value.',
            'With the cannulas separated and the return jet redirected, pre-oxygenator saturation drifts back toward a venous value — the circuit is again drawing deoxygenated blood.',
          ),
          option(
            'recirc-circuit-bright',
            'Drainage blood becomes brighter and pre-oxygenator saturation rises further, showing the circuit now draws better-oxygenated blood.',
            'Bright drainage blood is the problem, not progress: it means oxygenated return blood is being drawn straight back in. A rising pre-oxygenator saturation shows the recirculated fraction is growing.',
          ),
          option(
            'recirc-circuit-post',
            'Post-oxygenator saturation remains high, which alone excludes recirculation.',
            'Post-oxygenator saturation stays high in recirculation because the membrane is working perfectly. It answers whether the oxygenator is intact, not where its blood goes afterwards.',
          ),
        ],
        correctOptionId: 'recirc-circuit-correct',
      },
      patient: {
        prompt: 'Which patient response confirms more effective support?',
        options: [
          option(
            'recirc-patient-correct',
            'Systemic SpO₂ improves after cannula repositioning without simply increasing displayed flow.',
            'Systemic SpO₂ recovers after repositioning while displayed flow is little changed — the modeled sign that effective flow, not total flow, was the missing quantity.',
          ),
          option(
            'recirc-patient-worse',
            'SpO₂ falls as RPM and recaptured return flow increase.',
            'Falling SpO₂ as RPM rises is what the case shows when speed is increased against recirculation: more return blood is recaptured before it reaches the patient.',
          ),
          option(
            'recirc-patient-none',
            'No patient reassessment is needed if post-oxygenator blood remains saturated, since the circuit is delivering fully oxygenated blood.',
            'Saturated post-oxygenator blood proves only that the membrane is oxygenating. Whether that blood reaches the systemic circulation is a patient question, answered by SpO₂ and arterial gases.',
          ),
        ],
        correctOptionId: 'recirc-patient-correct',
      },
    },
    hints: [
      {
        id: 'recirc-pattern',
        title: 'Clue 1 · Ask where the oxygenated blood goes',
        text: 'High displayed flow and excellent post-oxygenator saturation can coexist with poor systemic support when oxygenated return blood is recaptured.',
        penalty: 5,
        target: 'circuit',
        controlId: 'cardiohelp-circuit-panel',
        focusId: 'cardiohelp-circuit-panel',
      },
      {
        id: 'recirc-action',
        title: 'Clue 2 · Correct geometry, not the display',
        text: 'Compare patient, pre-, and post-oxygenator blood; assess cannula position and return direction; then arrange image-guided repositioning.',
        penalty: 10,
        focusId: 'practice-treatment',
      },
    ],
  },
  'clinical-vv-gas-disconnection': {
    reassessment: {
      instruction:
        'Select the post-correction findings that distinguish restored gas transfer from unchanged blood-side support.',
      device: {
        prompt: 'Which console observation should remain true?',
        options: [
          option(
            'gas-device-correct',
            'RPM, blood flow, and blood-side pressures remain stable; the primary failure was not the pump.',
            'RPM, blood flow, and pVen/pArt stay where they were when the gas side alone is treated, because the blood side was never the problem. The fix lived on the gas panel, not the console.',
          ),
          option(
            'gas-device-rpm',
            'A large RPM increase is what restores CO₂ clearance.',
            'Raising RPM in this case left PaCO₂ almost unchanged and pushed pVen more negative. CO₂ clearance is set by sweep gas at the membrane; blood flow cannot substitute for gas that is not there.',
          ),
          option(
            'gas-device-flow-loss',
            'Blood flow must fall to zero whenever sweep gas is disconnected, because the pump cannot run without gas at the membrane.',
            'Blood flow and gas flow are separate circuits. The pump kept turning at full flow with the gas line off; the only thing that stopped was CO₂ leaving the blood.',
          ),
        ],
        correctOptionId: 'gas-device-correct',
      },
      circuit: {
        prompt: 'Which gas/circuit observation confirms correction?',
        options: [
          option(
            'gas-circuit-correct',
            'The verified gas source is connected and ordered sweep flow is present at the oxygenator.',
            'The source is reconnected and sweep flow is present again at the oxygenator inlet; the modeled membrane resumes clearing CO₂ from that moment.',
          ),
          option(
            'gas-circuit-fio2-only',
            'Changing FiO₂ alone restores gas flow through disconnected tubing.',
            'FiO₂ sets the composition of the gas, not whether any gas is flowing. Changing the blender fraction on a disconnected line delivers nothing to the membrane.',
          ),
          option(
            'gas-circuit-ack',
            'Acknowledging the alarm confirms that the gas pathway is restored, since the console would alarm again if gas were still absent.',
            'Acknowledging an alarm shows only that someone pressed the button. A gas pathway is confirmed by tracing it end to end and seeing flow at the oxygenator inlet.',
          ),
        ],
        correctOptionId: 'gas-circuit-correct',
      },
      patient: {
        prompt: 'Which blood-gas trend demonstrates recovery?',
        options: [
          option(
            'gas-patient-correct',
            'PaCO₂ begins falling and pH begins recovering over time after sweep is restored.',
            'PaCO₂ falls and pH recovers over simulated time after sweep returns — a gradual trend, because the CO₂ load washes out at the rate the membrane clears it.',
          ),
          option(
            'gas-patient-instant',
            'PaCO₂ and pH normalize instantly as soon as the source is reconnected.',
            'Blood gases do not normalize the moment the line is reconnected. Expecting an instant number is the misreading that leads to over-titrating sweep before the trend has declared itself.',
          ),
          option(
            'gas-patient-spo2',
            'An unchanged early SpO₂ proves that CO₂ clearance is adequate.',
            'SpO₂ lagged through this event: when sweep is lost, oxygenation declines later than CO₂ clearance. Saturation is the last signal to move in a CO₂ problem and cannot stand in for PaCO₂.',
          ),
        ],
        correctOptionId: 'gas-patient-correct',
      },
    },
    hints: [
      {
        id: 'gas-pattern',
        title: 'Clue 1 · Separate blood flow from gas flow',
        text: 'Rapid hypercapnia with unchanged RPM, blood flow, and circuit pressures points to the gas pathway rather than the blood pump.',
        penalty: 5,
        target: 'gas-panel',
        controlId: 'cardiohelp-gas-panel',
        focusId: 'cardiohelp-gas-panel',
      },
      {
        id: 'gas-action',
        title: 'Clue 2 · Trace, restore, then set sweep',
        text: 'Inspect the source-to-oxygenator gas path, restore the verified source on the gas panel, and set the supplied case sweep before reassessing PaCO₂/pH.',
        penalty: 10,
        target: 'gas-panel',
        controlId: 'cardiohelp-restore-gas-source',
        focusId: 'cardiohelp-restore-gas-source',
      },
    ],
  },
  'clinical-vv-oxygenator-thrombosis': {
    reassessment: {
      instruction:
        'Select findings that demonstrate restoration of membrane-lung function after the reviewed exchange process.',
      device: {
        prompt: 'Which console response is appropriate?',
        options: [
          option(
            'vv-oxy-device-correct',
            'Required flow is maintained without escalating RPM against a resistant oxygenator.',
            'The modeled fix is a component exchange, not a speed change: flow is held at the existing RPM while the team prepares, and recovers once the resistant membrane is replaced.',
          ),
          option(
            'vv-oxy-device-rpm',
            'RPM is increased until pInt rises further, since more drive pressure is what pushes blood through a resistant membrane.',
            'Pushing RPM against a clotted membrane raised pInt with little extra flow and more hemolysis concern. Drive pressure is being spent shearing blood against clot, not moving it.',
          ),
          option(
            'vv-oxy-device-delta',
            'The console Δp number alone proves thrombus location and severity.',
            'Δp is one number from two sensors, and it rises with flow as well as with clot. The diagnosis needed the pressure pattern plus pre/post gas transfer plus the visible fibrin.',
          ),
        ],
        correctOptionId: 'vv-oxy-device-correct',
      },
      circuit: {
        prompt: 'Which circuit trend supports successful exchange?',
        options: [
          option(
            'vv-oxy-circuit-correct',
            'pInt and Δp fall and post-oxygenator gas transfer improves with the replacement membrane lung.',
            'With the replacement membrane in the circuit, pInt and Δp fall and post-oxygenator gas transfer normalizes — the modeled circuit response to the exchange.',
          ),
          option(
            'vv-oxy-circuit-worse',
            'pInt and Δp continue rising with declining post-oxygenator saturation.',
            'A gradient still climbing with post-oxygenator saturation still falling is the untreated trajectory. It is what the case shows while the exchange is delayed.',
          ),
          option(
            'vv-oxy-circuit-part',
            'A normal pArt alone excludes oxygenator dysfunction, because blood leaving the membrane at normal pressure has crossed it freely.',
            'pArt is measured after the membrane, so it reflects return-limb resistance. Blood can leave a clotted oxygenator at a normal pArt while pInt climbs upstream; the gradient, not pArt alone, carries the story.',
          ),
        ],
        correctOptionId: 'vv-oxy-circuit-correct',
      },
      patient: {
        prompt: 'Which patient response should accompany circuit recovery?',
        options: [
          option(
            'vv-oxy-patient-correct',
            'Oxygenation and gas exchange improve while perfusion remains supported.',
            'Once gas transfer is restored the patient’s oxygenation improves and hemolysis markers stop rising, while flow support is maintained throughout the exchange.',
          ),
          option(
            'vv-oxy-patient-flow-only',
            'Displayed flow improves, so no blood gas or hemolysis reassessment is needed.',
            'Displayed flow recovering after exchange says the new membrane offers less resistance. Whether it is oxygenating and whether hemolysis has stopped are blood-gas and laboratory questions.',
          ),
          option(
            'vv-oxy-patient-worse',
            'Hypoxemia and hemolysis markers continue worsening after exchange.',
            'Continued hypoxemia and hemolysis after exchange would mean the new component is not performing or another cause exists. The modeled exchange reverses both trends.',
          ),
        ],
        correctOptionId: 'vv-oxy-patient-correct',
      },
    },
    hints: [
      {
        id: 'vv-oxy-pattern',
        title: 'Clue 1 · Compare both sides of the membrane lung',
        text: 'A rising pInt-to-pArt gradient plus worsening post-oxygenator gas transfer is different from an isolated return obstruction.',
        penalty: 5,
        target: 'circuit',
        controlId: 'cardiohelp-circuit-panel',
        focusId: 'cardiohelp-circuit-panel',
      },
      {
        id: 'vv-oxy-action',
        title: 'Clue 2 · Prepare before definitive exchange',
        text: 'Verify the trend and gas-transfer failure, mobilize the replacement circuit and trained team, then perform the reviewed emergency exchange process.',
        penalty: 10,
        focusId: 'practice-treatment',
      },
    ],
  },
  'va-clinical-initiation-shock': {
    reassessment: {
      instruction:
        'Select the post-initiation findings that demonstrate effective VA support and mode-specific surveillance.',
      device: {
        prompt: 'Which console response supports successful initiation?',
        options: [
          option(
            'va-init-device-correct',
            'The pump runs at the supplied RPM with stable forward VA flow.',
            'With the circuit connected and the supplied RPM set, Start ECMO gives a running pump and steady forward VA flow. The console shows the order carried out, not yet the patient’s response.',
          ),
          option(
            'va-init-device-stopped',
            'The pump remains stopped while pharmacologic support alone is escalated.',
            'Escalating vasopressor while the prepared circuit sits idle raises MAP briefly and lets lactate and oliguria worsen: tone without forward flow does not perfuse organs.',
          ),
          option(
            'va-init-device-max',
            'Maximum RPM is selected without reassessing drainage or native ejection.',
            'Maximum RPM without checking drainage or native ejection risks suction events and a fully unloaded LV. The supplied RPM is an order to reach and then reassess from, not a floor to exceed.',
          ),
        ],
        correctOptionId: 'va-init-device-correct',
      },
      circuit: {
        prompt: 'Which circuit finding should be documented?',
        options: [
          option(
            'va-init-circuit-correct',
            'Venous drainage and arterial return are intact with plausible pressures and distal-perfusion monitoring in place.',
            'Intact venous drainage and femoral arterial return with plausible pressures, plus distal-perfusion monitoring in place, is the circuit picture VA initiation must produce before it is called established.',
          ),
          option(
            'va-init-circuit-vv',
            'Venous return to the right atrium confirms adequate VA arterial support.',
            'Return to the right atrium describes VV support. In VA the return cannula sits in the femoral artery; venous return would leave the heart unsupported and the shock untreated.',
          ),
          option(
            'va-init-circuit-flow-only',
            'A displayed flow number makes arterial-return and limb checks unnecessary, since blood that is flowing must be reaching the patient and the leg.',
            'Flow into the femoral artery runs backward up the aorta while the leg downstream of the cannula is starved. The flow number cannot see the distal limb; only limb monitoring can.',
          ),
        ],
        correctOptionId: 'va-init-circuit-correct',
      },
      patient: {
        prompt: 'Which patient response best demonstrates effective VA support?',
        options: [
          option(
            'va-init-patient-correct',
            'MAP and organ perfusion begin recovering while lactate, pulsatility, right-arm oxygenation, and limb perfusion are trended.',
            'MAP recovers and lactate stops rising as forward VA flow perfuses the organs, while right-arm oxygenation, pulsatility, and the cannulated leg are trended for mode-specific harm.',
          ),
          option(
            'va-init-patient-map-only',
            'MAP rises, so LV loading and upper-body oxygenation no longer require assessment, because a restored pressure means both circulations are being served.',
            'A restored MAP shows the circuit is pressurizing the aorta. It says nothing about whether the LV is still ejecting, whether upper-body blood is oxygenated, or whether the leg is perfused.',
          ),
          option(
            'va-init-patient-spo2-only',
            'Femoral saturation alone confirms adequate cerebral and coronary oxygenation.',
            'Femoral blood is circuit blood and is well oxygenated on VA support. The brain and coronaries receive whatever the native heart ejects, so only right-arm oxygenation reflects them.',
          ),
        ],
        correctOptionId: 'va-init-patient-correct',
      },
    },
    hints: [
      {
        id: 'va-init-pattern',
        title: 'Clue 1 · Think perfusion plus VA-specific risks',
        text: 'The immediate goal is organ perfusion, but initiation also requires right-arm oxygenation, pulsatility/aortic opening, and cannulated-limb surveillance.',
        penalty: 5,
        target: 'patient-monitor',
        controlId: 'cardiohelp-patient-monitor',
        focusId: 'cardiohelp-patient-monitor',
      },
      {
        id: 'va-init-action',
        title: 'Clue 2 · Complete the whole start sequence',
        text: 'Complete readiness and arterial-return checks, configure the supplied console and gas orders, then start ECMO and reassess both circulations.',
        penalty: 10,
        target: 'console',
        controlId: 'cardiohelp-rpm-control',
        focusId: 'cardiohelp-rpm-control',
      },
    ],
  },
  'va-clinical-differential-hypoxemia': {
    reassessment: {
      instruction:
        'Select findings that integrate both circulations rather than relying on femoral or post-oxygenator data alone.',
      device: {
        prompt: 'Which console observation is most appropriate?',
        options: [
          option(
            'diff-device-correct',
            'VA flow remains stable while the upper-body problem is addressed without blindly escalating RPM.',
            'VA flow is held steady in the modeled path while the native lung is optimized and the support strategy is revised. The console was never the site of this problem.',
          ),
          option(
            'diff-device-rpm',
            'Higher RPM alone guarantees oxygenated blood reaches the upper body, since more retrograde flow pushes the mixing point up the aorta.',
            'The case shows the reflex directly: RPM rose, femoral saturation stayed excellent, and right-arm saturation stayed critically low. A recovering LV keeps pushing native-lung blood into the arch.',
          ),
          option(
            'diff-device-flow-only',
            'Normal displayed flow excludes differential hypoxemia.',
            'Displayed flow describes the circuit’s output. Differential hypoxemia is a mixing problem in the aorta, invisible to the console: the flow number is normal by definition in this case.',
          ),
        ],
        correctOptionId: 'diff-device-correct',
      },
      circuit: {
        prompt: 'Which paired circuit finding is essential?',
        options: [
          option(
            'diff-circuit-correct',
            'Post-oxygenator and femoral/lower-body oxygenation remain adequate despite the upper-body mismatch.',
            'Post-oxygenator and femoral oxygenation stay high because the membrane and the femoral return are working. The mismatch is upstream, where native ejection meets the circuit flow.',
          ),
          option(
            'diff-circuit-failure',
            'Poor post-oxygenator gas transfer explains both upper- and lower-body findings.',
            'If the membrane were underperforming, femoral and post-oxygenator samples would be low as well. They are excellent, which clears the oxygenator and localizes the problem to the native lung.',
          ),
          option(
            'diff-circuit-femoral',
            'A normal femoral sample proves right-arm oxygenation is adequate, because every arterial site sees the same returned blood.',
            'Arterial sites do not share one blood source in peripheral VA: the femoral artery sees circuit blood, the right arm sees native ejection. A normal femoral value cannot speak for the arch.',
          ),
        ],
        correctOptionId: 'diff-circuit-correct',
      },
      patient: {
        prompt: 'Which patient reassessment best demonstrates improvement?',
        options: [
          option(
            'diff-patient-correct',
            'Right-arm oxygenation improves while native ejection, lung function, systemic perfusion, and limb perfusion are reassessed.',
            'Right-arm oxygenation improves as native-lung gas exchange is optimized and the configuration is revised, while ejection, perfusion, and the cannulated leg are reassessed.',
          ),
          option(
            'diff-patient-femoral',
            'Femoral SpO₂ remains high, so right-arm values can be ignored.',
            'Ignoring the right arm ignores the brain and the coronaries, which receive native-lung blood. The femoral value is reassuring about the legs and misleading about everything above the mixing zone.',
          ),
          option(
            'diff-patient-pulse',
            'Pulse pressure disappears, which confirms successful upper-body oxygenation because the circuit now supplies the whole aorta unopposed.',
            'A vanishing pulse pressure means the LV has stopped ejecting, not that the upper body is oxygenated. It would also mean stasis in the LV and aortic root — a new hazard rather than a fix.',
          ),
        ],
        correctOptionId: 'diff-patient-correct',
      },
    },
    hints: [
      {
        id: 'diff-pattern',
        title: 'Clue 1 · Compare sampling locations',
        text: 'Excellent post-oxygenator and femoral oxygenation do not reassure the upper body when native ejection is poorly oxygenated.',
        penalty: 5,
        target: 'patient-monitor',
        controlId: 'cardiohelp-patient-monitor',
        focusId: 'cardiohelp-patient-monitor',
      },
      {
        id: 'diff-action',
        title: 'Clue 2 · Treat the two-circulation mismatch',
        text: 'Verify right-arm oxygenation, assess native ejection and lung function, optimize the native lung, then escalate the VA support strategy through the reviewed local pathway.',
        penalty: 10,
        focusId: 'practice-treatment',
      },
    ],
  },
  'va-clinical-tamponade': {
    reassessment: {
      instruction:
        'Select the findings expected after definitive relief of obstructive pericardial physiology.',
      device: {
        prompt: 'Which console response supports correction?',
        options: [
          option(
            'tamponade-device-correct',
            'Venous drainage and flow recover without escalating RPM against impaired filling.',
            'After surgical decompression the modeled drainage and flow recover at the existing RPM, because filling and venous return were the limit, not pump speed.',
          ),
          option(
            'tamponade-device-rpm',
            'Higher RPM overcomes tamponade and is definitive treatment, since the pump can draw blood past a compressed heart.',
            'A pump cannot draw blood that cannot reach the drainage cannula. Higher RPM against a compressed heart only makes pVen more negative and adds chatter; the effusion is unchanged.',
          ),
          option(
            'tamponade-device-ack',
            'Acknowledging low-flow alarms restores cardiac filling.',
            'Acknowledging the alarm changes the console, not the pericardium. Filling stays impaired and flow keeps falling while the collection is untreated.',
          ),
        ],
        correctOptionId: 'tamponade-device-correct',
      },
      circuit: {
        prompt: 'Which circuit response is expected?',
        options: [
          option(
            'tamponade-circuit-correct',
            'pVen becomes less negative and drainage stabilizes as venous return improves.',
            'Once compression is relieved, venous return improves and the circuit shows pVen becoming less negative with steadier drainage — the modeled response to decompression.',
          ),
          option(
            'tamponade-circuit-worse',
            'Drainage collapse persists despite decompression.',
            'Drainage collapse continuing after decompression would mean the compression was not relieved or bleeding has refilled the space. The modeled decompression restores drainage.',
          ),
          option(
            'tamponade-circuit-oxygenator',
            'A rising oxygenator Δp confirms tamponade relief, because more venous return is now crossing the membrane.',
            'The oxygenator gradient reflects membrane resistance and the flow crossing it, not pericardial pressure. A rising Δp would raise concern for clot, not signal relief.',
          ),
        ],
        correctOptionId: 'tamponade-circuit-correct',
      },
      patient: {
        prompt: 'Which patient response demonstrates relief?',
        options: [
          option(
            'tamponade-patient-correct',
            'Echo/hemodynamics improve, CVP falls, and MAP and pulsatility recover.',
            'Echo shows the chambers refilling, CVP falls, and MAP and pulse pressure recover — the patient-side picture of relieved obstruction that the case models.',
          ),
          option(
            'tamponade-patient-volume',
            'A brief volume response with persistent tamponade is definitive recovery.',
            'Volume briefly raises filling pressure while the effusion still compresses the heart; hypotension recurs quickly. A short-lived response with persistent compression is not recovery.',
          ),
          option(
            'tamponade-patient-map-only',
            'A single MAP value excludes ongoing pericardial compression.',
            'A single MAP can be propped up by vasopressor while the heart remains compressed. Ongoing compression is excluded by echo and by a falling CVP, not by one pressure value.',
          ),
        ],
        correctOptionId: 'tamponade-patient-correct',
      },
    },
    hints: [
      {
        id: 'tamponade-pattern',
        title: 'Clue 1 · Evaluate cardiac filling',
        text: 'Low drainage and hypotension with elevated CVP on VA support should trigger focused echo rather than automatic pump escalation.',
        penalty: 5,
        target: 'patient-monitor',
        controlId: 'cardiohelp-patient-monitor',
        focusId: 'cardiohelp-patient-monitor',
      },
      {
        id: 'tamponade-action',
        title: 'Clue 2 · Relieve the obstruction',
        text: 'Confirm pericardial compression and activate urgent decompression; volume or vasopressor can only temporize while definitive relief is arranged.',
        penalty: 10,
        focusId: 'practice-treatment',
      },
    ],
  },
  'va-clinical-vasoplegia': {
    reassessment: {
      instruction:
        'Select findings that support correction of vascular tone without unnecessary escalation of a functioning VA circuit.',
      device: {
        prompt: 'Which console observation best fits the corrected strategy?',
        options: [
          option(
            'vaso-device-correct',
            'VA flow remains adequate at the prior setting; RPM is not escalated to treat vascular tone.',
            'The modeled path leaves RPM where it was: flow was already adequate, so the console had nothing to add. MAP responds to vasopressor and source treatment, not to the pump.',
          ),
          option(
            'vaso-device-rpm',
            'RPM is increased to target extreme flow as the primary treatment for vasoplegia.',
            'Chasing an extreme flow target treats a tone problem as a flow problem. In this case the extra RPM made pVen more negative and started chatter without moving MAP.',
          ),
          option(
            'vaso-device-zero',
            'Circuit flow is stopped to assess whether MAP improves.',
            'Stopping circuit flow to see whether MAP improves removes support from a patient in shock. It would answer nothing about tone and is not a modeled response to any finding here.',
          ),
        ],
        correctOptionId: 'vaso-device-correct',
      },
      circuit: {
        prompt: 'Which circuit finding supports avoiding pump escalation?',
        options: [
          option(
            'vaso-circuit-correct',
            'Flow and drainage remain adequate without increasingly negative pVen or chatter.',
            'At the prior RPM the circuit stays quiet: flow and drainage adequate, pVen steady, no chatter. A circuit that is already delivering does not need to be pushed.',
          ),
          option(
            'vaso-circuit-collapse',
            'pVen becomes more negative and chatter begins after RPM escalation.',
            'More negative pVen and new chatter after escalation are the drainage cost of pulling harder on a venous system that was already giving what it had. The case shows this when RPM is raised.',
          ),
          option(
            'vaso-circuit-delta',
            'A normal oxygenator Δp directly measures vascular tone.',
            'Δp is the pressure drop across the membrane. It knows nothing about the patient’s vascular resistance; a normal Δp describes a clean oxygenator, not a vasodilated patient.',
          ),
        ],
        correctOptionId: 'vaso-circuit-correct',
      },
      patient: {
        prompt: 'Which patient trend supports improvement?',
        options: [
          option(
            'vaso-patient-correct',
            'MAP and perfusion improve and lactate begins falling after vasopressor titration and source treatment.',
            'With vasopressor titrated and the septic source addressed, the model shows MAP improving and lactate beginning to fall while circuit flow is unchanged.',
          ),
          option(
            'vaso-patient-flow',
            'Only total circuit flow rises; MAP and lactate remain abnormal.',
            'A higher total flow with MAP and lactate still abnormal means more blood is circulating through a bed that will not hold pressure. Flow was not the deficit; tone was.',
          ),
          option(
            'vaso-patient-warm',
            'Warm extremities alone prove adequate organ perfusion, since a vasodilated patient is by definition well perfused.',
            'Warm extremities are the signature of vasodilation, not of adequate perfusion. Rising lactate and low MAP show the organs are underperfused despite the warm skin.',
          ),
        ],
        correctOptionId: 'vaso-patient-correct',
      },
    },
    hints: [
      {
        id: 'vaso-pattern',
        title: 'Clue 1 · Decide whether flow is actually inadequate',
        text: 'Recovered native ejection, adequate VA flow, warm extremities, low MAP, and rising lactate suggest distributive vasoplegia rather than pump-flow failure.',
        penalty: 5,
        target: 'patient-monitor',
        controlId: 'cardiohelp-patient-monitor',
        focusId: 'cardiohelp-patient-monitor',
      },
      {
        id: 'vaso-action',
        title: 'Clue 2 · Treat tone and source',
        text: 'Use focused echo/perfusion assessment, titrate vasopressor through the local shock protocol, and treat the underlying septic source without blindly increasing RPM.',
        penalty: 10,
        focusId: 'practice-treatment',
      },
    ],
  },
  'va-clinical-limb-ischemia': {
    reassessment: {
      instruction:
        'Select findings that demonstrate restoration of regional limb perfusion while systemic VA support remains stable.',
      device: {
        prompt: 'Which console response is appropriate?',
        options: [
          option(
            'limb-device-correct',
            'Systemic VA flow remains stable; total RPM is not increased to treat a regional obstruction.',
            'The modeled fix is regional — restoring the distal-perfusion pathway — and systemic flow, MAP, and RPM are unchanged before and after. The console had no role in this emergency.',
          ),
          option(
            'limb-device-rpm',
            'Higher total circuit flow is the definitive treatment for an obstructed distal-perfusion catheter.',
            'More total flow into the femoral artery does not reopen an obstructed distal-perfusion catheter. In the case, systemic flow rose slightly and the leg stayed threatened.',
          ),
          option(
            'limb-device-map',
            'Normal MAP on the console excludes limb ischemia.',
            'MAP is a central pressure that the arterial return produces regardless of what happens downstream of the cannula. A normal MAP coexisted with a cool, mottled leg throughout.',
          ),
        ],
        correctOptionId: 'limb-device-correct',
      },
      circuit: {
        prompt: 'Which circuit/return-path finding confirms correction?',
        options: [
          option(
            'limb-circuit-correct',
            'The distal-perfusion pathway is patent with restored Doppler flow while arterial return remains stable.',
            'Once the distal-perfusion pathway is patent again, Doppler flow returns to the leg while arterial return and systemic pressures continue unchanged.',
          ),
          option(
            'limb-circuit-global',
            'Only total VA flow increases; distal Doppler flow remains weak.',
            'Total VA flow rising while distal Doppler stays weak is what the case shows after the RPM increase: the extra blood goes centrally, beyond the obstructed catheter, not into the leg.',
          ),
          option(
            'limb-circuit-oxygenator',
            'Post-oxygenator saturation alone confirms distal-limb perfusion, since oxygenated return blood is what the cannulated leg receives.',
            'Post-oxygenator saturation tells you the returned blood carries oxygen. It cannot tell you whether any of that blood is reaching the leg below an occluded femoral cannula.',
          ),
        ],
        correctOptionId: 'limb-circuit-correct',
      },
      patient: {
        prompt: 'Which limb response demonstrates improvement?',
        options: [
          option(
            'limb-patient-correct',
            'Cannulated-limb NIRS, temperature, color, capillary refill, and Doppler signals improve.',
            'Cannulated-leg NIRS rises and temperature, color, capillary refill, and Doppler signals recover as distal flow returns — the modeled response to vascular rescue.',
          ),
          option(
            'limb-patient-map',
            'MAP remains normal while the leg stays cool and mottled.',
            'A normal MAP with a cool, mottled leg is the presenting picture of this case, not its resolution. The leg’s own perfusion markers are the endpoint.',
          ),
          option(
            'limb-patient-other',
            'Contralateral-limb NIRS alone proves the cannulated leg is adequately perfused.',
            'The contralateral leg has no cannula in its artery and was never at risk. Its NIRS is the comparison baseline; the cannulated leg’s NIRS is the one that must recover.',
          ),
        ],
        correctOptionId: 'limb-patient-correct',
      },
    },
    hints: [
      {
        id: 'limb-pattern',
        title: 'Clue 1 · Global support can hide a regional emergency',
        text: 'Normal MAP, flow, and oxygenator function do not exclude compromised perfusion downstream from a femoral arterial cannula.',
        penalty: 5,
        target: 'patient-monitor',
        controlId: 'cardiohelp-patient-monitor',
        focusId: 'cardiohelp-patient-monitor',
      },
      {
        id: 'limb-action',
        title: 'Clue 2 · Assess and restore the distal pathway',
        text: 'Compare both limbs and the distal-perfusion catheter, then activate vascular/ECMO rescue to restore regional flow rather than increasing total RPM.',
        penalty: 10,
        focusId: 'practice-treatment',
      },
    ],
  },
  'va-clinical-oxygenator-thrombosis': {
    reassessment: {
      instruction:
        'Select findings that demonstrate restored membrane-lung function while VA perfusion remains supported.',
      device: {
        prompt: 'Which console response is most appropriate?',
        options: [
          option(
            'va-oxy-device-correct',
            'Required VA flow is maintained without escalating RPM across a resistant oxygenator.',
            'Flow is held at the existing RPM while backup circulation and a primed circuit are readied; the modeled recovery comes from the exchange, not from the console.',
          ),
          option(
            'va-oxy-device-rpm',
            'RPM is increased until the high pInt alarm resolves, since the alarm limit is what defines a safe oxygenator.',
            'Alarm limits are set by the program and say nothing about how much clot the membrane holds. Driving RPM up until pInt drops below a limit adds shear and hemolysis without restoring gas transfer.',
          ),
          option(
            'va-oxy-device-delta',
            'The console Δp value alone determines the exchange decision.',
            'Δp alone cannot make the decision: it rises with flow as well as with clot. The case builds the diagnosis from the pressure pattern, pre/post gas transfer, visible fibrin, and the falling MAP.',
          ),
        ],
        correctOptionId: 'va-oxy-device-correct',
      },
      circuit: {
        prompt: 'Which circuit trend supports successful exchange?',
        options: [
          option(
            'va-oxy-circuit-correct',
            'pInt and Δp fall and post-oxygenator gas transfer improves after membrane-lung exchange.',
            'After the exchange, pInt and Δp fall and post-oxygenator saturation recovers — the circuit response to a membrane without clot.',
          ),
          option(
            'va-oxy-circuit-worse',
            'pInt and Δp rise further while post-oxygenator oxygenation worsens.',
            'A climbing pInt and Δp with falling post-oxygenator saturation is the untreated trajectory, and on VA it threatens circulatory support directly, not just gas exchange.',
          ),
          option(
            'va-oxy-circuit-part',
            'A normal pArt alone excludes oxygenator thrombosis, because a membrane that lets blood out at its usual pressure cannot be clotted.',
            'pArt is read downstream of the membrane and reflects return-limb resistance. Blood can leave a clotted oxygenator at a normal pArt while pInt climbs upstream; the gradient tells the story.',
          ),
        ],
        correctOptionId: 'va-oxy-circuit-correct',
      },
      patient: {
        prompt: 'Which patient response should be reassessed?',
        options: [
          option(
            'va-oxy-patient-correct',
            'MAP and systemic perfusion remain supported while upper-body oxygenation and gas transfer improve.',
            'MAP and perfusion are supported through the exchange and recover afterwards, while right-arm oxygenation and gas transfer improve with the new membrane.',
          ),
          option(
            'va-oxy-patient-flow',
            'Displayed flow is adequate, so right-arm oxygenation and perfusion no longer matter.',
            'Adequate displayed flow on VA does not guarantee oxygenated blood reaches the arch: right-arm oxygenation depends on what the membrane and the native lung deliver. It still has to be reassessed.',
          ),
          option(
            'va-oxy-patient-worse',
            'Lactate and hypoxemia continue worsening after the exchange.',
            'Lactate and hypoxemia worsening after exchange would mean the new component is not performing or perfusion was lost during the swap. The modeled exchange reverses both.',
          ),
        ],
        correctOptionId: 'va-oxy-patient-correct',
      },
    },
    hints: [
      {
        id: 'va-oxy-pattern',
        title: 'Clue 1 · Trend resistance and gas transfer together',
        text: 'A rising pInt-to-pArt gradient plus impaired post-oxygenator gas transfer is more concerning than either value in isolation.',
        penalty: 5,
        target: 'circuit',
        controlId: 'cardiohelp-circuit-panel',
        focusId: 'cardiohelp-circuit-panel',
      },
      {
        id: 'va-oxy-action',
        title: 'Clue 2 · Preserve perfusion during definitive correction',
        text: 'Verify the membrane-lung failure, support pressure if needed, prepare the trained exchange team, then perform the reviewed circuit exchange while reassessing both circulations.',
        penalty: 10,
        focusId: 'practice-treatment',
      },
    ],
  },
  'clinical-vv-circuit-air-embolism': {
    reassessment: {
      instruction:
        'Select the findings that demonstrate a safely isolated, cleared, and resumed circuit after the air emergency.',
      device: {
        prompt: 'Which console/device response is most appropriate?',
        options: [
          option(
            'vv-air-device-correct',
            'The pump resumes only after the circuit is de-aired and confirmed clear; support is resumed per the current IFU and approved local protocol.',
            'Resumption in the model is one bounded action taken after de-airing: the pump comes back with support restored, and the patient is never left across two open limbs of a stopped circuit.',
          ),
          option(
            'vv-air-device-early-restart',
            'The pump is restarted as soon as the alarm is acknowledged, before de-airing.',
            'Restarting on an acknowledged alarm with air still in the lines drives that air toward the patient. The case records it as a critical safety error; the alarm is a report, not a clearance.',
          ),
          option(
            'vv-air-device-alarm-only',
            'Silencing the bubble alarm confirms the circuit is safe to resume.',
            'Silencing the bubble alarm tells the console to stop reporting; it does not remove the air. The circuit is safe to resume when it has been de-aired and confirmed clear, whatever the alarm says.',
          ),
        ],
        correctOptionId: 'vv-air-device-correct',
      },
      circuit: {
        prompt: 'Which circuit finding should be documented?',
        options: [
          option(
            'vv-air-circuit-correct',
            'Both near-patient clamps isolated the circuit while it was de-aired and confirmed clear.',
            'The two near-patient clamps, return limb first, are what isolate the patient; the pump stop alone does not. The modeled de-airing proceeds only on an isolated circuit.',
          ),
          option(
            'vv-air-circuit-open',
            'The circuit stayed unclamped throughout because the pump stop already protected the patient.',
            'A stopped centrifugal pump is non-occlusive: with both limbs open the patient stays continuous with an air-containing circuit. The stop halts flow; it does not isolate anything.',
          ),
          option(
            'vv-air-circuit-partial',
            'Only the drainage limb needed isolation; return-limb air poses no risk on VV support.',
            'Air entered the drainage limb, but the return limb is the path to the patient and is clamped first for that reason. Venous air is not harmless: on VV support it reaches the pulmonary circulation.',
          ),
        ],
        correctOptionId: 'vv-air-circuit-correct',
      },
      patient: {
        prompt: 'Which patient response best supports safe resumption?',
        options: [
          option(
            'vv-air-patient-correct',
            'Oxygenation recovers after protocol-governed resumption with no embolic deterioration.',
            'After protocol-governed resumption the model restores forward flow and oxygenation recovers, with no embolic deterioration because the air was cleared before flow returned.',
          ),
          option(
            'vv-air-patient-flow-only',
            'Displayed circuit flow alone confirms the patient is safe, since any air that mattered would have stopped the pump again.',
            'The bubble detector reports air at its own sensor; it cannot report what already reached the patient. Displayed flow says blood is moving, not that the patient is neurologically and hemodynamically unchanged.',
          ),
          option(
            'vv-air-patient-ignore',
            'No bedside reassessment is needed once the bubble latch clears.',
            'The latch clearing is a console event. Whether any air reached the patient is a bedside question — oxygenation, hemodynamics, and neurologic status — that the console cannot answer.',
          ),
        ],
        correctOptionId: 'vv-air-patient-correct',
      },
    },
    hints: [
      {
        id: 'vv-air-pattern',
        title: 'Clue 1 · The pump stop is not the endpoint',
        text: 'The automatic bubble stop halts flow, but only the near-patient clamps isolate the air column from the patient. Isolate first, then work on the circuit.',
        penalty: 5,
        target: 'circuit',
        controlId: 'cardiohelp-clamp-return',
        focusId: 'cardiohelp-clamp-return',
      },
      {
        id: 'vv-air-action',
        title: 'Clue 2 · Isolate, de-air, then resume per protocol',
        text: 'Clamp the return limb, then the drainage limb. De-air and confirm the circuit is clear. Then resume support per the current IFU and approved local protocol.',
        penalty: 10,
        target: 'circuit',
        controlId: 'cardiohelp-clamp-drainage',
        focusId: 'cardiohelp-clamp-drainage',
      },
    ],
  },
  'va-clinical-circuit-air-embolism': {
    reassessment: {
      instruction:
        'Select the findings that demonstrate a safely isolated, cleared, and resumed VA circuit after the air emergency.',
      device: {
        prompt: 'Which console/device response is most appropriate?',
        options: [
          option(
            'va-air-device-correct',
            'The pump resumes only after de-airing, through the resumption governed by the current IFU and approved local protocol.',
            'In the model, resumption is one bounded action available only once the circuit is de-aired; the pump returns with support restored and no interval of two open limbs on a stopped circuit.',
          ),
          option(
            'va-air-device-early-restart',
            'The pump is restarted immediately to shorten the interruption, before de-airing, since on VA support the lost circulation is the greater danger.',
            'On VA the interruption is dangerous, but restarting with air in the lines converts it into an arterial embolus. The case supports the patient conventionally while the circuit is cleared.',
          ),
          option(
            'va-air-device-alarm-only',
            'Acknowledging the alarm is sufficient to declare the circuit safe.',
            'An acknowledged alarm is a console state, not a circuit inspection. Air is declared gone when the connector is secured and the lines are confirmed clear, not when the alarm stops.',
          ),
        ],
        correctOptionId: 'va-air-device-correct',
      },
      circuit: {
        prompt: 'Which circuit finding should be documented?',
        options: [
          option(
            'va-air-circuit-correct',
            'The arterial return limb was clamped first and the circuit isolated, de-aired, and confirmed clear.',
            'The arterial return limb is clamped first because it is the direct path to the aorta; drainage follows, and de-airing proceeds on an isolated circuit. Isolation is the step this case teaches.',
          ),
          option(
            'va-air-circuit-open',
            'No clamping was needed because the bubble intervention already stopped the pump.',
            'A stopped centrifugal pump is non-occlusive. With both limbs open the arterial circulation stays continuous with an air-containing circuit; the pump stop protects nothing on its own.',
          ),
          option(
            'va-air-circuit-reverse',
            'The drainage limb alone was clamped; arterial-limb air is tolerated on VA support because the stopped pump already holds it in place.',
            'Nothing holds air in place inside a stopped, non-occlusive pump; an open arterial return limb is the embolic path. Clamping drainage alone leaves that path open.',
          ),
        ],
        correctOptionId: 'va-air-circuit-correct',
      },
      patient: {
        prompt: 'Which patient response best supports safe resumption?',
        options: [
          option(
            'va-air-patient-correct',
            'MAP and perfusion recover after protocol-governed resumption with no arterial embolic event.',
            'After protocol-governed resumption the model restores VA flow, and MAP and perfusion recover with no arterial embolic event because the circuit was cleared before flow returned.',
          ),
          option(
            'va-air-patient-map-only',
            'A single MAP value confirms full recovery without further reassessment, since pressure is the first thing an embolus would change.',
            'An embolus to the brain or coronaries does not have to change MAP first. Recovery is judged on perfusion, right-arm oxygenation, and neurologic status over time, not on one pressure.',
          ),
          option(
            'va-air-patient-ignore',
            'Right-arm oxygenation no longer needs monitoring after the emergency.',
            'Right-arm oxygenation is the VA sentinel for the upper body and matters more after an arterial-side event, not less. Surveillance continues after resumption.',
          ),
        ],
        correctOptionId: 'va-air-patient-correct',
      },
    },
    hints: [
      {
        id: 'va-air-pattern',
        title: 'Clue 1 · Arterial air is a direct embolic threat',
        text: 'On VA support the return limb feeds the arterial circulation. The automatic pump stop is not isolation—clamp the arterial return limb near the patient first.',
        penalty: 5,
        target: 'circuit',
        controlId: 'cardiohelp-clamp-return',
        focusId: 'cardiohelp-clamp-return',
      },
      {
        id: 'va-air-action',
        title: 'Clue 2 · Isolate, de-air, then resume per protocol',
        text: 'Clamp return then drainage. Secure the connector, de-air, and confirm clear. Then resume venoarterial support per the current IFU and approved local protocol while you reassess perfusion.',
        penalty: 10,
        target: 'circuit',
        controlId: 'cardiohelp-clamp-drainage',
        focusId: 'cardiohelp-clamp-drainage',
      },
    ],
  },
}

export function getClinicalPracticeSupport(
  scenarioId: string,
): ClinicalPracticeSupport | undefined {
  return clinicalPracticeSupportByScenarioId[scenarioId]
}

/**
 * Rationales for the sets `resolveScenarioReassessment` builds when a scenario has no authored
 * reassessment. They describe the response class each option stands for. The fallback cannot
 * know the mechanism of the scenario it is standing in for, so the modeled options point the
 * learner back at what they observed rather than asserting a mechanism.
 */
const fallbackRationale = {
  deviceExpected:
    'This matches the device response the scenario authored as its expected finding. Read it against what the console actually showed after the cause was addressed.',
  deviceUnchanged:
    'The console is one of three places a cause shows itself, and some causes leave it unchanged on purpose. Rechecking it is how you learn which kind this was.',
  deviceAcknowledged:
    'Acknowledging an alarm changes the console’s reporting, not the cause. An alarm that stays quiet because the condition itself resolved is evidence; one silenced by a button is not.',
  circuitExpected:
    'This matches the circuit or gas-path finding the scenario authored as its expected response. Compare it with the pressures, flow, and gas readings you saw after the cause was addressed.',
  circuitNumber:
    'One circuit value in isolation can be produced by several different causes. The pattern across pVen, pInt, pArt, flow, and the gas path is what distinguishes them.',
  circuitNone:
    'The circuit is where the cause acted, so it is where resolution first shows. Leaving it unchecked means the device reading and the patient change cannot be tied to a mechanism.',
  patientExpected:
    'This matches the patient response the scenario authored as its expected finding. Patient values in this model change only as simulated time elapses, so the trend is what to compare.',
  patientConsole:
    'The console reports the circuit, not the patient. Oxygenation, PaCO₂, MAP, and perfusion are read at the bedside, and every scenario here judges resolution there as well.',
  patientNone:
    'Addressing the cause is the start of the response, not its end. The patient’s values move over simulated time afterwards, and that trend is the evidence the cause was the right one.',
} as const

export function resolveScenarioReassessment(
  scenario: ScenarioDefinition,
): ScenarioReassessmentDefinition {
  if (scenario.reassessment) return scenario.reassessment

  const terms = scenario.expectation.acceptableReassessmentTerms
  const guidance = scenario.assessmentPolicy?.reassessmentGuidance
  const fallbackLabel = (domain: 'device' | 'circuit' | 'patient', index: number) =>
    guidance?.[domain] ??
    `The ${domain} response includes the expected ${terms[index] ?? terms[0] ?? 'scenario'} finding.`

  return {
    instruction: 'Select the expected post-intervention finding in each domain.',
    device: {
      prompt: 'Which device/console finding best fits the expected response?',
      options: [
        option(
          `${scenario.id}-device-expected`,
          fallbackLabel('device', 0),
          fallbackRationale.deviceExpected,
        ),
        option(
          `${scenario.id}-device-unchanged`,
          'No device or console reassessment is needed.',
          fallbackRationale.deviceUnchanged,
        ),
        option(
          `${scenario.id}-device-acknowledged`,
          'Alarm acknowledgement alone demonstrates that the cause is corrected.',
          fallbackRationale.deviceAcknowledged,
        ),
      ],
      correctOptionId: `${scenario.id}-device-expected`,
    },
    circuit: {
      prompt: 'Which circuit or gas finding best fits the expected response?',
      options: [
        option(
          `${scenario.id}-circuit-expected`,
          fallbackLabel('circuit', 1),
          fallbackRationale.circuitExpected,
        ),
        option(
          `${scenario.id}-circuit-number`,
          'One isolated circuit number is sufficient.',
          fallbackRationale.circuitNumber,
        ),
        option(
          `${scenario.id}-circuit-none`,
          'No circuit or gas reassessment is needed.',
          fallbackRationale.circuitNone,
        ),
      ],
      correctOptionId: `${scenario.id}-circuit-expected`,
    },
    patient: {
      prompt: 'Which patient finding best fits the expected response?',
      options: [
        option(
          `${scenario.id}-patient-expected`,
          fallbackLabel('patient', 2),
          fallbackRationale.patientExpected,
        ),
        option(
          `${scenario.id}-patient-console`,
          'The console response replaces bedside assessment.',
          fallbackRationale.patientConsole,
        ),
        option(
          `${scenario.id}-patient-none`,
          'No patient reassessment is needed after correction.',
          fallbackRationale.patientNone,
        ),
      ],
      correctOptionId: `${scenario.id}-patient-expected`,
    },
  }
}
