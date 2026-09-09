export const DECISION_GUIDE = [
  {
    finding: 'The tool is visible; the lesion is uncertain.',
    question: 'Is current target identity established?',
    action:
      'Review current localization, coverage and aeration; choose complementary imaging if needed.',
    lesson: 'two-dimensional',
  },
  {
    finding: 'A structure overlaps the target.',
    question: 'Is this a projection problem?',
    action: 'Use planning anatomy to choose another useful angle; recenter and assess output.',
    lesson: 'projection',
  },
  {
    finding: 'The image is grainy or washed out.',
    question: 'Is the limitation photon noise, scatter, or display?',
    action: 'Assess beam field, task preset, geometry and display before escalating exposure.',
    lesson: 'signal',
  },
  {
    finding: 'Edges duplicate or instruments lag.',
    question: 'Is measurement inconsistent over time?',
    action: 'Check motion, pulse duration/rate, processing and the agreed respiratory state.',
    lesson: 'time',
  },
  {
    finding: 'A depth relationship remains uncertain.',
    question: 'Which new measurement can resolve it?',
    action: 'Use suitable current DTS or CBCT and interpret its validated limits.',
    lesson: 'dts-acquisition',
  },
  {
    finding: 'A reconstructed tool overlaps the target.',
    question: 'Which component, planes and acquisition state?',
    action: 'Trace the actual sampling region in thin multiplanar views.',
    lesson: 'tool-confirmation',
  },
  {
    finding: 'The anatomy or setup has changed.',
    question: 'Does the previous evidence still apply?',
    action:
      'Reassess registration, target identity, tool position, coverage and clearance as relevant.',
    lesson: 'changing-anatomy',
  },
  {
    finding: 'A dose number or alert appears.',
    question: 'Which quantity, units and modes are included?',
    action: 'Review whole-procedure indices and follow the local dose-management policy.',
    lesson: 'dose-reporting',
  },
]

export const GLOSSARY = [
  [
    '2D fluoroscopy',
    'Successive X-ray projections. Each image combines information along the beam; temporal sampling depends on acquisition settings.',
  ],
  [
    'Augmented fluoroscopy',
    'A projected segmentation or route from a prior volume displayed with a current fluoroscopic image.',
  ],
  [
    'Automatic exposure control',
    'System-specific regulation of voltage, current, pulse width or other acquisition parameters to meet a detector/image target.',
  ],
  [
    'CBCT',
    'Cone-beam computed tomography: multiple projections acquired over a rotational orbit and reconstructed into a volume.',
  ],
  [
    'Collimation',
    'Physical restriction of the X-ray beam. It is different from cropping an already acquired image.',
  ],
  [
    'CT-to-body divergence',
    'Mismatch between prior CT anatomy and the patient during the procedure, including changes in inflation, position and local deformation.',
  ],
  [
    'DTS',
    'Digital tomosynthesis: depth reconstruction from limited-angle projections, with direction-dependent resolution.',
  ],
  [
    'Effective dose',
    'A tissue-weighted population-protection quantity in sieverts. It is not an individual skin-dose measurement.',
  ],
  [
    'Isocenter',
    'The reference center of an imaging system’s rotation. Target positioning must match the supported acquisition volume.',
  ],
  [
    'KAP / DAP',
    'Kerma–area product, commonly called dose–area product. Air kerma integrated over beam area, often in Gy·cm².',
  ],
  [
    'Kₐ,r',
    'Cumulative reference air kerma, usually in mGy or Gy. An equipment-reference index, not the actual highest skin dose.',
  ],
  [
    'MIP',
    'Maximum-intensity projection. A slab display selecting the highest values along viewing rays; can superimpose different depths.',
  ],
  [
    'MPR',
    'Multiplanar reformation: viewing a reconstructed volume in axial, coronal, sagittal or oblique planes.',
  ],
  [
    'Parallax',
    'A change in relative projected positions when the viewpoint changes, providing information about depth.',
  ],
  [
    'Peak skin dose',
    'The highest absorbed dose to a skin region. Estimation needs spatial dose and geometry information.',
  ],
  [
    'Pulse rate / pulse width',
    'How frequently new exposures are acquired / how long each individual exposure lasts. Neither equals display refresh.',
  ],
  [
    'Radial EBUS',
    'Local ultrasound imaging around a radial probe. The probe’s tissue relationship can differ from that of a subsequently exchanged sampling tool.',
  ],
  [
    'Registration',
    'The spatial mapping between datasets or coordinate systems. Mechanical registration need not compensate for anatomical deformation.',
  ],
  [
    'Tool-in-lesion',
    'An image-based localization claim that must specify the actual tool component, supporting planes and acquisition state. It is not a tissue diagnosis.',
  ],
] as const

export const MODALITIES = [
  {
    name: '2D fluoroscopy',
    information: 'Projection and observed movement',
    use: 'Orientation, tool movement, angle-dependent relationships',
    limit: 'Overlapping anatomy and unresolved depth',
    lesson: 'two-dimensional',
  },
  {
    name: 'Radial EBUS',
    information: 'Local acoustic tissue pattern',
    use: 'Airway-relative tissue localization',
    limit: 'Atelectasis mimics tissue; tool exchange changes the measurement',
    lesson: 'two-dimensional',
  },
  {
    name: 'Digital tomosynthesis',
    information: 'Limited-angle reconstructed depth',
    use: 'Local reconstruction or navigation correction, depending on integration',
    limit: 'Directional uncertainty and possible prior-CT influence',
    lesson: 'dts-acquisition',
  },
  {
    name: 'Fixed CBCT',
    information: 'Current reconstructed volume',
    use: 'Anatomy and multiplanar tool assessment in an installed suite',
    limit: 'Motion, artifacts, room access and installation-specific integration',
    lesson: 'fixed-suite',
  },
  {
    name: 'Mobile CBCT',
    information: 'Current reconstructed volume',
    use: 'Volumetric assessment with a mobile acquisition workflow',
    limit: 'Table/room compatibility and model-specific field and integration',
    lesson: 'mobile-suite',
  },
  {
    name: 'Augmented fluoroscopy',
    information: 'Projected prior segmentation plus live image',
    use: 'Guidance while registration and anatomical state remain valid',
    limit: 'A contour is not independent live lesion sensing',
    lesson: 'changing-anatomy',
  },
]
