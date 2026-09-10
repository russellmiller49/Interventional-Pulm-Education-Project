export const DECISION_GUIDE = [
  {
    finding: 'The tool is visible; the lesion is uncertain.',
    question: 'Has the current lesion location been established?',
    action:
      'Reconfirm the lesion on intraprocedural imaging, checking coverage and atelectasis; add radial EBUS, DTS or CBCT as needed.',
    lesson: 'two-dimensional',
  },
  {
    finding: 'A structure is superimposed on the lesion.',
    question: 'Is this a projection problem?',
    action:
      'Use the planning CT to choose another C-arm projection; recenter, recollimate and recheck the dose rate.',
    lesson: 'projection',
  },
  {
    finding: 'The image is noisy or low in contrast.',
    question: 'Is the limitation quantum noise, scatter or the display?',
    action:
      'Collimate, then review the fluoroscopy preset, patient thickness, projection and window/level before increasing dose.',
    lesson: 'signal',
  },
  {
    finding: 'Edges duplicate or instruments lag.',
    question: 'Is this motion, pulse timing or image lag?',
    action: 'Check motion, pulse width and pulse rate, frame averaging and the agreed breath hold.',
    lesson: 'time',
  },
  {
    finding: 'A depth relationship remains uncertain.',
    question: 'Which acquisition can resolve it?',
    action:
      'Obtain a sufficiently separated projection, a DTS acquisition or a CBCT spin, and interpret it within its validated limits.',
    lesson: 'dts-acquisition',
  },
  {
    finding: 'A reconstructed tool overlaps the lesion.',
    question: 'Which part of the tool, which planes and which acquisition?',
    action:
      'Confirm the sampling window, jaws or active segment within the lesion on thin multiplanar reformats.',
    lesson: 'tool-confirmation',
  },
  {
    finding: 'The anatomy or the setup has changed.',
    question: 'Does the earlier imaging still apply?',
    action:
      'Repeat localization as needed: registration, lesion identity, tool position, coverage and clearance.',
    lesson: 'changing-anatomy',
  },
  {
    finding: 'A dose index or dose notification appears.',
    question: 'Which quantity, units and acquisition modes are included?',
    action: 'Review whole-procedure dose indices and follow the local dose-management policy.',
    lesson: 'dose-reporting',
  },
]

