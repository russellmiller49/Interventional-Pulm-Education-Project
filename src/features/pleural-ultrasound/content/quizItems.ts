import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Pleural Ultrasound module, aligned to the Learn
 * objectives (why ultrasound first, the four patterns, safe window, dynamic
 * signs). Commit-first: the explanation only appears after the learner answers.
 */
export const ultrasoundQuizQuestions: QuizQuestion[] = [
  {
    prompt:
      'Compared with landmark-only technique, what is the main benefit of real-time ultrasound guidance for thoracentesis?',
    options: [
      'It reliably distinguishes a transudate from an exudate',
      'It reduces pneumothorax and failed ("dry") taps',
      'It removes the need for pleural fluid analysis',
      'It eliminates the need for any post-procedure assessment',
    ],
    answerIndex: 1,
    explanation:
      'Ultrasound is standard of care because real-time guidance increases success and lowers complications — fewer pneumothoraces and dry taps. It does not classify the fluid chemically; that still requires fluid analysis.',
  },
  {
    prompt:
      'A pleural effusion looks uniformly anechoic (black) with no septations. What can you conclude?',
    options: [
      'It is a transudate and needs no further work-up',
      'It is safe to leave undrained regardless of symptoms',
      'A simple appearance does not exclude an exudate, TB, or malignancy',
      'It must be infected because all anechoic fluid is purulent',
    ],
    answerIndex: 2,
    explanation:
      'A simple anechoic appearance is reassuring about access but does not establish the cause. Exudates, tuberculosis, and malignancy can all appear anechoic — pair the image with the clinical story and fluid analysis.',
  },
  {
    prompt: 'Septations and loculations within an effusion should make you think of:',
    options: [
      'A pure transudate from heart failure',
      'Fibrinous/organizing infection, blood, or malignant complexity needing drainage and source control',
      'An artifact that can be ignored',
      'A reason to avoid drainage entirely',
    ],
    answerIndex: 1,
    explanation:
      'Septations suggest fibrin deposition from infection, blood, or malignant involvement. They predict that simple aspiration will fall short and should prompt drainage and source-control thinking.',
  },
  {
    prompt: 'To minimize the risk of intercostal vessel injury, the needle should be inserted:',
    options: [
      'Just below the rib, near the costal groove',
      'Just above the rib, avoiding the posterior paravertebral zone',
      'Anywhere, as long as ultrasound shows fluid',
      'As far posteriorly and medially as possible',
    ],
    answerIndex: 1,
    explanation:
      'The neurovascular bundle runs in the costal groove below each rib, so enter just above the rib. The intercostal artery is most exposed and tortuous in the posterior paravertebral region, which should be avoided.',
  },
  {
    prompt:
      'On M-mode through an effusion you see the visceral pleura move toward the chest wall in inspiration, tracing a sine wave. This sinusoid sign indicates:',
    options: [
      'A pneumothorax',
      'Free-flowing, low-viscosity fluid that should drain readily',
      'A densely loculated empyema',
      'Trapped lung that cannot re-expand',
    ],
    answerIndex: 1,
    explanation:
      'The sinusoid sign reflects respiratory motion of free-flowing fluid and predicts that the effusion will drain readily. Heavily loculated collections lose this sign.',
  },
  {
    prompt:
      'During a focused post-procedure scan, lung sliding is absent and M-mode shows a "barcode" (stratosphere) sign instead of the seashore sign. This suggests:',
    options: ['Normal re-expanded lung', 'A large residual effusion', 'Pneumothorax', 'Hemothorax'],
    answerIndex: 2,
    explanation:
      'Lung sliding (the seashore sign on M-mode) requires apposed, moving pleura. Its loss, with a barcode/stratosphere pattern, raises pneumothorax — a key reason ultrasound can be more actionable than a routine post-tap chest X-ray.',
  },
  {
    prompt:
      'A scan shows B-lines and subpleural consolidation but no discrete fluid pocket. The best interpretation is:',
    options: [
      'This is an ideal thoracentesis target',
      'There is no drainable pleural collection in this view — it is not a thoracentesis target',
      'Drain immediately to prevent empyema',
      'The findings confirm a transudate',
    ],
    answerIndex: 1,
    explanation:
      'B-lines and subpleural consolidation are lung findings, not a pleural fluid pocket. Without a discrete drainable collection there is no safe target; keep scanning or reconsider the clinical question.',
  },
  {
    prompt:
      'Before draining a recurrent effusion, ultrasound shows atelectatic lung that does not swirl or re-expand as fluid is removed. This most likely indicates:',
    options: [
      'A simple effusion that will resolve with one tap',
      'Non-expandable (trapped) lung, which may favor an indwelling catheter over repeated taps',
      'A pneumothorax',
      'That the probe frequency is too low',
    ],
    answerIndex: 1,
    explanation:
      'Lung that fails to re-expand suggests a non-expandable/trapped lung. Recognizing it changes consent and management — repeated large-volume taps are unlikely to help, and an indwelling pleural catheter is often preferred.',
  },
]
