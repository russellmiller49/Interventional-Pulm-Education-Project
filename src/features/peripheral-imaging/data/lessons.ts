import type { Lesson, ObjectiveId } from '../types'

export const OBJECTIVES: { id: ObjectiveId; title: string; description: string }[] = [
  {
    id: 'choose',
    title: 'Define the imaging question',
    description:
      'Distinguish navigation, lesion localization, tool-in-lesion confirmation and diagnostic tissue.',
  },
  {
    id: 'optimize',
    title: 'Optimize 2D fluoroscopy',
    description:
      'Match projection, collimation, magnification and pulse settings to the imaging problem.',
  },
  {
    id: 'dts',
    title: 'Interpret digital tomosynthesis',
    description:
      'Recognize what a limited-angle acquisition resolves, and where depth uncertainty remains.',
  },
  {
    id: 'cbct',
    title: 'Optimize CBCT acquisition',
    description: 'Apply acquisition principles in fixed and mobile CBCT workflows.',
  },
  {
    id: 'verify',
    title: 'Confirm the biopsy tool',
    description:
      'Confirm tool-in-lesion on multiplanar imaging, and recognize when localization must be repeated.',
  },
  {
    id: 'protect',
    title: 'Manage radiation',
    description:
      'Protect the team from scatter, and interpret the patient dose metrics in the procedure record.',
  },
]

