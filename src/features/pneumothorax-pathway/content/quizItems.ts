import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Pneumothorax module, aligned to the Learn objectives
 * (stability, PSP vs SSP, size-is-not-everything, ACCP vs BTS, persistent air
 * leak, recurrence prevention). Commit-first.
 */
export const pneumothoraxQuizQuestions: QuizQuestion[] = [
  {
    prompt:
      'A patient has a pneumothorax with hypotension and severe hypoxia. The first action is:',
    options: [
      'Observe and repeat imaging in 6 hours',
      'Immediate decompression and chest drainage regardless of measured size',
      'Send for outpatient ambulatory device fitting',
      'Start suction and wait',
    ],
    answerIndex: 1,
    explanation:
      'Tension physiology (hemodynamic compromise or severe hypoxia) is an emergency. Decompress and drain immediately — size does not change that.',
  },
  {
    prompt:
      'Compared with a primary spontaneous pneumothorax, a secondary one (e.g., in COPD) is generally:',
    options: [
      'Managed more conservatively because patients tolerate it better',
      'Managed more aggressively (chest drain and admission) because reserve is low',
      'Identical in management',
      'Never drained',
    ],
    answerIndex: 1,
    explanation:
      'Secondary spontaneous pneumothorax occurs in patients with little respiratory reserve, so it is generally treated with a chest drain and admission rather than observation.',
  },
  {
    prompt: 'In current guidance (BTS 2023 / ERS 2024), the size of a stable pneumothorax is:',
    options: [
      'The single determinant of treatment',
      'One factor among symptoms, type, patient priorities, and follow-up reliability',
      'Irrelevant in every case',
      'Only used for secondary pneumothorax',
    ],
    answerIndex: 1,
    explanation:
      'Modern pathways de-emphasize a single size cutoff for stable patients and weigh symptoms, PSP vs SSP, patient preference, and reliable follow-up.',
  },
  {
    prompt:
      'A stable, symptomatic primary spontaneous pneumothorax is where the frameworks most diverge. The key difference is:',
    options: [
      'ACCP 2001 reacts mainly to size; BTS 2023 prioritizes symptoms, patient preference, and ambulatory options',
      'BTS 2023 always recommends surgery; ACCP 2001 always observes',
      'They are identical for this scenario',
      'Both mandate immediate pleurodesis',
    ],
    answerIndex: 0,
    explanation:
      'The classic divergence: ACCP 2001 is size-driven, while BTS 2023 emphasizes symptom burden, patient priorities, and ambulatory/aspiration options.',
  },
  {
    prompt: 'Conservative (observation) management is most reasonable for:',
    options: [
      'A ventilated patient with a traumatic pneumothorax',
      'A stable, minimally symptomatic primary spontaneous pneumothorax with reliable follow-up',
      'Any secondary spontaneous pneumothorax',
      'A patient with tension physiology',
    ],
    answerIndex: 1,
    explanation:
      'Stable, minimally symptomatic PSP can often be observed with safety-netting and reliable follow-up — procedure avoidance is reasonable here.',
  },
  {
    prompt:
      'A chest drain has been in for several days with an ongoing air leak. The best next step is:',
    options: [
      'Immediately apply high suction',
      'Troubleshoot the drain and circuit, avoid unnecessary suction, and plan time-bounded specialist escalation',
      'Remove the drain and discharge',
      'Clamp the drain and observe overnight',
    ],
    answerIndex: 1,
    explanation:
      'First confirm the leak is real by checking the drain and connections. Avoid unnecessary suction (it can propagate the leak) and escalate to a specialist in a time-bounded way.',
  },
  {
    prompt:
      'Bronchoscopic management of a persistent peripheral (alveolar-pleural) air leak may include:',
    options: [
      'Endobronchial valves after balloon-occlusion mapping',
      'Routine lobectomy for all leaks',
      'High-dose systemic antibiotics alone',
      'Permanent clamping of the chest tube',
    ],
    answerIndex: 0,
    explanation:
      'Balloon-occlusion mapping localizes the culprit segment, and one-way endobronchial valves (or spigots/sealants) can reduce or stop a persistent alveolar-pleural leak.',
  },
  {
    prompt: 'Which feature most strongly prompts a definitive recurrence-prevention discussion?',
    options: [
      'A first primary pneumothorax in a non-smoker office worker',
      'A recurrence, a secondary pneumothorax, or a high-risk occupation (e.g., diving or aviation)',
      'Complete resolution on the first chest X-ray',
      'A small apical pneumothorax found incidentally and asymptomatic',
    ],
    answerIndex: 1,
    explanation:
      'Recurrence, secondary pneumothorax, and high-risk occupations (aviation, diving) lower the threshold for definitive prevention such as pleurodesis or surgery.',
  },
]
