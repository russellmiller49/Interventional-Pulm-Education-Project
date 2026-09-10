import type { Lesson, ObjectiveId } from '../types'

export const OBJECTIVES: { id: ObjectiveId; title: string; description: string }[] = [
  {
    id: 'choose',
    title: 'Choose the information',
    description:
      'Distinguish navigation, lesion localization, tool confirmation, and diagnostic tissue.',
  },
  {
    id: 'optimize',
    title: 'Make 2D imaging useful',
    description:
      'Match projection, beam field, magnification, and temporal settings to the imaging problem.',
  },
  {
    id: 'dts',
    title: 'Interpret tomosynthesis',
    description:
      'Recognize what limited-angle reconstruction measures and where uncertainty remains.',
  },
  {
    id: 'cbct',
    title: 'Plan a useful CBCT scan',
    description: 'Apply acquisition principles to fixed and mobile suite workflows.',
  },
  {
    id: 'verify',
    title: 'Verify the sampling tool',
    description:
      'Assess multiplanar evidence and recognize when anatomy or an overlay needs reassessment.',
  },
  {
    id: 'protect',
    title: 'Use radiation deliberately',
    description:
      'Protect the team and distinguish the patient dose quantities in a procedure report.',
  },
]

export const LESSONS: Lesson[] = [
  {
    id: 'imaging-questions',
    title: 'What does this image establish?',
    shortTitle: 'Four questions',
    group: 'Start with the target',
    stage: 'Orientation',
    minutes: 4,
    objective: 'choose',
    outcome:
      'Distinguish the information supplied by a navigation map, an image, and a tissue result.',
    concept: 'Separate the imaging questions',
    prerequisites: [],
    why: 'A convincing display can lead to repeated sampling of tissue that was never the target when its information source is misunderstood.',
    recall: {
      prompt:
        'Before asking which technology to use, what decision is the next image meant to support?',
      answer:
        'Name the uncertainty: the airway path, current lesion location, actual sampling-tool position, or a complication. Then choose a measurement that addresses it.',
    },
    blocks: [
      {
        title: 'A map, a photograph, and a specimen',
        body: 'A navigation display is like a path drawn on a map. It can bring you to an address without showing what is inside the building today. Imaging adds a measurement of current anatomy; tissue acquisition adds a different kind of evidence.',
        points: [
          'Navigation: where is the tracked catheter relative to the map?',
          'Localization: where is the intended lesion now?',
          'Confirmation: where is the actual sampling component relative to it?',
          'Diagnosis: did the specimen answer the clinical question?',
        ],
        sources: ['setser', 'confirm'],
      },
      {
        title: 'Match the modality to the missing information',
        body: 'Fluoroscopy supplies a projection with useful temporal information. Radial EBUS samples local acoustic surroundings. DTS adds depth information from a limited sweep. CBCT reconstructs a volume over a broader orbit. An augmented contour projects a previous segmentation onto a current image.',
        points: [
          'A visible needle does not establish that the lesion is visible.',
          'A tracked catheter does not establish where a different tool will exit.',
          'Geometric localization does not guarantee diagnostic tissue.',
        ],
        sources: ['setser', 'frontier', 'pritchett'],
      },
    ],
    worked: {
      scenario:
        'The navigation screen places the catheter at the virtual target. Fluoroscopy shows a needle but no convincing nodule.',
      reasoning:
        'The path and the hardware are represented. Current lesion identity and needle–lesion depth remain uncertain. Choose additional localization or confirmation evidence before attributing a nondiagnostic sample to pathology alone.',
    },
    takeaway: [
      'State the question before acquiring.',
      'Name what is measured and what is a model.',
      'Keep localization and diagnosis as separate outcomes.',
    ],
    checkIds: ['choose-1', 'choose-transfer-1'],
  },
  {
    id: 'chain-walk',
    title: 'Follow the beam: a walk through the suite',
    shortTitle: 'The walk',
    group: 'Start with the target',
    stage: 'Foundation',
    minutes: 6,
    objective: 'optimize',
    outcome:
      'Name the six stops between the X-ray tube and the decision, and say which stop each imaging term belongs to.',
    concept: 'The image is made at the end of a six-stop chain',
    prerequisites: ['imaging-questions'],
    why: 'Every later section lights one stop of this chain. A term met at its stop survives; a term met in a list does not.',
    recall: {
      prompt: 'Which four questions can an image in the suite be asked to answer?',
      answer:
        'Where the tracked catheter is relative to the map, where the lesion is now, where the actual sampling component is relative to it, and whether the specimen answered the clinical question.',
    },
    blocks: [
      {
        title: 'Six stops, one image',
        kind: 'signals',
        body: 'An X-ray image is made along a chain. A source fires photons, a cone of them crosses the patient, a detector measures what arrives, a computer may reconstruct or register what was measured, and a monitor shows the result to the person deciding. Each stop changes the image in its own way, and every technology in this course is a different way of using the same chain.',
        points: [
          'The source decides energy, quantity and pulses.',
          'The beam decides aim, width and distance.',
          'The patient decides overlap, motion and the timestamp.',
          'The detector, the reconstruction and the display decide what is measured, what is added, and what is shown.',
        ],
        sources: ['tg272', 'setser'],
      },
      {
        title: 'Walk it on a running suite',
        kind: 'pattern',
        body: 'The walk visits each stop on a normal, working suite: a centred target, an open field, a pulsed beam, a visible tool. At each stop you read its plain name, its analogy and its short checklist, and where a control lives at that stop you move it once to see what changes. Nothing is broken yet; the faults come later, one at a time.',
        sources: ['tg272'],
      },
      {
        title: 'One ray, one pixel',
        kind: 'after-commitment',
        body: 'The idea the whole course rests on lives at the beam. Each pixel of the image collects a single ray from the source, and everything along that ray lands on the same pixel. Depth along the ray is not measured by one image; turning the beam, sweeping it or orbiting it are the ways the later sections recover it.',
        sources: ['tg272', 'setser'],
        detail: {
          title: 'Why the chain, not the device',
          body: 'Fluoroscopy, tomosynthesis, cone-beam CT and augmented fluoroscopy share the source, the beam, the patient and the detector. They differ at the reconstruction stop: how many angles were measured, how wide the arc, and what was borrowed from a prior scan. Reading a technology as a traversal of the chain makes its limits predictable.',
        },
      },
    ],
    worked: {
      scenario:
        'A colleague asks why a needle that was clearly on the nodule on the monitor turned out to be a centimetre behind it.',
      reasoning:
        'Follow the chain. The beam made the overlap: needle and nodule sat on one ray and shared a pixel. The detector measured that faithfully and the display showed it faithfully. Nothing downstream of the beam could have separated them; a second beam direction could.',
    },
    lab: 'geometry',
    labTask:
      'Walk the six stops. At the beam stop, move the obliquity once and watch the ray, the cone and the image move together.',
    takeaway: [
      'Six stops make one image.',
      'Each stop has its own short checklist.',
      'Depth along a ray is not measured by one image.',
    ],
    checkIds: ['walk-1', 'choose-1'],
  },
  {
    id: 'good-image',
    title: 'A good image: the baseline you read everything against',
    shortTitle: 'Five things',
    group: 'Start with the target',
    stage: 'Foundation',
    minutes: 6,
    objective: 'optimize',
    outcome:
      'Distinguish the five things you can change at the C-arm from the things the machine changes for you and the things that only change the display.',
    concept: 'Five things you can change; the machine sets the exposure',
    prerequisites: ['chain-walk'],
    why: 'A console offers dozens of buttons. Knowing which five change the acquisition turns every later problem into a single question: which of the five, if any.',
    recall: {
      prompt:
        'At which stop of the chain do two objects at different depths come to share a pixel?',
      answer:
        'At the beam. Each pixel collects one ray, and everything along that ray lands on it.',
    },
    blocks: [
      {
        title: 'What a good image looks like',
        kind: 'signals',
        body: 'Before any fault, see the baseline: the target centred, the field closed to the task with the whole tool excursion inside it, a pulsed beam at a rate that shows the movement you need, and a view chosen from the planning CT so nothing dense lies on the ray. Every later section starts from this image and breaks one thing.',
        sources: ['wabip', 'setser'],
      },
      {
        title: 'Five things you can change',
        kind: 'after-commitment',
        body: 'At the C-arm you change five things: where the beam is aimed (obliquity and cranial or caudal tilt), how wide it is (collimation), how time is sampled (pulse rate and pulse width), what acquisition you ask for (a single image, a limited sweep or a full orbit), and what the display shows (zoom, window, overlay). Everything else is monitoring.',
        points: [
          'Aim — the angle.',
          'Width — the collimator.',
          'Time — pulses per second and their length.',
          'Acquisition — image, sweep or orbit.',
          'Display — zoom, window, overlay.',
        ],
        sources: ['tg272', 'tg125', 'wabip'],
      },
      {
        title: 'The machine sets the exposure',
        kind: 'after-commitment',
        body: 'Tube voltage, current and filtration are chosen by automatic exposure regulation to hold the detector signal. You do not turn them up by hand, and a brighter image does not mean less output. What the machine did appears on the dose readout, which is why the readout, not the monitor, is where output is judged.',
        sources: ['tg125', 'aapm12'],
      },
    ],
    worked: {
      scenario:
        'A target sits behind the heart. One colleague reaches for the magnification button; another asks for fifteen degrees of obliquity.',
      reasoning:
        'Magnification enlarges the same ray, and the heart with it. Obliquity changes which ray crosses the target, so the heart can leave it. The first changes the display or the sampling; the second changes the aim. Name the thing you are changing before you change it.',
    },
    labTask:
      'Place each console control with the thing it changes: aim, width, time, acquisition or display — or monitoring, when it changes nothing about the beam.',
    takeaway: [
      'Five things change the acquisition.',
      'The machine chooses the exposure and reports it.',
      'Display changes are not acquisition changes.',
    ],
    checkIds: ['good-1', 'walk-1'],
  },
  {
    id: 'current-anatomy',
    title: 'The CT map and the lung today',
    shortTitle: 'The map',
    group: 'Start with the target',
    stage: 'Foundation',
    minutes: 5,
    objective: 'choose',
    outcome:
      'Distinguish a planning-map mismatch from loss of tracking or inadequate target coverage.',
    concept: 'Anatomy has an acquisition state',
    prerequisites: ['imaging-questions', 'chain-walk'],
    why: 'An anesthetized lung can differ from the inspiratory planning CT even while navigation hardware tracks accurately.',
    recall: {
      prompt: 'Does reaching the virtual target establish that the lesion has been localized now?',
      answer:
        'No. The virtual target is inherited from a prior acquisition. Current anatomy and the sampling component require their own evidence.',
    },
    blocks: [
      {
        title: 'Read the CT as a path and a safety map',
        body: 'Follow the bronchus in thin multiplanar images to the lesion. Record morphology, the airway–lesion relationship, and nearby pleura, fissures, vessels and diaphragm. Anticipate which projections will cross ribs, heart or dense chest wall.',
        points: [
          'Confirm the intended target and its relevant solid or wall component.',
          'Identify the final airway and direction of approach.',
          'Plan what anatomy must remain visible during instrument movement.',
        ],
        sources: ['setser', 'pritchett'],
      },
      {
        title: 'A timestamp is part of an image',
        body: 'Planning CT and procedural imaging may differ in lung inflation, body and arm position, time, and instrument deformation. CT-to-body divergence includes true anatomical change; it is broader than sensor error. Dependent atelectasis may both displace a lesion and obscure its boundary.',
        sources: ['setser', 'ilocate', 'vespa'],
        detail: {
          title: 'Respiratory excursion and progressive change',
          body: 'Cyclic motion moves the target through a breath. Hysteresis means a similar volume or pressure does not guarantee the same regional position on inflation and deflation. Progressive collapse or tool deformation changes the baseline itself. A central landmark staying aligned does not prove that a peripheral target is unchanged.',
        },
      },
      {
        title: 'Explain an absent target',
        body: 'When the expected nodule is absent, first assess coverage and acquisition quality. The target may be outside the reconstructed field, faint, obscured by atelectasis or hemorrhage, or changed since the planning CT. Reconcile current imaging with the original target before deciding whether to redirect, obtain different imaging, or reconsider the procedure.',
        sources: ['setser', 'mobile', 'ilocate'],
      },
    ],
    worked: {
      scenario:
        'A posterior lower-lobe target is clear on planning CT but becomes inseparable from a new dependent opacity during the case.',
      reasoning:
        'The map may still be correctly registered to central structures while the local lung has changed. Check aeration and target identity with anesthesia and current imaging; additional navigation precision alone cannot restore the original anatomy.',
    },
    lab: 'registration',
    labTask:
      'Change the anatomical state, then toggle the old contour. Observe which information remains current.',
    takeaway: [
      'Read the airway path and nearby hazards before instrumentation.',
      'Treat an image as a measurement of a particular state.',
      'A missing target needs an explanation.',
    ],
    checkIds: ['anatomy-1', 'choose-1'],
  },
  {
    id: 'projection',
    title: 'From a 3D chest to a 2D view',
    shortTitle: 'One ray',
    group: 'Start with the target',
    stage: 'Foundation',
    minutes: 6,
    objective: 'optimize',
    outcome:
      'Distinguish projected overlap from a resolved three-dimensional tool–target relationship.',
    concept: 'Projection removes one dimension',
    prerequisites: ['imaging-questions', 'current-anatomy', 'good-image'],
    why: 'A tool can overlap a nodule on the monitor while remaining anterior or posterior to it.',
    recall: {
      prompt: 'What can an old target contour establish about the lesion at this moment?',
      answer:
        'It shows the projected location of a prior segmentation. Its current validity depends on the anatomical and registration state.',
    },
    blocks: [
      {
        title: 'Think of shadows cast from different directions',
        kind: 'after-commitment',
        body: 'A projection combines information along each ray. Structures separated along the beam can share the same image position. Turning the beam creates parallax: their projected separation changes. Cranial/caudal tilt changes a different set of overlaps from obliquity.',
        points: [
          'Start with the planning CT to anticipate useful angles.',
          'Change the view enough to add information while preserving clearance.',
          'Recenter and recollimate after movement.',
        ],
        sources: ['setser', 'tg272'],
      },
      {
        title: 'Alignment and advancement are different tasks',
        body: 'A view looking along an instrument can help assess its aim but foreshortens its length. A more side-on view makes extension easier to observe. Choose the view for the task, and preserve the distal tool and necessary safety landmarks in the field.',
        sources: ['setser', 'pritchett'],
        detail: {
          title: 'Use verified direction conventions',
          body: 'Patient position, detector orientation and image flips determine what left, right, cranial and caudal mean on a particular console. Verify the radiographic orientation markers and the system convention. Do not memorize a direction-of-parallax rule without specifying those conventions.',
        },
      },
      {
        title: 'A second overlap still has limits',
        body: 'Separated projections can uncover a depth mismatch. Visual overlap in two projections does not prove that a finite sampling region lies inside a finite lesion. Blur, tool bloom, motion, lesion shape and residual depth uncertainty matter; use current tomography when the missing relationship would change safe sampling.',
        sources: ['setser', 'pritchett'],
      },
    ],
    worked: {
      scenario:
        'A needle and target overlap in the frontal view. In an oblique view they separate.',
      reasoning:
        'The new view exposes a component of separation that the first view compressed. Reassess the trajectory using the current target. Turning the C-arm changed the evidence, not the physical position of the needle.',
    },
    lab: 'geometry',
    labTask:
      'Keep the tool depth offset, rotate the C-arm, and compare the 3D scene with its teaching projection.',
    takeaway: [
      'Overlap is a projection finding.',
      'Select an angle for the information you need.',
      'A view change does not move the tool.',
    ],
    checkIds: ['geometry-1', 'anatomy-1'],
  },
  {
    id: 'signal',
    title: 'Why a target is hard to see',
    shortTitle: 'Hard to see',
    group: 'Optimize 2D fluoroscopy',
    stage: 'Mechanism',
    minutes: 5,
    objective: 'optimize',
    outcome: 'Distinguish quantum noise from scatter and overlapping anatomy.',
    concept: 'Image quality has a limiting mechanism',
    prerequisites: ['projection', 'good-image'],
    why: 'More exposure can make a clean image of the same unresolved overlap.',
    recall: {
      prompt:
        'When does changing projection add more useful information than enlarging the display?',
      answer:
        'When overlying anatomy or unresolved beam-direction separation is the limiting problem. Display enlargement preserves the same projection.',
    },
    blocks: [
      {
        title: 'Identify what is hiding the target',
        kind: 'after-commitment',
        body: 'Quantum noise is variation from limited detected photons. Scatter adds unwanted signal that reduces contrast. Anatomical clutter is real superimposed structure. They can look similar at first glance but require different responses.',
        points: [
          'Grainy image: assess photon statistics and motion.',
          'Washed-out contrast: assess field size, scatter and display.',
          'A rib or heart over the target: consider a different beam path.',
          'No distinct lesion after optimization: reassess identity or modality.',
        ],
        sources: ['tg125', 'tg272', 'wabip'],
      },
      {
        title: 'Energy and photon quantity are different',
        body: 'Tube voltage influences the X-ray spectrum and penetration; tube current and exposure duration influence photon quantity. Filtration removes part of the low-energy spectrum. These controls interact with automatic exposure regulation, so one knob does not map to one universal dose or contrast change.',
        sources: ['tg125', 'tg272'],
        detail: {
          title: 'The quantitative idea',
          body: 'In an ideal quantum-limited model, signal-to-noise ratio scales with the square root of detected photon count: four times the photons gives about twice the SNR with all other factors fixed. This is a physics relationship, not a prediction of diagnostic yield. Attenuation follows a line integral through heterogeneous tissue; the simple I = I₀ exp(−μx) form assumes a uniform material and monoenergetic narrow beam.',
        },
      },
      {
        title: 'Brightness can hide an output increase',
        body: 'Automatic exposure control may raise voltage, current or pulse duration when the beam traverses thicker tissue or a dense object. The monitor can remain similarly bright while output increases. Recheck dose-rate information after major angle, field or acquisition-mode changes.',
        sources: ['tg125', 'wabip'],
      },
    ],
    worked: {
      scenario:
        'The needle is sharp and the image is not grainy, but the nodule lies behind the cardiac silhouette.',
      reasoning:
        'Anatomical overlap is the leading limitation. Review the CT for a useful alternative projection, then assess its exposure implications. Increasing photon count would still image the same superimposed heart.',
    },
    lab: 'geometry',
    labTask:
      'Turn the beam until the heart leaves the ray through the target, then add a tilt and read what the projection does.',
    takeaway: [
      'Name the limiting mechanism.',
      'More photons have diminishing returns.',
      'Monitor brightness is not a dosimeter.',
    ],
    checkIds: ['signal-1', 'geometry-1'],
  },
  {
    id: 'field',
    title: 'Field size, geometry, and enlargement',
    shortTitle: 'Field and zoom',
    group: 'Optimize 2D fluoroscopy',
    stage: 'Mechanism',
    minutes: 6,
    objective: 'optimize',
    outcome:
      'Distinguish physical beam restriction and acquisition changes from display-only operations.',
    concept: 'Acquired information versus displayed information',
    prerequisites: ['signal', 'projection'],
    why: 'A smaller displayed field may still expose the same anatomy, while a magnification control may change acquisition without making that obvious.',
    recall: {
      prompt: 'Why might the monitor stay bright when the beam traverses more tissue?',
      answer:
        'Automatic exposure regulation can increase output to maintain its detector target. Check the dose-rate readout instead of judging brightness alone.',
    },
    blocks: [
      {
        title: 'Restrict the actual beam to the task',
        body: 'Physical collimation limits the tissue irradiated and the volume generating scatter. Electronic cropping hides acquired pixels. Supported virtual collimation places real shutters using a stored image before the next exposure. Confirm which operation the console performs.',
        points: [
          'Include the lesion or anticipated location, actual tool and needed landmarks.',
          'Allow for the complete planned tool excursion.',
          'Adapt shutters after each projection change.',
          'Check output: exposure regulation can partly offset a smaller field.',
        ],
        sources: ['wabip', 'tg125', 'tg272'],
      },
      {
        title: 'Ask what the zoom button changes',
        body: 'Display zoom enlarges existing data and adds no exposure when reviewing a stored image. Image-intensifier electronic magnification usually needs increased exposure. Flat-panel field modes may change binning/readout or merely crop. Their detail and dose effects need local characterization.',
        sources: ['tg272', 'tg125'],
      },
      {
        title: 'Geometry changes sampling and blur',
        body: 'For routine 2D work, avoid an unnecessary patient-to-detector gap and an unnecessarily short source-to-skin distance. Geometric magnification changes both sampling and focal-spot blur. Preserve clearance and the required target isocenter when preparing a rotational acquisition.',
        sources: ['setser', 'tg272'],
        detail: {
          title: 'A useful geometry relationship',
          body: 'Magnification M = source-to-image distance / source-to-object distance. Image-plane focal-spot blur is approximately f × (M − 1), for focal spot f. Better apparent sampling can coexist with more focal-spot blur. A rigid C-arm has a fixed source–detector spacing even when the entire assembly moves.',
        },
      },
    ],
    worked: {
      scenario:
        'The instrument is small on a held image. The operator is considering a smaller acquisition field just to inspect its edge.',
      reasoning:
        'Try display-only enlargement of the stored image first. It changes how existing information is viewed. If true detail is insufficient, a validated acquisition change may be needed, with its output checked.',
    },
    lab: 'field',
    labTask:
      'Compare the irradiated field with a display crop, then enlarge the stored image. Keep the full tool excursion visible.',
    takeaway: [
      'Collimation acts on the beam; cropping acts on the display.',
      'A magnification label does not describe the acquisition.',
      'Preserve context and mechanical clearance.',
    ],
    checkIds: ['field-1', 'signal-1'],
  },
  {
    id: 'time',
    title: 'Three clocks in a moving image',
    shortTitle: 'Three clocks',
    group: 'Optimize 2D fluoroscopy',
    stage: 'Mechanism',
    minutes: 6,
    objective: 'optimize',
    outcome: 'Distinguish within-frame blur, between-frame movement, and display lag.',
    concept: 'Measured time is different from display time',
    prerequisites: ['signal', 'field'],
    why: 'A crisp or smoothly refreshed image can still miss instrument movement between measurements.',
    recall: {
      prompt: 'Does a display-only change remove radiation already delivered?',
      answer:
        'No. Cropping, enlargement and windowing of stored data change viewing, not the preceding exposure.',
    },
    blocks: [
      {
        title: 'A short shutter opening and frequent photographs',
        body: 'Pulse width sets how much movement occurs during one exposure. Pulse rate sets how often new measurements arrive. Display refresh may repeat or interpolate those measurements. A short exposure can freeze a frame while a low rate leaves large gaps between measured positions.',
        sources: ['tg272', 'tg125'],
      },
      {
        title: 'Match temporal settings to the task',
        body: 'Use the lowest pulse rate and acquisition quality that reliably shows the movement needed for the task. Static position review may tolerate a different setting from tool advancement. A lower rate does not ensure proportionally lower output if the system lengthens pulses or increases current.',
        points: [
          'Check actual independent acquisition rate.',
          'Assess pulse width when motion blur dominates.',
          'Recognize temporal averaging as a source of smear or lag.',
          'Release the pedal to think; review last-image hold or a saved loop.',
        ],
        sources: ['tg272', 'tg125', 'wabip'],
      },
      {
        title: 'Image processing cannot create missing measurements',
        body: 'Temporal averaging can make noise less obvious but smear moving structures. Edge enhancement and window changes can improve display use without proving that a boundary was physically resolved. Preserve the source images and validate task presets with the technologist and physicist.',
        sources: ['tg272', 'tg125'],
      },
    ],
    worked: {
      scenario:
        'After the pulse rate is reduced, the controller doubles pulse width. Current remains unchanged.',
      reasoning:
        'There are fewer independent time samples, but the same mAs per second in this simplified comparison. Each exposure also spans more motion. Pulse-rate arithmetic alone does not establish patient dose savings.',
    },
    lab: 'temporal',
    labTask:
      'Halve pulse rate, then double pulse width. Compare measurement spacing, in-frame blur, and tube load.',
    takeaway: [
      'Pulse width, pulse rate and refresh rate are different.',
      'Judge image adequacy during the actual task.',
      'Use held images for deliberation.',
    ],
    checkIds: ['time-1', 'field-1'],
  },
  {
    id: 'two-dimensional',
    title: 'A deliberate 2D imaging sequence',
    shortTitle: 'The sequence',
    group: 'Optimize 2D fluoroscopy',
    stage: 'Application',
    minutes: 5,
    objective: 'choose',
    outcome:
      'Select the next useful adjustment when fluoroscopy does not answer the procedural question.',
    concept: 'Integrate question, geometry, field and temporal sampling',
    prerequisites: ['current-anatomy', 'projection', 'signal', 'field', 'time'],
    why: 'Repeated exposures with no new information delay useful localization and add avoidable radiation.',
    recall: {
      prompt: 'Which two independent temporal problems can remain in a crisp low-rate image?',
      answer:
        'Movement between acquired frames and lag from display processing. Short pulse width addresses blur within a frame, not either problem by itself.',
    },
    blocks: [
      {
        title: 'Prepare, inspect, change one limiting factor',
        kind: 'after-commitment',
        body: 'State the question and review the CT for the intended target and beam path. Confirm current aeration, geometry and clearance. Center the region, collimate physically, and select sufficient temporal behavior. Inspect the target and actual tool before escalating image quality.',
        points: [
          'For clutter, choose a useful angle and recenter.',
          'For small display size, inspect a held image with display zoom.',
          'For motion, address acquisition timing or movement.',
          'For unresolved depth or lesion identity, choose additional current imaging.',
        ],
        sources: ['setser', 'tg272', 'wabip'],
      },
      {
        title: 'Add radial EBUS as a different measurement',
        body: 'Radial EBUS depicts local tissue around the probe without ionizing radiation. A concentric or eccentric pattern helps localize an airway relative to tissue, but atelectatic lung can also look tissue-like. The probe is then exchanged; the sampling tool can follow a different path despite a stable sheath.',
        sources: ['mobile', 'ilocate', 'frontier'],
      },
      {
        title: 'Escalate for information, then reassess',
        body: 'Use DTS or CBCT when their depth or current anatomical information can change the next decision. More exposure will not repair an out-of-field target, resolve all superimposition or turn a virtual contour into a directly observed nodule. Save the evidence that actually supported sampling.',
        sources: ['setser', 'verhoeven', 'pritchett'],
      },
    ],
    worked: {
      scenario:
        'A peripheral target remains poorly defined after a useful angle change and appropriate beam restriction. A needle is easy to see.',
      reasoning:
        'Further polishing of the needle image does not establish target identity. Use the clinical context and available imaging to resolve the missing lesion/tool relationship. A current volume may answer a question the projection cannot.',
    },
    takeaway: [
      'Fix the limiting mechanism before increasing exposure.',
      'Treat rEBUS and fluoroscopy as complementary evidence.',
      'Stop repeating an unanswered question in the same way.',
    ],
    checkIds: ['workflow-1', 'time-1'],
  },
  {
    id: 'dts-acquisition',
    title: 'Building depth from a limited sweep',
    shortTitle: 'The sweep',
    group: 'Digital tomosynthesis',
    stage: 'Mechanism',
    minutes: 6,
    objective: 'dts',
    outcome:
      'Explain what a limited angular acquisition adds to one projection and what remains incompletely sampled.',
    concept: 'Limited-angle depth reconstruction',
    prerequisites: ['projection', 'two-dimensional'],
    why: 'The word “3D” on a reconstruction does not tell you whether depth is equally well resolved in every direction.',
    recall: {
      prompt: 'How does changing the beam direction expose a hidden separation?',
      answer:
        'Parallax changes the projected positions of structures at different depths. A single image compresses that beam-direction separation.',
    },
    blocks: [
      {
        title: 'Bring one depth plane into agreement',
        body: 'Imagine sliding a stack of photographs until one object lines up. That object reinforces; structures at different depths spread out. DTS uses multiple projections over a limited arc to recover depth-dependent information and reduce superimposition.',
        sources: ['saad', 'frontier'],
      },
      {
        title: 'The missing directions still matter',
        kind: 'after-commitment',
        body: 'Limited angular coverage leaves incompletely measured information, often described as a missing wedge. In-plane edges may look sharp while depth remains elongated or blurred. Small displayed voxels do not repair this anisotropy. Sparse views over a broad orbit and a limited arc are different sampling problems. Because the collected images do not single out one volume, a system may settle the unmeasured directions from a registered prior scan or a learned model and render a set that resembles a scan — which removes the visible sign of the limit without removing the limit.',
        sources: ['saad', 'sumner', 'podder'],
        detail: {
          title: 'More projections: state the constraint',
          body: 'More projections at fixed exposure per projection increase total exposure. Dividing a fixed total exposure among more projections changes sampling and noise differently. Frame count alone does not specify image quality, acquisition time or dose.',
        },
      },
      {
        title: 'Prepare the sweep as an acquisition',
        body: 'Keep target and relevant tool within the validated reconstruction field, follow the supported trajectory, and coordinate a stable respiratory state. Patient, instrument or unmodeled equipment motion can invalidate the reconstruction. Exact angles and sweep settings depend on the installed system.',
        points: [
          'Confirm geometry and target coverage.',
          'Maintain the agreed physiological and instrument state.',
          'Assess the reconstruction before using it to guide sampling.',
        ],
        sources: ['saad', 'frontier'],
      },
    ],
    worked: {
      scenario:
        'A limited-angle reconstruction separates a lesion from a rib, but the lesion and needle are elongated in the depth direction.',
      reasoning:
        'The acquisition added useful parallax information while retaining direction-dependent uncertainty. Assess the actual tool and target in supported views; do not interpret a fine voxel grid, or a rendering that resembles a scan, as equivalent to isotropic CT measurement.',
    },
    lab: 'dts',
    labTask:
      'Move the reconstruction plane through the added target and tool, then compare the surrounding anatomy with a wider authored sweep.',
    takeaway: [
      'A sweep supplies information absent from one projection.',
      'Resolution depends on direction and angular coverage.',
      'Image dimensions do not describe measurement certainty.',
    ],
    checkIds: ['dts-1', 'geometry-1'],
  },
  {
    id: 'dts-interpretation',
    title: 'What went into this reconstruction?',
    shortTitle: 'Provenance',
    group: 'Digital tomosynthesis',
    stage: 'Mechanism',
    minutes: 5,
    objective: 'dts',
    outcome:
      'Distinguish current projection evidence, prior-informed anatomy and navigation updates.',
    concept: 'Reconstruction provenance',
    prerequisites: ['dts-acquisition', 'current-anatomy'],
    why: 'A convincing prior-informed image can conceal how little independent information was acquired about a changed peripheral target.',
    recall: {
      prompt: 'Why can an object look sharp in one DTS orientation but uncertain in another?',
      answer:
        'Limited angular coverage measures spatial information unevenly. Reconstruction and a small voxel grid cannot eliminate the missing directions.',
    },
    blocks: [
      {
        title: 'Separate three uses of reconstruction',
        body: 'A system may update the navigation target, show a local tomographic reconstruction, or project an augmented contour onto fluoroscopy. These are separate capabilities. Ask which source and acquisition time support each display, and which tool component was visible.',
        points: [
          'Navigation correction changes the map used for guidance.',
          'Local tomography supplies reconstructed depth information.',
          'Augmented fluoroscopy projects a segmentation onto a live view.',
        ],
        sources: ['frontier', 'saad', 'pritchett'],
      },
      {
        title: 'A prior can improve an estimate and influence it',
        body: 'Iterative reconstruction compares measured projections with projections predicted from an estimated volume. Prior CT and regularization can guide an incomplete problem toward a useful solution. If anatomy has changed, the prior can also constrain the result toward older anatomy.',
        sources: ['saad'],
        detail: {
          title: 'What the reconstruction study established',
          body: 'Saad and colleagues evaluated a physical phantom and six patient imaging datasets. Prior-aided reconstruction improved image similarity to reference CBCT. This was technical evidence about reconstruction, not a diagnostic-yield trial or a measured whole-procedure dose comparison.',
        },
      },
      {
        title: 'Interrogate the claim, not the brand name',
        body: 'For “AI tomography” or “real-time 3D,” ask about angular coverage, the measured data, prior CT contribution, motion correction and the independently validated endpoint. A limited sweep may suit the question well without being interchangeable with every CBCT protocol.',
        sources: ['saad', 'frontier', 'sumner'],
        detail: {
          title: 'What “CT-like” names, and what it does not',
          body: 'Modern platforms differ in what they build from a sweep of roughly 50–70 degrees. Several use artificial intelligence and machine learning to generate CT-like multi-axial reconstructions from those limited images; at least one uses the sweep only to update its virtual navigation data and renders no such reconstruction at all. Where they are produced, these images are described as not fully accurate representations of what actual CT would show, because part of them is extrapolated: comparisons of target location on tomosynthesis against cone-beam CT report the distance between target centers deviating by as much as 16.2 mm. The name on the screen does not settle which of these you are looking at.',
        },
      },
    ],
    worked: {
      scenario:
        'A reconstructed lesion contour resembles planning CT closely, but new projection and rEBUS information are discordant.',
      reasoning:
        'Do not let visual familiarity outrank current contradictory evidence. Review source projections, coverage, acquisition state and the role of prior information. Independently reassess the target before relying on the contour.',
    },
    takeaway: [
      'Ask what was measured now.',
      'Map correction, tomography and overlay are distinct.',
      'Technical image quality is not clinical diagnostic yield.',
    ],
    checkIds: ['prior-1', 'anatomy-1'],
  },
  {
    id: 'cbct-acquisition',
    title: 'Preparing a useful CBCT volume',
    shortTitle: 'The orbit',
    group: 'Cone-beam CT in the suite',
    stage: 'Mechanism',
    minutes: 6,
    objective: 'cbct',
    outcome:
      'Distinguish an acquisition-ready setup from one with unresolved coverage, motion or clearance problems.',
    concept: 'A rotational acquisition has shared preconditions',
    prerequisites: ['current-anatomy', 'dts-acquisition', 'time'],
    why: 'A full sweep with a truncated target or avoidable motion adds exposure without answering the intended question.',
    recall: {
      prompt:
        'Does collecting many projections over a narrow arc supply the same directions as a broad orbit?',
      answer:
        'No. Angular coverage and projection count are independent. A broader orbit supplies additional directions; how they are sampled still matters.',
    },
    blocks: [
      {
        title: 'Many views become one volume',
        body: 'CBCT rotates a source and area detector around the patient and reconstructs the collected projections. Compared with a limited DTS sweep, it generally supplies broader angular information for multiplanar evaluation. Contrast, scatter, motion and calibration still limit the volume; it is not interchangeable with diagnostic multidetector CT for every task.',
        sources: ['setser', 'mobile'],
      },
      {
        title: 'Center the target in three dimensions',
        kind: 'after-commitment',
        body: 'A centered frontal image can conceal an anterior/posterior offset. Use supported orthogonal localization or validated positioning aids to place the lesion, relevant tool and safety anatomy within the reconstruction volume. Respect supported collimation and table configurations.',
        sources: ['setser'],
      },
      {
        title: 'Make readiness a team check',
        body: 'Confirm the intended target and field, the instrument configuration, mechanical clearance through the complete orbit, and the respiratory/protection plan. Perform a nonirradiating rehearsal orbit when supported. Account for the tube and detector, patient arms, table, robot, scope, lines and anesthesia equipment.',
        points: [
          'Operator: target and actual sampling configuration.',
          'Technologist: protocol, coverage and full-orbit clearance.',
          'Anesthesia: stable state, monitoring and interruption criteria.',
          'Team: effective shielding and maintained patient access.',
        ],
        sources: ['setser', 'mobile', 'wabip'],
      },
    ],
    worked: {
      scenario:
        'The lesion is centered in the frontal scout. A lateral localization view places it near the volume edge.',
      reasoning:
        'Frontal centering resolved only part of the positioning problem. Fix the remaining offset with the supported method and recheck coverage and clearance before exposure. A prettier reconstruction cannot recover an excluded target.',
    },
    lab: 'acquisition',
    labTask:
      'Set up the authored target and complete the readiness checks. See what happens after moving a previously checked setup.',
    takeaway: [
      'Center the target, not simply the chest.',
      'Check the whole orbit.',
      'Inspect acquisition quality before accepting the result.',
    ],
    checkIds: ['acquisition-1', 'dts-1'],
  },
  {
    id: 'fixed-suite',
    title: 'Working in a fixed CBCT suite',
    shortTitle: 'Fixed suite',
    group: 'Cone-beam CT in the suite',
    stage: 'Application',
    minutes: 4,
    objective: 'cbct',
    outcome: 'Adapt shared acquisition requirements to an integrated fixed-room workflow.',
    concept: 'Fixed-room application of acquisition requirements',
    prerequisites: ['cbct-acquisition', 'field'],
    why: 'Integration can simplify imaging while a bronchoscopy robot, anesthesia circuit or changed table position introduces a new constraint.',
    recall: {
      prompt: 'Which positioning uncertainty can survive a centered frontal scout?',
      answer:
        'The target can still be offset along the beam direction or outside another dimension of the supported reconstruction volume.',
    },
    blocks: [
      {
        title: 'Plan around the installed room',
        body: 'A fixed C-arm may be floor-, ceiling- or robot-mounted, often with a coordinated imaging table and dedicated shielding. Room access, movement limits, detector clearance and navigation integration are installation-specific. Plan scope and robot docking around the actual orbit.',
        sources: ['setser', 'wabip'],
      },
      {
        title: 'Use integration deliberately',
        body: 'Supported table/C-arm position tracking may keep an overlay aligned through recognized equipment movement. Patient movement relative to the table, lung-volume change and local deformation remain separate problems. Verify which image flips, magnification changes and imported volumes preserve registration.',
        sources: ['setser', 'pritchett'],
      },
      {
        title: 'Choose a protocol for the decision',
        body: 'Localization, low-contrast target definition and repeat tool confirmation can have different information requirements. Establish a small set of validated presets with a technologist and physicist. Escalate quality for insufficient signal or boundary definition after addressing motion and coverage.',
        points: [
          'Keep access to the airway and emergency pathways.',
          'Use supported positions for 2D and rotational work.',
          'Record the reason each additional acquisition was needed.',
        ],
        sources: ['setser', 'verhoeven', 'tg272'],
      },
    ],
    worked: {
      scenario:
        'After a table move, the integrated overlay follows the displayed field correctly. An airway recruitment maneuver then changes peripheral lung inflation.',
      reasoning:
        'Equipment tracking and anatomical tracking are different. The first supported movement may preserve geometric registration; the subsequent anatomical change requires reassessment of peripheral validity.',
    },
    lab: 'acquisition',
    labTask:
      'Select the fixed-suite workflow, inspect the original C-arm motion reference, and consider the installation-specific clearance checks.',
    takeaway: [
      'Fixed installation does not remove patient-state uncertainty.',
      'Confirm supported integration behavior.',
      'Choose protocol quality by the information question.',
    ],
    checkIds: ['fixed-1', 'field-1'],
  },
  {
    id: 'mobile-suite',
    title: 'Bringing CBCT into the bronch suite',
    shortTitle: 'Mobile suite',
    group: 'Cone-beam CT in the suite',
    stage: 'Application',
    minutes: 4,
    objective: 'cbct',
    outcome:
      'Adapt shared acquisition requirements to a mobile scanner and existing procedure room.',
    concept: 'Mobile-room application of acquisition requirements',
    prerequisites: ['cbct-acquisition', 'fixed-suite'],
    why: 'Portability does not establish that a room, table, radiation barrier or data pathway is ready for rotational imaging.',
    recall: {
      prompt: 'What does a correctly moving overlay establish after a recognized table move?',
      answer:
        'It can demonstrate supported equipment geometry. It does not establish that the peripheral lung and tool still match the acquisition state.',
    },
    blocks: [
      {
        title: 'Commission the combination',
        body: 'Check table radiolucency, pedestal/base interference, power and parking, patient/robot clearance, image export and room shielding with the responsible team. A static space for a C-arm is not a verified rotational envelope.',
        sources: ['mobile', 'setser', 'wabip'],
      },
      {
        title: 'Compare capabilities individually',
        body: 'Field size, angular coverage, scan duration, exposure modes, reconstructed image quality and workflow differ among models and software versions. A mobile label does not imply a universally lower dose or inferior image. A fixed label does not establish every navigation or overlay capability.',
        points: [
          'Can the actual target and tool fit the validated volume?',
          'How are reconstructed images reviewed and transferred?',
          'Can the navigation map be updated?',
          'Is a registered live overlay available and maintained?',
        ],
        sources: ['mobile', 'setser', 'tg272'],
      },
      {
        title: 'Preserve the information chain',
        body: 'Verify image orientation, patient position, volume identity and supported coordinate transfer. DICOM export alone does not prove that two systems share a coordinate frame. Maintain clear roles during scanner entry, positioning, acquisition, review and return to sampling.',
        sources: ['setser', 'mobile', 'pritchett'],
      },
    ],
    worked: {
      scenario:
        'A mobile scanner produces a useful volume, but the navigation platform has no validated target-update integration.',
      reasoning:
        'The volume can still support current anatomical and tool review on its own workstation. Do not assume that viewing or exporting it automatically updates navigation coordinates or supplies an augmented overlay.',
    },
    lab: 'acquisition',
    labTask:
      'Select the mobile-suite workflow. Compare its room-preparation needs and center the target in both CT-derived scouts.',
    takeaway: [
      'Portability changes logistics, not core physics.',
      'Commission room, table and scanner together.',
      'Volume review, map update and overlay are separate capabilities.',
    ],
    checkIds: ['mobile-1', 'acquisition-1'],
  },
  {
    id: 'tool-confirmation',
    title: 'Read the actual sampling component',
    shortTitle: 'The sampler',
    group: 'Cone-beam CT in the suite',
    stage: 'Application',
    minutes: 7,
    objective: 'verify',
    outcome:
      'Distinguish projected hardware overlap, tip position and sampling-region intersection on multiplanar views.',
    concept: 'The sampling region is a three-dimensional object',
    prerequisites: ['cbct-acquisition', 'projection', 'two-dimensional'],
    why: 'The brightest pixel or a catheter parked near the nodule may not represent where tissue is actually collected.',
    recall: {
      prompt: 'Why does a concentric rEBUS image not prove where a subsequent needle will sample?',
      answer:
        'The ultrasound probe measured tissue around itself. Tool exchange can change the trajectory and the sampling component is a different object.',
    },
    blocks: [
      {
        title: 'Target → tool → relationship → state',
        body: 'Identify the intended lesion independently, then trace the actual instrument through thin axial, coronal and sagittal planes. Use oblique reformats along the instrument when helpful. Identify the component that collects tissue and the acquisition state in which the relationship was shown.',
        points: [
          'Target: the intended lesion and its sampling region.',
          'Tool: distinguish catheter, shaft, tip, window or deployed jaws.',
          'Relationship: outside, margin, within, or beyond; inspect more than one plane.',
          'State: record when and under what respiratory conditions.',
        ],
        sources: ['setser', 'pritchett', 'mobile'],
      },
      {
        title: 'Trace the tool instead of following a streak',
        body: 'Metal can bloom or generate streaks from beam hardening, photon starvation, scatter and reconstruction. Compare source planes and supported reconstructions. For a needle, the tip and sampling opening may differ; forceps jaws and a cryoprobe active region require their own interpretation.',
        sources: ['setser', 'tg272'],
      },
      {
        title: 'A slab helps tracing but can conceal depth',
        body: 'Thicker slabs and maximum-intensity projections can make a long metal instrument easier to follow. They can also superimpose structures at different depths. Attractive surface renderings and overlap in a MIP should complement thin multiplanar review.',
        sources: ['setser'],
        detail: {
          title: 'Localize, then obtain a diagnostic specimen',
          body: 'A geometrically favorable position does not establish adequate tissue volume, viable target selection, specimen processing or a final diagnosis. Document image evidence and pathology endpoints separately; do not convert a high localization rate into a claim of guaranteed diagnostic yield.',
        },
      },
    ],
    worked: {
      scenario:
        'The needle tip is beyond the nodule. Its sampling window lies within part of the target on thin reformats.',
      reasoning:
        'Tip-in-lesion and sampling-window intersection are different statements. Describe the actual component and extent shown. The module’s fictional window geometry teaches this distinction; clinical interpretation depends on the real tool, approved technique and target safety anatomy.',
    },
    lab: 'mpr',
    labTask:
      'Move the fictional needle in three dimensions. Compare target slices, tool-centered slices, and a slab before revealing the geometric relationship.',
    takeaway: [
      'Identify the lesion independently.',
      'Trace the actual sampling component in thin planes.',
      'Document the component and acquisition state.',
    ],
    checkIds: ['tool-1', 'geometry-1'],
  },
  {
    id: 'changing-anatomy',
    title: 'When the image and procedure diverge',
    shortTitle: 'After change',
    group: 'Cone-beam CT in the suite',
    stage: 'Application',
    minutes: 6,
    objective: 'verify',
    outcome:
      'Distinguish a correctable acquisition artifact from an anatomical or physiological change requiring reassessment.',
    concept: 'Validity must be reassessed after change',
    prerequisites: ['current-anatomy', 'tool-confirmation', 'time', 'dts-interpretation'],
    why: 'A scan is a snapshot; anatomy can change between acquisition, reconstruction and sampling.',
    recall: {
      prompt: 'What does a thick slab sacrifice when it makes a long tool easy to trace?',
      answer:
        'It combines multiple depths. Apparent tool–target overlap can therefore hide separation that thin planes reveal.',
    },
    blocks: [
      {
        title: 'Match the artifact to its cause',
        body: 'Duplicated edges suggest motion. Metal-adjacent streaks need artifact-aware tracing. A cut-off target suggests coverage or centering. A new dependent tissue opacity may represent real aeration change. Address the likely cause before repeating the same acquisition.',
        sources: ['setser', 'tg272', 'ilocate'],
      },
      {
        title: 'Plan respiratory state with anesthesia',
        body: 'A coordinated pause can reduce motion, but the target–tool relationship may change when ventilation resumes. Preserve adequate oxygenation, ventilation, pressure control and cardiovascular tolerance. Recruitment is an attempt to reopen lung; an imaging hold maintains a selected state. These are different tasks.',
        points: [
          'Agree on the intended state and who announces acquisition readiness.',
          'Agree on interruption criteria before the pause.',
          'Do not treat normal oxygen saturation as proof of adequate CO₂ elimination.',
          'Reassess position after a clinically meaningful state change.',
        ],
        sources: ['setser', 'vespa'],
      },
      {
        title: 'Treat atelectasis as anatomy, not a filter problem',
        body: 'Published ventilation research supports prevention of atelectasis in studied settings, including a bundled strategy in VESPA. It does not justify one pressure, PEEP, oxygen concentration or apnea duration for all patients. Position changes may help selected dependent targets but also change access, clearance and registration.',
        sources: ['vespa', 'ilocate', 'setser'],
        detail: {
          title: 'Reassess an augmented overlay',
          body: 'Toggle the contour off to inspect the underlying image. Check its source time and physiological state. Refresh or independently reassess after patient repositioning, significant tool manipulation, recruitment or unexplained discordance. A current tool marker and a prior lesion segmentation are different information streams.',
        },
      },
    ],
    worked: {
      scenario: 'Motion degraded a scan and the patient became intolerant of the planned hold.',
      reasoning:
        'Anesthesia restores appropriate support. Review the cause and a safer acquisition strategy before another attempt. Do not prolong an unsafe physiological state merely to finish imaging, and do not expect higher exposure to remove duplicated edges.',
    },
    lab: 'registration',
    labTask:
      'Capture a target contour, change the anatomical state, and decide what the stored overlay still represents.',
    takeaway: [
      'Fix the cause before repeating.',
      'Anesthesia safety governs the imaging pause.',
      'Reassess evidence after meaningful change.',
    ],
    checkIds: ['change-1', 'prior-1'],
  },
  {
    id: 'staff-protection',
    title: 'Protecting people around the beam',
    shortTitle: 'Scatter',
    group: 'Radiation protection',
    stage: 'Mechanism',
    minutes: 5,
    objective: 'protect',
    outcome:
      'Select staff protection based on the irradiated patient, equipment geometry and effective barriers.',
    concept: 'The patient is a scatter source',
    prerequisites: ['field', 'cbct-acquisition'],
    why: 'A staff member may be outside the direct beam yet receive scatter during bedside fluoroscopy.',
    recall: {
      prompt: 'Why does a display crop not protect tissue outside the visible region?',
      answer:
        'It does not restrict the physical beam. Radiation and scatter are determined by acquisition, not the displayed border.',
    },
    blocks: [
      {
        title: 'Time, distance and shielding work together',
        body: 'The irradiated patient is an important source of scattered radiation. Reduce unnecessary exposures and bedside time, increase distance when the task permits, and interpose properly positioned shielding. Staff should leave or use effective barriers during a spin when hands-on presence is unnecessary while monitoring and patient access continue.',
        sources: ['wabip', 'icrp'],
      },
      {
        title: 'Geometry changes exposure',
        body: 'Scatter is not a uniform circle around the patient. Tube side, angulation, patient size, field and barriers affect the pattern. Detector-side positions often reduce exposure relative to the entrance/tube side in lateral geometry, but a full rotational acquisition changes directions. A room or device category does not create a universal unshielded safe zone.',
        sources: ['wabip', 'icrp'],
      },
      {
        title: 'Keep hands out of the primary beam',
        body: 'Use supported instrument stabilization and shielding arrangements. An apron, glove or shield does not justify placing a hand in the beam; it can also influence automatic exposure regulation. Wear assigned dosimeters in the specified positions and use eye, thyroid or other protection as directed by the institutional program.',
        points: [
          'Verify barrier placement for the current angle.',
          'Use the assigned dosimetry consistently.',
          'Have the radiation safety officer assess workload and room shielding.',
          'Review pregnancy-related work arrangements through the local program.',
        ],
        sources: ['icrp', 'wabip', 'tg125'],
      },
    ],
    worked: {
      scenario:
        'A staff member steps farther from the patient for a spin but remains outside the available barrier.',
      reasoning:
        'Distance generally reduces exposure, but there is no universal distance that establishes safety. Use the room’s verified barrier and position plan. The required location depends on the real scatter field, workload and radiation survey.',
    },
    lab: 'safety',
    labTask:
      'Inspect staff, patient and barrier geometry. Explore distance while noting what the simplified calculation cannot establish.',
    takeaway: [
      'Protect from scatter as well as the primary beam.',
      'Use effective barriers and verified positions.',
      'A badge reading is useful only when the badge is worn correctly.',
    ],
    checkIds: ['safety-1', 'field-1'],
  },
  {
    id: 'dose-reporting',
    title: 'Read the dose report correctly',
    shortTitle: 'The dose report',
    group: 'Radiation protection',
    stage: 'Mechanism',
    minutes: 6,
    objective: 'protect',
    outcome:
      'Distinguish dose indices, their units, and the information needed for whole-procedure review.',
    concept: 'Dose quantities answer different questions',
    prerequisites: ['staff-protection', 'time', 'field'],
    why: 'Fluoroscopy time or a low scan count can conceal substantial exposure from other modes.',
    recall: {
      prompt: 'Why is staff dose not a substitute for the patient’s procedural exposure?',
      answer:
        'Staff may leave or use barriers during a scan while the patient still receives the beam. The exposure pathways and quantities differ.',
    },
    blocks: [
      {
        title: 'Know the quantity before comparing the number',
        body: 'Cumulative reference air kerma (Kₐ,r, mGy or Gy) is an equipment-reference index. Kerma–area product (KAP/DAP, Gy·cm²) combines air kerma and field area. Peak skin dose is the highest absorbed skin dose, requiring location-specific information. Effective dose (mSv) is a population-protection quantity, not a measured individual skin dose.',
        sources: ['wabip', 'aapm12', 'skin'],
      },
      {
        title: 'A smaller field and a higher local index can coexist',
        kind: 'after-commitment',
        body: 'Collimation can reduce KAP while automatic exposure regulation maintains or raises kerma in the remaining field. Equal KAP does not imply equal peak skin dose or organ exposure. Fluoroscopy minutes omit differences in output and may exclude rotational or radiographic acquisitions.',
        sources: ['tg125', 'aapm12', 'skin'],
        detail: {
          title: 'Units and quantities',
          body: '1 Gy = 1,000 mGy. For area products, 1 Gy·cm² = 100 µGy·m². CTDIvol and DLP are CT output descriptors under defined conditions and are not directly interchangeable with C-arm KAP. Never compare values until quantity, units and included acquisition modes are established.',
        },
      },
      {
        title: 'Record the whole procedure once',
        body: 'Record available total KAP and reference air kerma with units, fluoroscopy time, DTS/CBCT acquisition count and protocols, and reasons for repeats. Distinguish component subtotals from totals to avoid double counting. Include significant alerts, limitations and any dose-management follow-up.',
        sources: ['wabip', 'aapm12'],
      },
      {
        title: 'Respond to alerts through the dose-management program',
        body: 'A dose notification prompts reassessment of necessity, optimization and the remaining plan. Follow local policy for medical-physics review, documentation and patient follow-up. Reference kerma is not a diagnosis of skin injury. Occupational limits are not patient medical-exposure limits, and no scan count is universally right.',
        sources: ['aapm12', 'skin', 'icrp'],
      },
    ],
    worked: {
      scenario:
        'The field area is reduced while local air kerma rises modestly. The reported area product falls.',
      reasoning:
        'Both readouts can be right because KAP depends on kerma and area. Interpret each quantity and review the whole procedure. The calculation does not reveal the patient’s peak skin dose or justify ignoring an institutional alert.',
    },
    lab: 'dose',
    labTask:
      'Change beam area and air kerma independently. Convert the area product and compare a component subtotal with the procedural total.',
    takeaway: [
      'State quantity, units and included modes.',
      'KAP, reference kerma and peak skin dose are not interchangeable.',
      'Use the dose-management program for review and follow-up.',
    ],
    checkIds: ['dose-1', 'time-1'],
  },
  {
    id: 'suite-cases',
    title: 'Decisions in the bronch suite',
    shortTitle: 'Bring it together',
    group: 'Bring it together',
    stage: 'Independent practice',
    minutes: 8,
    objective: 'verify',
    outcome: 'Apply the imaging and protection principles to new suite decisions.',
    concept: 'Integrate all previously taught decisions',
    prerequisites: [
      'two-dimensional',
      'dts-interpretation',
      'fixed-suite',
      'mobile-suite',
      'tool-confirmation',
      'changing-anatomy',
      'staff-protection',
      'dose-reporting',
    ],
    why: 'The useful skill is recognizing which information or safety problem needs attention before the next procedural step.',
    recall: {
      prompt: 'What four questions organize your final image review?',
      answer:
        'Identify the target, identify the actual sampling component, assess their three-dimensional relationship, and establish the acquisition state.',
    },
    blocks: [
      {
        title: 'Use the same reasoning in a new situation',
        body: 'This section adds nothing new. It combines the technologies and safety questions of the course: each finding you meet in the suite belongs at one stop of the chain, and naming that stop is what decides the next move. The eight case decisions come afterwards, on the Assess page, once every section has been worked through.',
        points: [
          'Name the information gap before naming a device.',
          'Say which stop of the chain the problem lives at.',
          'Choose the single best action from the available information.',
        ],
        sources: ['setser', 'wabip'],
      },
    ],
    worked: {
      scenario: 'Before starting, organize your own approach without a model answer.',
      reasoning:
        'Name the information gap, its likely limiting mechanism, the measurement that can resolve it, and the conditions needed to acquire that measurement safely.',
    },
    takeaway: [
      'Choose imaging for the unanswered question.',
      'Reassess current anatomy and the sampling component.',
      'Protect people and record meaningful exposure quantities.',
    ],
    checkIds: ['capstone-1', 'capstone-transfer-1'],
  },
]
