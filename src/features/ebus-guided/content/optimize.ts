import type { Lesson } from './types'
import { question as q } from './authoring'
const boundary =
  'These controls select existing recorded ultrasound examples. Example numbers are specific to this teaching library, not recommended processor settings for patients.'
export const optimizeLessons: Lesson[] = [
  {
    id: 'image-depth',
    title: 'Choose an appropriate image depth',
    topic: 'Optimize',
    minutes: 7,
    objective: 'Adjust depth to display the target and tissue immediately beyond it.',
    recall: 'Establish acoustic contact before optimizing the displayed image.',
    concept: 'Depth changes the field displayed',
    paragraphs: [
      'Too little depth truncates the target or its far margin. Excessive depth devotes screen space to tissue beyond the area of interest and makes the target occupy less of the image. Choose a depth that includes the target and relevant surrounding structures.',
      'Depth is an acquisition setting, not a node measurement. Compare the full contour and the tissue beyond it while changing this control alone.',
    ],
    checklist: [
      'Find the near and far borders.',
      'Include tissue beyond the target.',
      'Avoid unnecessary empty depth.',
    ],
    worked: {
      context:
        'At a shallow setting, the far border leaves the image. At a much deeper setting, the target becomes small on the screen.',
      reasoning:
        'Increase depth enough to see the entire target, then remove unnecessary depth. For this recorded example, compare the 3–4 cm views with the 8 cm view; these are teaching examples, not universal targets.',
    },
    question: q(
      'depth-predict',
      'A target extends beyond the bottom of the sector. Which control directly expands the displayed field?',
      ['Depth', 'Increasing depth displays tissue farther from the transducer.'],
      [
        'Gain',
        'Gain changes echo brightness and cannot reveal tissue outside the displayed field.',
      ],
      ['Calipers', 'Calipers measure positions within the image; they do not expand the field.'],
    ),
    lab: {
      kind: 'knobology',
      goal: 'depth',
      presetKey: '',
      controls: ['depth'],
      initialDepth: 80,
      initialGain: 43,
      instruction:
        'Move Image depth from 8 cm toward a view that includes the full target with less unused depth. Compare the 3 cm and 4 cm recordings and stop on either of those views.',
    },
    observation: q(
      'depth-observe',
      'When depth was reduced in this clip set, why did the target occupy more of the screen?',
      [
        'The displayed depth range decreased',
        'Display scale changed. This is not biological enlargement of the node.',
      ],
      [
        'The target grew while you watched',
        'The recorded examples illustrate acquisition settings, not tissue growth.',
      ],
      ['The needle penetrated more deeply', 'There was no needle action in this activity.'],
    ),
    transfer: q(
      'depth-transfer',
      'At a different station, reducing depth removes a vessel just beyond the node from view. What should you do before planning a path?',
      [
        'Restore enough depth to assess the relevant surrounding anatomy',
        'Framing should preserve the structures that matter to the intended path.',
      ],
      [
        'Accept the cropped image because the node appears larger',
        'Magnification does not justify losing important anatomical context.',
      ],
      [
        'Treat the missing vessel as absent',
        'A structure outside the displayed field remains present.',
      ],
    ),
    diagram: 'ultrasound',
    takeaways: [
      'Optimize the field, not just apparent target size.',
      'Always inspect the far margin and nearby structures.',
    ],
    sources: ['ics2023', 'simulation'],
    boundary,
  },
  {
    id: 'gain-contrast',
    title: 'Gain, contrast, and tissue detail',
    topic: 'Optimize',
    minutes: 7,
    objective: 'Distinguish a brightness adjustment from a change in tissue characteristics.',
    recall: 'Depth sets the displayed field; gain acts on echoes within that field.',
    concept: 'Preserve detail while adjusting brightness',
    paragraphs: [
      'Gain changes the amplification of received echoes. Very low gain can obscure weak echoes; excessive gain can obscure boundaries and make normally dark regions appear filled. First confirm contact and framing, then adjust brightness.',
      'Contrast changes the separation of displayed gray levels. A striking dark-to-bright image is not necessarily more informative: intermediate tissue detail may be lost. Compare borders and internal texture, not just overall brightness.',
    ],
    checklist: [
      'Keep the acquisition plane stable.',
      'Adjust one control at a time.',
      'Preserve borders and internal gray-scale detail.',
    ],
    worked: {
      context:
        'A stable recording looks washed out at a high gain level. The nodal border is difficult to distinguish.',
      reasoning:
        'Reduce gain while watching whether tissue detail returns. Then compare contrast separately. The teaching clips show these changes one control at a time; they do not synthesize all combinations.',
    },
    question: q(
      'gain-predict',
      'A well-coupled image is globally bright after increasing gain. Which explanation best fits?',
      [
        'Amplification changed the displayed echoes',
        'The acquisition setting changed; the tissue itself has not become more echogenic.',
      ],
      [
        'Every structure became denser',
        'A processor adjustment does not change tissue composition.',
      ],
      ['The depth field became shorter', 'Gain does not define the depth range.'],
    ),
    lab: {
      kind: 'knobology',
      goal: 'gain',
      presetKey: '',
      controls: ['gain', 'contrast'],
      initialDepth: 40,
      initialGain: 100,
      instruction:
        'Reduce Image gain from example 8 and compare the nodal border and internal echoes. Explore Image contrast separately, then return to Image gain and stop at example 4 or 5 for this teaching example. Each recording varies one control, so the clip on screen is a gain example only while gain is the control you moved last.',
    },
    observation: q(
      'gain-observe',
      'Why should morphology be interpreted after image optimization?',
      [
        'Settings influence apparent tissue detail',
        'Describe morphology on a usable image and avoid attributing an acquisition artifact to tissue biology.',
      ],
      [
        'An optimized image determines pathology',
        'Morphology can inform suspicion but cannot replace tissue diagnosis.',
      ],
      [
        'Contrast adjustment identifies the nodal station',
        'Station identity depends on anatomical relationships.',
      ],
    ),
    transfer: q(
      'gain-transfer',
      'The sector turns dark when the transducer leaves the wall, although the prior gain level is unchanged. Which action comes first?',
      [
        'Re-establish the acoustic window',
        'Absent coupling should be corrected before adjusting gain.',
      ],
      [
        'Increase gain to its maximum and proceed to puncture',
        'Amplifying a poorly coupled image does not establish safe real-time guidance.',
      ],
      [
        'Classify the target as necrotic',
        'Loss of the window prevents a reliable morphology assessment.',
      ],
      true,
    ),
    diagram: 'ultrasound',
    takeaways: [
      'Brightness is partly a setting, not only a tissue property.',
      'Contact and framing precede fine adjustment.',
    ],
    sources: ['ics2023', 'simulation'],
    boundary,
  },
  {
    id: 'doppler',
    title: 'Doppler and the intended needle path',
    topic: 'Optimize',
    minutes: 7,
    objective:
      'Use Doppler as part of a vascular-path assessment without treating absent color as proof of safety.',
    recall:
      'A dark structure on gray-scale ultrasound may represent fluid, vessel lumen, or another low-echo structure.',
    concept: 'Assess flow and anatomy together',
    paragraphs: [
      'Color Doppler adds a display of detected flow to the gray-scale image. Use it to evaluate structures within and beside the intended path, and correlate with the CT and ultrasound anatomy.',
      'Absent color can reflect settings, slow flow, insonation angle, or poor contact. It does not prove that a dark structure is a lymph node or that the path is safe. A suspected vascular structure requires further assessment before needle passage.',
    ],
    checklist: [
      'Identify the target on gray scale.',
      'Assess the whole intended path and adjacent vessels.',
      'Resolve uncertain vascular anatomy before puncture.',
    ],
    worked: {
      context:
        'A smooth dark structure lies between the airway wall and the target. It shows color flow when Doppler is activated.',
      reasoning:
        'The finding supports a vascular structure in the path. Reassess the approach with the supervising operator; do not use a routine nodal sampling maneuver through the vessel.',
    },
    question: q(
      'doppler-predict',
      'A dark structure lies in the proposed needle path. What additional information is most directly useful?',
      [
        'Doppler assessment with anatomical correlation',
        'Doppler helps assess vascular structures, alongside the anatomical views.',
      ],
      [
        'A higher gray-scale gain setting',
        'Brightness adjustment alone does not establish whether a structure carries flow.',
      ],
      [
        'A short-axis measurement of the structure',
        'Size alone does not establish whether the structure is vascular.',
      ],
    ),
    lab: {
      kind: 'knobology',
      goal: 'doppler',
      presetKey: '',
      controls: ['doppler'],
      initialDepth: 40,
      initialGain: 43,
      instruction:
        'Compare the gray-scale recording with Color Doppler. Activate Color Doppler and inspect where flow is displayed relative to the surrounding structures.',
    },
    observation: q(
      'doppler-observe',
      'What does the color-flow recording add to the gray-scale image?',
      [
        'Detected flow in the recording',
        'This adds vascular information. It does not simulate a needle or verify an individual clinical path.',
      ],
      ['A histologic classification of the node', 'Color flow is not pathology.'],
      [
        'A guarantee that every noncolored region is avascular',
        'Flow can go undetected for several technical reasons.',
      ],
    ),
    transfer: q(
      'doppler-transfer',
      'No color is seen in a structure that remains anatomically suspicious for a vessel. What is appropriate?',
      [
        'Reassess Doppler settings and anatomy and obtain a clear safe window',
        'An equivocal vascular assessment should not be converted into permission to puncture.',
      ],
      [
        'Puncture because absent color proves absence of blood flow',
        'This is unsafe; absent color is not proof that a structure is avascular.',
      ],
      [
        'Rename it a lymph node based on shape alone',
        'Morphology alone does not settle uncertain vascular anatomy.',
      ],
      true,
    ),
    diagram: 'ultrasound',
    takeaways: [
      'Doppler supplements anatomical identification.',
      'Absent color is not clearance for puncture.',
    ],
    sources: ['ics2023', 'simulation'],
    boundary,
  },
  {
    id: 'capture',
    title: 'Freeze, measure, and document the image',
    topic: 'Optimize',
    minutes: 8,
    objective:
      'Capture a selected image with two deliberately placed calipers and explain measurement limitations.',
    recall: 'A change in the imaging plane can change apparent dimensions.',
    concept: 'A measurement belongs to an image and a station',
    paragraphs: [
      'Identify a representative plane and both borders before freezing. For nodal size, specify the dimension being recorded, commonly the short axis, and preserve the station label and useful landmark context.',
      'Place calipers on the intended borders rather than on gain-related haze. A saved image documents the selected view; it does not establish sampling adequacy or histology. Return to live imaging before any real needle maneuver.',
    ],
    checklist: [
      'Choose a representative plane.',
      'Freeze before positioning calipers.',
      'Record station, dimension, and image context.',
    ],
    worked: {
      context: 'A long oblique section looks larger than a perpendicular view of the same node.',
      reasoning:
        'Select the intended dimension consistently. Freezing an arbitrary oblique view and reporting its longest line as the short axis would produce a misleading record.',
    },
    question: q(
      'capture-predict',
      'Why should the selected plane be reviewed before caliper placement?',
      [
        'The dimension depends on the slice through the node',
        'Calipers describe the displayed plane rather than a complete three-dimensional node.',
      ],
      [
        'Freezing makes every slice equivalent',
        'Freeze holds a frame; it does not correct the plane.',
      ],
      [
        'Saving automatically validates station identity',
        'A stored image still needs correct anatomical labeling.',
      ],
    ),
    lab: {
      kind: 'knobology',
      goal: 'capture',
      presetKey: '',
      controls: ['freeze', 'measure', 'save'],
      initialDepth: 40,
      initialGain: 43,
      instruction:
        'Freeze image, choose Measure, move the first marker, and select Set first caliper. Move the second marker to a distinct position, then Save image. Inspect your captured frame. This practices controls; border placement is not scored as a clinical measurement.',
    },
    observation: q(
      'capture-observe',
      'What has your saved frame demonstrated in this exercise?',
      [
        'Freeze, caliper placement, and capture',
        'The activity records those actions. It does not validate clinical border selection or a true short-axis measurement.',
      ],
      ['Adequate lymph-node tissue for molecular testing', 'No tissue was obtained.'],
      ['Absence of malignancy at this station', 'An image capture has no histologic result.'],
    ),
    transfer: q(
      'capture-transfer',
      'During real EBUS, an operator is ready to insert a needle while the image remains frozen. What is required?',
      [
        'Restore live ultrasound and reassess the target and path',
        'Needle guidance requires a current image; the saved frame is documentation.',
      ],
      [
        'Use the frozen image because its calipers are precise',
        'A still image cannot guide ongoing needle movement safely.',
      ],
      [
        'Delete the measurements and proceed on the same frozen frame',
        'Removing calipers does not restore live guidance.',
      ],
      'both',
    ),
    diagram: 'ultrasound',
    takeaways: [
      'A saved frame is documentation, not live guidance.',
      'Dimension and station context belong in the record.',
    ],
    sources: ['ics2023', 'simulation'],
    boundary,
  },
]
