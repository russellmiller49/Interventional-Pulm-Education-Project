import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Malignant Pleural Effusion module, aligned to the
 * Learn objectives (cytology escalation, expandability-driven choice, talc,
 * IPC, combined strategies, patient goals). Commit-first.
 */
export const mpeQuizQuestions: QuizQuestion[] = [
  {
    prompt: 'Pleural fluid cytology in suspected malignant effusion has a sensitivity of about:',
    options: ['95–99%', '40–60%', 'Under 10%', 'Exactly 75% in all tumors'],
    answerIndex: 1,
    explanation:
      'Cytology sensitivity is roughly 40–60%, so a negative result does not rule out malignancy. With high suspicion after one or two nondiagnostic taps, escalate to tissue diagnosis.',
  },
  {
    prompt:
      'After two nondiagnostic cytology samples in a patient who still looks like MPE, the best next step is:',
    options: [
      'Keep repeating thoracentesis for cytology',
      'Escalate to pleural biopsy or pleuroscopy for tissue',
      'Declare the effusion benign',
      'Start empiric chemotherapy without tissue',
    ],
    answerIndex: 1,
    explanation:
      'Repeated nondiagnostic cytology should not falsely reassure. Escalate to image-guided biopsy or pleuroscopy (≈80–90% yield) rather than cycling fluid-only tests.',
  },
  {
    prompt: 'Which single factor most determines whether pleurodesis can succeed?',
    options: [
      'The tumor histology',
      'Whether the lung re-expands and the pleura can appose',
      'The pleural fluid LDH',
      'The patient’s age',
    ],
    answerIndex: 1,
    explanation:
      'Pleurodesis requires apposition of the visceral and parietal pleura, so lung expandability after drainage is the decisive factor — not tumor type.',
  },
  {
    prompt:
      'A patient with recurrent MPE has a trapped (non-expandable) lung after drainage. The most appropriate definitive option is:',
    options: [
      'Talc pleurodesis',
      'An indwelling pleural catheter (IPC) for symptom control',
      'Repeated weekly thoracentesis indefinitely',
      'Observation only',
    ],
    answerIndex: 1,
    explanation:
      'Pleurodesis fails without lung apposition, so a trapped lung favors an IPC, which controls breathlessness regardless of expandability.',
  },
  {
    prompt:
      'Compared with talc poudrage at thoracoscopy, talc slurry via a chest tube (TAPPS) achieves:',
    options: [
      'Markedly worse pleurodesis',
      'Similar pleurodesis success',
      'No pleurodesis at all',
      'Pleurodesis only in mesothelioma',
    ],
    answerIndex: 1,
    explanation:
      'TAPPS showed similar pleurodesis success for slurry and poudrage, so the route can follow logistics and whether thoracoscopy is already being done.',
  },
  {
    prompt:
      'Adding talc through an indwelling pleural catheter (the IPC-Plus approach) is intended to:',
    options: [
      'Reduce the chance of pleurodesis',
      'Increase successful pleurodesis while keeping outpatient management',
      'Replace the need for any drainage',
      'Treat catheter infection',
    ],
    answerIndex: 1,
    explanation:
      'IPC-Plus combines IPC with talc to increase the rate of pleurodesis while preserving outpatient, catheter-centered care — useful when goals favor both.',
  },
  {
    prompt: 'Pleural infection associated with an IPC is:',
    options: [
      'Almost always fatal',
      'Common (about 50%) and always requires removal',
      'Uncommon (about 5–6%) and often managed with antibiotics without removing the catheter',
      'Impossible because the catheter is tunneled',
    ],
    answerIndex: 2,
    explanation:
      'IPC-related pleural infection occurs in roughly 5–6% and can frequently be managed with antibiotics while leaving the catheter in place.',
  },
  {
    prompt: 'The overall goal of malignant pleural effusion management is best described as:',
    options: [
      'Achieving a radiographically empty pleural space at any cost',
      'Controlling symptoms (usually breathlessness) in line with patient goals',
      'Maximizing the number of thoracenteses',
      'Always achieving device-free pleurodesis',
    ],
    answerIndex: 1,
    explanation:
      'The endpoint is symptom control matched to what the patient values (hospital-free days, a device-free chest, speed of relief), not an empty space or endless taps.',
  },
]
