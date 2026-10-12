import type { Lesson } from './types'
import { question } from './authoring'

export const needleModel: Lesson = {
  id: 'needle-assembly-model',
  title: 'Needle assembly and live-tip visibility',
  topic: 'Sample',
  minutes: 10,
  objective:
    'Distinguish sheath movement from needle exposure and stop advancement when live tip guidance is lost.',
  recall:
    'The sheath protects the needle during passage through the working channel. A visible shaft segment does not establish the location of its tip.',
  concept: 'The handle and distal needle form one assembly',
  paragraphs: [
    'Use this model to follow movement from the handle to the distal needle: switch between the Needle tip and Handle views to see both ends. The sheath and needle move separately along a common outlet axis. The handle and the scope tip are drawn at true size, with the length of the scope between them left out.',
    'The ultrasound schematic shows only the part of the needle intersecting its finite imaging plane. Changing that plane can remove the tip echo while leaving part of the shaft visible. Frozen images and missing contact cannot provide current tip guidance.',
  ],
  checklist: [
    'Identify the sheath, needle handle, extension stop and channel outlet.',
    'Compare the live tip with a shaft-only image.',
    'Stop and reassess lost visualization or resistance; retract and secure before removal.',
  ],
  worked: {
    context:
      'The operator changes the imaging plane while the needle remains in place. A short bright line persists.',
    reasoning:
      'In the worked model, hover over the assembly, prepare and lock the sheath, then expose the tip. Introduce a plane change. Compare the true tip location in 3D with the shorter line in the schematic. Stop advancement before restoring the demonstration window.',
  },
  question: question(
    'assembly-predict',
    'A needle-like line remains after the imaging plane changes. What must be established before further advancement?',
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
    instruction:
      'Prepare the sheath and lock it. Display the tip live, introduce a plane change, then stop and reassess. Restore the window. Introduce resistance and stop again. Finish by retracting the needle and removing the secured assembly.',
  },
  observation: {
    ...question(
      'assembly-observe',
      'Why was advancement blocked after the plane changed?',
      [
        'A shaft echo could remain while the tip left the imaging plane',
        'The needle geometry and imaging plane are separate. A surviving shaft intersection does not prove visible tip guidance.',
      ],
      [
        'The needle had reached the far border of the node',
        'Nothing about the node changed; the plane moved, so the position of the tip was no longer known.',
      ],
      [
        'The shorter echo showed that the needle was bending',
        'A shorter line after a plane change means less of the needle lies in the plane, not that it has deflected.',
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
    'Sheath position and needle exposure are distinct.',
    'A frozen frame or shaft-only echo cannot substitute for live tip guidance.',
  ],
  sources: ['ics2023', 'simulation'],
  boundary:
    'Generic mechanical and imaging-plane illustration. No patient tissue mechanics, device dimensions, force, sampling yield or clinically validated puncture trajectory is modeled.',
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
  title: 'Sweep and measure geometric phantoms',
  topic: 'Optimize',
  minutes: 12,
  objective:
    'Sweep through fixed shapes and record a central short-axis measurement using visible borders.',
  recall: 'The same fixed object can produce different sections as the imaging plane moves.',
  concept: 'A section is only one view of the object',
  paragraphs: [
    'Explore a sphere, elongated ellipsoid, two adjacent objects and a lobulated union. Their dimensions stay fixed while the section moves.',
    'Sweep each shape completely before measuring. For the required record, return to the elongated phantom’s central section, freeze it and place opposing short-axis calipers. The two adjacent objects share the same station label; object count does not define station count.',
  ],
  checklist: [
    'Sweep from before the near border to beyond the far border.',
    'Compare central and off-center sections.',
    'Freeze, select the requested axis, place border calipers and label the phantom image.',
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
      'Sweep every shape through all plane positions. Return to Elongated, set plane offset to zero and freeze. Select the short axis and place two calipers on opposite visible borders. Label the image “Phantom station 7” and record it. Use “Not adequately visualized” when borders cannot be measured.',
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
  boundary:
    'These are geometric phantoms. The station label on them teaches documentation; it does not make them an anatomical station.',
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
  diagram: 'stations',
  takeaways: [
    'Station identity follows anatomy.',
    'EUS-B and EBUS provide complementary regional access.',
    'Regions you could not examine stay in the record.',
  ],
  sources: ['combined2015', 'atlas', 'simulation'],
  boundary:
    'Same-frame anatomical orientation model with derived preset locators and one lower example. No clinical reachability, esophageal navigation, acoustic image or puncture safety is simulated.',
}
