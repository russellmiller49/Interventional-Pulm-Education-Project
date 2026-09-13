import type { EbusCase } from './types'
import { question as q } from './authoring'
export const FINAL_CASES: EbusCase[] = [
  {
    id: 'assessment-planning',
    title: 'Before the first examination',
    topic: 'Prepare',
    context:
      'A patient with a left lung mass and several enlarged mediastinal nodes is referred for EBUS. Diagnosis and nodal staging will affect the treatment discussion. The patient reports a newly prescribed anticoagulant; the team has not yet clarified the last dose.',
    lessonIds: ['clinical-question', 'preparation'],
    sources: ['ers2026', 'ics2023', 'chest2024'],
    questions: [
      q(
        'planning-ready',
        'Which unresolved issue should be addressed before this elective procedure starts?',
        [
          'The anticoagulant history and individualized procedural plan',
          'Clarify the drug, indication, last dose, and relevant patient factors before agreeing on timing.',
        ],
        [
          'Whether the largest node should automatically be the only target',
          'Target size does not settle either readiness or the complete staging plan.',
        ],
        [
          'Whether image contrast can reduce bleeding risk',
          'Contrast changes the image display, not anticoagulant effect.',
        ],
      ),
      q(
        'planning-purpose',
        'If one node yields carcinoma, which further question remains relevant to this referral?',
        [
          'The distribution of involvement across the relevant stations',
          'One diagnostic sample may not complete the requested nodal staging examination.',
        ],
        [
          'Whether every enlarged node is now proven malignant',
          'The other nodes have not acquired a tissue result.',
        ],
        [
          'Whether the primary tumor side can be ignored',
          'Primary side remains relevant to nodal classification.',
        ],
      ),
      q(
        'planning-handoff',
        'What should be agreed with pathology before collecting all material?',
        [
          'Specimen allocation and requested studies',
          'Early planning preserves material for the tests that will inform care.',
        ],
        [
          'A final diagnosis based on PET uptake alone',
          'Imaging helps prioritize questions but does not establish pathology.',
        ],
        [
          'A single pooled container for all stations',
          'Pooling can destroy information needed for nodal staging.',
        ],
      ),
    ],
  },
  {
    id: 'assessment-image',
    title: 'An image changes during the examination',
    topic: 'Optimize',
    context:
      'During examination of a second nodal target, tissue echoes fade when the transducer moves away from the wall. After the prior window is restored, the target is visible but its far margin is cropped. A dark structure lies beside the intended path.',
    lessonIds: ['acoustic-contact', 'image-depth', 'doppler'],
    sources: ['ics2023', 'simulation'],
    questions: [
      q(
        'image-window',
        'Which action addresses the initial fading of echoes most directly?',
        [
          'Restore wall contact',
          'The positional loss of echoes suggests an acoustic-window problem.',
        ],
        ['Measure the blank sector', 'A measurement does not restore a missing acoustic window.'],
        ['Classify the target as avascular', 'Absent tissue echoes cannot establish vascularity.'],
      ),
      q(
        'image-field',
        'With contact restored, which setting should be reconsidered for the cropped far margin?',
        ['Image depth', 'The field should include the target and relevant tissue beyond it.'],
        ['The number of needle passes', 'Pass count does not change the field displayed.'],
        ['The specimen medium', 'Specimen handling does not change the ultrasound image.'],
      ),
      q(
        'image-vessel',
        'Color Doppler shows no flow in the dark structure, but its anatomy remains suspicious for a vessel. What should happen before puncture?',
        [
          'Reassess flow settings and anatomy until the path is adequately understood',
          'Absent color alone cannot clear an uncertain path.',
        ],
        [
          'Puncture immediately because the structure has no color',
          'Undetected flow does not prove absence of a vessel.',
        ],
        [
          'Use the darkest part of the structure as the needle target',
          'Dark appearance alone does not establish a safe tissue target.',
        ],
        'both',
      ),
    ],
  },
  {
    id: 'assessment-map',
    title: 'Reconcile the station labels',
    topic: 'Locate',
    context:
      'A patient has a left lung primary. One target is right paratracheal, below the brachiocephalic-vein crossing and above the lower border of the azygos vein. A second target lies between the left upper- and lower-lobe bronchi.',
    lessonIds: ['right-paratracheal', 'hilar-interlobar', 'systematic-staging'],
    sources: ['atlas', 'iaslc9'],
    questions: [
      q(
        'map-right',
        'Which station fits the described right paratracheal target?',
        ['4R', 'The stated vascular boundaries define the lower right paratracheal compartment.'],
        [
          '10R',
          'The target is above the lower azygos boundary, rather than in the specified hilar compartment.',
        ],
        [
          '2R',
          'The target is below the brachiocephalic-vein crossing used for the 2R/4R boundary.',
        ],
      ),
      q(
        'map-left',
        'Which station fits the target between the left lobar bronchi?',
        ['11L', 'This is the left interlobar compartment.'],
        [
          '7',
          'The target is at a left lobar bifurcation, not in the medial subcarinal compartment.',
        ],
        ['4L', 'The stated location is interlobar rather than lower paratracheal.'],
      ),
      q(
        'map-category',
        'For this left lung primary, what N category would malignant involvement of the described right paratracheal target represent?',
        ['N3', 'Contralateral mediastinal involvement is N3.'],
        ['N1', 'N1 refers to ipsilateral hilar and intrapulmonary nodal involvement.'],
        ['N2a', 'A contralateral mediastinal target is not an ipsilateral N2 station.'],
      ),
    ],
  },
  {
    id: 'assessment-access',
    title: 'A target remains unassessed',
    topic: 'Plan',
    context:
      'The airway examination has assessed several mediastinal stations. A lower paraesophageal node remains relevant to the clinical question. Separately, a lateral subaortic target is described on CT, and no acceptable standard airway window has been found.',
    lessonIds: ['left-paratracheal', 'eus-b', 'difficult-acquisition'],
    sources: ['atlas', 'ers2026', 'ics2023'],
    questions: [
      q(
        'access-lower',
        'Which approach may add access to the lower paraesophageal target?',
        [
          'A planned EUS or EUS-B examination',
          'An esophageal route can complement airway EBUS for lower mediastinal targets such as station 8.',
        ],
        [
          'More proximal airway rotation alone as a guaranteed solution',
          'A different airway angle does not guarantee access to a lower paraesophageal compartment.',
        ],
        ['A routine right interlobar pass', 'That samples a different anatomical compartment.'],
      ),
      q(
        'access-lateral',
        'The subaortic target is lateral to the ligamentum arteriosum. Which station should be considered?',
        ['5', 'The lateral subaortic compartment differs from medial 4L.'],
        [
          '4L solely because it is near the aortic arch',
          'Proximity to the arch alone does not define 4L.',
        ],
        ['11L', 'The target is subaortic rather than between the left lobar bronchi.'],
      ),
      q(
        'access-report',
        'How should a clinically important target with no safe sampling route be handled in the report?',
        [
          'Describe the unassessed target and the agreed further diagnostic plan',
          'An inaccessible target remains an unresolved part of the clinical question.',
        ],
        [
          'Report it as negative because no malignant material was collected',
          'No tissue result was obtained from that target.',
        ],
        [
          'Omit it because the completed stations were adequate',
          'Adequacy at other sites does not erase an unassessed target.',
        ],
      ),
    ],
  },
  {
    id: 'assessment-distribution',
    title: 'Preserve the distribution of disease',
    topic: 'Plan',
    context:
      'A right lung primary has targets at 4L, 4R, 7, and 11R. Each has an acceptable sampling window. Final pathology later identifies malignancy at 4R and 7, with representative negative sampling at 4L.',
    lessonIds: ['systematic-staging', 'specimen-triage'],
    sources: ['iaslc9', 'ics2023', 'ers2026'],
    questions: [
      q(
        'distribution-first',
        'Which of these targets should be sampled first in the stated staging sequence?',
        ['4L', 'For a right lung primary, 4L is a contralateral mediastinal N3 target.'],
        [
          '11R',
          'This ipsilateral interlobar N1 target is sampled after the higher-category targets.',
        ],
        [
          'The primary tumor regardless of the nodal plan',
          'Sampling a tumor before higher-category nodes can complicate contamination control.',
        ],
      ),
      q(
        'distribution-n2',
        'Based on the stated positive 4R and 7 stations, which N2 subdivision fits?',
        ['N2b', 'Two distinct ipsilateral mediastinal/subcarinal stations are involved.'],
        [
          'N2a because one lung is the primary site',
          'The subdivision depends on the number of involved N2 stations, not the number of primary lungs.',
        ],
        [
          'N3 because station 7 is shared by both lungs',
          'Station 7 is an N2 station for either primary side.',
        ],
      ),
      q(
        'distribution-labels',
        'If the material from 4R and 7 had been pooled into an unlabeled container, what would be lost?',
        [
          'Station-specific attribution of the finding',
          'Pooling may establish malignancy while preventing a station-specific distribution from being inferred.',
        ],
        [
          'All ability to recognize malignant cells',
          'Malignant cells may still be recognizable; the lost information is their anatomical source.',
        ],
        [
          'Only the record of processor gain',
          'The principal problem is specimen identity, not the image setting.',
        ],
      ),
    ],
  },
  {
    id: 'assessment-sampling',
    title: 'During tissue acquisition',
    topic: 'Sample',
    context:
      'The team is sampling a node for suspected lung carcinoma. The needle shaft is seen, but the tip briefly leaves the ultrasound plane. After a safely completed pass, ROSE identifies malignant cells. Biomarker studies are planned.',
    lessonIds: ['needle-safety', 'adequacy-rose', 'capture'],
    sources: ['ics2023', 'chest2024'],
    questions: [
      q(
        'sampling-tip',
        'What should occur when the tip is no longer identifiable?',
        [
          'Stop movement and restore tip visualization',
          'The shaft alone does not establish the position of the tip.',
        ],
        [
          'Continue advancing using the visible shaft as a guide',
          'Continuing without the tip risks unintended penetration.',
        ],
        [
          'Freeze the image and continue the pass',
          'A frozen frame cannot provide real-time guidance.',
        ],
        'both',
      ),
      q(
        'sampling-adequacy',
        'What does the positive ROSE finding leave to be confirmed?',
        [
          'Final pathology and adequacy for the planned biomarker studies',
          'On-site recognition of malignant cells does not guarantee sufficient material for all requested assays.',
        ],
        [
          'That no further laboratory processing is needed',
          'Final processing and any requested studies remain necessary.',
        ],
        [
          'That every other nodal station has the same diagnosis',
          'ROSE describes the submitted specimen, not all stations.',
        ],
      ),
      q(
        'sampling-passes',
        'How should the CHEST 2024 recommendation for four or more passes in suspected malignancy be used?',
        [
          'As acquisition guidance alongside tissue requirements and patient safety',
          'The recommendation does not prove that an individual specimen set is adequate or override a safety concern.',
        ],
        [
          'As permission to continue despite significant deterioration',
          'Patient safety takes priority over a numerical target.',
        ],
        [
          'As a guarantee of successful molecular testing',
          'Cellularity, tumor content, and assay requirements remain relevant.',
        ],
      ),
    ],
  },
  {
    id: 'assessment-differential',
    title: 'An unresolved cause of adenopathy',
    topic: 'Sample',
    context:
      'A patient has unexplained mediastinal adenopathy. Lymphoma, granulomatous inflammation, and infection remain in the differential. The pathology team requests a prospective handling plan. One subsequent specimen contains only blood.',
    lessonIds: ['specimen-triage', 'node-characterization', 'results-reporting'],
    sources: ['chest2024', 'ics2023', 'ats2020'],
    questions: [
      q(
        'differential-handling',
        'Which planning choice best preserves the differential diagnosis?',
        [
          'Agree on fresh material, microbiology, and cytology allocation with the laboratory',
          'Different studies may need separate specimens and specific preservation.',
        ],
        [
          'Place every sample in formalin before discussing tests',
          'That can prevent culture and some fresh-material analyses.',
        ],
        [
          'Use ultrasound morphology to select a single diagnosis in advance',
          'Morphology alone cannot settle these alternatives.',
        ],
      ),
      q(
        'differential-blood',
        'What does the blood-only specimen establish about the target?',
        [
          'Potentially nonrepresentative sampling',
          'No representative target tissue has been demonstrated in that specimen.',
        ],
        ['The target is benign', 'A nonrepresentative aspirate cannot support that conclusion.'],
        [
          'The target is necessarily a vascular malformation',
          'Blood in a specimen does not by itself establish the target diagnosis.',
        ],
      ),
      q(
        'differential-granulomas',
        'Another specimen shows granulomatous inflammation. What remains necessary before calling the process sarcoidosis?',
        [
          'Reconcile the clinical findings and evaluate plausible alternative causes',
          'Granulomas occur in more than one disease; the diagnostic context and alternatives matter.',
        ],
        [
          'Nothing; granulomas alone are diagnostic of sarcoidosis',
          'The histologic pattern is not unique to sarcoidosis.',
        ],
        [
          'Assume infection is excluded even when relevant tests are missing',
          'An unperformed test supplies no evidence excluding infection.',
        ],
      ),
    ],
  },
  {
    id: 'assessment-followup',
    title: 'Finish the examination and follow the results',
    topic: 'Complete',
    context:
      'A patient completes a systematic endosonographic staging examination with representative samples and no malignancy identified. The team is preparing a report and follow-up plan. Later, the patient develops worsening dyspnea and fever.',
    lessonIds: ['complications-recovery', 'results-reporting'],
    sources: ['ers2026', 'ics2023'],
    questions: [
      q(
        'followup-negative',
        'In the stated complete negative staging setting, what does the 2026 ERS/ESGE/ESTS guideline recommend regarding routine add-on mediastinoscopy?',
        [
          'It is no longer routinely recommended',
          'This applies to the stated systematic negative examination; unresolved clinical questions still need individual review.',
        ],
        [
          'It is mandatory after every negative examination',
          'This does not reflect the 2026 recommendation.',
        ],
        [
          'It is never an option for any subsequent diagnostic question',
          'The recommendation does not prohibit surgical assessment for other unresolved indications.',
        ],
      ),
      q(
        'followup-report',
        'Which addition makes the report’s follow-up plan actionable?',
        [
          'Assign responsibility for result review',
          'Responsibility for communication and follow-up should be explicit.',
        ],
        [
          'List only that the procedure was completed',
          'Completion alone does not communicate findings or pending responsibilities.',
        ],
        [
          'Remove all limitations once representative samples are obtained',
          'The actual examination scope and any relevant limitations still belong in the report.',
        ],
      ),
      q(
        'followup-symptoms',
        'What should the later dyspnea and fever prompt?',
        [
          'Timely clinical evaluation for a possible complication',
          'New or worsening symptoms warrant evaluation independent of the pathology result.',
        ],
        [
          'Waiting for the next routine visit because EBUS is usually safe',
          'General safety statistics do not justify ignoring deterioration.',
        ],
        [
          'Reassurance based on negative cytology',
          'A negative cancer result does not exclude a procedural complication.',
        ],
        'both',
      ),
    ],
  },
]
export const PRACTICE_CASES: EbusCase[] = [
  {
    id: 'practice-boundary',
    title: 'A station-boundary review',
    topic: 'Locate',
    context:
      'Review the CT example and the stated boundaries. The target lies below the carina between the medial borders of the main bronchi.',
    lessonIds: ['ct-map', 'station-seven'],
    sources: ['atlas'],
    questions: [
      {
        ...q(
          'drill-subcarinal',
          'Which station fits this target and the described anatomical compartment?',
          ['7', 'The medial subcarinal location supports station 7.'],
          ['10R', 'A lateral hilar target would occupy a different compartment.'],
          ['4R', '4R is lower paratracheal rather than the described subcarinal compartment.'],
        ),
        imageStation: '7',
      },
      q(
        'drill-approach',
        'The same target is viewed through the left main bronchus. How does this alter its station?',
        [
          'The station is unchanged',
          'Changing the approach does not move the target to another compartment.',
        ],
        [
          'It becomes 10L',
          'The airway approach does not determine the target compartment by itself.',
        ],
        ['It becomes 4L', 'A left-sided approach does not establish a paratracheal location.'],
      ),
    ],
  },
  {
    id: 'practice-right',
    title: 'A right paratracheal review',
    topic: 'Locate',
    context:
      'The CT example shows a right paratracheal target. Multiplanar review places it below the brachiocephalic-vein crossing and above the lower border of the azygos vein.',
    lessonIds: ['right-paratracheal', 'systematic-staging'],
    sources: ['atlas', 'iaslc9'],
    questions: [
      {
        ...q(
          'drill-right',
          'Which station matches the stated level?',
          ['4R', 'The target lies between the specified 2R/4R and 4R/10R boundaries.'],
          ['2R', 'The target is below the 2R lower boundary.'],
          ['10R', 'The target is above the stated hilar boundary.'],
        ),
        imageStation: '4R',
      },
      q(
        'drill-side',
        'If a left lung primary involves this node, which category applies?',
        ['N3', 'This is contralateral mediastinal involvement for a left primary.'],
        ['N1', 'The node is mediastinal and contralateral, not ipsilateral hilar.'],
        ['N2a', 'It is not an ipsilateral N2 station for this primary.'],
      ),
    ],
  },
  {
    id: 'practice-handoff',
    title: 'A specimen-handoff review',
    topic: 'Sample',
    context:
      'An unexplained node is being sampled. The receiving laboratory asks for fresh material for flow cytometry, and the operator is ready to remove the needle assembly.',
    lessonIds: ['needle-safety', 'specimen-triage'],
    sources: ['ics2023', 'chest2024'],
    questions: [
      q(
        'drill-retract',
        'Which condition must be confirmed before withdrawing the assembly through the scope channel?',
        [
          'The needle is retracted into its sheath and secured per the IFU',
          'This protects the scope and reduces injury risk.',
        ],
        [
          'The needle is exposed to retain a larger specimen',
          'Channel removal with an exposed needle is unsafe.',
        ],
        [
          'The image is saved, regardless of needle position',
          'Image capture does not establish a protected needle position.',
        ],
        true,
      ),
      q(
        'drill-medium',
        'What should govern the fresh-material container choice?',
        [
          'The receiving laboratory’s handling instructions',
          'Use the medium specified for the planned assay.',
        ],
        [
          'The container already nearest the scope',
          'Convenience does not establish assay compatibility.',
        ],
        [
          'A general assumption that all fixatives are interchangeable',
          'Different studies have different preservation requirements.',
        ],
      ),
    ],
  },
]