export const GLOSSARY = [
  [
    '2D fluoroscopy',
    'Pulsed X-ray projections acquired in real time. A single projection collapses depth; temporal resolution depends on pulse rate and pulse width.',
  ],
  [
    'Acquisition magnification',
    'A smaller detector field or magnification mode. On flat-panel systems it may change detector sampling, binning, processing and exposure; it is distinct from display zoom.',
  ],
  [
    'Augmented fluoroscopy',
    'Live fluoroscopy with a registered target contour or segmentation, derived from an earlier CT or CBCT, projected onto it. The contour is not live lesion imaging.',
  ],
  [
    'Automatic exposure regulation',
    'System-specific adjustment of kV, mA, pulse width and filtration to hold the detector signal. Image brightness therefore does not report radiation output.',
  ],
  [
    'CBCT',
    'Cone-beam CT: projections acquired during a rotational C-arm spin and reconstructed into a volume for multiplanar review.',
  ],
  [
    'Collimation',
    'Physical restriction of the X-ray beam, which limits the irradiated field and scatter. Electronic cropping changes only the displayed image.',
  ],
  [
    'Concentric / eccentric view',
    'Radial EBUS patterns in which the lesion surrounds the probe (concentric) or lies predominantly to one side of it (eccentric).',
  ],
  [
    'CT-to-body divergence',
    'Mismatch between planning CT anatomy and the intraprocedural lung, from differences in lung volume, position, atelectasis, deformation and bleeding.',
  ],
  [
    'Display zoom',
    'Enlargement of acquired pixels on the monitor. Applied to a stored image, it adds no X-ray information and no exposure.',
  ],
  [
    'DTS',
    'Digital tomosynthesis: planes reconstructed from a limited-angle acquisition. Depth resolution depends on angular coverage; some platforms add prior-CT or model-based reconstruction.',
  ],
  [
    'Effective dose',
    'A tissue-weighted population-protection quantity in sieverts. It is not an individual skin-dose measurement.',
  ],
  [
    'Image lag',
    'Persistence of earlier frames from recursive filtering or frame averaging, so moving structures trail or ghost.',
  ],
  [
    'Isocenter',
    'The reference center of the C-arm’s rotation. The lesion must be positioned within the supported reconstruction volume.',
  ],
  [
    'KAP / DAP',
    'Kerma–area product, commonly called dose–area product: air kerma integrated over the beam area, often in Gy·cm².',
  ],
  [
    'Kₐ,r',
    'Cumulative reference air kerma, usually in mGy or Gy. An equipment-reference index, not the actual highest skin dose.',
  ],
  [
    'Last-image hold',
    'The final fluoroscopic frame retained on the monitor after the pedal is released, for review without further exposure.',
  ],
  [
    'Lesion conspicuity',
    'How distinctly a lesion stands out from surrounding anatomy; limited by superimposition, scatter and noise.',
  ],
  [
    'MIP',
    'Maximum-intensity projection: a slab display of the highest values along each viewing path. It can superimpose structures at different depths.',
  ],
  [
    'MPR',
    'Multiplanar reformation: review of a reconstructed volume in axial, coronal, sagittal or oblique planes.',
  ],
  [
    'Parallax',
    'A change in relative projected positions when the projection changes. If a stationary tool and a lesion separate after C-arm rotation, their earlier overlap was superimposition.',
  ],
  [
    'Peak skin dose',
    'The highest absorbed dose to any area of skin. Estimating it needs spatial dose and geometry information.',
  ],
  [
    'Pulse rate / pulse width',
    'How often new images are acquired / how long each exposure lasts. Neither is the display refresh rate.',
  ],
  [
    'Radial EBUS',
    'Ultrasound imaging around a radial probe: a concentric, eccentric or no lesional view. The probe is not the biopsy tool; after exchange, the tool may take a different path.',
  ],
  [
    'Registration',
    'The spatial mapping between datasets or coordinate systems. Equipment registration need not compensate for anatomical deformation.',
  ],
  [
    'Superimposition',
    'Overlap, in a single projection, of structures that lie at different depths.',
  ],
  [
    'Tool-in-lesion',
    'Imaging confirmation that the part of the biopsy tool that acquires tissue lies within the lesion. State the component, the planes and the acquisition; it is not a tissue diagnosis.',
  ],
] as const

export const MODALITIES = [
  {
    name: '2D fluoroscopy',
    information: 'Real-time projection',
    use: 'Orientation, tool advancement and projection-dependent relationships',
    limit: 'Superimposition and unresolved depth',
    lesson: 'two-dimensional',
  },
  {
    name: 'Radial EBUS',
    information: 'Local ultrasound view: concentric, eccentric or none',
    use: 'Lesion localization relative to the airway',
    limit:
      'Atelectasis can mimic a lesion; the biopsy tool may take a different path after probe exchange',
    lesson: 'two-dimensional',
  },
  {
    name: 'Digital tomosynthesis',
    information: 'Limited-angle reconstruction',
    use: 'Local tomographic imaging or a navigation target update, depending on the platform',
    limit: 'Depth resolution limited by angular coverage; possible prior-CT or model contribution',
    lesson: 'dts-acquisition',
  },
  {
    name: 'Fixed CBCT',
    information: 'Intraprocedural CBCT volume',
    use: 'Lesion localization and multiplanar tool-in-lesion confirmation in an installed suite',
    limit: 'Motion, metal artifact, room access and installation-specific integration',
    lesson: 'fixed-suite',
  },
  {
    name: 'Mobile CBCT',
    information: 'Intraprocedural CBCT volume',
    use: 'Volumetric confirmation with a mobile acquisition workflow',
    limit: 'Table and room compatibility; model-specific field of view and integration',
    lesson: 'mobile-suite',
  },
  {
    name: 'Augmented fluoroscopy',
    information: 'Registered prior segmentation on live fluoroscopy',
    use: 'Guidance while registration and the anatomy remain valid',
    limit: 'The contour is derived from an earlier acquisition, not live lesion imaging',
    lesson: 'changing-anatomy',
  },
]
