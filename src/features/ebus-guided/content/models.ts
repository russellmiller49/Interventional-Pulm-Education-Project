import type { Lesson } from './types'
import { question } from './authoring'
import { EBUS_NUMBERS } from './teachingNumbers'

/** The lab asks for the low end of the sourced range of movements on one pass. */
const NEEDLE_MOVEMENTS = Number.parseInt(EBUS_NUMBERS.value('agitations-per-pass'), 10)

export const needleModel: Lesson = {
  id: 'needle-assembly-model',
  title: 'One needle pass, by your own hand',
  topic: 'Sample',
  minutes: 10,
  objective:
    'Work the sheath, the stop and the needle in order, and hold the needle still when its tip leaves the image.',
  recall:
    'The sheath protects the needle during passage through the working channel. A visible shaft segment does not establish the location of its tip.',
  concept: 'The handle and distal needle form one assembly',
  paragraphs: [
    'Each control on the handle does one thing. The sheath adjuster moves the sheath, and the sheath lock holds it. The needle stop limits how far the needle can travel. The needle slider moves the needle. In the lab the handle is drawn above the scope tip and the ultrasound picture, at true size, with the length of the scope between them left out.',
    'The ultrasound picture shows only the part of the needle that lies in the imaging plane. A small turn of the scope can take the tip out of the image while part of the shaft stays in it. The line on the screen is then shorter than the needle.',
  ],
  checklist: [
    'Sheath out until it is seen beyond the scope tip, then locked.',
    'Stop set to the far side of the node before the needle moves.',
    'Tip in the image for every movement; needle back in its sheath before the assembly comes out.',
  ],
  worked: {
    context:
      'The needle is in the node. The scope turns a few degrees and the bright line on the screen shortens.',
    reasoning:
      'The needle has not moved; less of it lies in the imaging plane, and the end of the line is no longer the tip. Hold the needle still and turn the scope back until the tip returns.',
  },
  question: question(
    'assembly-predict',
    'A bright line remains on the screen after the scope turns. What must be established before the needle is advanced again?',
    [
      'Live visualization of the actual tip',
      'A shaft intersection alone does not establish the distal endpoint. Stop and restore guidance.',
    ],
    [
      'That the line lies within the nodal borders',
      'A shaft segment inside the node does not show where the tip is; it may already be beyond the far border.',
    ],
    [
      'That the prior frozen frame showed the tip',
      'The prior frame cannot establish its current location.',
    ],
  ),
  lab: {
    kind: 'model',
    modelPackage: 'needle',
    goal: 'model',
    presetKey: 'needle',
    controls: [],
    needleMovements: NEEDLE_MOVEMENTS,
    instruction:
      'Make one pass with the controls beside the model. Work down the steps: each control is named after the part of the handle it moves.',
  },
  observation: {
    ...question(
      'assembly-observe',
      'After you turned the scope, the needle could not be advanced. Why?',
      [
        'The tip had left the image, although part of the shaft was still seen',
        'The needle and the imaging plane move separately. A line that is still on the screen does not show where the tip is.',
      ],
      [
        'The needle had reached the far border of the node',
        'Nothing about the node changed; the plane moved, so the position of the tip was no longer known.',
      ],
      [
        'The shorter line showed that the needle was bending',
        'A shorter line after the scope turns means less of the needle lies in the plane, not that it has deflected.',
      ],
    ),
    imagePolicy: 'retained-acquisition',
  },
  transfer: question(
    'assembly-transfer',
    'The assembly meets resistance despite a recognizable tip. What is the appropriate response?',
    [
      'Stop and reassess with the supervising operator',
      'Visibility alone does not justify overcoming resistance. Follow the selected device instructions and supervised technique.',
    ],
    [
      'Increase force until the assembly advances',
      'Forcing an assembly can damage equipment or tissue.',
    ],
    ['Remove it with the needle exposed', 'Protect the needle before channel removal.'],
    'both',
  ),
  diagram: 'needle',
  takeaways: [
    'Sheath, stop and needle are set in that order, and undone in reverse.',
    'A line on the screen is not the tip: hold the needle still until the tip is seen.',
  ],
  sources: ['ics2023', 'chest2016', 'simulation'],
  boundary:
    'A teaching model. Its depths and travel are for practising the steps and are not settings for a patient or for a particular needle.',
}
export const contactModel: Lesson = {
  id: 'contact-cutaway-model',
  title: 'Contact, air gaps and acoustic shadowing',
  topic: 'Prepare',
  minutes: 8,
  objective:
    'Use a local cutaway to distinguish missing coupling from a shadow behind a reflector.',
  recall:
    'Gain changes the amplification of received echoes. It cannot create a tissue window across a deliberately uncoupled interface.',
  concept: 'Trace the acoustic path before changing brightness',
  paragraphs: [
    'The cutaway pairs a transducer, airway wall and example node with a qualitative echo schematic. Select direct contact, fluid-balloon contact, a bubble or a strong reflector and inspect the resulting acoustic path.',
    'Both direct and balloon-assisted contact can provide a window. A bubble can interrupt it. A shadow behind a strong reflector has a different mechanism from a complete air gap at the transducer.',
  ],
  checklist: [
    'Compare gain changes while an air gap persists.',
    'Inspect direct and balloon-assisted contact.',
    'Compare a focal bubble interruption with a shadow behind a reflector.',
  ],
  worked: {
    context: 'Gain is increased while the transducer remains separated from the wall.',
    reasoning:
      'The schematic becomes brighter near the interface but deeper tissue echoes remain absent. Establish contact, then compare a fluid-balloon window. Hover labels in the worked example identify each part of the path.',
  },
  question: question(
    'cutaway-predict',
    'An air gap is present. Which adjustment can restore the acoustic path?',
    [
      'Establish transducer or fluid-balloon contact with the wall',
      'Ultrasound reaches tissue only across a coupled interface.',
    ],
    ['Increase gain alone', 'Amplification cannot replace the missing contact.'],
    [
      'Lower the frequency for more penetration',
      'Penetration is not the limit; nearly all of the beam is reflected at the air interface whatever the frequency.',
    ],
  ),
  lab: {
    kind: 'model',
    modelPackage: 'contact',
    goal: 'model',
    presetKey: 'contact',
    controls: [],
    instruction:
      'Raise gain with the air gap present. Then select and inspect direct contact, balloon contact, the bubble window and the reflector shadow. Compare the cutaway with the schematic after each change.',
  },
  observation: {
    ...question(
      'cutaway-observe',
      'You inspected the air-gap and reflector states in the echo schematic. Both leave a dark region. Which difference in mechanism does the model show?',
      [
        'The air gap blocks transmission at the transducer; the reflector attenuates the path only beyond it',
        'The course distinguishes a complete air gap at the transducer from a shadow behind a strong reflector.',
      ],
      [
        'Both are corrected by raising gain',
        'Gain amplifies returning echoes; it cannot restore a missing window or the signal lost behind a reflector.',
      ],
      [
        'The dark region behind the reflector is a low-echo node',
        'A shadow is an acoustic effect; it does not describe tissue.',
      ],
    ),
    imagePolicy: 'retained-acquisition',
  },
  transfer: question(
    'cutaway-transfer',
    'After a pass, a focal interruption appears although surrounding tissue echoes persist. What should you reassess?',
    [
      'The contact window and a possible local air interface',
      'Compare the acquisition and contact path before interpreting the focal change as tissue.',
    ],
    [
      'The node, for a new area of necrosis',
      'Necrosis does not appear during a pass; a new focal dropout is air or lost contact until shown otherwise.',
    ],
    [
      'The overall gain, since the image has darkened',
      'Low gain darkens the whole sector; a focal interruption with preserved surrounding echoes points to the acoustic path.',
    ],
  ),
  diagram: 'ultrasound',
  takeaways: [
    'Contact and gain address different problems.',
    'Fluid-balloon contact does not guarantee a clear window.',
  ],
  sources: ['ics2023', 'simulation'],
  boundary:
    'Qualitative acoustic illustration. Brightness and balloon shape do not represent measured pressure, inflation volume or a calibrated clinical ultrasound response.',
}
export const measurementModel: Lesson = {
  id: 'measurement-phantoms',
  title: 'Sweep before you measure',
  topic: 'Optimize',
  minutes: 12,
  objective: 'Sweep through a fixed shape and measure its short axis on the central section.',
  recall: 'The same fixed object can produce different sections as the imaging plane moves.',
  concept: 'A section is only one view of the object',
  paragraphs: [
    'A node is a three-dimensional object and the ultrasound image is one slice through it. Move the slice off-center and the same node looks smaller, although nothing about the node has changed.',
    'So sweep through a node before you measure it. Find the section where it is widest, freeze that section, and measure the short axis there, from border to border.',
  ],
  checklist: [
    'Sweep from one edge of the node to the other.',
    'Freeze the central, widest section.',
    'Place the calipers on opposite borders, across the short axis.',
  ],
  worked: {
    context:
      'An off-center section through an elongated object looks smaller than its central section.',
    reasoning:
      'The object has not shrunk. Move through its full extent and compare sections before choosing where to measure.',
  },
  question: question(
    'phantom-predict',
    'A fixed phantom looks smaller after the plane is moved. What is the most direct explanation?',
    [
      'The plane passes through a smaller cross-section',
      'Plane position changes the section without changing the object dimensions.',
    ],
    [
      'The depth setting changed the image scale',
      'Depth was not changed; a scale change would shrink everything in the sector, not this object alone.',
    ],
    [
      'Lower gain is hiding its outer border',
      'Gain was not changed; the border is still sharp, and it encloses a smaller section.',
    ],
  ),
  lab: {
    kind: 'model',
    modelPackage: 'measurement',
    goal: 'model',
    presetKey: 'measurement',
    controls: [],
    instruction:
      'Move “Plane offset” from one end to the other and watch the section of the elongated shape grow and shrink. Then go to the central section, freeze it, click the top and bottom borders to place calipers, and record the measurement.',
  },
  observation: {
    ...question(
      'phantom-observe',
      'What does the recorded millimeter measurement represent?',
      [
        'A distance in the geometric phantom',
        'The value comes from the phantom and where you placed the calipers. It says nothing about the size of a node in a clinical image.',
      ],
      [
        'The true short axis, whichever plane was frozen',
        'Calipers measure the frozen section; an off-center or oblique plane gives a different number for the same object.',
      ],
      [
        'The largest diameter of the object',
        'The task was the short axis on the central section; the long axis is a different measurement.',
      ],
    ),
    imagePolicy: 'retained-acquisition',
  },
  transfer: question(
    'phantom-transfer',
    'Two separate nodes are seen within one anatomically defined station. How should their measurements be recorded?',
    [
      'Record the individual nodes while retaining the shared station identity',
      'Node count and station count describe different things.',
    ],
    ['Assign a new station to each node', 'Station identity follows anatomical boundaries.'],
    [
      'Measure across both nodes as a single short axis',
      'Separate structures should not be merged by a caliper span.',
    ],
  ),
  diagram: 'ultrasound',
  takeaways: [
    'Sweep before choosing a measurement plane.',
    'Separated calipers can still be on the wrong borders or axis.',
  ],
  sources: ['atlas', 'simulation'],
  boundary: 'These are geometric shapes, not nodes: the numbers are the shape’s own millimeters.',
}
export const routeModel: Lesson = {
  id: 'eus-b-route-model',
  title: 'Compare airway and esophageal windows',
  topic: 'Plan',
  minutes: 10,
  objective:
    'Compare two approaches to the same target and identify gaps that an esophageal examination does not resolve.',
  recall:
    'EUS-B uses the EBUS endoscope from the esophagus. Changing the approach does not change a lymph node’s anatomical station.',
  concept: 'Complementary access, with explicit limits',
  paragraphs: [
    'Compare the station 4L and 7 example nodes from the airway and from the esophagus in the same anatomy. The esophagus, airway, aorta and vessels stay where they are; the lines show the viewing direction.',
    'A lower paraesophageal example shows a target that the esophageal route adds. Some windows are unsupported from a given route. An esophageal examination does not replace evaluation of relevant hilar and interlobar stations through an appropriate approach.',
  ],
  checklist: [
    'Identify the airway and esophageal sides of each fixed target.',
    'Compare the aorta and surrounding vessels.',
    'Inspect a lower example and an unsupported window.',
  ],
  worked: {
    context:
      'An airway examination gives limited information about a mediastinal target adjacent to the esophagus.',
    reasoning:
      'Compare the two views of the same target. Note the changed viewing direction and unchanged target position.',
  },
  question: question(
    'route-model-predict',
    'The same station 7 node is viewed from the esophagus. What changes?',
    [
      'The approach and viewing direction',
      'The anatomical station remains tied to the target’s location.',
    ],
    [
      'Its station, since EUS uses its own nodal map',
      'EBUS and EUS use the same IASLC map; the route does not rename the node.',
    ],
    [
      'Its position relative to the main bronchi',
      'The anatomy is fixed; only the direction you look from is different.',
    ],
  ),
  lab: {
    kind: 'model',
    modelPackage: 'routes',
    goal: 'model',
    presetKey: 'routes',
    controls: [],
    instruction:
      'Compare and record both airway and esophageal views for 4L and 7. Inspect the lower paraesophageal example from the esophagus. Select an unsupported window and record that limitation.',
  },
  observation: {
    ...question(
      'route-model-observe',
      'Why did the station label remain unchanged when the approach switched?',
      [
        'Both views reference the same fixed anatomical target',
        'The route markers change, while target coordinates and anatomical identity stay fixed.',
      ],
      [
        'Station 7 is the only station seen from both routes',
        '4L is also seen from both; the label holds because the node has not moved, not because station 7 is special.',
      ],
      [
        'Both routes are oriented by the main carina',
        'The esophageal view has its own landmarks; the label holds because it belongs to the location of the node.',
      ],
    ),
    imagePolicy: 'retained-acquisition',
  },
  transfer: question(
    'route-model-transfer',
    'Relevant interlobar nodes remain unexamined after an esophageal survey. What does that imply?',
    [
      'The examination still has a regional gap requiring an appropriate approach',
      'EUS-B provides complementary information; it does not substitute for all airway-accessible regions.',
    ],
    ['The nodes can be reported negative', 'An unexamined region is not a negative result.'],
    [
      'They are N1 and do not affect a mediastinal staging report',
      'N1 status changes stage and management; an unexamined hilar or interlobar station is a gap to state and plan for.',
    ],
  ),
  diagram: 'station-map-access',
  takeaways: [
    'Station identity follows anatomy.',
    'EUS-B and EBUS provide complementary regional access.',
    'Regions you could not examine stay in the record.',
  ],
  sources: ['combined2015', 'atlas', 'simulation'],
  boundary:
    'Same-frame anatomical orientation model with derived preset locators and one lower example. No clinical reachability, esophageal navigation, acoustic image or puncture safety is simulated.',
}
