import type { IntroBronchoscopyModule } from '../types'

const procedureSafety = {
  title: 'Educational use only',
  text: 'This module supports bronchoscopy education and simulation. Local credentialing, medication dosing, airway plans, infection-control policy, device instructions, and supervised procedural judgment remain authoritative.',
}

export const introBronchoscopyModules = [
  {
    id: 'decision-risk-planning',
    slug: 'decision-risk-planning',
    title: 'Procedure Decision & Risk Planning',
    shortTitle: 'Decision & Risk',
    summary:
      'Use indication, expected benefit, patient risk, alternatives, airway route, sedation, consent, and rescue planning to decide whether bronchoscopy is worth doing.',
    estimatedMinutes: 35,
    objectives: [
      'Apply the bronchoscopy value equation before choosing tools or technique.',
      'Identify patient factors that raise physiologic, bleeding, sedation, and airway risk.',
      'Choose a route and sedation plan that fits the patient and procedural goal.',
      'Explain the consent and rescue-plan elements a fellow should verbalize before starting.',
    ],
    syllabusSections: ['1', '5', '6', '14.1'],
    learnBlocks: [
      {
        id: 'value-equation',
        title: 'Bronchoscopy starts before the scope enters the airway',
        visual: 'value-equation',
        paragraphs: [
          'A useful bronchoscopy is not just technically smooth. It begins with a patient-level decision: the expected diagnostic or therapeutic benefit should substantially exceed the expected risk.',
          'The novice trap is to treat bronchoscopy as a requested task. The fellow should instead ask what result will change management and whether bronchoscopy is the safest route to that result.',
        ],
        bullets: [
          'Appropriate indication',
          'Correct tools and airway route',
          'Competent technique and team execution',
          'Plan for complications and follow-up',
        ],
      },
      {
        id: 'risk-route-sedation',
        title: 'Risk, route, and sedation are one decision',
        paragraphs: [
          'The airway route and sedation plan should be selected together. A low-risk inspection may be reasonable with topical anesthesia and moderate sedation, while a long, stimulating, or large-tool case may need a secured airway.',
        ],
        bullets: [
          'Transnasal route: useful for selected awake or lightly sedated cases, limited by epistaxis risk and scope size.',
          'Transoral route: accommodates larger flexible scopes but may be more stimulating.',
          'ETT, supraglottic airway, NIV, or general anesthesia: selected when airway control or physiologic support changes safety.',
        ],
      },
    ],
    practiceActivities: [
      {
        type: 'case-triage',
        id: 'would-you-scope',
        title: 'Would you scope?',
        prompt: 'Commit to a plan, then compare it with the teaching rationale.',
        cases: [
          {
            id: 'tb-dry-cough',
            title: 'Possible TB with dry cough',
            scenario:
              'A patient has upper-lobe nodules, weight loss, and dry cough. Sputum cannot be produced and microbiology will change isolation and treatment.',
            bestChoiceId: 'scope',
            choices: [
              {
                id: 'scope',
                label: 'Bronchoscopy for targeted BAL after CT review',
                verdict: 'scope',
                feedback:
                  'Reasonable: the sample can change management and noninvasive sputum is unavailable.',
              },
              {
                id: 'defer',
                label: 'Defer because cough is dry',
                verdict: 'defer',
                feedback:
                  'A dry cough is part of why bronchoscopy may be useful when microbiology is needed.',
              },
              {
                id: 'alternative',
                label: 'Treat empirically without microbiology',
                verdict: 'alternative',
                feedback:
                  'Empiric treatment may be necessary in some settings, but the case asks for microbiology that changes management.',
              },
            ],
          },
          {
            id: 'straightforward-cap',
            title: 'Straightforward community-acquired pneumonia',
            scenario:
              'A stable patient has a typical lobar infiltrate, productive cough, no immunosuppression, and improves with antibiotics.',
            bestChoiceId: 'alternative',
            choices: [
              {
                id: 'scope',
                label: 'Bronchoscopy now',
                verdict: 'scope',
                feedback:
                  'Usually low value: routine improving pneumonia often does not need bronchoscopy.',
              },
              {
                id: 'alternative',
                label: 'Continue noninvasive management',
                verdict: 'alternative',
                feedback:
                  'Best choice: the expected bronchoscopy benefit is low while noninvasive care is working.',
              },
              {
                id: 'stabilize',
                label: 'Intubate to perform BAL',
                verdict: 'stabilize',
                feedback:
                  'Escalating the airway just to sample an improving typical pneumonia adds risk without clear benefit.',
              },
            ],
          },
        ],
      },
      {
        type: 'simulator',
        id: 'risk-calculator',
        title: 'Value equation simulator',
        prompt:
          'Move benefit, risk, alternative yield, and urgency to see how the decision changes.',
        simulator: 'ventilator',
      },
    ],
    assessmentItems: [
      {
        prompt: 'Which question should come first when bronchoscopy is requested?',
        options: [
          'Which bronchoscope is available?',
          'Will the result or intervention meaningfully change management?',
          'How quickly can the patient be transported?',
          'Which specimen trap is easiest to reach?',
        ],
        answerIndex: 1,
        explanation:
          'The indication and management-changing result come before tool selection or logistics.',
      },
      {
        prompt:
          'Which factor most strongly pushes a case toward a secured airway or anesthesia support?',
        options: [
          'A short inspection in a stable patient',
          'A long, stimulating, large-tool airway intervention',
          'A normal CT with no target',
          'A request for routine sputum culture',
        ],
        answerIndex: 1,
        explanation:
          'Long, stimulating, or large-tool procedures require more airway control and team planning.',
      },
    ],
    assets: [],
    safetyNotes: [procedureSafety],
  },
  {
    id: 'scope-anatomy-handling',
    slug: 'scope-anatomy-handling',
    title: 'Scope Anatomy, Sizing & Handling',
    shortTitle: 'Scope & Handling',
    summary:
      'Identify flexible bronchoscope parts, choose scope size and working channel deliberately, and connect hand movements to distal-tip control.',
    estimatedMinutes: 45,
    objectives: [
      'Identify insertion tube, control body, universal cord, suction valve, and working-channel port.',
      'Explain how outer diameter and working-channel diameter drive practical choices.',
      'Estimate airway obstruction when a scope is passed through an endotracheal tube.',
      'Practice the three basic movements: advance/retract, flex/extend, and wrist rotation.',
    ],
    syllabusSections: ['2', '3', '6.3', '11.3', '11.4'],
    learnBlocks: [
      {
        id: 'scope-parts',
        title: 'Flexible bronchoscope anatomy is functional anatomy',
        visual: 'scope-anatomy',
        paragraphs: [
          'The insertion tube contains imaging, light, angulation wires, and the working channel. The control body turns hand movement into distal-tip movement and instrument access.',
        ],
        bullets: [
          'Outer diameter determines airway occupancy and distal reach.',
          'Working channel diameter determines suction and tool compatibility.',
          'A kinked insertion tube transmits rotation poorly; straighten the scope before blaming the tip.',
        ],
      },
      {
        id: 'size-tradeoffs',
        title: 'The best scope is the one that fits the task and patient',
        paragraphs: [
          'Larger scopes improve suction and tool passage but obstruct more airway area. Smaller scopes improve reach and maneuverability but may limit suction and tools.',
        ],
      },
    ],
    practiceActivities: [
      {
        type: 'hotspot-diagram',
        id: 'scope-hotspots',
        title: 'Real scope part atlas',
        prompt:
          'Use the real bronchoscope photos to identify the major parts, then compare the suction valve and biopsy valve adapter setup.',
        diagram: 'scope-photo-atlas',
        photoAtlas: {
          manifestUrl: '/intro-bronchoscopy/scope-anatomy/scope-photo-atlas.json',
        },
      },
      {
        type: 'scope-size-explorer',
        id: 'scope-size-fit',
        title: 'Bronchoscope size, reach, and tool fit',
        prompt:
          'Compare scope outer diameter, working-channel diameter, estimated reach, and instrument compatibility.',
      },
      {
        type: 'simulator',
        id: 'ett-occlusion',
        title: 'ETT obstruction visual',
        prompt:
          'Adjust ETT inner diameter and bronchoscope outer diameter to see airway area occupied.',
        simulator: 'ett-occlusion',
      },
    ],
    assessmentItems: [
      {
        prompt: 'If a fellow remembers only two flexible bronchoscope specifications, they are:',
        options: [
          'Scope color and processor brand',
          'Outer diameter and working-channel diameter',
          'Universal cord length and light source brightness',
          'Lever color and monitor size',
        ],
        answerIndex: 1,
        explanation:
          'Outer diameter and working-channel diameter determine reach, obstruction, suction, and tool compatibility.',
      },
      {
        prompt:
          'What should the operator check first when wrist rotation is not moving the distal tip as expected?',
        options: [
          'Whether the insertion tube is kinked or twisted',
          'Whether the biopsy forceps are open',
          'Whether the specimen trap is full',
          'Whether the patient is supine',
        ],
        answerIndex: 0,
        explanation: 'Rotational force transmits poorly through a kinked or twisted scope.',
      },
    ],
    assets: [
      '/intro-bronchoscopy/scope-anatomy/scope-photo-atlas.json',
      '/intro-bronchoscopy/scope-anatomy/full-scope.png',
      '/intro-bronchoscopy/scope-anatomy/suction-valve-setup.png',
      '/intro-bronchoscopy/scope-anatomy/biopsy-adapter-setup.png',
      '/bronch-navigation-trainer/app',
      '/fluoroview/airway_segments_new.glb',
    ],
    safetyNotes: [procedureSafety],
  },
  {
    id: 'airway-anatomy',
    slug: 'airway-anatomy',
    title: 'Airway Anatomy & Systematic Inspection',
    shortTitle: 'Airway Anatomy',
    summary:
      'Use the existing bronchoscopy atlas, CT correlations, and 3D airway model to build a reproducible airway survey.',
    estimatedMinutes: 50,
    objectives: [
      'Orient with tracheal rings anterior and membranous wall posterior.',
      'Inspect the right and left bronchial trees in a repeatable sequence.',
      'Name lobar and segmental bronchi and correlate endoscopy with CT/3D anatomy.',
    ],
    syllabusSections: ['4', '14.2'],
    learnBlocks: [
      {
        id: 'three-views',
        title: 'Connect bronchoscopy, CT, and the airway tree',
        visual: 'airway-map',
        paragraphs: [
          'The airway anatomy module teaches the same structure through endoscopy, CT, a 3D model, and a branching tree. This is the core orientation skill for the rest of the course.',
        ],
      },
    ],
    practiceActivities: [
      {
        type: 'case-triage',
        id: 'open-atlas',
        title: 'Dedicated anatomy atlas',
        prompt:
          'Open the airway anatomy route to practice pause-and-reveal labels and CT correlation.',
        cases: [
          {
            id: 'atlas',
            title: 'Airway atlas route',
            scenario:
              'The full anatomy trainer is preserved at /intro-bronchoscopy/airway-anatomy with video, stills, CT, and 3D model views.',
            bestChoiceId: 'scope',
            choices: [
              {
                id: 'scope',
                label: 'Use the dedicated airway anatomy trainer',
                verdict: 'scope',
                feedback:
                  'Correct. This module is intentionally preserved as the detailed anatomy workspace.',
              },
            ],
          },
        ],
      },
    ],
    assessmentItems: [
      {
        prompt: 'Which tracheal landmark is the most reliable posterior compass?',
        options: ['Cartilage rings', 'Membranous wall', 'Right upper lobe takeoff', 'Lingula'],
        answerIndex: 1,
        explanation:
          'The flat membranous wall marks posterior and helps re-orient when the scope rotates.',
      },
      {
        prompt: 'Which lobe arises directly from the right main bronchus?',
        options: ['Right upper lobe', 'Right middle lobe', 'Right lower lobe', 'Lingula'],
        answerIndex: 0,
        explanation:
          'The right upper lobe bronchus arises from the right main bronchus before the bronchus intermedius.',
      },
    ],
    assets: ['/airway-lesson/airway-survey-cropped.mp4', '/airway-lesson/airway-survey-ct.json'],
    safetyNotes: [procedureSafety],
  },
  {
    id: 'airway-pathology-description',
    slug: 'airway-pathology-description',
    title: 'Airway Pathology Description Lab',
    shortTitle: 'Pathology',
    summary:
      'Practice describing narrowing, mucosa, lesions, secretions, dynamic collapse, fistulas, variants, and foreign bodies with precise airway language.',
    estimatedMinutes: 45,
    objectives: [
      'Separate location, appearance, severity, and dynamic behavior in airway descriptions.',
      'Classify narrowing as intrinsic, extrinsic, mixed, fixed, or dynamic.',
      'Use structured language for mucosal, secretion, lesion, and foreign-body findings.',
    ],
    syllabusSections: ['8', '13.2'],
    learnBlocks: [
      {
        id: 'description-framework',
        title: 'Good descriptions are structured',
        paragraphs: [
          'Avoid vague findings such as "mass in left airway." Useful documentation states the exact location, lesion morphology, vascularity, severity, and effect on patency.',
        ],
        bullets: [
          'Location: airway and wall/clock position.',
          'Severity: percent narrowing or dynamic collapse.',
          'Appearance: mucosa, lesion surface, secretions, bleeding, or defect.',
          'Effect: obstruction, post-obstructive secretions, fistula, or airway instability.',
        ],
      },
    ],
    practiceActivities: [
      {
        type: 'simulator',
        id: 'stenosis-slider',
        title: 'Stenosis severity slider',
        prompt: 'Estimate severity and convert percent narrowing into usable report language.',
        simulator: 'stenosis',
      },
      {
        type: 'image-description',
        id: 'pattern-drill',
        title: 'Pathology description drill',
        prompt: 'Pick the descriptor set that best fits each schematic airway finding.',
        patterns: [
          {
            id: 'vascular-lesion',
            label: 'Round vascular lesion',
            finding: 'Smooth red lesion projecting from the medial right mainstem wall',
            description:
              'Smooth, round, hypervascular endobronchial lesion arising from the medial wall with partial obstruction.',
            correctDescriptors: ['location', 'vascularity', 'obstruction'],
          },
          {
            id: 'dynamic-collapse',
            label: 'Expiratory collapse',
            finding: 'Posterior membrane bows inward during cough',
            description:
              'Dynamic expiratory collapse of the distal trachea, worse with cough, with membranous intrusion.',
            correctDescriptors: ['dynamic', 'posterior wall', 'severity'],
          },
        ],
      },
      {
        type: 'report-builder',
        id: 'pathology-report',
        title: 'Finding sentence builder',
        prompt: 'Build a useful airway finding sentence.',
        requiredElements: ['location', 'appearance', 'severity', 'effect'],
        exampleFinding:
          'Smooth, round, hypervascular lesion on the medial right mainstem wall causing approximately 60% obstruction.',
      },
    ],
    assessmentItems: [
      {
        prompt: 'Which description is most useful?',
        options: [
          'Bad mass in left airway',
          'Smooth hypervascular lesion from medial right mainstem wall causing about 60% obstruction',
          'Lots of secretions everywhere',
          'Abnormal airway',
        ],
        answerIndex: 1,
        explanation:
          'The best option includes location, appearance, vascularity, severity, and effect.',
      },
      {
        prompt: 'Extrinsic airway narrowing means:',
        options: [
          'The lesion grows from the airway lumen',
          'The airway is narrowed by compression from outside the lumen',
          'The airway collapses only during expiration',
          'The airway contains purulent secretions',
        ],
        answerIndex: 1,
        explanation:
          'Extrinsic narrowing is compression from outside the airway; mixed disease has both intrinsic and extrinsic components.',
      },
    ],
    assets: [],
    safetyNotes: [procedureSafety],
  },
  {
    id: 'diagnostic-tools-bal',
    slug: 'diagnostic-tools-bal',
    title: 'Diagnostic Tools & BAL Quality',
    shortTitle: 'Diagnostic Tools',
    summary:
      'Select BAL, brushing, forceps biopsy, or TBNA based on the question, and practice the technique details that make samples interpretable.',
    estimatedMinutes: 45,
    objectives: [
      'Compare what BAL, brushing, biopsy, and TBNA sample.',
      'Perform the core steps of a high-quality BAL in simulation.',
      'Route specimens to the correct tests and avoid sample-handling ambiguity.',
    ],
    syllabusSections: ['9', '14.3'],
    learnBlocks: [
      {
        id: 'tool-comparison',
        title: 'Every diagnostic tool answers a different question',
        paragraphs: [
          'BAL samples alveolar cells and secretions. Brushing samples airway wall or peripheral airway cells. Forceps biopsy provides tissue architecture. TBNA samples beyond the airway wall.',
        ],
      },
      {
        id: 'bal-quality',
        title: 'BAL quality determines whether results can be trusted',
        paragraphs: [
          'A high-quality BAL uses a disease-based target, avoids proximal contamination, maintains a wedge, instills adequate volume, maximizes return, and documents both volume and return.',
        ],
      },
    ],
    practiceActivities: [
      {
        type: 'simulator',
        id: 'bal-quality-simulator',
        title: 'BAL quality simulator',
        prompt: 'Toggle technique elements and watch the quality score change.',
        simulator: 'bal-quality',
      },
      {
        type: 'drag-drop',
        id: 'specimen-routing',
        title: 'Specimen routing match',
        prompt: 'Match sample type to what it best evaluates.',
        pairs: [
          { id: 'bal', left: 'BAL', right: 'Alveolar infection, hemorrhage pattern, cell count' },
          {
            id: 'brush',
            left: 'Brush',
            right: 'Airway wall or peripheral airway cytology/microbiology',
          },
          {
            id: 'forceps',
            left: 'Forceps biopsy',
            right: 'Tissue architecture from visible or peripheral lesion',
          },
          { id: 'tbna', left: 'TBNA', right: 'Parabronchial lesion or lymph node cells' },
        ],
      },
      {
        type: 'sequence-builder',
        id: 'bal-sequence',
        title: 'BAL sequence builder',
        prompt: 'Select the BAL steps in order.',
        steps: [
          {
            id: 'target',
            label: 'Choose target from CT and disease pattern',
            rationale: 'Sampling starts with the right target.',
          },
          {
            id: 'avoid-suction',
            label: 'Avoid proximal suction before wedge',
            rationale: 'Reduces contamination.',
          },
          {
            id: 'wedge',
            label: 'Wedge in the target airway',
            rationale: 'Directs aliquots distally.',
          },
          {
            id: 'instill',
            label: 'Instill adequate aliquots',
            rationale: 'Adequate volume reaches alveoli.',
          },
          {
            id: 'document',
            label: 'Document instilled/returned volume and tests',
            rationale: 'Makes the sample interpretable.',
          },
        ],
      },
    ],
    assessmentItems: [
      {
        prompt:
          'Which procedure best samples the alveolar space for infection or hemorrhage pattern?',
        options: ['BAL', 'Rigid coring', 'Balloon dilation', 'Airway stent'],
        answerIndex: 0,
        explanation:
          'BAL is designed to sample alveolar cells and secretions when performed with good technique.',
      },
      {
        prompt: 'A report should describe a poor BAL as:',
        options: [
          'A perfect BAL',
          'A bronchial wash or airway wash when BAL standards were not met',
          'A biopsy',
          'A TBNA',
        ],
        answerIndex: 1,
        explanation:
          'If wedge/volume/return standards are not met, document what actually occurred.',
      },
    ],
    assets: [],
    safetyNotes: [procedureSafety],
  },
  {
    id: 'therapeutic-tools-foreign-body',
    slug: 'therapeutic-tools-foreign-body',
    title: 'Therapeutic Tools & Foreign Body Strategy',
    shortTitle: 'Therapeutics',
    summary:
      'Use suction technique, secretion/clot management, and foreign-body extraction planning to connect tools to airway tasks.',
    estimatedMinutes: 45,
    objectives: [
      'Use therapeutic aspiration deliberately and document it accurately.',
      'Plan foreign-body extraction based on object shape, material, chronicity, and airway control.',
      'Choose among forceps, basket, balloon, cryoprobe, and secured-airway approaches.',
    ],
    syllabusSections: ['10', '14.6'],
    learnBlocks: [
      {
        id: 'therapeutic-aspiration',
        title: 'Therapeutic aspiration is active airway work',
        paragraphs: [
          'Meaningful clearance of retained secretions, blood, or clot should be planned, performed, and documented as therapeutic aspiration rather than casual suctioning.',
        ],
      },
      {
        id: 'foreign-body-planning',
        title: 'The object determines the extraction plan',
        paragraphs: [
          'Smooth round objects are hard to pinch, organic material may freeze to cryo, sharp objects need airway protection, and chronic objects may bleed from granulation tissue.',
        ],
      },
    ],
    practiceActivities: [
      {
        type: 'simulator',
        id: 'suction-base',
        title: 'Suction at the base',
        prompt:
          'Practice aiming suction at the base of retained material instead of burying the scope tip.',
        simulator: 'suction',
      },
      {
        type: 'drag-drop',
        id: 'foreign-body-tools',
        title: 'Foreign-body tool match',
        prompt: 'Match common scenarios to a primary extraction approach.',
        pairs: [
          { id: 'smooth', left: 'Smooth round mobile object', right: 'Basket' },
          { id: 'organic', left: 'Organic food material', right: 'Cryoprobe or basket' },
          {
            id: 'sharp',
            left: 'Large sharp object',
            right: 'Secured airway or rigid bronchoscopy',
          },
          {
            id: 'peripheral',
            left: 'Peripheral lodged object',
            right: 'Balloon dislodge, then retrieve',
          },
        ],
      },
    ],
    assessmentItems: [
      {
        prompt: 'Which tool often captures a smooth round mobile foreign body better than forceps?',
        options: ['Basket', 'BAL syringe', 'Suction valve only', 'Cytology brush'],
        answerIndex: 0,
        explanation: 'A basket can lasso and hold smooth objects that forceps may slide off.',
      },
      {
        prompt: 'Why can cryoprobe extraction work well for organic material?',
        options: [
          'Organic material often contains water and can freeze to the probe',
          'Metal freezes faster than tissue',
          'Cryoprobes are always hemostatic',
          'Cryoprobes do not require airway planning',
        ],
        answerIndex: 0,
        explanation:
          'Water-containing material can adhere to a cryoprobe, but airway control and backup plans still matter.',
      },
    ],
    assets: [],
    safetyNotes: [procedureSafety],
  },
  {
    id: 'icu-bronchoscopy',
    slug: 'icu-bronchoscopy',
    title: 'ICU Bronchoscopy Physiology & Sampling',
    shortTitle: 'ICU Bronchoscopy',
    summary:
      'Understand ventilated bronchoscopy physiology, secretion clearance, deterioration, and ICU pneumonia sampling tradeoffs.',
    estimatedMinutes: 45,
    objectives: [
      'Explain why bronchoscopy through an ETT creates obstructive physiology.',
      'Adjust ventilator and procedural decisions to reduce hypoxemia, hypercapnia, auto-PEEP, and hemodynamic collapse.',
      'Compare ETA, protected specimen brush, and BAL for suspected ventilator-associated pneumonia.',
    ],
    syllabusSections: ['11', '14.5'],
    learnBlocks: [
      {
        id: 'ett-physiology',
        title: 'The bronchoscope becomes an obstruction in the ETT',
        visual: 'icu-physiology',
        paragraphs: [
          'Passing a scope through an endotracheal tube reduces the remaining cross-sectional area for ventilation. The clinical effect depends on ETT size, scope diameter, ventilator settings, secretions, and patient reserve.',
        ],
      },
      {
        id: 'icu-sampling',
        title: 'ICU sampling is a decision, not a reflex',
        paragraphs: [
          'ETA is fast and sensitive but less specific. BAL can sample alveolar space and alternate diagnoses, but can worsen oxygenation and depends heavily on technique.',
        ],
      },
    ],
    practiceActivities: [
      {
        type: 'simulator',
        id: 'icu-ett-obstruction',
        title: 'Ventilated bronchoscopy obstruction',
        prompt: 'Estimate how much ETT area the scope occupies and what that means for monitoring.',
        simulator: 'ett-occlusion',
      },
      {
        type: 'case-triage',
        id: 'vap-sampling',
        title: 'VAP sampling choice',
        prompt: 'Choose a sampling approach for suspected ICU pneumonia.',
        cases: [
          {
            id: 'unstable-hypoxemia',
            title: 'High oxygen need and marginal ventilation',
            scenario:
              'A ventilated patient has severe hypoxemia, rising plateau pressures, and moderate secretions. Antibiotics are already started.',
            bestChoiceId: 'stabilize',
            choices: [
              {
                id: 'scope',
                label: 'Immediate BAL with large scope',
                verdict: 'scope',
                feedback:
                  'This may worsen ventilation. Stabilize and consider whether bronchoscopy will change management.',
              },
              {
                id: 'stabilize',
                label: 'Optimize physiology and consider less invasive sampling first',
                verdict: 'stabilize',
                feedback:
                  'Best choice: bronchoscopy may still be needed, but the physiology and alternatives must be addressed first.',
              },
            ],
          },
        ],
      },
    ],
    assessmentItems: [
      {
        prompt: 'A scope that is too large for an ETT can cause:',
        options: [
          'Airway obstruction, hypoventilation, air trapping, auto-PEEP, and hemodynamic collapse',
          'Improved ventilation by stenting open the ETT',
          'Lower airway resistance',
          'No physiologic effect',
        ],
        answerIndex: 0,
        explanation:
          'The bronchoscope occupies ETT cross-sectional area and can create clinically important obstruction.',
      },
      {
        prompt:
          'Which ICU sampling method is fastest but less specific because colonization is common?',
        options: [
          'Endotracheal aspirate',
          'Rigid bronchoscopy',
          'Airway stent',
          'Foreign-body basket',
        ],
        answerIndex: 0,
        explanation:
          'Endotracheal aspirates are fast and easy but require clinical correlation because colonization and contamination are common.',
      },
    ],
    assets: [],
    safetyNotes: [procedureSafety],
  },
  {
    id: 'airway-emergencies',
    slug: 'airway-emergencies',
    title: 'Airway Emergencies',
    shortTitle: 'Emergencies',
    summary:
      'Practice first moves for bleeding, massive hemoptysis, bronchial blocker problems, and critical central airway obstruction.',
    estimatedMinutes: 50,
    objectives: [
      'Prioritize oxygenation and good-lung protection before chasing a bleeding source.',
      'Use a basic airway bleeding sequence and know when to escalate.',
      'Plan critical central airway obstruction by pattern and CT anatomy.',
    ],
    syllabusSections: ['7', '12', '14.4', '14.7', '14.8'],
    learnBlocks: [
      {
        id: 'protect-good-lung',
        title: 'Protect the good lung first',
        visual: 'bleeding',
        paragraphs: [
          'Airway bleeding becomes life-threatening when blood floods the nonbleeding lung or ventilation fails. The first priority is airway protection, not perfect diagnosis.',
        ],
      },
      {
        id: 'cao-planning',
        title: 'Central airway obstruction planning starts with CT',
        paragraphs: [
          'The team should determine level, length, severity, intrinsic versus extrinsic disease, and whether the obstruction is fixed or dynamic before instrumenting the airway.',
        ],
      },
    ],
    practiceActivities: [
      {
        type: 'simulator',
        id: 'bleeding-sequence',
        title: 'Bleeding algorithm simulator',
        prompt: 'Select the first six moves in a basic airway bleeding sequence.',
        simulator: 'bleeding',
      },
      {
        type: 'sequence-builder',
        id: 'massive-hemoptysis',
        title: 'Massive hemoptysis priorities',
        prompt: 'Build the initial response sequence.',
        steps: [
          {
            id: 'recognize',
            label: 'Recognize respiratory threat',
            rationale: 'Massive is defined by threat, not just volume.',
          },
          {
            id: 'position',
            label: 'Bleeding side down when known',
            rationale: 'Reduces contamination of the good lung.',
          },
          {
            id: 'airway',
            label: 'Secure airway with large single-lumen ETT when needed',
            rationale: 'Allows bronchoscopy and blocker placement.',
          },
          {
            id: 'clear',
            label: 'Clear and protect the good lung',
            rationale: 'Maintains oxygenation.',
          },
          {
            id: 'definitive',
            label: 'Arrange definitive therapy',
            rationale: 'Often bronchial artery embolization or surgery.',
          },
        ],
      },
    ],
    assessmentItems: [
      {
        prompt: 'The first priority in brisk airway bleeding is to:',
        options: [
          'Protect oxygenation and the good lung',
          'Measure exact blood volume',
          'Perform a complete segmental survey',
          'Remove all monitors',
        ],
        answerIndex: 0,
        explanation: 'Protecting the good lung and oxygenation comes before detailed localization.',
      },
      {
        prompt: 'Critical central airway obstruction planning should begin with:',
        options: [
          'Blind intubation',
          'CT review and a pattern-based airway plan',
          'A small cytology brush',
          'Routine discharge instructions',
        ],
        answerIndex: 1,
        explanation:
          'CT defines level, length, severity, and intrinsic/extrinsic/dynamic pattern before airway manipulation.',
      },
    ],
    assets: [],
    safetyNotes: [procedureSafety],
  },
  {
    id: 'documentation-communication',
    slug: 'documentation-communication',
    title: 'Documentation & Team Communication',
    shortTitle: 'Documentation',
    summary:
      'Turn bronchoscopy findings, specimens, complications, and next steps into clear procedure notes and immediate team communication.',
    estimatedMinutes: 35,
    objectives: [
      'Document indication, airway route, extent of inspection, findings, samples, interventions, complications, and plan.',
      'Write precise airway findings and BAL documentation.',
      'Communicate urgent bronchoscopy findings to the treating team.',
    ],
    syllabusSections: ['13', '14.9', '14.11'],
    learnBlocks: [
      {
        id: 'report-purpose',
        title: 'A bronchoscopy note is a clinical communication tool',
        paragraphs: [
          'The note should let a colleague who was not in the room understand why the procedure was done, what was found, what was performed, what specimens were obtained, what complications occurred, and what happens next.',
        ],
      },
      {
        id: 'document-actual',
        title: 'Document what happened, not what you intended',
        paragraphs: [
          'If a BAL did not meet BAL standards, call it an airway wash or bronchial wash. If therapeutic aspiration meaningfully cleared secretions, document it clearly.',
        ],
      },
    ],
    practiceActivities: [
      {
        type: 'report-builder',
        id: 'procedure-note-builder',
        title: 'Procedure-note builder',
        prompt: 'Check whether a procedure note includes the required elements.',
        requiredElements: [
          'indication',
          'airway route',
          'extent of inspection',
          'findings by region',
          'samples and tests',
          'complications',
          'post-procedure plan',
        ],
        exampleFinding:
          'Therapeutic aspiration of copious thick tan secretions from the bronchus intermedius, RML, and RLL basilar segments until segmental airways were patent.',
      },
      {
        type: 'drag-drop',
        id: 'handoff-match',
        title: 'Post-procedure communication match',
        prompt: 'Match the finding to the immediate communication need.',
        pairs: [
          {
            id: 'fungal',
            left: 'Suspicion of invasive fungal infection',
            right: 'Call treating team promptly',
          },
          {
            id: 'pneumo',
            left: 'Pneumothorax concern',
            right: 'Arrange imaging and escalation plan',
          },
          {
            id: 'sample',
            left: 'Inadequate sample quality',
            right: 'Explain limitations and next diagnostic step',
          },
          {
            id: 'obstruction',
            left: 'Critical airway obstruction',
            right: 'Urgent IP/thoracic/anesthesia planning',
          },
        ],
      },
    ],
    assessmentItems: [
      {
        prompt: 'Which BAL documentation element is essential?',
        options: [
          'Total saline instilled and return volume',
          'The color of the bronchoscopy tower',
          'The brand of the keyboard',
          'The hallway location',
        ],
        answerIndex: 0,
        explanation:
          'BAL documentation should include target, wedge status, instilled volume, returned volume, return character, and tests sent.',
      },
      {
        prompt: 'Which phrase is most accurate when meaningful secretion clearance was performed?',
        options: [
          'Looked around',
          'Therapeutic aspiration of secretions performed until target airways were patent',
          'No procedure occurred',
          'Biopsy of all lobes',
        ],
        answerIndex: 1,
        explanation:
          'Document therapeutic aspiration when retained secretions, blood, or clot are meaningfully cleared.',
      },
    ],
    assets: [],
    safetyNotes: [procedureSafety],
  },
] satisfies IntroBronchoscopyModule[]

export const introBronchoscopyModuleSlugs = introBronchoscopyModules.map((module) => module.slug)

export function getIntroBronchoscopyModule(slug: string): IntroBronchoscopyModule | undefined {
  return introBronchoscopyModules.find((module) => module.slug === slug)
}

export function getNextIntroBronchoscopyModule(slug: string): IntroBronchoscopyModule | undefined {
  const index = introBronchoscopyModules.findIndex((module) => module.slug === slug)
  return index >= 0 ? introBronchoscopyModules[index + 1] : undefined
}

export function getPreviousIntroBronchoscopyModule(
  slug: string,
): IntroBronchoscopyModule | undefined {
  const index = introBronchoscopyModules.findIndex((module) => module.slug === slug)
  return index > 0 ? introBronchoscopyModules[index - 1] : undefined
}
