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
    'Use this generic cutaway to follow movement from the external handle to the distal needle. The sheath and needle move separately along a common outlet axis. The illustration compresses the assembly; it does not specify a commercial device or a recommended extension distance.',
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
    ['That the line is bright enough', 'Brightness does not identify the endpoint.'],
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
  observation: question(
    'assembly-observe',
    'Why was advancement blocked after the plane changed?',
    [
      'A shaft echo could remain while the tip left the modeled imaging plane',
      'The needle geometry and imaging plane are separate. A surviving shaft intersection does not prove visible tip guidance.',
    ],
    ['The needle reached a validated depth limit', 'Model travel has no clinical depth meaning.'],
    [
      'The model diagnosed a vessel puncture',
      'This activity does not simulate or validate puncture safety.',
    ],
  ),
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
    'The generic model does not certify a device setup or safe puncture.',
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
      'Coupling permits transmission into tissue in this authored model.',
    ],
    ['Increase gain alone', 'Amplification cannot replace the missing contact.'],
    ['Move the calipers', 'Measurement controls do not affect coupling.'],
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
  observation: question(
    'cutaway-observe',
    'Why did changing gain fail to remove the dark region behind the reflector?',
    [
      'The modeled acoustic path is attenuated behind the reflector',
      'Amplifying the remaining echoes does not restore the missing information.',
    ],
    ['All dark regions represent malignant tissue', 'An artifact does not establish histology.'],
    [
      'Balloon inflation always removes artifacts',
      'A balloon can assist coupling but does not remove every artifact.',
    ],
  ),
  transfer: question(
    'cutaway-transfer',
    'After a pass, a focal interruption appears although surrounding tissue echoes persist. What should you reassess?',
    [
      'The contact window and a possible local air interface',
      'Compare the acquisition and contact path before interpreting the focal change as tissue.',
    ],
    ['Assume the entire station is absent', 'A local artifact is not a negative examination.'],
    ['Assign histology from the new dark area', 'Image appearance alone is insufficient.'],
  ),
  diagram: 'ultrasound',
  takeaways: [
    'Contact and gain address different problems.',
    'Fluid-balloon contact does not guarantee a clear window.',
    'The schematic illustrates mechanisms; it is not a matched clinical recording.',
  ],
  sources: ['ics2023', 'simulation'],
  boundary:
    'Authored qualitative acoustic illustration. Brightness and balloon shape do not represent measured pressure, inflation volume or a calibrated clinical ultrasound response.',
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
    'Explore a sphere, elongated ellipsoid, two adjacent objects and a lobulated union. Their dimensions stay fixed while the section moves. The millimeters in this activity belong to authored geometric phantoms.',
    'Sweep each shape completely before measuring. For the required record, return to the elongated phantom’s central section, freeze it and place opposing short-axis calipers. The two adjacent objects share the same fictional station label; object count does not define station count.',
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
      'The object has not shrunk. Move through its full extent and compare sections. In this worked model, hover reveals the phantom identity; the independent measurement withholds dimensional and border answers.',
  },
  question: question(
    'phantom-predict',
    'A fixed phantom looks smaller after the plane is moved. What is the most direct explanation?',
    [
      'The plane passes through a smaller cross-section',
      'Plane position changes the section without changing the object dimensions.',
    ],
    ['Its tissue has regressed', 'The shape is fixed and has no biological behavior.'],
    ['A second station has appeared', 'Section size does not define station identity.'],
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
  observation: question(
    'phantom-observe',
    'What does the recorded millimeter measurement represent?',
    [
      'A distance in the authored geometric phantom',
      'The value comes from the phantom coordinate system and placed calipers; it does not calibrate clinical media.',
    ],
    [
      'A calibrated measurement in the course videos',
      'Uncalibrated recordings cannot inherit phantom dimensions.',
    ],
    [
      'Evidence of malignancy from object shape',
      'These shapes teach geometry, not pathological diagnosis.',
    ],
  ),
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
    'Phantom dimensions do not establish histology or clinical-image calibration.',
  ],
  sources: ['atlas', 'simulation'],
  boundary:
    'Analytic geometric phantoms with authored dimensions. The fictional station label teaches documentation and does not make these objects anatomical station boundaries.',
}
export const routeModel: Lesson = {
  id: 'eus-b-route-model',
  title: 'Compare airway and esophageal windows',
  topic: 'Plan',
  minutes: 10,
  objective:
    'Compare two approaches to a fixed modeled target and identify gaps that an esophageal examination does not resolve.',
  recall:
    'EUS-B uses the EBUS endoscope from the esophagus. Changing the approach does not change a lymph node’s anatomical station.',
  concept: 'Complementary access, with explicit limits',
  paragraphs: [
    'Compare fixed station 4L and 7 example nodes from airway and esophageal orientation locators in the same anatomy frame. The esophagus, airway, aorta and vessels retain their original positions. Lines indicate viewing direction only.',
    'A separate authored lower paraesophageal example illustrates additional context. Some requested windows are deliberately unsupported. An esophageal examination does not replace evaluation of relevant hilar and interlobar stations through an appropriate approach.',
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
      'Compare the two preset views of the same modeled target. Note the changed viewing direction and unchanged target position. These locators have not been validated as sampling windows or puncture trajectories.',
  },
  question: question(
    'route-model-predict',
    'The same station 7 node is viewed from the esophagus. What changes?',
    [
      'The approach and viewing direction',
      'The anatomical station remains tied to the target’s location.',
    ],
    ['The node becomes station 8', 'Changing route does not relocate the node.'],
    [
      'Every previously inaccessible node becomes reachable',
      'Complementary access does not imply universal reachability.',
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
  observation: question(
    'route-model-observe',
    'Why did the station label remain unchanged when the approach switched?',
    [
      'Both views reference the same fixed anatomical target',
      'The route markers change, while target coordinates and anatomical identity stay fixed.',
    ],
    ['Station labels are assigned by the scope route', 'Anatomical location defines the station.'],
    [
      'The model guarantees both approaches can safely sample it',
      'Orientation locators are not validated puncture windows.',
    ],
  ),
  transfer: question(
    'route-model-transfer',
    'Relevant interlobar nodes remain unexamined after an esophageal survey. What does that imply?',
    [
      'The examination still has a regional gap requiring an appropriate approach',
      'EUS-B provides complementary information; it does not substitute for all airway-accessible regions.',
    ],
    ['The nodes can be reported negative', 'An unexamined region is not a negative result.'],
    [
      'A generic route toggle proves access',
      'This model deliberately excludes unsupported windows.',
    ],
  ),
  diagram: 'stations',
  takeaways: [
    'Station identity follows anatomy.',
    'EUS-B and EBUS provide complementary regional access.',
    'Unsupported or unexamined windows remain explicit.',
  ],
  sources: ['combined2015', 'atlas', 'simulation'],
  boundary:
    'Same-frame anatomical orientation model with derived preset locators and one authored lower example. No clinical reachability, esophageal navigation, acoustic image or puncture safety is simulated.',
}
