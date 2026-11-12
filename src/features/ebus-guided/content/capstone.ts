import type { Lab, Lesson, Question } from './types'
import { matching, question as q } from './authoring'
import { locateLessons } from './locate'

/*
 * The capstone (2026-11-11): one staging examination, start to finish.
 *
 * A right upper lobe primary with four nodal targets, examined in the order the course teaches,
 * N3 then N2 then N1: 4L, 7, 4R, 11Ri. Each station is scanned in the lab the learner has already
 * used for it, so the capstone adds no new control and no new anatomy; what is new is doing the
 * four in order and carrying the findings to a report.
 *
 * Every check retrieves something an earlier lesson taught (the landmarks that name a station,
 * what ROSE settles, a nonrepresentative sample, single- against multiple-station N2), applied to
 * this case. The case and its results are written for teaching. It states no threshold and no
 * number that is not already in the course.
 *
 * A unit must carry three checks (`Lesson`). Each station asks two, on the learner's own image:
 * the landmarks that name the station, and what its sample settles. The third is kept short and
 * is not asked.
 *
 * The findings: 4L lymphocytes only; 7 malignant cells; 4R blood only at first, then lymphocytes
 * only; 11Ri malignant cells. On today's findings that is N2a, with N1 also involved, all of it
 * provisional until final pathology.
 */
const stationLab = (lessonId: string): Lab => {
  const lab = locateLessons.find((lesson) => lesson.id === lessonId)?.lab
  if (!lab) throw new Error('The capstone needs the station lab of ' + lessonId)
  return lab
}
const onImage = (item: Question): Question => ({ ...item, imagePolicy: 'retained-acquisition' })
const SOURCES = ['iaslc9', 'ers2026', 'aabip2025', 'ics2023', 'simulation']

/** One station of the examination: what was planned there, and what the samples showed. */
export interface CapstoneStation {
  unitId: string
  station: string
  name: string
  category: 'N1' | 'N2' | 'N3'
  finding: string
}
/** The order of the examination. The two N2 stations could be taken in either order. */
export const CAPSTONE_STATIONS: CapstoneStation[] = [
  {
    unitId: 'staging-exam-4l',
    station: '4L',
    name: 'Left lower paratracheal',
    category: 'N3',
    finding: 'Lymphocytes, no malignant cells',
  },
  {
    unitId: 'staging-exam-7',
    station: '7',
    name: 'Subcarinal',
    category: 'N2',
    finding: 'Malignant cells',
  },
  {
    unitId: 'staging-exam-4r',
    station: '4R',
    name: 'Right lower paratracheal',
    category: 'N2',
    finding: 'Blood only at first; further passes: lymphocytes, no malignant cells',
  },
  {
    unitId: 'staging-exam-11ri',
    station: '11Ri',
    name: 'Right interlobar, inferior',
    category: 'N1',
    finding: 'Malignant cells',
  },
]
export const CAPSTONE_CONCLUSION =
  'On today’s on-site findings: N2a. One N2 station (7) is involved, 4R and 4L were sampled without malignant cells, and 11Ri (N1) is involved. All of it is provisional until final pathology.'

const visit = (
  entry: CapstoneStation,
  fields: Pick<
    Lesson,
    'title' | 'objective' | 'recall' | 'paragraphs' | 'observation' | 'question' | 'transfer'
  > & { labFrom: string; takeaway: string },
): Lesson => ({
  id: entry.unitId,
  title: fields.title,
  topic: 'Complete',
  minutes: 5,
  objective: fields.objective,
  recall: fields.recall,
  concept: 'Station ' + entry.station + ': ' + entry.category + ' for a right lung primary',
  paragraphs: fields.paragraphs,
  checklist: [
    'Name the station from its landmarks.',
    'Sweep through the node before the needle.',
    'Read the on-site result for what it settles.',
  ],
  worked: {
    context: 'Station ' + entry.station + ' in this examination.',
    reasoning: entry.finding + '.',
  },
  question: fields.question,
  observation: onImage(fields.observation),
  transfer: fields.transfer,
  lab: stationLab(fields.labFrom),
  station: entry.station,
  takeaways: [fields.takeaway],
  sources: SOURCES,
})

const [fourL, seven, fourR, elevenRi] = CAPSTONE_STATIONS