export const LESSONS: Lesson[] = [
  {
    id: 'imaging-questions',
    title: 'What are you trying to confirm?',
    shortTitle: 'Localization vs confirmation',
    group: 'Plan',
    stage: 'Orientation',
    minutes: 4,
    objective: 'choose',
    outcome:
      'Distinguish what navigation, intraprocedural imaging and a tissue result can each confirm.',
    concept: 'Separate navigation, localization, confirmation and diagnosis',
    prerequisites: [],
    why: 'Misreading what a display confirms can lead to repeated sampling of tissue that was never the lesion.',
    recall: {
      prompt: 'Before choosing a modality, what decision is the next image meant to support?',
      answer:
        'Name the uncertainty: the airway path, the current lesion location, the biopsy tool’s position relative to the lesion, or a complication. Then choose the imaging that resolves it.',
    },
    blocks: [
      {
        title: 'Navigation, localization, confirmation, diagnosis',
        body: 'Navigation shows where the catheter is relative to a target defined on the planning CT; it cannot show what lies at that target today. Intraprocedural imaging shows current anatomy, and tissue acquisition provides a different kind of evidence again. Think of navigation as an address on a map: it can bring you to the building without showing what is inside it today.',
        points: [
          'Navigation: where is the catheter relative to the navigation target?',
          'Localization: where is the lesion now?',
          'Tool-in-lesion confirmation: where is the actual biopsy tool relative to the lesion?',
          'Diagnosis: did the specimen answer the clinical question?',
        ],
        sources: ['setser', 'confirm'],
      },
      {
        title: 'Match the modality to the question',
        body: 'Fluoroscopy provides a real-time projection. Radial EBUS images the tissue immediately around the probe. DTS adds depth information from a limited-angle acquisition. CBCT reconstructs a volume from a rotational acquisition. Augmented fluoroscopy projects a segmentation from an earlier acquisition onto the live image.',
        points: [
          'A visible needle does not establish that the lesion is visible.',
          'A tracked catheter does not establish where a different tool will exit.',
          'Tool-in-lesion confirmation does not guarantee diagnostic tissue.',
        ],
        sources: ['setser', 'frontier', 'pritchett'],
      },
    ],
    worked: {
      scenario:
        'Navigation places the catheter at the virtual target. Fluoroscopy shows a needle but no convincing nodule.',
      reasoning:
        'The navigation target and the needle are visualized; the current lesion location and the needle–lesion depth relationship are not. Obtain localization or confirmation imaging before attributing a nondiagnostic sample to pathology alone.',
    },
    takeaway: [
      'State the question before acquiring.',
      'Separate what was visualized from what is inferred from the planning CT.',
      'Keep localization and diagnosis as separate endpoints.',
    ],
    checkIds: ['choose-1', 'choose-transfer-1'],
  },
  {
    id: 'chain-walk',
    title: 'How a fluoroscopic image is formed',
    shortTitle: 'Image formation',
    group: 'Plan',
    stage: 'Foundation',
    minutes: 6,
    objective: 'optimize',
    outcome:
      'Name the six components of image formation, from the X-ray tube to interpretation, and place each imaging term at the component it belongs to.',
    concept: 'The image is formed across six components, from tube to interpretation',
    prerequisites: ['imaging-questions'],
    why: 'Every later section highlights one component of image formation. A term learned where it acts is remembered; a term learned from a list is not.',
    recall: {
      prompt: 'Which four questions can intraprocedural imaging be asked to answer?',
      answer:
        'Where the catheter is relative to the navigation target, where the lesion is now, where the actual biopsy tool is relative to the lesion, and whether the specimen answered the clinical question.',
    },
    blocks: [
      {
        title: 'Six components, one image',
        kind: 'signals',
        body: 'A fluoroscopic image is formed in sequence. The X-ray tube emits photons, the collimated beam crosses the patient, the flat-panel detector records what arrives, the system may reconstruct or register what was acquired, and the monitor displays the result for interpretation. Each component changes the image in its own way, and every modality in this course uses the same components differently.',
        points: [
          'The X-ray tube and generator set kV, mA and pulses.',
          'Beam geometry sets the projection, collimation and distances.',
          'Patient anatomy contributes attenuation, motion and CT-to-body divergence.',
          'The detector, the reconstruction and the display decide what is acquired, what is added and what is shown.',
        ],
        sources: ['tg272', 'setser'],
      },
      {
        title: 'Walk it on a working suite',
        kind: 'pattern',
        body: 'The walk visits each component on a normal, working setup: the lesion centred, the field collimated, pulsed fluoroscopy running and the tool visible. At each component you read its precise statement, the control that acts there and a short checklist, and where a control acts you move it once to see what changes. Nothing is faulty yet; the problems come later, one at a time.',
        sources: ['tg272'],
      },
      {
        title: 'A single projection collapses depth',
        kind: 'after-commitment',
        body: 'The principle the whole course rests on is set by beam geometry. Each detector location records the attenuation along one X-ray path from the focal spot, so structures anywhere along that path land at the same location. A single image does not resolve depth along the path; changing the projection, a DTS acquisition or a CBCT spin are the ways the later sections recover it.',
        sources: ['tg272', 'setser'],
        detail: {
          title: 'Why components, not devices',
          body: 'Fluoroscopy, DTS, CBCT and augmented fluoroscopy share the X-ray tube, the beam, the patient and the detector. They differ at reconstruction and registration: how many angles were acquired, over how wide an arc, and what a prior scan contributed. Reading a modality this way makes its limits predictable.',
        },
      },
    ],
    worked: {
      scenario:
        'A colleague asks why a needle that appeared to be on the nodule turned out to be a centimetre behind it.',
      reasoning:
        'Beam geometry produced the overlap: the needle and nodule lay on one X-ray path and projected to the same location. The detector recorded that faithfully and the display showed it faithfully; nothing downstream of the beam could have separated them. A sufficiently separated second projection could.',
    },
    lab: 'geometry',
    labTask:
      'Walk the six components. At beam geometry, change the C-arm obliquity once and watch the X-ray path, the beam and the image move together.',
    takeaway: [
      'Six components form one image.',
      'Each component has its own short checklist.',
      'A single projection does not resolve depth.',
    ],
    checkIds: ['walk-1', 'choose-1'],
  },
  {
    id: 'good-image',
    title: 'Optimizing the fluoroscopic image',
    shortTitle: 'Fluoroscopy controls',
    group: 'Localize and optimize',
    stage: 'Foundation',
    minutes: 6,
    objective: 'optimize',
    outcome:
      'Distinguish the five fluoroscopy controls from the settings the system chooses for you and from operations that change only the display.',
    concept: 'Five fluoroscopy controls; automatic exposure regulation sets the exposure',
    prerequisites: ['chain-walk'],
    why: 'A C-arm console offers dozens of buttons. Knowing which five change the acquisition turns every later problem into one question: which control, if any.',
    recall: {
      prompt:
        'At which component of image formation do two objects at different depths come to overlap?',
      answer:
        'At beam geometry. Each detector location records the attenuation along one X-ray path, so everything on that path projects to the same location.',
    },
    blocks: [
      {
        title: 'The baseline image',
        kind: 'signals',
        body: 'Before troubleshooting, know the baseline: the lesion centred, collimation tight to the task with the whole planned tool excursion inside the field, pulsed fluoroscopy at a rate that shows the movement you need, and a projection chosen from the planning CT so no dense structure is superimposed on the lesion. Every later section starts from this image and changes one thing.',
        sources: ['wabip', 'setser'],
      },
      {
        title: 'The five fluoroscopy controls',
        kind: 'after-commitment',
        body: 'At the C-arm you control five things: the C-arm projection (obliquity and cranial or caudal angulation), collimation, pulse rate and pulse width, the acquisition mode (a single projection, a DTS acquisition or a CBCT spin), and the display (display zoom, window/level, overlays). Everything else is monitoring.',
        points: [
          'Projection: obliquity and cranial or caudal angulation.',
          'Collimation: the irradiated field.',
          'Pulse rate and pulse width: how often, and for how long.',
          'Acquisition mode: projection, DTS or CBCT.',
          'Display: zoom, window/level, overlays.',
        ],
        sources: ['tg272', 'tg125', 'wabip'],
      },
      {
        title: 'Automatic exposure regulation sets the exposure',
        kind: 'after-commitment',
        body: 'kV, mA and filtration are selected by automatic exposure regulation to hold the detector signal. You do not set them directly, and a brighter image does not mean less output. What the system did appears on the dose readout, which is why the dose-rate and cumulative dose readouts, not image brightness, are where radiation output is judged.',
        sources: ['tg125', 'aapm12'],
      },
    ],
    worked: {
      scenario:
        'A lesion is projected over the heart. One colleague reaches for magnification; another asks for fifteen degrees of obliquity.',
      reasoning:
        'Magnification enlarges the same projection, heart included. Obliquity changes the projection, so the heart can move off the lesion. The first changes the display or the detector sampling; the second changes the projection. Name the control before you change it.',
    },
    labTask:
      'Assign each console control to the fluoroscopy control it belongs to — projection, collimation, pulse rate and width, acquisition mode or display — or to monitoring, when it does not change the acquisition.',
    takeaway: [
      'Five controls change the acquisition or the display.',
      'Automatic exposure regulation chooses the exposure; the dose readout reports it.',
      'Display changes are not acquisition changes.',
    ],
    checkIds: ['good-1', 'walk-1'],
  },
  {
    id: 'current-anatomy',
    title: 'CT-to-body divergence',
    shortTitle: 'CT-to-body divergence',
    group: 'Localize and optimize',
    stage: 'Foundation',
    minutes: 5,
    objective: 'choose',
    outcome:
      'Distinguish CT-to-body divergence from navigation registration error and from inadequate imaging coverage.',
    concept: 'The intraprocedural lung may differ from the planning CT',
    prerequisites: ['imaging-questions', 'chain-walk'],
    why: 'An anesthetized lung can differ from the inspiratory planning CT even while the navigation system tracks accurately.',
    recall: {
      prompt: 'Does reaching the virtual target establish where the lesion is now?',
      answer:
        'No. The virtual target comes from the planning CT. The current lesion location and the biopsy tool each need their own intraprocedural confirmation.',
    },
    blocks: [
      {
        title: 'Read the planning CT for the airway and the hazards',
        body: 'Follow the bronchus to the lesion on thin multiplanar images. Note lesion morphology, the bronchus sign and the airway–lesion relationship, and nearby pleura, fissures, vessels and diaphragm. Anticipate which projections will superimpose ribs, heart or thick chest wall on the lesion.',
        points: [
          'Confirm the intended lesion and its solid or wall component.',
          'Identify the final airway and the direction of approach.',
          'Plan which anatomy must remain visible during tool movement.',
        ],
        sources: ['setser', 'pritchett'],
      },
      {
        title: 'The planning CT is one acquisition',
        body: 'The planning CT and intraprocedural imaging can differ in lung volume, body and arm position, timing and catheter-induced deformation. CT-to-body divergence includes true anatomical change and is broader than navigation registration error. Dependent atelectasis can both displace a lesion and obscure its margin.',
        sources: ['setser', 'ilocate', 'vespa'],
        detail: {
          title: 'Respiratory motion and progressive change',
          body: 'Cyclic motion moves the lesion through each breath. Hysteresis means a similar volume or pressure does not guarantee the same regional position on inflation and deflation. Progressive atelectasis or catheter deformation changes the baseline itself. A central landmark staying aligned does not show that a peripheral lesion is unchanged.',
        },
      },
      {
        title: 'When the lesion is not where it was expected',
        body: 'When the expected lesion is not seen, first check coverage and acquisition quality. The lesion may be outside the reconstruction volume, faint, obscured by atelectasis or hemorrhage, or displaced since the planning CT. Re-localize the lesion on current imaging before deciding whether to redirect, change modality, or reconsider the procedure.',
        sources: ['setser', 'mobile', 'ilocate'],
      },
    ],
    worked: {
      scenario:
        'A posterior lower-lobe lesion is clear on the planning CT but becomes inseparable from a new dependent opacity during the case.',
      reasoning:
        'Navigation may still be registered to central structures while the peripheral lung has changed. Address atelectasis with anesthesia and reconfirm the lesion on current imaging; more precise navigation cannot restore the original anatomy.',
    },
    lab: 'registration',
    labTask:
      'Change the anatomy, then toggle the stored contour. Note which information is still current.',
    takeaway: [
      'Review the airway and nearby hazards on the planning CT before instrumentation.',
      'Treat every image as a record of one respiratory and anatomical state.',
      'A lesion that cannot be found needs an explanation.',
    ],
    checkIds: ['anatomy-1', 'choose-1'],
  },
  {
    id: 'projection',
    title: 'Projection, superimposition, and depth',
    shortTitle: 'Projection & depth',
    group: 'Localize and optimize',
    stage: 'Foundation',
    minutes: 6,
    objective: 'optimize',
    outcome:
      'Distinguish projected overlap from a resolved three-dimensional tool–lesion relationship.',
    concept: 'A single projection collapses depth',
    prerequisites: ['imaging-questions', 'current-anatomy', 'good-image'],
    why: 'A tool can overlap a nodule on the monitor while lying anterior or posterior to it.',
    recall: {
      prompt: 'What does a stored target contour establish about the lesion now?',
      answer:
        'It shows the projected position of a prior segmentation. Whether it is still valid depends on the anatomy and on registration.',
    },
    blocks: [
      {
        title: 'Superimposition and parallax',
        kind: 'after-commitment',
        body: 'A single fluoroscopic projection collapses three-dimensional anatomy into a two-dimensional image, so structures at different depths can overlap. Rotating the C-arm produces parallax: their projected separation changes. Cranial or caudal angulation changes a different set of overlaps from obliquity.',
        points: [
          'Use the planning CT to anticipate useful projections.',
          'Change the projection enough to add depth information while preserving clearance.',
          'Recenter and recollimate after rotating the C-arm.',
        ],
        sources: ['setser', 'tg272'],
      },
      {
        title: 'Alignment view versus advancement view',
        body: 'A projection close to the axis of the tool helps judge whether the trajectory is centred on the lesion, but it foreshortens the tool. A more side-on projection places the tool in profile and better shows its advancement and depth. The best view for aligning the trajectory is not necessarily the best view for judging needle advancement; keep the distal tool and the safety landmarks in the field.',
        sources: ['setser', 'pritchett'],
        detail: {
          title: 'Verify orientation conventions',
          body: 'Patient position, detector orientation and image flips determine what left, right, cranial and caudal mean on a given console. Verify the orientation markers and the system convention, and do not rely on a memorized direction-of-parallax rule without them.',
        },
      },
      {
        title: 'Two projections still have limits',
        body: 'A sufficiently separated second projection can reveal a depth mismatch, but overlap on two projections does not prove that the sampling part of a tool lies within an irregular three-dimensional lesion. Blur, tool blooming, motion, lesion shape and residual depth uncertainty matter; use DTS or CBCT when the remaining uncertainty would change safe sampling.',
        sources: ['setser', 'pritchett'],
      },
    ],
    worked: {
      scenario:
        'A needle and nodule overlap on the frontal projection. On an oblique projection they separate.',
      reasoning:
        'The oblique view demonstrates parallax: the needle and nodule were only superimposed on the frontal view. Reassess the trajectory against the lesion; rotating the C-arm changed the image, not the position of the needle.',
    },
    lab: 'geometry',
    labTask:
      'Keep the tool depth offset, rotate the C-arm, and compare the 3D scene with its CT-derived projection.',
    takeaway: [
      'Overlap on one projection is superimposition until shown otherwise.',
      'Choose the projection for the question: alignment or advancement.',
      'Changing the projection does not move the tool.',
    ],
    checkIds: ['geometry-1', 'anatomy-1'],
  },
  {
    id: 'signal',
    title: 'Improving lesion conspicuity',
    shortTitle: 'Lesion visibility',
    group: 'Localize and optimize',
    stage: 'Mechanism',
    minutes: 5,
    objective: 'optimize',
    outcome: 'Distinguish quantum noise from scatter and from anatomical superimposition.',
    concept: 'Lesion conspicuity has a limiting factor',
    prerequisites: ['projection', 'good-image'],
    why: 'More radiation output can produce a cleaner image of the same unresolved superimposition.',
    recall: {
      prompt: 'When does changing the projection add more than display zoom?',
      answer:
        'When overlying anatomy or unresolved depth is the limiting problem. Display zoom keeps the same projection and the same superimposition.',
    },
    blocks: [
      {
        title: 'Identify what is limiting conspicuity',
        kind: 'after-commitment',
        body: 'Quantum noise is random variation from too few detected photons. Scatter adds unwanted signal that reduces contrast. Anatomical superimposition is real overlying structure. They can look similar at first glance but need different responses.',
        points: [
          'Noisy image: assess photon statistics and motion.',
          'Low contrast: assess collimation, scatter and the display.',
          'Rib or heart superimposed on the lesion: change the projection.',
          'No distinct lesion after optimization: reassess lesion identity or the modality.',
        ],
        sources: ['tg125', 'tg272', 'wabip'],
      },
      {
        title: 'Beam energy and photon output are different',
        body: 'kV affects the X-ray spectrum and penetration; mA and pulse duration affect photon output. Filtration removes part of the low-energy spectrum. These interact with automatic exposure regulation, so no single control maps to one universal change in dose or contrast.',
        sources: ['tg125', 'tg272'],
        detail: {
          title: 'The quantitative idea',
          body: 'In an ideal quantum-limited model, signal-to-noise ratio scales with the square root of the detected photon count: four times the photons gives about twice the SNR, with all other factors fixed. This is a physics relationship, not a prediction of diagnostic yield. Attenuation follows a line integral through heterogeneous tissue; the simple I = I₀ exp(−μx) form assumes a uniform material and a monoenergetic narrow beam.',
        },
      },
      {
        title: 'Brightness can hide an increase in output',
        body: 'Automatic exposure regulation may raise kV, mA or pulse width when the beam crosses thicker tissue or a dense object, and the monitor can stay similarly bright while output rises. Check the dose-rate or cumulative dose readout after major changes in projection, collimation, magnification mode or patient thickness.',
        sources: ['tg125', 'wabip'],
      },
    ],
    worked: {
      scenario:
        'The needle is sharp and the image is not noisy, but the nodule is projected over the cardiac silhouette.',
      reasoning:
        'Anatomical superimposition is the limiting factor. Use the planning CT to choose a projection that moves the lesion off the heart, then check the dose rate in the new projection. Increasing photon output would still image the heart superimposed on the lesion.',
    },
    lab: 'geometry',
    labTask:
      'Rotate the C-arm until the heart no longer overlaps the X-ray path through the lesion, then add angulation and read what the projection does.',
    takeaway: [
      'Name the limiting factor before changing anything.',
      'More photons give diminishing returns.',
      'Image brightness is not a dose indicator.',
    ],
    checkIds: ['signal-1', 'geometry-1'],
  },
  {
    id: 'field',
    title: 'Collimation, geometry, and magnification',
    shortTitle: 'Collimation & zoom',
    group: 'Localize and optimize',
    stage: 'Mechanism',
    minutes: 6,
    objective: 'optimize',
    outcome:
      'Distinguish collimation and acquisition changes from operations that change only the display.',
    concept: 'Acquired information versus displayed information',
    prerequisites: ['signal', 'projection'],
    why: 'Electronic cropping can hide anatomy that was still irradiated, while a magnification control can change the acquisition without making that obvious.',
    recall: {
      prompt: 'Why might the monitor stay bright when the beam crosses more tissue?',
      answer:
        'Automatic exposure regulation can increase output to hold its detector target. Check the dose-rate readout rather than judging brightness.',
    },
    blocks: [
      {
        title: 'Collimate to the task',
        body: 'Physical collimation limits the irradiated tissue and the volume that generates scatter. Electronic cropping hides acquired pixels on the monitor. Supported virtual collimation positions the real blades on a stored image before the next exposure. Confirm which operation the console performs.',
        points: [
          'Include the lesion or its expected location, the actual tool and the landmarks you need.',
          'Allow for the complete planned tool excursion.',
          'Recenter and recollimate after each change of projection.',
          'Check the dose rate: automatic exposure regulation can partly offset a smaller field.',
        ],
        sources: ['wabip', 'tg125', 'tg272'],
      },
      {
        title: 'Display zoom versus acquisition magnification',
        body: 'Display zoom enlarges acquired pixels and adds no exposure when applied to a stored image. Image-intensifier electronic magnification generally required increased exposure. Flat-panel acquisition field and readout modes may change detector sampling, binning, processing and automatic exposure behavior, or may simply crop; their effect on detail and dose needs local characterization. Ask whether a control changes the X-ray acquisition, the detector readout, or only the display.',
        sources: ['tg272', 'tg125'],
      },
      {
        title: 'Geometry changes magnification and blur',
        body: 'For routine 2D work, avoid an unnecessary patient-to-detector gap and an unnecessarily short source-to-skin distance. Geometric magnification changes both apparent sampling and focal-spot blur. Preserve clearance and centering at the isocenter when preparing a rotational acquisition.',
        sources: ['setser', 'tg272'],
        detail: {
          title: 'A useful geometry relationship',
          body: 'Magnification M = source-to-image distance / source-to-object distance. Image-plane focal-spot blur is approximately f × (M − 1), for focal spot size f. Better apparent sampling can coexist with more focal-spot blur. A rigid C-arm keeps a fixed source–detector distance even when the whole assembly moves.',
        },
      },
    ],
    worked: {
      scenario:
        'The needle is small on a last-image-hold frame. The operator is considering a smaller acquisition field just to inspect its edge.',
      reasoning:
        'Try display zoom on the stored image first; it changes how acquired information is viewed. If true detail is insufficient, a validated acquisition change may be needed, with the dose rate checked.',
    },
    lab: 'field',
    labTask:
      'Compare the collimated field with an electronic crop, then apply display zoom to the stored image. Keep the full tool excursion in the field.',
    takeaway: [
      'Collimation acts on the beam; electronic cropping acts on the display.',
      'A magnification label does not tell you what the acquisition changed.',
      'Keep the anatomic context and mechanical clearance.',
    ],
    checkIds: ['field-1', 'signal-1'],
  },
  {
    id: 'time',
    title: 'Pulse rate, pulse width, and image lag',
    shortTitle: 'Temporal resolution',
    group: 'Localize and optimize',
    stage: 'Mechanism',
    minutes: 6,
    objective: 'optimize',
    outcome: 'Distinguish motion blur within a frame, movement between frames, and image lag.',
    concept: 'Acquisition timing is different from display timing',
    prerequisites: ['signal', 'field'],
    why: 'A sharp or smoothly refreshed image can still miss tool movement between acquired frames.',
    recall: {
      prompt: 'Does a display-only change reduce radiation already delivered?',
      answer:
        'No. Cropping, display zoom and window/level applied to stored images change viewing, not the preceding exposure.',
    },
    blocks: [
      {
        title: 'Pulse width and pulse rate',
        body: 'Pulse width sets how much movement occurs during one exposure, and therefore within-frame motion blur. Pulse rate sets how often new images are acquired. The display refresh rate may repeat or interpolate those frames. A short pulse can freeze each frame while a low pulse rate leaves large gaps between acquired positions.',
        sources: ['tg272', 'tg125'],
      },
      {
        title: 'Match temporal settings to the task',
        body: 'Use the lowest pulse rate and image quality that reliably show the movement the task needs. Static localization may tolerate a lower pulse rate than dynamic needle advancement. A lower pulse rate does not guarantee proportionally lower output if the system lengthens pulses or raises current.',
        points: [
          'Check the actual acquisition rate.',
          'Shorten pulse width when motion blur dominates.',
          'Recognize frame averaging as a cause of smear and image lag.',
          'Release the pedal to think; review last-image hold or a stored loop.',
        ],
        sources: ['tg272', 'tg125', 'wabip'],
      },
      {
        title: 'Image processing cannot create acquired information',
        body: 'Frame averaging makes noise less obvious but smears moving structures and adds lag. Edge enhancement and window/level can make an image easier to read without showing that a boundary was physically resolved. Keep the source images, and validate task-specific presets with the technologist and medical physicist.',
        sources: ['tg272', 'tg125'],
      },
    ],
    worked: {
      scenario:
        'After the pulse rate is reduced, the system doubles pulse width. Tube current is unchanged.',
      reasoning:
        'There are fewer images per second but the same mAs per second in this simplified comparison, and each exposure spans more motion. Pulse-rate arithmetic alone does not establish a reduction in patient dose.',
    },
    lab: 'temporal',
    labTask:
      'Halve the pulse rate, then double the pulse width. Compare the spacing of acquired positions, within-frame blur and tube loading.',
    takeaway: [
      'Pulse width, pulse rate and display refresh rate are different.',
      'Judge temporal resolution during the actual task.',
      'Use last-image hold to deliberate without exposure.',
    ],
    checkIds: ['time-1', 'field-1'],
  },
  {
    id: 'two-dimensional',
    title: 'Practical 2D fluoroscopy workflow',
    shortTitle: '2D fluoroscopy',
    group: 'Confirm',
    stage: 'Application',
    minutes: 5,
    objective: 'choose',
    outcome:
      'Select the next useful adjustment when fluoroscopy does not answer the procedural question.',
    concept: 'Integrate the question, projection, collimation and timing',
    prerequisites: ['current-anatomy', 'projection', 'signal', 'field', 'time'],
    why: 'Repeated exposures that add no new information delay localization and add avoidable radiation.',
    recall: {
      prompt: 'Which two temporal problems can remain in a sharp, low-rate image?',
      answer:
        'Movement between acquired frames, and lag from frame averaging or display processing. A short pulse width addresses blur within a frame, not either of these.',
    },
    blocks: [
      {
        title: 'A two-axis fluoroscopy technique',
        kind: 'after-commitment',
        body: 'State the question and review the planning CT. Use the axial CT to choose an oblique projection that moves the lesion off the heart, mediastinum, scapula, ribs or thick chest wall, and add modest cranial or caudal angulation when the sagittal CT shows the diaphragm, a rib edge or the clavicle over it; the individual lesion position, not a memorized lobe rule, decides the angle. Then recenter, collimate around the lesion and the anticipated tool excursion, use display zoom if the image is simply small, and choose a second projection that places the tool in profile.',
        points: [
          'Superimposition: change the projection, then recenter.',
          'Image too small: display zoom on last-image hold.',
          'Motion: address pulse width, pulse rate or the movement itself.',
          'Unresolved depth or lesion identity: add DTS or CBCT.',
        ],
        sources: ['setser', 'tg272', 'wabip'],
      },
      {
        title: 'Radial EBUS is a different kind of evidence',
        body: 'Radial EBUS images the tissue around the probe without ionizing radiation. A concentric or eccentric view helps localize the lesion relative to the airway, but atelectatic lung can also look lesion-like. The radial EBUS probe is not the biopsy tool: after the probe is withdrawn and another device inserted, the sheath can move, the catheter can deform and the tool can exit in a different direction.',
        sources: ['mobile', 'ilocate', 'frontier'],
      },
      {
        title: 'Change modality when the projection stops answering',
        body: 'Use DTS or CBCT when their depth or current anatomical information can change the next decision. More exposure in the same projection will not bring an out-of-field lesion into view, resolve every superimposition, or turn a virtual contour into an imaged nodule. Save the images that actually supported sampling.',
        sources: ['setser', 'verhoeven', 'pritchett'],
      },
    ],
    worked: {
      scenario:
        'A peripheral lesion remains poorly defined after a better oblique projection and tight collimation. The needle is easy to see.',
      reasoning:
        'Refining the needle image further does not establish lesion identity. 2D fluoroscopy is no longer resolving the depth uncertainty; a DTS acquisition or a CBCT spin may answer what the projection cannot.',
    },
    takeaway: [
      'Fix the limiting factor before increasing exposure.',
      'Treat radial EBUS and fluoroscopy as complementary evidence.',
      'Stop repeating the same projection when it has stopped answering.',
    ],
    checkIds: ['workflow-1', 'time-1'],
  },
  {
    id: 'dts-acquisition',
    title: 'Digital tomosynthesis: acquisition and depth localization',
    shortTitle: 'DTS acquisition',
    group: 'Confirm',
    stage: 'Mechanism',
    minutes: 6,
    objective: 'dts',
    outcome:
      'Explain what a limited-angle acquisition adds to a single projection and what it leaves incompletely resolved.',
    concept: 'Limited-angle depth reconstruction',
    prerequisites: ['projection', 'two-dimensional'],
    why: 'The label “3D” on a reconstruction does not tell you whether depth is resolved as well as the in-plane image.',
    recall: {
      prompt: 'How does changing the projection reveal a hidden depth separation?',
      answer:
        'Parallax changes the projected positions of structures at different depths. A single projection collapses that separation along the beam.',
    },
    blocks: [
      {
        title: 'Reconstructing planes from a DTS acquisition',
        body: 'Digital tomosynthesis acquires a series of projections as the C-arm moves through a limited arc. Shifting and adding those projections brings one depth into register: structures at that depth reinforce, and structures at other depths blur out of plane. The result reduces superimposition and adds depth information that a single projection lacks. Think of sliding a stack of transparencies until one object lines up.',
        sources: ['saad', 'frontier'],
      },
      {
        title: 'Depth resolution depends on angular coverage',
        kind: 'after-commitment',
        body: 'Limited angular coverage leaves part of the spatial information unmeasured, often described as a missing wedge. In-plane edges can look sharp while depth remains elongated or blurred, and small voxels do not repair this anisotropy: a reconstruction can contain small voxels without equivalent resolution in every direction. Sparse projections over a wide rotation and a limited arc are different sampling problems. Because the acquired projections do not single out one volume, a system may resolve the unmeasured directions from a registered prior scan or a learned model and render a CT-like image, which removes the visible sign of the limit without removing the limit.',
        sources: ['saad', 'sumner', 'podder'],
        detail: {
          title: 'More projections: state the constraint',
          body: 'More projections at a fixed exposure per projection increase total exposure. Dividing a fixed total exposure among more projections changes sampling and noise differently. Projection count alone does not specify image quality, acquisition time or dose.',
        },
      },
      {
        title: 'Prepare the DTS acquisition',
        body: 'Keep the lesion and the relevant tool within the supported reconstruction field, use the supported trajectory, and coordinate a stable respiratory state. Patient, tool or unmodelled equipment motion can invalidate the reconstruction. Arc and acquisition settings depend on the installed system.',
        points: [
          'Confirm geometry and lesion coverage.',
          'Maintain the agreed respiratory state and tool position.',
          'Review the reconstruction before using it to guide sampling.',
        ],
        sources: ['saad', 'frontier'],
      },
    ],
    worked: {
      scenario:
        'A DTS reconstruction separates a lesion from a rib, but the lesion and needle are elongated in the depth direction.',
      reasoning:
        'The acquisition added useful depth information while leaving depth less resolved than the in-plane image. Assess the actual tool and lesion on supported views, and do not read a fine voxel grid, or a CT-like rendering, as equivalent to isotropic CT.',
    },
    lab: 'dts',
    labTask:
      'Scroll the reconstruction plane through the added lesion and tool, then compare the surrounding anatomy with a wider authored DTS arc.',
    takeaway: [
      'DTS adds depth information absent from a single projection.',
      'Depth resolution depends on angular coverage.',
      'Voxel size does not describe measured resolution.',
    ],
    checkIds: ['dts-1', 'geometry-1'],
  },
  {
    id: 'dts-interpretation',
    title: 'Understanding the DTS reconstruction',
    shortTitle: 'DTS reconstruction',
    group: 'Confirm',
    stage: 'Mechanism',
    minutes: 5,
    objective: 'dts',
    outcome:
      'Distinguish image content acquired now, prior-derived anatomy and navigation target updates.',
    concept: 'What the reconstruction was built from',
    prerequisites: ['dts-acquisition', 'current-anatomy'],
    why: 'A convincing prior-informed image can conceal how little current information was acquired about a changed peripheral lesion.',
    recall: {
      prompt: 'Why can an object look sharp in one DTS orientation but uncertain in another?',
      answer:
        'Limited angular coverage resolves space unevenly. Reconstruction and a small voxel grid cannot supply the missing directions.',
    },
    blocks: [
      {
        title: 'Three uses of a DTS reconstruction',
        body: 'A system may update the navigation target, display local tomographic planes, or project an augmented-fluoroscopy contour onto live imaging. These are separate capabilities. Ask which acquisition, and when, supports each display, and which part of the tool was actually imaged.',
        points: [
          'A navigation target update changes the target used for guidance.',
          'Local tomography displays reconstructed depth information.',
          'Augmented fluoroscopy projects a segmentation onto live fluoroscopy.',
        ],
        sources: ['frontier', 'saad', 'pritchett'],
      },
      {
        title: 'A prior CT can improve the reconstruction and bias it',
        body: 'Iterative reconstruction compares acquired projections with projections predicted from an estimated volume. A prior CT and regularization can guide an incomplete problem toward a useful solution. If the anatomy has changed, the prior can also pull the result toward the older anatomy.',
        sources: ['saad'],
        detail: {
          title: 'What the reconstruction study established',
          body: 'Saad and colleagues evaluated a physical phantom and six patient imaging datasets. Prior-aided reconstruction improved image similarity to reference CBCT. This was technical evidence about reconstruction, not a diagnostic-yield trial or a measured whole-procedure dose comparison.',
        },
      },
      {
        title: 'Question the claim, not the brand name',
        body: 'For “AI tomography” or “real-time 3D,” ask about angular coverage, what was acquired, the prior CT’s contribution, motion correction and the independently validated endpoint. A DTS acquisition may answer the question well without being interchangeable with every CBCT protocol.',
        sources: ['saad', 'frontier', 'sumner'],
        detail: {
          title: 'What “CT-like” names, and what it does not',
          body: 'Modern platforms differ in what they build from a DTS acquisition over roughly 50–70 degrees. Several use artificial intelligence and machine learning to generate CT-like multi-axial reconstructions from those limited images; at least one uses the acquisition only to update its virtual navigation data and renders no such reconstruction at all. Where they are produced, these images are described as not fully accurate representations of what actual CT would show, because part of them is extrapolated: comparisons of target location on tomosynthesis against cone-beam CT report the distance between target centers deviating by as much as 16.2 mm. The name on the screen does not settle which of these you are looking at.',
        },
      },
    ],
    worked: {
      scenario:
        'A reconstructed lesion contour closely resembles the planning CT, but new fluoroscopic and radial EBUS findings disagree with it.',
      reasoning:
        'Do not let visual familiarity outweigh current contradictory evidence. Review the source projections, coverage, respiratory state and the prior’s contribution, and reconfirm the lesion before relying on the contour.',
    },
    takeaway: [
      'Ask what was acquired now.',
      'Navigation target update, tomography and overlay are distinct.',
      'Technical image quality is not diagnostic yield.',
    ],
    checkIds: ['prior-1', 'anatomy-1'],
  },
  {
    id: 'cbct-acquisition',
    title: 'Optimizing CBCT acquisition',
    shortTitle: 'CBCT acquisition',
    group: 'Confirm',
    stage: 'Mechanism',
    minutes: 6,
    objective: 'cbct',
    outcome:
      'Distinguish a CBCT setup that is ready from one with unresolved coverage, motion or collision problems.',
    concept: 'A CBCT spin has shared preconditions',
    prerequisites: ['current-anatomy', 'dts-acquisition', 'time'],
    why: 'A full CBCT spin with a truncated lesion or avoidable motion adds radiation without answering the question.',
    recall: {
      prompt:
        'Do many projections over a narrow arc provide the same directions as a full rotation?',
      answer:
        'No. Angular coverage and projection count are independent. A wider rotation adds directions; how they are sampled still matters.',
    },
    blocks: [
      {
        title: 'Many projections become one volume',
        body: 'CBCT rotates the X-ray tube and flat-panel detector around the patient and reconstructs the acquired projections into a volume for multiplanar review. Compared with a DTS acquisition, it generally provides much wider angular information. Contrast, scatter, motion and calibration still limit the volume, and it is not interchangeable with diagnostic multidetector CT for every task.',
        sources: ['setser', 'mobile'],
      },
      {
        title: 'Center the lesion in three dimensions',
        kind: 'after-commitment',
        body: 'A lesion centred on the frontal view can still be offset anteroposteriorly. Use supported orthogonal localization or validated positioning aids to place the lesion, the relevant tool and the safety anatomy within the reconstruction volume at the isocenter, and respect the supported collimation and table configurations.',
        sources: ['setser'],
      },
      {
        title: 'Make readiness a team check',
        body: 'Confirm the intended lesion and field of view, the tool configuration, collision clearance through the complete spin, and the breath-hold and protection plan. Perform a non-irradiating trial rotation when supported. Account for the tube and detector, the patient’s arms, the table, the robot, the bronchoscope, the lines and the anesthesia equipment.',
        points: [
          'Bronchoscopist: the lesion and the actual biopsy tool configuration.',
          'Technologist: protocol, coverage and clearance for the full spin.',
          'Anesthesia: a stable breath hold or ventilation pause, monitoring and stopping criteria.',
          'Team: effective shielding and maintained patient access.',
        ],
        sources: ['setser', 'mobile', 'wabip'],
      },
    ],
    worked: {
      scenario:
        'The lesion is centred on the frontal scout. A lateral localization view places it near the edge of the reconstruction volume.',
      reasoning:
        'Frontal centering resolved only part of the positioning problem. Fix the remaining offset with the supported method and recheck coverage and clearance before exposure; a better reconstruction cannot recover a truncated lesion.',
    },
    lab: 'acquisition',
    labTask:
      'Set up the authored lesion and complete the readiness checks. See what happens when a checked setup is moved.',
    takeaway: [
      'Center the lesion, not just the chest.',
      'Check clearance for the whole spin.',
      'Review acquisition quality before accepting the result.',
    ],
    checkIds: ['acquisition-1', 'dts-1'],
  },
  {
    id: 'fixed-suite',
    title: 'Fixed C-arm CBCT workflow',
    shortTitle: 'Fixed CBCT',
    group: 'Confirm',
    stage: 'Application',
    minutes: 4,
    objective: 'cbct',
    outcome: 'Adapt shared CBCT acquisition requirements to an integrated fixed C-arm workflow.',
    concept: 'Fixed-room CBCT workflow',
    prerequisites: ['cbct-acquisition', 'field'],
    why: 'Integration can simplify imaging while a robotic bronchoscopy platform, the anesthesia circuit or a changed table position adds a new constraint.',
    recall: {
      prompt: 'Which positioning uncertainty can remain after a centred frontal scout?',
      answer:
        'The lesion can still be offset along the beam direction, or outside another dimension of the supported reconstruction volume.',
    },
    blocks: [
      {
        title: 'Plan around the installed room',
        body: 'A fixed C-arm may be floor-, ceiling- or robot-mounted, often with an integrated imaging table and dedicated shielding. Room access, motion limits, detector clearance and navigation integration are installation-specific. Plan bronchoscope and robot docking around the actual CBCT spin path.',
        sources: ['setser', 'wabip'],
      },
      {
        title: 'Use integration deliberately',
        body: 'Supported table and C-arm position tracking can keep an overlay aligned through recognized equipment movement. Patient movement relative to the table, lung-volume change and local deformation are separate problems. Verify which image flips, magnification changes and imported volumes preserve registration.',
        sources: ['setser', 'pritchett'],
      },
      {
        title: 'Choose the protocol for the question',
        body: 'Localization, low-contrast lesion definition and repeat tool-in-lesion confirmation can need different image quality. Establish a small set of validated presets with the technologist and medical physicist, and raise image quality for insufficient signal or margin definition only after addressing motion and coverage.',
        points: [
          'Keep access to the airway and emergency pathways.',
          'Use supported positions for 2D and rotational imaging.',
          'Record why each additional acquisition was needed.',
        ],
        sources: ['setser', 'verhoeven', 'tg272'],
      },
    ],
    worked: {
      scenario:
        'After a table move, the integrated overlay follows the displayed field correctly. A recruitment maneuver then changes peripheral lung inflation.',
      reasoning:
        'Equipment tracking and anatomical tracking are different. The supported table move may preserve geometric registration; the later change in the anatomy requires the overlay to be reconfirmed.',
    },
    lab: 'acquisition',
    labTask:
      'Select the fixed C-arm workflow, inspect the C-arm motion reference, and consider the installation-specific clearance checks.',
    takeaway: [
      'A fixed installation does not remove CT-to-body divergence.',
      'Confirm how the integration behaves.',
      'Match protocol quality to the question.',
    ],
    checkIds: ['fixed-1', 'field-1'],
  },
  {
    id: 'mobile-suite',
    title: 'Mobile CBCT workflow',
    shortTitle: 'Mobile CBCT',
    group: 'Confirm',
    stage: 'Application',
    minutes: 4,
    objective: 'cbct',
    outcome:
      'Adapt shared CBCT acquisition requirements to a mobile scanner in an existing procedure room.',
    concept: 'Mobile CBCT workflow',
    prerequisites: ['cbct-acquisition', 'fixed-suite'],
    why: 'Portability does not establish that a room, table, radiation barrier or data connection is ready for rotational imaging.',
    recall: {
      prompt: 'What does an overlay that moves correctly after a table move establish?',
      answer:
        'It demonstrates supported equipment geometry. It does not establish that the peripheral lung and the tool still match the acquisition.',
    },
    blocks: [
      {
        title: 'Commission the combination',
        body: 'Check table radiolucency, pedestal and base interference, power and parking, patient and robot clearance, image export and room shielding with the responsible team. Floor space for a C-arm is not a verified rotational clearance.',
        sources: ['mobile', 'setser', 'wabip'],
      },
      {
        title: 'Compare capabilities individually',
        body: 'Field of view, angular range, scan time, exposure modes, reconstructed image quality and workflow differ among models and software versions. A mobile label does not imply universally lower dose or poorer images, and a fixed label does not establish every navigation or overlay capability.',
        points: [
          'Can the actual lesion and tool fit in the validated volume?',
          'How are reconstructed images reviewed and transferred?',
          'Can the navigation target be updated?',
          'Is a registered live overlay available and maintained?',
        ],
        sources: ['mobile', 'setser', 'tg272'],
      },
      {
        title: 'Preserve orientation and registration',
        body: 'Verify image orientation, patient position, volume identity and supported coordinate transfer. DICOM export alone does not show that two systems share a coordinate frame. Keep roles clear during scanner entry, positioning, acquisition, review and the return to sampling.',
        sources: ['setser', 'mobile', 'pritchett'],
      },
    ],
    worked: {
      scenario:
        'A mobile scanner produces a useful volume, but the navigation platform has no validated target-update integration.',
      reasoning:
        'The volume can still support current anatomical and tool review on its own workstation. Do not assume that viewing or exporting it updates the navigation target or provides an augmented-fluoroscopy overlay.',
    },
    lab: 'acquisition',
    labTask:
      'Select the mobile CBCT workflow. Compare its room-preparation needs, and center the lesion on both CT-derived scout images.',
    takeaway: [
      'Portability changes logistics, not the physics.',
      'Commission the room, table and scanner together.',
      'Image review, navigation target update and overlay are separate capabilities.',
    ],
    checkIds: ['mobile-1', 'acquisition-1'],
  },
  {
    id: 'tool-confirmation',
    title: 'Confirm the biopsy tool within the lesion',
    shortTitle: 'Tool-in-lesion',
    group: 'Sample and reconfirm',
    stage: 'Application',
    minutes: 7,
    objective: 'verify',
    outcome:
      'Distinguish projected overlap, tip position and sampling-window position on multiplanar CBCT review.',
    concept: 'The sampling part of the tool is a three-dimensional object',
    prerequisites: ['cbct-acquisition', 'projection', 'two-dimensional'],
    why: 'The brightest pixel, or a catheter parked near the nodule, may not represent where tissue is actually acquired.',
    recall: {
      prompt:
        'Why does a concentric radial EBUS view not prove where a subsequent needle will sample?',
      answer:
        'The probe imaged the tissue around itself. Tool exchange can change the trajectory, and the biopsy tool is a different device.',
    },
    blocks: [
      {
        title: 'Lesion → tool → relationship → acquisition',
        body: 'Identify the intended lesion independently, then follow the actual tool through thin axial, coronal and sagittal reconstructions, adding oblique reformats along the tool where helpful. Identify the portion of the instrument that actually acquires tissue, and the acquisition in which the relationship was shown.',
        points: [
          'Lesion: the intended lesion, its margin and its solid component.',
          'Tool: catheter, sheath, needle tip, side-cutting window, forceps jaws or cryoprobe active segment.',
          'Relationship: outside, at the margin, within, or beyond; review more than one plane.',
          'Acquisition: record when, and in what respiratory state.',
        ],
        sources: ['setser', 'pritchett', 'mobile'],
      },
      {
        title: 'Follow the tool, not the streak',
        body: 'Metal can bloom or produce streaks from beam hardening, photon starvation, scatter and reconstruction. Compare source planes and supported reconstructions. A needle tip can be inside the lesion while a side-cutting window remains outside it; forceps jaws and a cryoprobe active segment need their own interpretation.',
        sources: ['setser', 'tg272'],
      },
      {
        title: 'A slab helps tracking but can conceal depth',
        body: 'Thick slabs and maximum-intensity projections make a long metal tool easier to follow, but they also superimpose structures at different depths. Surface renderings and overlap on a MIP should complement, not replace, thin multiplanar review.',
        sources: ['setser'],
        detail: {
          title: 'Tool-in-lesion is not a diagnosis',
          body: 'A favourable tool position does not establish adequate tissue, viable lesion selection, specimen handling or a final diagnosis. Document the imaging evidence and the pathology result separately, and do not turn a high tool-in-lesion rate into a claim of guaranteed diagnostic yield.',
        },
      },
    ],
    worked: {
      scenario:
        'The needle tip is beyond the nodule, and its side-cutting window lies within part of the lesion on thin reformats.',
      reasoning:
        'Tip-in-lesion and window-in-lesion are different statements. Describe the actual component and extent shown. The module’s fictional window geometry teaches this distinction; clinical interpretation depends on the real tool, the approved technique and the surrounding safety anatomy.',
    },
    lab: 'mpr',
    labTask:
      'Move the fictional needle in three dimensions. Compare slices through the lesion, slices along the tool and a thick slab before revealing the geometric relationship.',
    takeaway: [
      'Identify the lesion independently.',
      'Follow the part of the tool that acquires tissue on thin planes.',
      'Document the component and the acquisition.',
    ],
    checkIds: ['tool-1', 'geometry-1'],
  },
  {
    id: 'changing-anatomy',
    title: 'When to repeat localization',
    shortTitle: 'Reconfirmation',
    group: 'Sample and reconfirm',
    stage: 'Application',
    minutes: 6,
    objective: 'verify',
    outcome:
      'Distinguish a correctable acquisition artifact from an anatomical or physiological change that requires repeat localization.',
    concept: 'Localization must be repeated after meaningful change',
    prerequisites: ['current-anatomy', 'tool-confirmation', 'time', 'dts-interpretation'],
    why: 'An image records one moment; the anatomy can change between acquisition, reconstruction and sampling.',
    recall: {
      prompt: 'What does a thick slab sacrifice when it makes a long tool easy to follow?',
      answer:
        'It combines several depths, so apparent tool–lesion overlap can hide a separation that thin planes reveal.',
    },
    blocks: [
      {
        title: 'Match the artifact to its cause',
        body: 'Duplicated edges suggest motion. Metal-adjacent streaks need artifact-aware review. A truncated lesion suggests a coverage or centering problem. A new dependent opacity may be real atelectasis. Address the likely cause before repeating the same acquisition.',
        sources: ['setser', 'tg272', 'ilocate'],
      },
      {
        title: 'Plan the breath hold with anesthesia',
        body: 'A coordinated breath hold or ventilation pause can reduce motion, but the lesion–tool relationship may change when ventilation resumes. Preserve adequate oxygenation, ventilation, airway pressure and hemodynamic tolerance. A recruitment maneuver aims to reopen lung; a breath hold maintains a chosen state. These are different tasks.',
        points: [
          'Agree the intended state, and who announces readiness for acquisition.',
          'Agree stopping criteria before the breath hold.',
          'Do not treat normal oxygen saturation as proof of adequate CO₂ elimination.',
          'Repeat localization after a clinically meaningful change.',
        ],
        sources: ['setser', 'vespa'],
      },
      {
        title: 'Treat atelectasis as anatomy, not an image-quality problem',
        body: 'Ventilation research supports preventing atelectasis in studied settings, including the bundled strategy in VESPA. It does not justify one pressure, PEEP, oxygen concentration or apnea duration for all patients. Position changes may help selected dependent lesions but also change access, clearance and registration.',
        sources: ['vespa', 'ilocate', 'setser'],
        detail: {
          title: 'Reconfirm an augmented-fluoroscopy overlay',
          body: 'Toggle the contour off to review the underlying image, and check its source acquisition and respiratory state. Refresh it or reconfirm the lesion independently after repositioning, significant tool manipulation, a recruitment maneuver or unexplained discordance. A live tool position and a prior lesion segmentation are different sources of information.',
        },
      },
    ],
    worked: {
      scenario:
        'Motion degraded a CBCT spin, and the patient did not tolerate the planned breath hold.',
      reasoning:
        'Anesthesia restores appropriate support first. Review the cause and a safer acquisition strategy before another attempt; do not prolong an unsafe physiological state to finish imaging, and do not expect more exposure to remove duplicated edges.',
    },
    lab: 'registration',
    labTask:
      'Capture a target contour, change the anatomy, and decide what the stored overlay still represents.',
    takeaway: [
      'Address the cause before repeating.',
      'Anesthesia safety governs the breath hold.',
      'Repeat localization after tool exchange, needle deployment, recruitment, repositioning, bleeding or progressive atelectasis.',
    ],
    checkIds: ['change-1', 'prior-1'],
  },
  {
    id: 'staff-protection',
    title: 'Staff radiation protection',
    shortTitle: 'Staff protection',
    group: 'Radiation safety',
    stage: 'Mechanism',
    minutes: 5,
    objective: 'protect',
    outcome:
      'Select staff protection based on the irradiated patient, the C-arm geometry and effective barriers.',
    concept: 'The patient is the principal source of scatter',
    prerequisites: ['field', 'cbct-acquisition'],
    why: 'A staff member can be outside the primary beam and still receive scatter radiation during bedside fluoroscopy.',
    recall: {
      prompt: 'Why does electronic cropping not protect tissue outside the displayed region?',
      answer:
        'It does not restrict the physical beam. Radiation and scatter are determined by the acquisition, not by the displayed border.',
    },
    blocks: [
      {
        title: 'Time, distance and shielding',
        body: 'The irradiated patient is the principal source of scatter radiation. Reduce unnecessary exposure and bedside time, increase distance when the task allows, and use properly positioned shielding. Staff not needed at the bedside should stand behind an effective barrier during a CBCT spin while monitoring and patient access continue.',
        sources: ['wabip', 'icrp'],
      },
      {
        title: 'Geometry shapes occupational exposure',
        body: 'Scatter is not a uniform circle around the patient. The tube side, angulation, patient size, field size and barriers all shape it. In lateral projections, positions on the detector side often receive less than the beam-entrance (tube) side, but a CBCT spin changes directions throughout. No room or device category creates a universal unshielded safe zone.',
        sources: ['wabip', 'icrp'],
      },
      {
        title: 'Keep hands out of the primary beam',
        body: 'Use supported tool stabilization and shielding. A lead apron, glove or shield does not justify placing a hand in the primary beam, and it can drive automatic exposure regulation up. Wear assigned dosimeters in the specified positions, and use eye, thyroid or other protection as the institutional program directs.',
        points: [
          'Verify barrier position for the current projection.',
          'Wear the assigned dosimeters consistently.',
          'Have the radiation safety officer assess workload and room shielding.',
          'Arrange pregnancy-related work changes through the local program.',
        ],
        sources: ['icrp', 'wabip', 'tg125'],
      },
    ],
    worked: {
      scenario:
        'A staff member steps farther from the patient for a CBCT spin but stays outside the available barrier.',
      reasoning:
        'Distance generally reduces exposure, but no universal distance establishes safety. Use the room’s verified barrier and position plan; the right position depends on the actual scatter field, workload and radiation survey.',
    },
    lab: 'safety',
    labTask:
      'Inspect staff, patient and barrier geometry. Explore distance while noting what the simplified calculation cannot establish.',
    takeaway: [
      'Protect against scatter as well as the primary beam.',
      'Use effective barriers and verified positions.',
      'A dosimeter reading is useful only when the dosimeter is worn as assigned.',
    ],
    checkIds: ['safety-1', 'field-1'],
  },
  {
    id: 'dose-reporting',
    title: 'Understanding fluoroscopy and CBCT dose metrics',
    shortTitle: 'Dose metrics',
    group: 'Radiation safety',
    stage: 'Mechanism',
    minutes: 6,
    objective: 'protect',
    outcome:
      'Distinguish dose indices, their units, and the information needed for whole-procedure review.',
    concept: 'Different dose quantities answer different questions',
    prerequisites: ['staff-protection', 'time', 'field'],
    why: 'Fluoroscopy time or a small number of CBCT spins can conceal substantial exposure from other modes.',
    recall: {
      prompt: 'Why is staff dose not a substitute for the patient’s procedural exposure?',
      answer:
        'Staff may leave or stand behind barriers during a spin while the patient remains in the beam. The exposure pathways and the quantities differ.',
    },
    blocks: [
      {
        title: 'Know the quantity before comparing the number',
        body: 'Cumulative reference air kerma (Kₐ,r, in mGy or Gy) is an equipment-reference index. Kerma–area product (KAP, also called DAP, in Gy·cm²) combines air kerma and field area. Peak skin dose is the highest absorbed skin dose and requires location-specific information. Effective dose (mSv) is a population-protection quantity, not a measured individual skin dose.',
        sources: ['wabip', 'aapm12', 'skin'],
      },
      {
        title: 'A smaller field and a higher local index can coexist',
        kind: 'after-commitment',
        body: 'Collimation can reduce KAP while automatic exposure regulation maintains or raises air kerma in the remaining field. Equal KAP does not imply equal peak skin dose or organ exposure. Fluoroscopy time ignores differences in output and may exclude CBCT and radiographic acquisitions.',
        sources: ['tg125', 'aapm12', 'skin'],
        detail: {
          title: 'Units and quantities',
          body: '1 Gy = 1,000 mGy. For area products, 1 Gy·cm² = 100 µGy·m². CTDIvol and DLP are CT output descriptors under defined conditions and are not directly interchangeable with C-arm KAP. Never compare values until the quantity, units and included acquisition modes are established.',
        },
      },
      {
        title: 'Record the whole procedure once',
        body: 'Record the available total KAP and reference air kerma with units, the fluoroscopy time, the number and protocols of DTS and CBCT acquisitions, and the reasons for repeats. Distinguish component subtotals from totals to avoid double counting, and include significant notifications, limitations and any dose-management follow-up.',
        sources: ['wabip', 'aapm12'],
      },
      {
        title: 'Respond to notifications through the dose-management program',
        body: 'A dose notification prompts reassessment of necessity, optimization and the remaining plan. Follow local policy for medical-physics review, documentation and patient follow-up. Reference air kerma is not a diagnosis of skin injury, occupational limits are not patient medical-exposure limits, and no number of CBCT spins is universally right.',
        sources: ['aapm12', 'skin', 'icrp'],
      },
    ],
    worked: {
      scenario:
        'The field area is reduced while local air kerma rises modestly. The reported kerma–area product falls.',
      reasoning:
        'Both readouts can be accurate, because KAP depends on both air kerma and area. Interpret each quantity and review the whole procedure; the calculation does not reveal peak skin dose or justify ignoring an institutional notification.',
    },
    lab: 'dose',
    labTask:
      'Change beam area and air kerma independently. Convert the kerma–area product, and compare a component subtotal with the procedural total.',
    takeaway: [
      'State the quantity, units and included modes.',
      'KAP, reference air kerma and peak skin dose are not interchangeable.',
      'Use the dose-management program for review and follow-up.',
    ],
    checkIds: ['dose-1', 'time-1'],
  },
  {
    id: 'suite-cases',
    title: 'Integrated peripheral bronchoscopy cases',
    shortTitle: 'Integrated cases',
    group: 'Integrated cases',
    stage: 'Independent practice',
    minutes: 8,
    objective: 'verify',
    outcome: 'Apply the imaging and radiation-safety principles to new procedural decisions.',
    concept: 'Integrate the earlier decisions',
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
    why: 'The skill that matters is recognizing which imaging or safety problem needs attention before the next procedural step.',
    recall: {
      prompt: 'What four questions organize your final image review?',
      answer:
        'Identify the lesion, identify the part of the biopsy tool that acquires tissue, assess their three-dimensional relationship, and establish the acquisition and respiratory state.',
    },
    blocks: [
      {
        title: 'Apply the same reasoning to new situations',
        body: 'This section adds nothing new. It combines the modalities and safety questions of the course: each problem in the suite arises at one component of image formation, and naming it guides the next step. The eight case decisions follow on the Assess page, once every section has been worked through.',
        points: [
          'Name the imaging question before naming a device.',
          'Say where in image formation the problem arises.',
          'Choose the single best action from the available information.',
        ],
        sources: ['setser', 'wabip'],
      },
    ],
    worked: {
      scenario: 'Before starting, organize your own approach without a model answer.',
      reasoning:
        'Name the imaging question, the likely limiting factor, the acquisition that can resolve it, and the conditions needed to acquire it safely.',
    },
    takeaway: [
      'Choose imaging for the unanswered question.',
      'Reconfirm the current anatomy and the biopsy tool.',
      'Protect the team, and record the dose indices that matter.',
    ],
    checkIds: ['capstone-1', 'capstone-transfer-1'],
  },
]
