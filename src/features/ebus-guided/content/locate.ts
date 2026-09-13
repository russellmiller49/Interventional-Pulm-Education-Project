import type { Lesson } from './types'
import { question as q, matching } from './authoring'
const boundary =
  'Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.'
export const locateLessons: Lesson[] = [
  {
    id: 'ct-map',
    title: 'Translate the CT into a nodal map',
    topic: 'Locate',
    minutes: 7,
    objective: 'Use anatomical boundaries to map a target across CT and airway views.',
    recall:
      'The carina divides the trachea into the main bronchi. A rotated ultrasound sector is a different view of the same anatomy.',
    concept: 'Name the location before the specimen',
    paragraphs: [
      'Read CT in a consistent orientation, then use adjacent planes to establish the craniocaudal level and the relationship to the airway and vessels. An axial slice alone can obscure a station boundary.',
      'The IASLC map names compartments. A node’s station is determined by where it lies, not by its size, PET uptake, or sonographic appearance. Record the station before collecting and labeling a specimen.',
      'Review the clinical CT reference before the lab. In the linked workbench, Model section samples the same label volume as the simulated ultrasound; it is not CT and is not registered to the separate clinical reference. Use it to relate the main carina to the scope plane.',
    ],
    checklist: [
      'Confirm CT orientation and level.',
      'Find the airway and vascular boundary.',
      'Correlate the expected ultrasound window.',
    ],
    worked: {
      context:
        'A node lies below the carina between the medial borders of the main bronchi. The coronal view confirms it remains in the subcarinal compartment.',
      reasoning:
        'These relationships support station 7. Calling every node beside a main bronchus hilar would miss the medial subcarinal compartment.',
    },
    question: q(
      'map-predict',
      'Why review coronal or sagittal CT when an axial target lies near a nodal boundary?',
      [
        'To establish the craniocaudal level',
        'Multiplanar review helps locate the compartment when a single slice is ambiguous.',
      ],
      [
        'To decide malignancy from the plane alone',
        'CT plane selection does not establish histology.',
      ],
      [
        'To replace all ultrasound landmarks',
        'CT guides the map, but live procedural anatomy still requires confirmation.',
      ],
    ),
    lab: {
      kind: 'simulator',
      linkedLesson: 'ct-map',
      goal: 'scan',
      presetKey: 'station_7_node_a::rms',
      controls: ['roll'],
      initialRoll: 55,
      instruction:
        'In Anatomy model, select the carina with Inspect a structure. Open Model section and compare its axial and coronal level with the 3D marker. The cyan line is the current scan-plane intersection. Use Scope rotation to display the target in ultrasound. The separate clinical CT remains a reference, not a registered view of this model.',
    },
    observation: q(
      'map-observe',
      'Which finding should determine a node’s station name?',
      [
        'Its anatomical compartment',
        'Use the IASLC boundaries and document uncertainty if the compartment is unresolved.',
      ],
      ['The number of passes performed', 'Pass count describes sampling, not location.'],
      [
        'Whether its aspirate is malignant',
        'Pathology does not move a node to a different station.',
      ],
    ),
    transfer: q(
      'map-transfer',
      'Two similarly shaped nodes lie on opposite sides of a station boundary. How should samples be labeled?',
      [
        'By their separately confirmed anatomical stations',
        'Similar morphology does not justify pooling distinct station samples.',
      ],
      ['Together under the larger node’s station', 'Pooling can erase staging information.'],
      [
        'By their brightness instead of location',
        'Echo appearance cannot substitute for anatomical source.',
      ],
    ),
    diagram: 'stations',
    station: '7',
    takeaways: [
      'Multiplanar anatomy resolves station boundaries.',
      'Keep anatomical source and specimen identity linked.',
    ],
    sources: ['atlas', 'iaslc9'],
    boundary,
  },
  {
    id: 'station-seven',
    title: 'Find station 7',
    topic: 'Locate',
    minutes: 8,
    objective: 'Identify the subcarinal compartment and relate it to the two main bronchi.',
    recall:
      'The medial space between the main bronchi differs from the lateral hilar compartments.',
    concept: 'The subcarinal station is shared across approaches',
    paragraphs: [
      'Station 7 begins at the carina and occupies the subcarinal space. Its inferior limits differ by side: the upper border of the left lower-lobe bronchus on the left and the lower border of the bronchus intermedius on the right. Use multiplanar anatomy when a caudal target is near a boundary.',
      'A subcarinal target can be viewed from either main bronchus. The airway approach does not create a “right station 7” or “left station 7.” For lung-cancer nodal classification, station 7 is an N2 station for either lung.',
      'During the lab, locate the main carina and sweep through the same modeled subcarinal node from both main bronchi. The approach controls load the two calibrated starts; each approach requires your own rotation sweep.',
    ],
    checklist: [
      'Find the main carina.',
      'Confirm the medial subcarinal relationship.',
      'Record station 7 regardless of bronchial approach.',
    ],
    worked: {
      context:
        'The same subcarinal node is imaged first from the right main bronchus and then from the left.',
      reasoning:
        'The node remains in station 7. Approach and station are different pieces of the procedure record.',
    },
    question: q(
      'seven-predict',
      'A confirmed subcarinal node is sampled through the left main bronchus. Which station should be recorded?',
      ['Station 7', 'The target’s anatomical compartment defines the station.'],
      [
        'Station 10L because the scope is on the left',
        'Scope location does not automatically determine the target compartment.',
      ],
      [
        'Station 4L because the image is obtained from a left-sided window',
        'A left-sided approach does not establish a paratracheal location.',
      ],
    ),
    lab: {
      kind: 'simulator',
      linkedLesson: 'station-seven',
      goal: 'scan',
      presetKey: 'station_7_node_a::rms',
      controls: ['roll'],
      initialRoll: 55,
      instruction:
        'Select the carina in Anatomy model. From Right main bronchus, use Scope rotation to bring the target into ultrasound. Then choose Left main bronchus and repeat the sweep. Both approaches must be scanned. Compare the node’s fixed subcarinal location with the changing plane.',
    },
    observation: q(
      'seven-observe',
      'What ties the rendered target to station 7 in this activity?',
      [
        'Its subcarinal anatomical location in the model',
        'The location supplies the station identity; the sector supplies one view.',
      ],
      [
        'A dark round appearance by itself',
        'Several nodes and other structures can appear dark and round.',
      ],
      [
        'The amount of rotation needed to find it',
        'A control angle is specific to the model and is not an anatomical definition.',
      ],
    ),
    transfer: q(
      'seven-transfer',
      'The main bronchi are visible on CT. A node lies lateral to the right main bronchus rather than between the bronchi. What should you reconsider?',
      [
        'Whether it belongs to a hilar compartment instead of station 7',
        'The medial-versus-lateral relationship matters; confirm the full station boundaries.',
      ],
      [
        'Whether all nodes below the carina must be station 7',
        'Subcarinal level alone does not define the entire compartment.',
      ],
      [
        'Whether the node must be N3 solely because it is lateral',
        'N category also depends on the primary side and the actual station.',
      ],
    ),
    diagram: 'stations',
    station: '7',
    takeaways: [
      'Station 7 is an anatomical compartment, not an approach.',
      'Below the carina does not automatically mean subcarinal.',
    ],
    sources: ['atlas', 'iaslc9', 'simulation'],
    boundary,
  },
  {
    id: 'right-paratracheal',
    title: 'Right paratracheal stations: 2R and 4R',
    topic: 'Locate',
    minutes: 8,
    objective: 'Use vascular landmarks to distinguish right paratracheal levels.',
    recall: 'The IASLC map uses compartment boundaries that may not match the tracheal midline.',
    concept: 'Track the vein landmarks',
    paragraphs: [
      'The lower border of 2R, and upper border of 4R, is where the caudal margin of the left brachiocephalic (innominate) vein intersects the trachea. The lower border of 4R is the lower border of the azygos vein.',
      'The right–left division of stations 2 and 4 lies at the left lateral tracheal border. Thus tissue anterior to the trachea is not assigned by simply drawing a line through the center of the tracheal lumen.',
      'Use the reference station selector to compare 2R with 4R. On ultrasound, correlate vascular landmarks before interpreting or sampling a nearby dark structure. The guided scan focuses on the calibrated 4R example.',
    ],
    checklist: [
      'Find the brachiocephalic-vein crossing.',
      'Locate the azygos lower border.',
      'Use the left lateral tracheal wall for the side boundary.',
    ],
    worked: {
      context:
        'A right paratracheal node lies below the brachiocephalic-vein crossing and above the lower margin of the azygos vein.',
      reasoning:
        'This relationship places it in 4R. Its sonographic shape cannot distinguish it from a node in 2R.',
    },
    question: q(
      'right-predict',
      'Which landmark separates the lower right paratracheal compartment from the right hilar compartment?',
      [
        'The lower border of the azygos vein',
        'This is the inferior boundary of 4R and the superior boundary of 10R.',
      ],
      [
        'The center of the tracheal lumen',
        'The tracheal midline is not this craniocaudal boundary.',
      ],
      ['The upper border of the left pulmonary artery', 'That landmark is used on the left side.'],
    ),
    lab: {
      kind: 'simulator',
      linkedLesson: 'right-paratracheal',
      goal: 'scan',
      presetKey: 'station_4r_node_a::default',
      controls: ['roll'],
      initialRoll: 55,
      instruction:
        'In Anatomy model, select the azygos vein using Inspect a structure. Locate its lower arch margin and compare the example tissue volumes above and below that level. Use Scope rotation to bring the paratracheal target into ultrasound. Relate 4R versus 10R to the venous boundary; the displayed volumes are node examples, not full station compartments.',
    },
    observation: q(
      'right-observe',
      'The model shows a target at the selected 4R location. What must still be resolved in a clinical examination?',
      [
        'The live anatomical relationships and vascular path',
        'A calibrated teaching target does not validate an individual patient’s station or puncture path.',
      ],
      [
        'Whether all right-sided nodes share the same station',
        'Right-sided nodes occupy several distinct compartments.',
      ],
      [
        'Whether a teaching preset itself proves sampling adequacy',
        'No specimen has been obtained.',
      ],
    ),
    transfer: q(
      'right-transfer',
      'A target anterior to the trachea is just right of the left lateral tracheal wall and lies within the lower paratracheal level. Which map principle applies?',
      [
        'The side division uses the left lateral tracheal border',
        'Do not use the tracheal centerline as the side boundary for stations 2 and 4.',
      ],
      [
        'Every target left of the tracheal center must be 4L',
        'That would misapply the IASLC side boundary.',
      ],
      [
        'The target must be station 7 because it is anterior',
        'Station 7 requires the appropriate subcarinal location.',
      ],
    ),
    diagram: 'stations',
    station: '4R',
    takeaways: [
      'Use vein landmarks to distinguish 2R, 4R, and 10R.',
      'The paratracheal side boundary is the left lateral tracheal wall.',
    ],
    sources: ['atlas', 'simulation'],
    boundary,
  },
  {
    id: 'left-paratracheal',
    title: 'Left paratracheal stations: 2L and 4L',
    topic: 'Locate',
    minutes: 8,
    objective:
      'Identify the left paratracheal window using the aortic arch and left pulmonary artery.',
    recall: 'The side boundary of stations 2 and 4 follows the left lateral tracheal wall.',
    concept: 'A narrow window between vascular landmarks',
    paragraphs: [
      'The superior border of the aortic arch separates 2L from 4L. Station 4L extends down to the upper rim of the left main pulmonary artery and lies medial to the ligamentum arteriosum. Station 5 occupies the subaortic compartment lateral to that ligament.',
      'A node near the aortopulmonary window is therefore not automatically 4L. Confirm the CT compartment and live vascular landmarks rather than relying on a familiar ultrasound shape.',
      'Airway angulation and vessel position can make the 4L window difficult. Establish coupling and avoid forcing the scope. A complementary esophageal approach may be useful when appropriate; EUS-B is introduced later.',
    ],
    checklist: [
      'Locate the arch and left pulmonary artery.',
      'Confirm the medial 4L compartment.',
      'Reassess difficult access before sampling.',
    ],
    worked: {
      context:
        'A target lies left of the trachea, below the superior arch border and above the left pulmonary artery, in the medial paratracheal compartment.',
      reasoning:
        'These relationships support 4L. A more lateral subaortic node may instead be station 5 and require a different sampling strategy.',
    },
    question: q(
      'left-predict',
      'Which landmark forms the lower boundary of station 4L?',
      [
        'The upper rim of the left main pulmonary artery',
        'This separates 4L from the left hilar compartment at that boundary.',
      ],
      ['The lower border of the azygos vein', 'The azygos landmark applies to 4R on the right.'],
      [
        'The right upper-lobe bronchial origin',
        'That airway landmark does not define the lower 4L boundary.',
      ],
    ),
    lab: {
      kind: 'simulator',
      goal: 'scan',
      presetKey: 'station_4l_node_a::default',
      controls: ['roll'],
      initialRoll: 55,
      instruction:
        'Use Anatomy to inspect the left paratracheal target and adjacent vessels. Return to Ultrasound and adjust Scope rotation to bring the target into the sector. This is an assisted scan, not an access or needle simulation.',
    },
    observation: q(
      'left-observe',
      'Why compare the target with the adjacent vessels?',
      [
        'Their relationships help define the compartment and assess access',
        'Vessels supply both anatomical landmarks and procedural constraints.',
      ],
      [
        'A nearby artery guarantees benign pathology',
        'Location beside a vessel does not determine histology.',
      ],
      [
        'Vascular anatomy is only relevant after a pass',
        'The path must be assessed before puncture.',
      ],
    ),
    transfer: q(
      'left-transfer',
      'A PET-avid subaortic node is lateral to the ligamentum arteriosum. What is the best interpretation?',
      [
        'Reconsider station 5 and plan an appropriate approach with the team',
        'A lateral subaortic target is different from the medial 4L compartment.',
      ],
      [
        'Label it 4L because all aortopulmonary-window nodes are 4L',
        'That collapses distinct anatomical compartments.',
      ],
      [
        'Puncture through a vessel to keep the planned EBUS route',
        'Routine transvascular sampling is outside this introductory course and is not a default solution.',
      ],
    ),
    diagram: 'stations',
    station: '4L',
    takeaways: [
      'The arch and left pulmonary artery define key levels.',
      'Distinguish 4L from the lateral subaortic compartment.',
    ],
    sources: ['atlas', 'ics2023', 'simulation'],
    boundary,
  },
  {
    id: 'hilar-interlobar',
    title: 'Hilar and interlobar stations',
    topic: 'Locate',
    minutes: 7,
    objective: 'Distinguish hilar from interlobar compartments using bronchial landmarks.',
    recall: 'Medial subcarinal nodes remain station 7; mainstem adjacency alone is insufficient.',
    concept: 'Follow the bronchial branching level',
    paragraphs: [
      'Station 10 is hilar, adjacent to the main bronchi and hilar vessels. Station 11 lies between lobar bronchi. The transition from paratracheal to hilar territory is defined by the vascular boundaries already covered.',
      'On the right, 11Rs is between the right upper-lobe bronchus and bronchus intermedius. Station 11Ri is between the middle- and lower-lobe bronchi. On the left, 11L lies between the upper- and lower-lobe bronchi.',
      'Use the station selector to compare 10R, 10L, 11Rs, 11Ri, and 11L across CT and bronchoscopic landmarks. The suffix on 11R records the interlobar location and should not be inferred from node size.',
    ],
    checklist: [
      'Identify the mainstem or lobar branching level.',
      'Confirm medial versus lateral location.',
      'Keep right interlobar sublocations distinct.',
    ],
    worked: {
      context:
        'The scope reaches the right upper-lobe takeoff. The target lies between that bronchus and the bronchus intermedius.',
      reasoning:
        'That relationship identifies 11Rs, rather than the lower 11Ri compartment between the middle- and lower-lobe bronchi.',
    },
    question: q(
      'hilar-predict',
      'A target lies between the left upper- and lower-lobe bronchi. Which station fits this location?',
      ['11L', 'This is the left interlobar compartment.'],
      ['4L', '4L is lower paratracheal, above the defined hilar boundary.'],
      ['7', 'A lobar bifurcation on the left is not the medial subcarinal space.'],
    ),
    matching: matching(
      'Match the bronchial relationship with the station.',
      [
        ['Right upper-lobe bronchus and bronchus intermedius', '11Rs'],
        ['Right middle- and lower-lobe bronchi', '11Ri'],
        ['Left upper- and lower-lobe bronchi', '11L'],
      ],
      'The named lobar branches distinguish these interlobar compartments.',
    ),
    observation: q(
      'hilar-observe',
      'What information made these interlobar assignments possible?',
      [
        'The neighboring bronchial branches',
        'Anatomical relationships distinguish the sublocations.',
      ],
      [
        'An assumption that all interlobar nodes are malignant',
        'Pathology was not part of the matching task.',
      ],
      [
        'The relative sizes of the nodes',
        'Size does not identify the neighboring bronchial branches or station.',
      ],
    ),
    transfer: q(
      'hilar-transfer',
      'A malignant 11L node is found in a patient with a left lung primary. What nodal category does that involvement represent?',
      ['N1', 'Ipsilateral hilar and intrapulmonary nodes, including interlobar nodes, are N1.'],
      [
        'N2 solely because EBUS reached it',
        'EBUS can reach both mediastinal and hilar/interlobar stations.',
      ],
      [
        'N3 because the node is between lobes',
        'The interlobar location does not make it contralateral.',
      ],
    ),
    diagram: 'stations',
    station: '11Rs',
    takeaways: [
      'Branching landmarks distinguish interlobar stations.',
      'An accessible node is not necessarily a mediastinal node.',
    ],
    sources: ['atlas', 'iaslc9'],
    boundary,
  },
]
