import type {
  ScenarioDefinition,
  ScenarioHint,
  ScenarioReassessmentDefinition,
} from '../engine/types'

interface ClinicalPracticeSupport {
  reassessment: ScenarioReassessmentDefinition
  hints: readonly ScenarioHint[]
}

const option = (id: string, label: string) => ({ id, label })

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
          ),
          option('vv-init-device-stopped', 'The pump remains stopped with zero forward flow.'),
          option(
            'vv-init-device-rpm-only',
            'RPM is increased repeatedly without checking drainage or measured flow.',
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
          ),
          option(
            'vv-init-circuit-no-return',
            'The drainage limb fills, but no return flow reaches the patient.',
          ),
          option(
            'vv-init-circuit-console-only',
            'The displayed RPM alone confirms that the entire circuit is functioning.',
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
          ),
          option(
            'vv-init-patient-map-only',
            'MAP is unchanged, so gas-exchange support has failed.',
          ),
          option(
            'vv-init-patient-flow-only',
            'Displayed circuit flow improves; no bedside or blood-gas reassessment is needed.',
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
          ),
          option('hem-device-increase', 'RPM was increased until the displayed flow briefly rose.'),
          option(
            'hem-device-ack',
            'The low-flow alarm was acknowledged; no machine or patient change was needed.',
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
          ),
          option(
            'hem-circuit-worse',
            'pVen becomes more negative and chatter persists despite higher RPM.',
          ),
          option(
            'hem-circuit-pressure-only',
            'pArt alone normalizes, proving that blood loss has stopped.',
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
          ),
          option(
            'hem-patient-pressor-only',
            'MAP rises briefly with vasopressor alone while hemoglobin and lactate worsen.',
          ),
          option(
            'hem-patient-volume-only',
            'A transient volume response confirms definitive hemorrhage control.',
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
          ),
          option(
            'tension-device-rpm',
            'Higher RPM is required to overcome the obstructive physiology.',
          ),
          option('tension-device-alarm', 'Silencing the low-flow alarm resolves the obstruction.'),
        ],
        correctOptionId: 'tension-device-correct',
      },
      circuit: {
        prompt: 'Which circuit change should follow decompression?',
        options: [
          option(
            'tension-circuit-correct',
            'Drainage stabilizes, pVen becomes less negative, and chatter resolves.',
          ),
          option(
            'tension-circuit-static',
            'Circuit pressures remain severely drainage-limited despite correction.',
          ),
          option(
            'tension-circuit-oxygenator',
            'A rising oxygenator pressure gradient confirms successful decompression.',
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
          ),
          option(
            'tension-patient-volume',
            'MAP rises briefly after volume while unilateral absent sliding persists.',
          ),
          option(
            'tension-patient-spo2-only',
            'A single SpO₂ value excludes persistent obstructive shock.',
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
          ),
          option(
            'recirc-device-rpm',
            'A higher RPM and higher displayed flow prove systemic support improved.',
          ),
          option('recirc-device-flow-only', 'The flow number alone excludes recirculation.'),
        ],
        correctOptionId: 'recirc-device-correct',
      },
      circuit: {
        prompt: 'Which circuit finding supports correction?',
        options: [
          option(
            'recirc-circuit-correct',
            'Cannula separation and return direction are restored and pre-oxygenator saturation moves toward a venous value.',
          ),
          option(
            'recirc-circuit-bright',
            'Drainage blood becomes brighter and pre-oxygenator saturation rises further.',
          ),
          option(
            'recirc-circuit-post',
            'Post-oxygenator saturation remains high, which alone excludes recirculation.',
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
          ),
          option('recirc-patient-worse', 'SpO₂ falls as RPM and recaptured return flow increase.'),
          option(
            'recirc-patient-none',
            'No patient reassessment is needed if post-oxygenator blood remains saturated.',
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
          ),
          option('gas-device-rpm', 'A large RPM increase is what restores CO₂ clearance.'),
          option(
            'gas-device-flow-loss',
            'Blood flow must fall to zero whenever sweep gas is disconnected.',
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
          ),
          option(
            'gas-circuit-fio2-only',
            'Changing FiO₂ alone restores gas flow through disconnected tubing.',
          ),
          option(
            'gas-circuit-ack',
            'Acknowledging the alarm confirms that the gas pathway is restored.',
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
          ),
          option(
            'gas-patient-instant',
            'PaCO₂ and pH normalize instantly as soon as the source is reconnected.',
          ),
          option(
            'gas-patient-spo2',
            'An unchanged early SpO₂ proves that CO₂ clearance is adequate.',
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
          ),
          option('vv-oxy-device-rpm', 'RPM is increased until pInt rises further.'),
          option(
            'vv-oxy-device-delta',
            'The console Δp number alone proves thrombus location and severity.',
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
          ),
          option(
            'vv-oxy-circuit-worse',
            'pInt and Δp continue rising with declining post-oxygenator saturation.',
          ),
          option('vv-oxy-circuit-part', 'A normal pArt alone excludes oxygenator dysfunction.'),
        ],
        correctOptionId: 'vv-oxy-circuit-correct',
      },
      patient: {
        prompt: 'Which patient response should accompany circuit recovery?',
        options: [
          option(
            'vv-oxy-patient-correct',
            'Oxygenation and gas exchange improve while perfusion remains supported.',
          ),
          option(
            'vv-oxy-patient-flow-only',
            'Displayed flow improves, so no blood gas or hemolysis reassessment is needed.',
          ),
          option(
            'vv-oxy-patient-worse',
            'Hypoxemia and hemolysis markers continue worsening after exchange.',
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
          ),
          option(
            'va-init-device-stopped',
            'The pump remains stopped while pharmacologic support alone is escalated.',
          ),
          option(
            'va-init-device-max',
            'Maximum RPM is selected without reassessing drainage or native ejection.',
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
          ),
          option(
            'va-init-circuit-vv',
            'Venous return to the right atrium confirms adequate VA arterial support.',
          ),
          option(
            'va-init-circuit-flow-only',
            'A displayed flow number makes arterial-return and limb checks unnecessary.',
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
          ),
          option(
            'va-init-patient-map-only',
            'MAP rises, so LV loading and upper-body oxygenation no longer require assessment.',
          ),
          option(
            'va-init-patient-spo2-only',
            'Femoral saturation alone confirms adequate cerebral and coronary oxygenation.',
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
          ),
          option(
            'diff-device-rpm',
            'Higher RPM alone guarantees oxygenated blood reaches the upper body.',
          ),
          option('diff-device-flow-only', 'Normal displayed flow excludes differential hypoxemia.'),
        ],
        correctOptionId: 'diff-device-correct',
      },
      circuit: {
        prompt: 'Which paired circuit finding is essential?',
        options: [
          option(
            'diff-circuit-correct',
            'Post-oxygenator and femoral/lower-body oxygenation remain adequate despite the upper-body mismatch.',
          ),
          option(
            'diff-circuit-failure',
            'Poor post-oxygenator gas transfer explains both upper- and lower-body findings.',
          ),
          option(
            'diff-circuit-femoral',
            'A normal femoral sample proves right-arm oxygenation is adequate.',
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
          ),
          option(
            'diff-patient-femoral',
            'Femoral SpO₂ remains high, so right-arm values can be ignored.',
          ),
          option(
            'diff-patient-pulse',
            'Pulse pressure disappears, which confirms successful upper-body oxygenation.',
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
          ),
          option(
            'tamponade-device-rpm',
            'Higher RPM overcomes tamponade and is definitive treatment.',
          ),
          option('tamponade-device-ack', 'Acknowledging low-flow alarms restores cardiac filling.'),
        ],
        correctOptionId: 'tamponade-device-correct',
      },
      circuit: {
        prompt: 'Which circuit response is expected?',
        options: [
          option(
            'tamponade-circuit-correct',
            'pVen becomes less negative and drainage stabilizes as venous return improves.',
          ),
          option('tamponade-circuit-worse', 'Drainage collapse persists despite decompression.'),
          option(
            'tamponade-circuit-oxygenator',
            'A rising oxygenator Δp confirms tamponade relief.',
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
          ),
          option(
            'tamponade-patient-volume',
            'A brief volume response with persistent tamponade is definitive recovery.',
          ),
          option(
            'tamponade-patient-map-only',
            'A single MAP value excludes ongoing pericardial compression.',
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
          ),
          option(
            'vaso-device-rpm',
            'RPM is increased to target extreme flow as the primary treatment for vasoplegia.',
          ),
          option('vaso-device-zero', 'Circuit flow is stopped to assess whether MAP improves.'),
        ],
        correctOptionId: 'vaso-device-correct',
      },
      circuit: {
        prompt: 'Which circuit finding supports avoiding pump escalation?',
        options: [
          option(
            'vaso-circuit-correct',
            'Flow and drainage remain adequate without increasingly negative pVen or chatter.',
          ),
          option(
            'vaso-circuit-collapse',
            'pVen becomes more negative and chatter begins after RPM escalation.',
          ),
          option('vaso-circuit-delta', 'A normal oxygenator Δp directly measures vascular tone.'),
        ],
        correctOptionId: 'vaso-circuit-correct',
      },
      patient: {
        prompt: 'Which patient trend supports improvement?',
        options: [
          option(
            'vaso-patient-correct',
            'MAP and perfusion improve and lactate begins falling after vasopressor titration and source treatment.',
          ),
          option(
            'vaso-patient-flow',
            'Only total circuit flow rises; MAP and lactate remain abnormal.',
          ),
          option('vaso-patient-warm', 'Warm extremities alone prove adequate organ perfusion.'),
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
          ),
          option(
            'limb-device-rpm',
            'Higher total circuit flow is the definitive treatment for an obstructed distal-perfusion catheter.',
          ),
          option('limb-device-map', 'Normal MAP on the console excludes limb ischemia.'),
        ],
        correctOptionId: 'limb-device-correct',
      },
      circuit: {
        prompt: 'Which circuit/return-path finding confirms correction?',
        options: [
          option(
            'limb-circuit-correct',
            'The distal-perfusion pathway is patent with restored Doppler flow while arterial return remains stable.',
          ),
          option(
            'limb-circuit-global',
            'Only total VA flow increases; distal Doppler flow remains weak.',
          ),
          option(
            'limb-circuit-oxygenator',
            'Post-oxygenator saturation alone confirms distal-limb perfusion.',
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
          ),
          option('limb-patient-map', 'MAP remains normal while the leg stays cool and mottled.'),
          option(
            'limb-patient-other',
            'Contralateral-limb NIRS alone proves the cannulated leg is adequately perfused.',
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
          ),
          option('va-oxy-device-rpm', 'RPM is increased until the high pInt alarm resolves.'),
          option(
            'va-oxy-device-delta',
            'The console Δp value alone determines the exchange decision.',
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
          ),
          option(
            'va-oxy-circuit-worse',
            'pInt and Δp rise further while post-oxygenator oxygenation worsens.',
          ),
          option('va-oxy-circuit-part', 'A normal pArt alone excludes oxygenator thrombosis.'),
        ],
        correctOptionId: 'va-oxy-circuit-correct',
      },
      patient: {
        prompt: 'Which patient response should be reassessed?',
        options: [
          option(
            'va-oxy-patient-correct',
            'MAP and systemic perfusion remain supported while upper-body oxygenation and gas transfer improve.',
          ),
          option(
            'va-oxy-patient-flow',
            'Displayed flow is adequate, so right-arm oxygenation and perfusion no longer matter.',
          ),
          option(
            'va-oxy-patient-worse',
            'Lactate and hypoxemia continue worsening after the exchange.',
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
            'The pump resumes only after the circuit is de-aired and both clamps are reopened in order.',
          ),
          option(
            'vv-air-device-early-restart',
            'The pump is restarted as soon as the alarm is acknowledged, before de-airing.',
          ),
          option(
            'vv-air-device-alarm-only',
            'Silencing the bubble alarm confirms the circuit is safe to resume.',
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
          ),
          option(
            'vv-air-circuit-open',
            'The circuit stayed unclamped throughout because the pump stop already protected the patient.',
          ),
          option(
            'vv-air-circuit-partial',
            'Only the drainage limb needed isolation; return-limb air poses no risk on VV support.',
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
          ),
          option(
            'vv-air-patient-flow-only',
            'Displayed circuit flow alone confirms the patient is safe.',
          ),
          option(
            'vv-air-patient-ignore',
            'No bedside reassessment is needed once the bubble latch clears.',
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
          ),
          option(
            'va-air-device-early-restart',
            'The pump is restarted immediately to shorten the interruption, before de-airing.',
          ),
          option(
            'va-air-device-alarm-only',
            'Acknowledging the alarm is sufficient to declare the circuit safe.',
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
          ),
          option(
            'va-air-circuit-open',
            'No clamping was needed because the bubble intervention already stopped the pump.',
          ),
          option(
            'va-air-circuit-reverse',
            'The drainage limb alone was clamped; arterial-limb air is tolerated on VA support.',
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
          ),
          option(
            'va-air-patient-map-only',
            'A single MAP value confirms full recovery without further reassessment.',
          ),
          option(
            'va-air-patient-ignore',
            'Right-arm oxygenation no longer needs monitoring after the emergency.',
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
        option(`${scenario.id}-device-expected`, fallbackLabel('device', 0)),
        option(`${scenario.id}-device-unchanged`, 'No device or console reassessment is needed.'),
        option(
          `${scenario.id}-device-acknowledged`,
          'Alarm acknowledgement alone demonstrates that the cause is corrected.',
        ),
      ],
      correctOptionId: `${scenario.id}-device-expected`,
    },
    circuit: {
      prompt: 'Which circuit or gas finding best fits the expected response?',
      options: [
        option(`${scenario.id}-circuit-expected`, fallbackLabel('circuit', 1)),
        option(`${scenario.id}-circuit-number`, 'One isolated circuit number is sufficient.'),
        option(`${scenario.id}-circuit-none`, 'No circuit or gas reassessment is needed.'),
      ],
      correctOptionId: `${scenario.id}-circuit-expected`,
    },
    patient: {
      prompt: 'Which patient finding best fits the expected response?',
      options: [
        option(`${scenario.id}-patient-expected`, fallbackLabel('patient', 2)),
        option(
          `${scenario.id}-patient-console`,
          'The console response replaces bedside assessment.',
        ),
        option(
          `${scenario.id}-patient-none`,
          'No patient reassessment is needed after correction.',
        ),
      ],
      correctOptionId: `${scenario.id}-patient-expected`,
    },
  }
}
