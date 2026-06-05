import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Pleural Infection module, aligned to the Learn
 * objectives (staging, drainage thresholds, MIST2, surgery, irrigation, RAPID).
 * Commit-first: explanations appear only after answering.
 */
export const infectionQuizQuestions: QuizQuestion[] = [
  {
    prompt:
      'Which pleural-fluid value is the single strongest chemical indicator that a parapneumonic effusion needs drainage?',
    options: ['pH ≤ 7.2', 'Protein > 3 g/dL', 'Lymphocyte predominance', 'Amylase > 100 IU/L'],
    answerIndex: 0,
    explanation:
      'A pleural pH of 7.2 or lower is the strongest single chemical indicator for drainage. Low glucose (<60 mg/dL) and high LDH (>1000 IU/L) support it, but pH carries the most weight.',
  },
  {
    prompt: 'Frank pus is aspirated from the pleural space. The correct framing is:',
    options: [
      'Treat with antibiotics alone and recheck chemistry first',
      'It is an empyema — drain and pursue source control regardless of the pH',
      'Send pH; only drain if pH < 7.2',
      'Observe unless the patient is febrile',
    ],
    answerIndex: 1,
    explanation:
      'Frank pus (or a positive Gram stain/culture) defines empyema. It mandates drainage and source control; you do not need chemistry to make that call.',
  },
  {
    prompt: 'Based on MIST2, the intrapleural enzyme regimen that improves outcomes is:',
    options: ['DNase alone', 'tPA alone', 'Combination tPA + DNase', 'Streptokinase alone'],
    answerIndex: 2,
    explanation:
      'MIST2 showed combination tPA + DNase improved radiographic clearance and reduced surgical referral and length of stay. Single-agent tPA did not show the same benefit.',
  },
  {
    prompt: 'In MIST2, intrapleural DNase given alone was:',
    options: [
      'The most effective single agent',
      'Equivalent to combination therapy',
      'Not beneficial (and a recognized teaching trap)',
      'Contraindicated because of allergy risk',
    ],
    answerIndex: 2,
    explanation:
      'DNase monotherapy was not beneficial and may worsen drainage — a classic trap. The benefit comes from the tPA + DNase combination, not either agent alone.',
  },
  {
    prompt: 'When should empiric antibiotics for pleural infection cover anaerobes?',
    options: [
      'Never — pleural infection is always pneumococcal',
      'Routinely — anaerobic coverage is part of standard empiric therapy',
      'Only if the culture grows anaerobes',
      'Only in immunocompromised patients',
    ],
    answerIndex: 1,
    explanation:
      'Anaerobes are common in pleural infection, so empiric regimens should cover them, then be tailored to community- versus hospital-acquired risk, local resistance, and culture results.',
  },
  {
    prompt:
      'A patient with empyema has a working drain and has received tPA + DNase but continues to deteriorate with an organized collection. The next step is:',
    options: [
      'Stop antibiotics',
      'Surgical referral (e.g., VATS)',
      'Repeat the same lytic course indefinitely',
      'Remove the drain and observe',
    ],
    answerIndex: 1,
    explanation:
      'Failure to improve despite a working drain and enzyme therapy, or an organized empyema, is an indication for surgery. Surgical referral should be a planned escalation, made early in non-responders.',
  },
  {
    prompt: 'Normal saline pleural irrigation is best presented as:',
    options: [
      'The first-line therapy for all empyemas',
      'A selected alternative when lytic therapy is unsuitable or bleeding risk cannot be mitigated',
      'A replacement for antibiotics',
      'Equivalent to surgery in all patients',
    ],
    answerIndex: 1,
    explanation:
      'Saline irrigation is supported by pilot data as a selected alternative — useful when lytics are unsuitable or bleeding risk is prohibitive — not a universal replacement for drainage, combination therapy, or surgery.',
  },
  {
    prompt: 'The RAPID score in pleural infection is used to:',
    options: [
      'Decide the antibiotic dose',
      'Risk-stratify mortality to guide monitoring and escalation discussions',
      'Set the exact chest-tube size',
      'Diagnose the causative organism',
    ],
    answerIndex: 1,
    explanation:
      'RAPID (Renal/urea, Age, Purulence, Infection source, Dietary/albumin) risk-stratifies mortality. It informs how closely to monitor and when to escalate — it does not itself dictate whether to drain.',
  },
]
