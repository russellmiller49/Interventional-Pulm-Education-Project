import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Thoracentesis module, aligned to the Learn
 * objectives (safe access, vessel risk, bleeding-risk framing, manometry, and
 * stopping rules). Commit-first: explanations appear only after answering.
 */
export const thoracentesisQuizQuestions: QuizQuestion[] = [
  {
    prompt: 'To avoid the intercostal neurovascular bundle, the needle should pass:',
    options: [
      'Just below the rib, in the costal groove',
      'Just above the rib',
      'Through the middle of the interspace, posteriorly',
      'It does not matter if ultrasound shows fluid',
    ],
    answerIndex: 1,
    explanation:
      'The main neurovascular bundle runs in the costal groove on the underside of each rib, so entering just above the rib keeps the needle away from it.',
  },
  {
    prompt: 'Why is a posterior, paravertebral entry (within ~6 cm of the spine) discouraged?',
    options: [
      'The lung is thicker there',
      'The intercostal artery is more exposed and tortuous in that zone',
      'Ultrasound cannot image the posterior chest',
      'The diaphragm is always higher posteriorly',
    ],
    answerIndex: 1,
    explanation:
      'Near the spine the intercostal artery is more exposed and takes a variable, tortuous course, raising bleeding risk. Scanning laterally for a safer window is preferred.',
  },
  {
    prompt:
      'A patient on therapeutic anticoagulation needs a thoracentesis for a symptomatic effusion. The best framing of bleeding risk is:',
    options: [
      'Any anticoagulation is an absolute contraindication',
      'Only the INR matters; if it is under 1.5 proceed',
      'Risk is individualized — weigh indication, urgency, ultrasound guidance, drug/timing, and local policy together',
      'Platelets above 50,000 guarantee safety regardless of other factors',
    ],
    answerIndex: 2,
    explanation:
      'No single lab value decides safety. With ultrasound guidance and a skilled operator, risk is individualized across indication, urgency, the specific drug and its timing, and local policy.',
  },
  {
    prompt: 'During large-volume drainage, the recommended stopping signals are:',
    options: [
      'A fixed volume of exactly 1 liter, always',
      'Symptoms (chest pain, relentless cough) or pleural pressure falling below about −20 cm H₂O',
      'Only when fluid stops flowing completely',
      'When the patient asks how much longer it will take',
    ],
    answerIndex: 1,
    explanation:
      'Drain to symptoms and pressure, not a fixed volume. Stop or slow for chest pain, intractable cough, or a steeply negative pleural pressure (≈ −20 cm H₂O).',
  },
  {
    prompt:
      'Manometry shows a negative baseline opening pressure and an immediate, steep, monophasic pressure drop with minimal fluid removed. This pattern indicates:',
    options: [
      'A normal, fully expandable lung',
      'Trapped lung (a chronic fibrous peel that will not re-expand)',
      'A pneumothorax',
      'Operator error in zeroing the manometer',
    ],
    answerIndex: 1,
    explanation:
      'A negative baseline with an immediate steep monophasic drop is the ex vacuo signature of trapped lung — a chronic restrictive peel. Repeated taps rarely help; an indwelling catheter is often better.',
  },
  {
    prompt:
      'A normal/positive opening pressure with a biphasic curve — gentle decline, then a sharp inflection where pressure falls fast — best fits:',
    options: [
      'Fully expandable lung',
      'Lung entrapment (partial expansion limited by an active process such as malignancy)',
      'Trapped lung',
      'Re-expansion pulmonary edema',
    ],
    answerIndex: 1,
    explanation:
      'A biphasic curve with an inflection point reflects lung entrapment: the lung expands partially before an active process restricts it. This differs from the chronic, monophasic trapped lung.',
  },
  {
    prompt: 'Which combination most increases the risk of re-expansion pulmonary edema?',
    options: [
      'Small-volume drainage of a 2-day-old effusion at near-zero pressure',
      'Rapid removal of a large volume with very negative pleural pressures from a chronically collapsed lung',
      'Stopping early for cough',
      'Using ultrasound guidance',
    ],
    answerIndex: 1,
    explanation:
      'RPE risk rises with rapid large-volume removal, very negative pleural pressures, and lung that has been collapsed a long time. Manometry- and symptom-guided drainage is the main prevention.',
  },
  {
    prompt:
      'Ultrasound and manometry suggest a non-expandable (trapped) lung in a patient with a recurrent effusion. The most appropriate plan is:',
    options: [
      'Schedule weekly large-volume taps indefinitely',
      'Counsel the patient and favor an indwelling pleural catheter over repeated taps',
      'Proceed with talc pleurodesis immediately',
      'Avoid any drainage entirely',
    ],
    answerIndex: 1,
    explanation:
      'A trapped lung will not appose the chest wall, so pleurodesis tends to fail and repeated taps give little durable relief. Counsel the patient and favor an indwelling pleural catheter.',
  },
]