export const capstoneLessons: Lesson[] = [
  {
    id: 'staging-examination',
    title: 'A complete staging examination',
    topic: 'Complete',
    minutes: 10,
    objective:
      'Carry one staging examination from the plan to the report: station order, a scan and a sample at each station, and a conclusion that says only what the samples support.',
    recall:
      'Station identity comes from anatomy. The side of the primary sets each station’s N category, and the sampling order runs from the highest category to the lowest.',
    concept: 'One patient, four stations, one report',
    paragraphs: [
      'The patient has a right upper lobe mass, suspected lung cancer, and no distant disease on PET-CT. PET-CT shows an avid right lower paratracheal node (4R), an enlarged subcarinal node (7), a small left lower paratracheal node (4L) and an avid right interlobar node (11Ri). The team has asked for systematic nodal staging by EBUS.',
      'All four nodes are on the plan. For a right lung primary, 4L is N3, 7 and 4R are N2, and 11Ri is N1. Sample in that order, so that a needle that has been through tumor is not carried into a station of a higher category.',
      'At each station you will scan the node in the lab you used when you first met that station, and then read the on-site result. Keep each station’s specimen separate and labelled. On-site results are provisional until final pathology.',
    ],
    checklist: [
      'State the side of the primary and each station’s category.',
      'Sample N3, then N2, then N1.',
      'Report what was sampled, what it showed, and what is still pending.',
    ],
    worked: {
      context: 'Right upper lobe primary; targets at 4L, 7, 4R and 11Ri.',
      reasoning:
        '4L is contralateral mediastinal (N3). Stations 7 and 4R are subcarinal and ipsilateral mediastinal (N2). 11Ri is ipsilateral interlobar (N1). The order is 4L, then 7 and 4R, then 11Ri.',
    },
    question: q(
      'exam-first-station',
      'Right upper lobe primary. PET-CT shows nodes at 4R (avid), 7, 4L (small, not avid) and 11Ri (avid). All four are on the plan. Which do you sample first?',
      [
        '4L',
        'For a right lung primary 4L is contralateral mediastinal, N3: the highest category on the plan, so it is sampled first.',
      ],
      [
        '4R, the most avid mediastinal node',
        'PET avidity ranks suspicion, not sampling order. 4R is N2; starting there risks carrying tumor cells into 4L, which is N3.',
      ],
      [
        '11Ri, the node nearest the tumor',
        '11Ri is N1, the lowest category on the plan. It is sampled last.',
      ],
    ),
    observation: q(
      'exam-plan-check',
      'Why is 4L on the plan although it is small and not PET-avid?',
      [
        'A systematic examination samples the relevant stations and does not rely on PET alone',
        'The course teaches systematic staging over a targeted examination: the core mediastinal stations, 4R, 4L and 7, are surveyed and sampled as the plan sets out.',
      ],
      [
        'A small node that is not avid is more likely to be malignant',
        'Size and avidity raise suspicion when present; their absence does not. The node is on the plan because the examination is systematic.',
      ],
      [
        'It is the easiest station to reach, so it is a useful warm-up',
        'Order follows the N category. 4L is first because it is N3 for this primary.',
      ],
    ),
    matching: matching(
      'Match each on-site result to the line it earns in the report.',
      [
        ['4L: lymphocytes, no malignant cells', 'N3 station sampled; no malignant cells on site'],
        ['7: malignant cells', 'N2 station involved on site'],
        [
          '4R: blood only, then lymphocytes on further passes',
          'First passes nonrepresentative; repeat sample without malignant cells',
        ],
        ['11Ri: malignant cells', 'N1 station involved on site'],
      ],
      'Each station gets its own line: what was sampled and what it showed. A sample of blood alone is reported as nonrepresentative, not as negative. Every line is provisional until final pathology.',
    ),
    transfer: q(
      'exam-report',
      'The examination is finished. Which statement do today’s findings support?',
      [
        'N2a on on-site findings: station 7 is involved, 4R and 4L were sampled without malignant cells, 11Ri is involved; final pathology is pending',
        'One N2 station is involved, which is N2a. 11Ri is N1 and does not add an N2 station. On-site results are provisional, so the report says what is pending.',
      ],
      [
        'N2b: tumor was found at two stations, 7 and 11Ri',
        'N2b is involvement of more than one N2 station. 11Ri is an N1 station. Count the involved mediastinal and subcarinal stations: here, one.',
      ],
      [
        'N3 is excluded: the 4L aspirate contained lymphocytes and no malignant cells',
        'The 4L sample represents the node and shows no malignancy so far. That is a negative sample pending final pathology, and the report says so in those words.',
      ],
    ),
    takeaways: [
      'Order by N category for this primary: N3, then N2, then N1.',
      'A sample must represent the node before it can count as negative.',
      'Count involved N2 stations, not nodes or passes: one is N2a, more than one is N2b.',
      'Report what was sampled, what it showed, and what is pending.',
    ],
    sources: SOURCES,
  },
  visit(fourL, {
    labFrom: 'left-paratracheal',
    title: 'Station 4L',
    objective: 'Scan and sample the N3 station first, and read what its on-site result settles.',
    recall:
      'Station 4L lies between the aortic arch and the left main pulmonary artery. Station 2L lies above the arch.',
    paragraphs: [
      'Start at 4L, the N3 station for this primary. Find the aortic arch and the left main pulmonary artery, then the node between them, and sweep through it.',
    ],
    observation: q(
      'exam-4l-observe',
      'On your image, which two structures place this node in station 4L?',
      [
        'The aortic arch and the left main pulmonary artery',
        'The 4L node lies between the aortic arch and the left main pulmonary artery. Both were on your scan before the node.',
      ],
      [
        'The superior vena cava and the azygos vein',
        'Those are the landmarks of the right lower paratracheal station, 4R.',
      ],
      [
        'The aortic arch alone, with the node above it',
        'A left paratracheal node above the arch is in station 2L.',
      ],
    ),
    question: q(
      'exam-4l-result',
      'On-site cytology from 4L: lymphocytes, no malignant cells. What does this settle?',
      [
        'The sample represents the node and shows no malignancy so far; final pathology is pending',
        'Lymphocytes show that the needle sampled the node. An on-site reading is provisional, so the station is negative so far and the report says final pathology is pending.',
      ],
      [
        'N3 disease is excluded, and the report can say so now',
        'An on-site reading is provisional. The station is reported as sampled, without malignant cells on site, final pathology pending.',
      ],
      [
        'Nothing: without malignant cells the node cannot have been sampled',
        'Lymphocytes are what a sampled lymph node returns. A sample of blood alone would be the one that settles nothing.',
      ],
    ),
    transfer: q(
      'exam-4l-next',
      '4L is done. Which station is next on this plan?',
      [
        'Station 7 or 4R: the N2 stations',
        'After the N3 station come the N2 stations. Either may be taken first.',
      ],
      ['11Ri', '11Ri is N1 and is sampled after the N2 stations.'],
      [
        'The right upper lobe mass',
        'The primary, if it is sampled, comes after the nodes, so that tumor is not carried into a node.',
      ],
    ),
    takeaway: 'Lymphocytes without malignant cells: a representative sample, negative so far.',
  }),
  visit(seven, {
    labFrom: 'station-seven',
    title: 'Station 7',
    objective:
      'Scan the subcarinal node from both main bronchi, and decide what a malignant on-site result changes.',
    recall:
      'The subcarinal node can be imaged from either main bronchus. The approach does not change the station.',
    paragraphs: [
      'Station 7 is N2 whichever side the primary is on. Scan the node from each main bronchus in turn and finish with it in the image.',
    ],
    observation: q(
      'exam-7-observe',
      'You imaged this node from both main bronchi. How is it recorded?',
      [
        'As one node in station 7',
        'The station belongs to where the node lies, between the main bronchi below the carina. Seeing it from a second airway does not make a second station.',
      ],
      [
        'As station 7 from the right and station 10L from the left',
        'Station 10L is hilar, beside the left main bronchus. This node lies below the carina between the two main bronchi, which is station 7 from either side.',
      ],
      [
        'As two nodes, one for each bronchial window',
        'The same node crossed the image in both windows. Count nodes by anatomy, not by the number of views.',
      ],
    ),
    question: q(
      'exam-7-result',
      'On-site cytology from station 7: malignant cells. 4R and 11Ri are still on the plan. What now?',
      [
        'Go on to 4R: a second involved N2 station would change N2a to N2b',
        'Single-station and multiple-station N2 are different categories, so the second N2 station still matters. A fresh needle may be used for the next station to reduce cross-contamination (AABIP 2025).',
      ],
      [
        'Stop: N2 is established and further stations add nothing',
        'N2a and N2b are separate categories in the ninth edition. Whether 4R is involved is still unknown, and the plan covers it.',
      ],
      [
        'Go back and sample 4L again to confirm it',
        '4L already returned a representative sample. Returning to an N3 station with a needle that has been through tumor risks the false result the sampling order exists to prevent.',
      ],
      true,
    ),
    transfer: q(
      'exam-7-label',
      'The station 7 specimen is handed off. How is it labelled?',
      [
        'With its own station, separate from the 4L specimen',
        'Each station keeps its own specimen and label. Pooling them loses the distribution of disease that staging is for.',
      ],
      [
        'Pooled with 4L as “mediastinal nodes”',
        'A pooled specimen cannot say which station was involved.',
      ],
      [
        'As “N2 node”, since the category is known',
        'The label is the station. The category is worked out from the station and the side of the primary.',
      ],
    ),
    takeaway: 'A malignant N2 station does not end the examination: the other N2 station matters.',
  }),
  visit(fourR, {
    labFrom: 'right-paratracheal',
    title: 'Station 4R',
    objective:
      'Scan the second N2 station, and recognize a sample that does not yet represent the node.',
    recall:
      'Station 4R lies beside the trachea on the right, with the superior vena cava in front of it and the azygos vein at its lower border.',
    paragraphs: [
      'Station 4R is the second N2 station on the plan. Find the superior vena cava and the azygos vein, then the node, and sweep through it.',
    ],
    observation: q(
      'exam-4r-observe',
      'On your image, which landmarks place this node in station 4R?',
      [
        'The superior vena cava and the azygos vein',
        'Both were on your scan before the node. The lower border of 4R is the lower border of the azygos vein.',
      ],
      [
        'The aortic arch and the left main pulmonary artery',
        'Those are the landmarks of station 4L, on the left.',
      ],
      [
        'The right middle- and lower-lobe bronchi',
        'Those bronchi name station 11Ri, an interlobar station.',
      ],
    ),
    question: q(
      'exam-4r-result',
      'The first passes at 4R return blood, with no lymphocytes and no malignant cells. What does that mean for 4R?',
      [
        'Nothing yet: the sample does not represent the node, so make further passes',
        'Blood alone is not a sample of the node. Further passes at 4R then return lymphocytes without malignant cells: a representative sample, negative so far.',
      ],
      [
        '4R is negative: no malignant cells were seen',
        'Blood without lymphocytes does not show that the node was sampled. A negative result needs a sample that represents the node.',
      ],
      [
        '4R is involved, because station 7 is',
        'Each station is settled by its own sample. Disease at 7 does not establish disease at 4R.',
      ],
    ),
    transfer: q(
      'exam-4r-count',
      'Station 7 is involved and 4R is not. How many N2 stations are involved?',
      ['One', 'Count involved stations: station 7 only. That is N2a.'],
      ['Two, because two N2 stations were sampled', 'Sampled is not involved. Only 7 is involved.'],
      [
        'It depends on how many nodes at station 7 contained tumor',
        'The count is of stations, not of nodes or passes.',
      ],
    ),
    takeaway: 'Blood alone is not a negative node. Sample again until the node is represented.',
  }),
  visit(elevenRi, {
    labFrom: 'hilar-interlobar',
    title: 'Station 11Ri',
    objective: 'Scan the N1 station last, and state the N category the findings support.',
    recall:
      'Station 11Ri lies between the right middle- and lower-lobe bronchi. Station 11Rs lies between the right upper-lobe bronchus and the bronchus intermedius.',
    paragraphs: [
      'Finish at 11Ri, the N1 station. The scope is in the right lower airway. Find the node and sweep through it.',
    ],
    observation: q(
      'exam-11ri-observe',
      'Which bronchi name the station you have just scanned?',
      [
        'The right middle- and lower-lobe bronchi',
        'Station 11Ri is the interlobar station between the middle- and lower-lobe bronchi.',
      ],
      [
        'The right upper-lobe bronchus and the bronchus intermedius',
        'Those name station 11Rs, the superior interlobar station.',
      ],
      ['The right main bronchus', 'A node beside the main bronchus is hilar, station 10R.'],
    ),
    question: q(
      'exam-11ri-result',
      'On-site cytology from 11Ri: malignant cells. So far: 4L lymphocytes only, 7 malignant cells, 4R lymphocytes only. What N category do today’s findings support?',
      [
        'N2a: one N2 station is involved, and 11Ri is N1',
        'The category is the highest one involved, N2, and one involved N2 station is N2a. 11Ri is recorded as an involved N1 station; it does not add to the N2 count.',
      ],
      [
        'N2b: two stations contain tumor',
        'N2b needs more than one involved N2 station. Station 11Ri is N1.',
      ],
      [
        'N1: the last station sampled sets the category',
        'The category is the highest involved, whatever the order of sampling.',
      ],
    ),
    transfer: q(
      'exam-11ri-order',
      'Why was 11Ri sampled last?',
      [
        'It has the lowest N category on the plan',
        'Sampling runs from N3 to N1, so tumor from a lower-category station cannot be carried into a higher one.',
      ],
      ['It is the deepest station in the airway', 'Depth in the airway does not set the order.'],
      [
        'Interlobar nodes are the least likely to be involved',
        'Likelihood does not set the order; the N category does.',
      ],
    ),
    takeaway: 'The N category is the highest involved station’s, whatever the order of sampling.',
  }),
]
