import { findMissingEvidenceRefs } from '../content/evidenceRegistry'
import {
  balloonExpandedMetalArchitecture,
  dynamicYArchitecture,
  freeCrossingBraidArchitecture,
  hookCrossCoveredArchitecture,
  laserCutCoveredArchitecture,
  metallicYArchitecture,
  siliconeYArchitecture,
  singleWireKnitArchitecture,
  solidSiliconeArchitecture,
} from './architectures'
import { stentExplorerControlsByStation } from './controls'
import type { StentExplorerStation, StentExplorerStationId } from './types'

export const stentExplorerStations: readonly StentExplorerStation[] = [
  {
    id: 'architecture-lumen',
    number: 1,
    category: 'foundation',
    shortLabel: 'Architecture & lumen',
    title: 'Compare lumen budgets at the same outer envelope',
    summary:
      'Hold the outer envelope constant, predict which construction preserves more circular lumen, then reveal the true-scale cross-section.',
    clinicalHook:
      'A treated central airway looks adequately opened, but the device itself must occupy part of that restored diameter. Compare three generic constructions before deciding what the airway actually gains.',
    architectureOptions: [
      solidSiliconeArchitecture,
      freeCrossingBraidArchitecture,
      hookCrossCoveredArchitecture,
      laserCutCoveredArchitecture,
      singleWireKnitArchitecture,
      balloonExpandedMetalArchitecture,
    ],
    defaultArchitectureId: 'solid-silicone',
    controls: stentExplorerControlsByStation['architecture-lumen'],
    phases: [
      {
        id: 'lumen-outer-envelope',
        label: 'Match outer diameter',
        instruction: 'Begin with the same outer circular envelope for each generic architecture.',
        textEquivalent:
          'All compared devices occupy the same modeled outer diameter; this is a geometric comparison, not a sizing recommendation.',
      },
      {
        id: 'lumen-reveal-wall',
        label: 'Reveal wall thickness',
        instruction:
          'Scrub to reveal how much of the outer envelope is occupied by the wall or scaffold.',
        textEquivalent:
          'A continuous silicone wall occupies more radial thickness in this qualitative comparison than either generic thin-wall scaffold.',
      },
      {
        id: 'lumen-compare-area',
        label: 'Compare open area',
        instruction:
          'Inspect inner diameter, the ID-to-OD ratio, and its squared lumen-area fraction.',
        textEquivalent:
          'For circular sections, the open-area fraction equals the square of the inner-to-outer diameter ratio; this does not calculate airflow.',
      },
    ],
    hotspots: [
      {
        id: 'outer-envelope',
        label: 'Outer envelope',
        description: 'The fixed same-OD reference used for the architecture comparison.',
      },
      {
        id: 'device-wall',
        label: 'Device wall',
        description:
          'The radial space occupied by the continuous wall or scaffold-and-cover layer.',
      },
      {
        id: 'open-lumen',
        label: 'Open lumen',
        description: 'The remaining circular inner diameter and area after wall occupancy.',
      },
    ],
    prediction: {
      question:
        'With outer diameter held constant, which construction leaves the smaller modeled inner lumen?',
      instruction: 'Commit a prediction before revealing the true-scale cross-section.',
      choices: [
        {
          id: 'continuous-wall-smaller-lumen',
          label: 'The thicker continuous-wall tube',
          rationale:
            'In this geometric model, greater wall thickness reduces inner diameter; the area fraction changes with the square of the ID-to-OD ratio.',
        },
        {
          id: 'same-lumen-at-same-od',
          label: 'All constructions have the same lumen',
          rationale:
            'Matching outer diameter does not match inner diameter when construction thickness differs.',
        },
        {
          id: 'thin-scaffold-smaller-lumen',
          label: 'The thinner scaffold construction',
          rationale:
            'A thinner modeled wall preserves more of the same outer envelope as open lumen.',
        },
      ],
      bestChoiceId: 'continuous-wall-smaller-lumen',
    },
    whatChanged: [
      'The outer envelope stayed fixed while construction thickness changed.',
      'Inner diameter and open cross-sectional area changed together.',
    ],
    whyItMatters: [
      'The airway diameter occupied by a device is not the same as the open lumen left for ventilation and secretion clearance.',
      'A small diameter-ratio change produces a larger proportional area change because area depends on the square of diameter.',
    ],
    inspect: [
      'Outer diameter reference',
      'Wall or cover thickness',
      'Inner diameter',
      'Open-area fraction',
    ],
    conceptualResponse: [
      'Compare the actual labeled inner and outer dimensions of the contemplated architecture.',
      'Integrate lumen budget with anatomy, mechanical job, secretion burden, removability, and operator judgment.',
    ],
    evidenceRefs: [
      'textbook-airway-stents-primer-2025',
      'textbook-silicone-stents-2025',
      'ratnovsky-airway-mechanics-2015',
    ],
    evidenceNote:
      'The supplied chapters support the qualitative wall-to-lumen tradeoff; the circular area relation is geometry.',
    evidenceBoundary:
      'The comparison is not an airflow model, device ranking, pressure calculation, or universal sizing rule. Finished geometry and the specific device construction still matter.',
    reducedMotionSummary:
      'Static cross-sections share one outer circle. The solid silicone example has the thickest modeled wall and therefore the lowest modeled inner-to-outer ratio and open-area fraction.',
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'metal-architecture',
    number: 2,
    category: 'foundation',
    shortLabel: 'Metal scaffold & material',
    title: 'Same diameter, different metallic architecture',
    summary:
      'Compare wire continuity, crossing or connector geometry, coverage, and expansion behavior under one qualitative constraint.',
    clinicalHook:
      'Two metallic airway stents share a nominal diameter, yet one changes length during release while another shows less visible diameter-length coupling in this qualitative scene. Inspect the construction before attributing the difference to a material name alone.',
    architectureOptions: [
      freeCrossingBraidArchitecture,
      hookCrossCoveredArchitecture,
      laserCutCoveredArchitecture,
      singleWireKnitArchitecture,
      balloonExpandedMetalArchitecture,
    ],
    defaultArchitectureId: 'free-crossing-braid',
    controls: stentExplorerControlsByStation['metal-architecture'],
    phases: [
      {
        id: 'metal-map-topology',
        label: 'Map the construction',
        instruction:
          'Identify continuous strands, mobile or captured crossings, discrete connectors, coverage transitions, and the expansion mechanism.',
        textEquivalent:
          'The baseline identifies the selected generic topology and material-expansion pairing without assigning comparative force, durability, or clinical superiority.',
      },
      {
        id: 'metal-apply-constraint',
        label: 'Apply the same constraint',
        instruction:
          'Scrub an amplified diameter, bend, or eccentric constraint and follow where the scaffold reconfigures.',
        textEquivalent:
          'Authored relative-motion cues show more crossing rotation in the free braid, less rotation around captured junction markers, loopwise deformation along the knitted strand, and localized deflection within ring connectors.',
      },
      {
        id: 'metal-release-constraint',
        label: 'Release and compare recovery',
        instruction:
          'Continue through release and compare return toward a programmed shape with retained balloon-set deformation.',
        textEquivalent:
          'The superelastic schematics recover toward their programmed geometry while the historical balloon-expanded reference retains more imposed deformation; neither behavior is a device ranking.',
      },
      {
        id: 'metal-inspect-interface',
        label: 'Inspect the interface',
        instruction:
          'Relate length change, local hinges, cover transitions, and exposed cells to ends, branches, contact, and later retrieval.',
        textEquivalent:
          'The consequence view connects topology to end excursion, local deformation, tissue-facing coverage, and potential structural hotspots without calculating force or risk.',
      },
    ],
    hotspots: [
      {
        id: 'wire-junctions',
        label: 'Crossings or junctions',
        description:
          'Distinguish mobile crossings from captured junctions before applying braid-angle reasoning.',
      },
      {
        id: 'ring-connectors',
        label: 'Ring connectors',
        description:
          'Discrete connectors transfer bending between laser-cut rings and may localize deformation.',
      },
      {
        id: 'continuous-strand',
        label: 'Continuous knitted strand',
        description:
          'One wire propagates loop deformation differently from a multiwire braid or linked rings.',
      },
      {
        id: 'coverage-transitions',
        label: 'Coverage transitions',
        description:
          'Full, partial, and absent covers create different body, transition, and end interfaces.',
      },
    ],
    prediction: {
      question:
        'What should you predict when the same radial constraint is applied to the free braid and the ring-and-connector reference?',
      instruction: 'Commit before the load-path and recovery layers are revealed.',
      choices: [
        {
          id: 'different-deformation-pathways',
          label: 'Different pathways: braid coupling versus connector hinging',
          rationale:
            'In these authored exemplars, mobile crossings permit visible diameter-length coupling while linked rings redistribute deformation through connectors. This is a load-path contrast, not a universal performance ranking.',
        },
        {
          id: 'same-diameter-same-motion',
          label: 'The same nominal diameter produces the same motion',
          rationale:
            'Nominal diameter does not specify wire continuity, junction mobility, connectors, coverage, material processing, or the constrained shape.',
        },
        {
          id: 'universal-force-ranking',
          label: 'One construction must always exert greater force',
          rationale:
            'This qualitative scene does not measure force and cannot establish a family-level stiffness or performance ranking.',
        },
      ],
      bestChoiceId: 'different-deformation-pathways',
    },
    whatChanged: [
      'The same imposed constraint appeared as relative crossing rotation, restriction at captured-node markers, connector deflection, or loopwise change along one continuous knitted strand.',
      'Constraint release separated qualitative superelastic recovery from the balloon-expanded reference while preserving topology-specific motion.',
    ],
    whyItMatters: [
      'Wire configuration can change diameter-length coupling, local hinging, deformation propagation, and where repeated loading concentrates.',
      'Material and expansion mechanism affect recovery, but cannot be interpreted apart from finished geometry, covering, airway constraint, and device-specific processing.',
    ],
    inspect: [
      'Wire continuity and crossing or connector type',
      'Diameter-length and end-position change',
      'Coverage body, transitions, and exposed ends',
      'Local deformation, recovery, and tissue contact',
    ],
    conceptualResponse: [
      'Match the mechanical job to the complete architecture rather than choosing by metal or cover label alone.',
      'Use device-specific dimensions, instructions, evidence, anatomy, retrieval horizon, and specialist judgment for any real selection.',
    ],
    evidenceRefs: [
      'textbook-sems-2025',
      'textbook-airway-stents-primer-2025',
      'ratnovsky-airway-mechanics-2015',
      'mckenna-covered-braid-2021',
      'pelton-nitinol-fatigue-2008',
      'fda-bonastent-k140472',
      'fda-ultraflex-k230269',
      'merit-aero-official',
    ],
    evidenceNote:
      'The supplied chapters support material, expansion, and coverage distinctions. Regulatory and manufacturer sources constrain topology; airway bench and transferred engineering evidence support only qualitative load-path teaching.',
    evidenceBoundary:
      'No universal force, stiffness, foreshortening, recovery, fatigue-life, removability, or device-ranking rule is encoded. Relative displacement amplitudes are authored visual contrasts, not measured cross-device differences. The stainless-steel view is a historical balloon-expanded construction reference, not an alloy comparison with topology held constant. Tantalum and cobalt-alloy examples are acknowledged in the source chapters but are not independent sliders because topology, processing, and expansion mechanism were not isolated.',
    reducedMotionSummary:
      'A keyboard-operable static-state selector exposes baseline, representative loaded, and recovered or retained-set views for the free multiwire braid, captured covered braid, laser-cut ring-and-connector lattice, partially covered single-wire knit, and balloon-expanded metal reference.',
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'cough-motion',
    number: 3,
    category: 'foundation',
    shortLabel: 'Cough & motion',
    title: 'Track what moves during a cough-like pulse',
    summary:
      'Use fixed markers to compare device-end and airway relationships during one qualitative displacement pulse.',
    clinicalHook:
      'A patient has repetitive cough and a device spanning a moving central-airway segment. Symptoms vary with motion, but a resting image is unrevealing. Mark both device ends and nearby branches, then predict what the pulse will make visible.',
    architectureOptions: [
      solidSiliconeArchitecture,
      freeCrossingBraidArchitecture,
      hookCrossCoveredArchitecture,
      laserCutCoveredArchitecture,
      singleWireKnitArchitecture,
    ],
    defaultArchitectureId: 'free-crossing-braid',
    controls: stentExplorerControlsByStation['cough-motion'],
    phases: [
      {
        id: 'cough-rest',
        label: 'Inspect resting fit',
        instruction: 'Mark both device ends and the central curve before applying motion.',
        textEquivalent:
          'The resting scene shows fixed airway landmarks, the device ends, and its construction-specific load path.',
      },
      {
        id: 'cough-pulse',
        label: 'Apply cough-like displacement',
        instruction: 'Scrub through one amplified displacement pulse and follow the end markers.',
        textEquivalent:
          'The braid changes diameter and length through crossing geometry, while the solid wall primarily slides, bends, or straightens in this schematic.',
      },
      {
        id: 'cough-reinspect',
        label: 'Reinspect interfaces',
        instruction: 'Compare end excursion, focal contact, gaps, and branch relationships.',
        textEquivalent:
          'Relative end motion and contact are visible contributors to inspect; no tissue outcome is inferred from one motion cycle.',
      },
    ],
    hotspots: [
      {
        id: 'proximal-end-marker',
        label: 'Proximal end',
        description: 'A fixed airway marker makes relative end excursion visible.',
      },
      {
        id: 'distal-end-marker',
        label: 'Distal end',
        description: 'Inspect whether length coupling or sliding changes the distal relationship.',
      },
      {
        id: 'crossing-or-wall',
        label: 'Architecture load path',
        description: 'Compare mobile braid crossings with deformation of a continuous solid wall.',
      },
    ],
    prediction: {
      question: 'What should you expect during the same qualitative cough-like displacement?',
      instruction: 'Choose before playing the animation; this check is optional and unscored.',
      choices: [
        {
          id: 'architecture-specific-motion',
          label: 'Different motion paths for different finished architectures',
          rationale:
            'Braid crossing geometry can couple diameter and length, whereas a continuous wall may slide, straighten, bend, or gap. Finished design matters beyond material labels.',
        },
        {
          id: 'all-foreshorten-identically',
          label: 'Every stent foreshortens identically',
          rationale:
            'That transfers one architecture model to all devices and ignores continuous-wall and non-sliding constructions.',
        },
        {
          id: 'no-interface-motion',
          label: 'No device-airway interface moves',
          rationale:
            'The schematic intentionally exposes relative motion; its amplitude is illustrative rather than physiologic.',
        },
      ],
      bestChoiceId: 'architecture-specific-motion',
    },
    whatChanged: [
      'Mobile braid crossings coupled visible diameter and length change.',
      'The solid wall instead showed amplified sliding, bending, or straightening.',
    ],
    whyItMatters: [
      'Architecture-specific end excursion can change contact and adjacent-orifice relationships.',
      'Mechanical motion is only one part of a multifactorial tissue-response pathway that also includes secretions or infection, time, surface factors, and host biology.',
    ],
    inspect: [
      'Proximal and distal end excursion',
      'Focal contact',
      'Gapping',
      'Adjacent branch orifices',
    ],
    conceptualResponse: [
      'Inspect the entire device and both ends rather than inferring behavior from a material label.',
      'If symptoms change, integrate position, patency, secretions or infection, tissue response, and the ongoing indication.',
    ],
    evidenceRefs: [
      'ratnovsky-airway-mechanics-2015',
      'mckenna-covered-braid-2021',
      'ost-infection-granulation-2012',
      'gupta-granulation-review-2025',
    ],
    evidenceNote:
      'Airway bench evidence supports architecture-specific mechanics; generic braid evidence is transferred only for geometry. Observational and review evidence frame tissue response as multifactorial.',
    evidenceBoundary:
      'The pulse is amplified qualitative displacement, not measured cough force. No causal path from a cough event to granulation, an individual risk estimate, or a product ranking is asserted.',
    reducedMotionSummary:
      'Three static poses show baseline, peak displacement, and recovery. End markers reveal braid length coupling versus solid-wall sliding or straightening, while the tissue-response boundary remains multifactorial.',
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'curve-buckle',
    number: 4,
    category: 'failure',
    shortLabel: 'Curve, buckle & kink',
    title: 'When a straight device meets a curved mainstem',
    summary:
      'Compare what can change along the device-airway relationship even when one end view looks acceptable.',
    clinicalHook:
      'A straight silicone tube traverses a curved left mainstem. Immediate inspection appears acceptable at one end, yet the patient has persistent lobar compromise; before rotating the view, choose which relationship you most need to interrogate.',
    architectureOptions: [
      solidSiliconeArchitecture,
      freeCrossingBraidArchitecture,
      hookCrossCoveredArchitecture,
      laserCutCoveredArchitecture,
      singleWireKnitArchitecture,
    ],
    defaultArchitectureId: 'solid-silicone',
    controls: stentExplorerControlsByStation['curve-buckle'],
    phases: [
      {
        id: 'curve-baseline',
        label: 'Align centerlines',
        instruction: 'Compare the airway curve, device axis, landing zones, and branch origin.',
        textEquivalent:
          'The straight device axis does not fully match the modeled curved mainstem centerline.',
      },
      {
        id: 'curve-load',
        label: 'Apply curve constraint',
        instruction:
          'Scrub the constraint while watching inner-curve contact and outer-curve gapping.',
        textEquivalent:
          'The solid wall tends to straighten within the curve, shifting contact and creating a visible gap.',
      },
      {
        id: 'curve-consequence',
        label: 'Inspect the functional lumen',
        instruction:
          'Switch to cutaway or endoscopic view to find inward folding and branch crowding.',
        textEquivalent:
          'The consequence pose shows central inward buckling with qualitative lumen loss and crowding near a branch origin.',
      },
    ],
    hotspots: [
      {
        id: 'inner-curve-contact',
        label: 'Inner-curve contact',
        description: 'Focal contact increases where the device attempts to straighten.',
      },
      {
        id: 'outer-curve-gap',
        label: 'Outer-curve gap',
        description: 'A visible loss of apposition can become a secretion pocket.',
      },
      {
        id: 'central-involution',
        label: 'Central involution',
        description: 'The solid wall folds inward and reduces the visible minor-axis lumen.',
      },
      {
        id: 'branch-origin',
        label: 'Branch origin',
        description: 'Inspect whether deformation or end position crowds an adjacent orifice.',
      },
    ],
    prediction: {
      question:
        'Which finding is most important to seek when a straight solid tube meets a curved mainstem?',
      instruction: 'Commit before revealing the cutaway consequence pose.',
      choices: [
        {
          id: 'central-buckle-and-end-fit',
          label: 'Central inward buckling plus end and branch relationships',
          rationale:
            'A continuous wall can straighten or involute in a curve, so central patency and both ends need direct inspection.',
        },
        {
          id: 'braid-angle-only',
          label: 'Braid angle alone',
          rationale:
            'A molded continuous wall has no mobile braid crossings; its curve response must be inspected on its own terms.',
        },
        {
          id: 'proximal-end-only',
          label: 'Only the proximal end',
          rationale:
            'A single end view can miss central involution, outer-curve gapping, and distal branch compromise.',
        },
      ],
      bestChoiceId: 'central-buckle-and-end-fit',
    },
    whatChanged: [
      'Curve mismatch shifted contact toward the inner curve and opened an outer-curve gap.',
      'The continuous wall folded inward centrally and narrowed the modeled lumen.',
    ],
    whyItMatters: [
      'A nominal diameter does not guarantee the same functional lumen after deformation.',
      'Central involution, gaps, and end position can affect patency, secretion clearance, and branch preservation.',
    ],
    inspect: [
      'Entire device lumen',
      'Inner-curve contact',
      'Outer-curve gap',
      'Distal branch origin',
    ],
    conceptualResponse: [
      'Reassess anatomy, device geometry, position, and ongoing mechanical job rather than treating the visible fold alone.',
      'Conceptual options include repositioning, removal, or a different fit strategy under specialist judgment and applicable instructions.',
    ],
    evidenceRefs: [
      'textbook-silicone-stents-2025',
      'textbook-airway-stents-primer-2025',
      'ratnovsky-airway-mechanics-2015',
    ],
    evidenceNote:
      'The supplied silicone and primer chapters support qualitative straightening, angulation, and central involution teaching; bench evidence reinforces that finished geometry changes mechanics.',
    evidenceBoundary:
      'The curvature, deformation amplitude, and lumen loss are illustrative. They are not a buckling threshold, airflow estimate, mucosal-pressure calculation, or patient-specific prediction.',
    reducedMotionSummary:
      'Static baseline and loaded cutaways show a straight solid tube constrained by a curved airway: inner-curve contact rises, an outer gap appears, and the central wall folds inward near a branch.',
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'migration',
    number: 5,
    category: 'failure',
    shortLabel: 'Migration',
    title: 'Is the device still where it started?',
    summary:
      'Compare the device before and after changing obstruction, then decide whether target and branch relationships changed.',
    clinicalHook:
      'After treatment changes an obstructing lesion, a follow-up image of a previously stable stent looks different from baseline. Decide how to separate true device movement from a changed camera view and which airway relationships must be rechecked.',
    architectureOptions: [
      solidSiliconeArchitecture,
      freeCrossingBraidArchitecture,
      hookCrossCoveredArchitecture,
      laserCutCoveredArchitecture,
      singleWireKnitArchitecture,
      balloonExpandedMetalArchitecture,
    ],
    defaultArchitectureId: 'solid-silicone',
    controls: stentExplorerControlsByStation.migration,
    phases: [
      {
        id: 'migration-baseline',
        label: 'Establish the first view',
        instruction:
          'Inspect the device, airway wall, treated lesion, and branch origins from the initial camera angle.',
        textEquivalent:
          'The baseline records the starting device-airway relationship without interpreting a later apparent change.',
      },
      {
        id: 'migration-loss-apposition',
        label: 'Reduce apposition',
        instruction:
          'Model qualitative undersizing or changing obstruction without assigning a universal threshold.',
        textEquivalent:
          'A visible circumferential gap develops as the modeled device-airway apposition decreases.',
      },
      {
        id: 'migration-displacement',
        label: 'Follow displacement',
        instruction: 'Scrub the device relative to the unchanged airway and branch markers.',
        textEquivalent:
          'The device shifts from its original landing zone, changing coverage and its relationship to an adjacent branch.',
      },
    ],
    hotspots: [
      {
        id: 'baseline-landing-zone',
        label: 'Original landing zone',
        description: 'A fixed reference distinguishes device motion from camera motion.',
      },
      {
        id: 'apposition-gap',
        label: 'Apposition gap',
        description:
          'Inspect the space between the device and the airway wall before displacement.',
      },
      {
        id: 'new-device-end',
        label: 'New end position',
        description: 'Compare the migrated end with lesion margins and branch landmarks.',
      },
    ],
    prediction: {
      question: 'What makes migration visible most reliably in this qualitative scene?',
      instruction: 'Commit before the comparison overlays are revealed.',
      choices: [
        {
          id: 'fixed-landmark-comparison',
          label: 'Compare both ends with fixed airway landmarks',
          rationale:
            'Landmarks separate true device displacement from camera movement and reveal changed lesion or branch coverage.',
        },
        {
          id: 'device-shape-alone',
          label: 'Judge device shape without landmarks',
          rationale:
            'Shape alone cannot establish that the device changed position within the airway.',
        },
        {
          id: 'material-label-alone',
          label: 'Infer migration from the material label',
          rationale:
            'Migration depends on fit, anatomy, obstruction evolution, position, and finished architecture rather than material name alone.',
        },
      ],
      bestChoiceId: 'fixed-landmark-comparison',
    },
    whatChanged: [
      'Modeled apposition decreased before the device changed position.',
      'The ends shifted relative to fixed landing-zone and branch landmarks.',
    ],
    whyItMatters: [
      'Displacement can uncover the target obstruction or crowd a previously patent airway.',
      'The mechanism may include sizing and fit, changing obstruction, airway motion, or architecture-specific anchoring.',
    ],
    inspect: [
      'Both device ends',
      'Target lesion coverage',
      'Adjacent orifices',
      'Patency and secretion burden',
    ],
    conceptualResponse: [
      'Confirm position and airway consequence before choosing a response.',
      'Reassess the indication and fit; specialist options may include repositioning, removal, or replacement when appropriate.',
    ],
    evidenceRefs: [
      'textbook-stent-placement',
      'textbook-silicone-stents-2025',
      'textbook-sems-2025',
      'textbook-airway-stents-primer-2025',
    ],
    evidenceNote:
      'The supplied chapters describe migration across stent families and emphasize position, fit, changing anatomy, verification, and response planning.',
    evidenceBoundary:
      'No universal oversizing percentage, migration probability, timing threshold, or architecture ranking is encoded. The displacement is qualitative.',
    reducedMotionSummary:
      'Three static states show the original landing zone, reduced circumferential apposition, and a shifted device end relative to unchanged airway and branch markers.',
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'mucus-obstruction',
    number: 6,
    category: 'failure',
    shortLabel: 'Mucus obstruction',
    title: 'New symptoms despite a device that remains in place',
    summary:
      'Use sequential external and endoluminal views to distinguish among competing explanations for recurrent narrowing.',
    clinicalHook:
      'A patient returns with new dyspnea and productive cough after initial improvement. The device appears unchanged on the first view; before revealing the endoluminal sequence, choose the inspection strategy that best characterizes the new obstruction.',
    architectureOptions: [
      solidSiliconeArchitecture,
      freeCrossingBraidArchitecture,
      hookCrossCoveredArchitecture,
      laserCutCoveredArchitecture,
      singleWireKnitArchitecture,
      siliconeYArchitecture,
    ],
    defaultArchitectureId: 'hook-cross-covered',
    controls: stentExplorerControlsByStation['mucus-obstruction'],
    phases: [
      {
        id: 'mucus-coating',
        label: 'Surface coating',
        instruction: 'Inspect the inner surface and any transitions at the device ends.',
        textEquivalent: 'A thin secretion layer coats part of the inner device surface.',
      },
      {
        id: 'mucus-pocket',
        label: 'Retention pocket',
        instruction: 'Reveal a dependent pocket at a gap, bend, or bifurcation.',
        textEquivalent:
          'Secretions accumulate in a modeled low-clearance pocket associated with local geometry.',
      },
      {
        id: 'mucus-plug',
        label: 'Lumen compromise',
        instruction: 'Switch to endoscopic and cross-section views to inspect the residual lumen.',
        textEquivalent:
          'A focal plug occupies much of the modeled lumen; distal inflammatory context is signaled without assigning a diagnosis.',
      },
    ],
    hotspots: [
      {
        id: 'inner-surface-coating',
        label: 'Inner surface',
        description: 'Inspect the device lumen for coating and impaired clearance.',
      },
      {
        id: 'retention-pocket',
        label: 'Retention pocket',
        description: 'A gap or geometry transition can shelter retained secretions.',
      },
      {
        id: 'residual-lumen',
        label: 'Residual lumen',
        description: 'End-on inspection shows the remaining open pathway around the plug.',
      },
      {
        id: 'distal-airway-context',
        label: 'Distal airway',
        description: 'Inspect distal patency and clinical evidence of infection or obstruction.',
      },
    ],
    prediction: {
      question: 'Which inspection best characterizes this complication?',
      instruction: 'Commit before the endoscopic view is revealed.',
      choices: [
        {
          id: 'entire-lumen-and-distal-context',
          label: 'Inspect the full lumen, pockets, and distal airway',
          rationale:
            'The clinically relevant finding includes plug burden, residual patency, geometry that retains secretions, and distal consequences.',
        },
        {
          id: 'outer-surface-only',
          label: 'Inspect only the outer device surface',
          rationale: 'External appearance can miss a major intraluminal secretion burden.',
        },
        {
          id: 'assume-tumor',
          label: 'Assume every new opacity is tumor',
          rationale:
            'New symptoms require a differential that includes secretions, infection, tissue response, migration, and recurrent obstruction.',
        },
      ],
      bestChoiceId: 'entire-lumen-and-distal-context',
    },
    whatChanged: [
      'A thin secretion layer accumulated in a modeled retention pocket.',
      'The pocket progressed to a plug that reduced the visible functional lumen.',
    ],
    whyItMatters: [
      'Device surfaces and geometric pockets can interfere with mucociliary clearance.',
      'Obstruction and infection context should be evaluated together without assuming either from animation alone.',
    ],
    inspect: [
      'Inner surface',
      'Retention pockets',
      'Residual lumen',
      'Distal airway and infection evidence',
    ],
    conceptualResponse: [
      'Restore patency and assess secretion or infectious contributors under appropriate clinical supervision.',
      'Reassess position, fit, airway clearance strategy, and whether the device still has a defined mechanical job.',
    ],
    evidenceRefs: [
      'textbook-stent-placement',
      'textbook-silicone-stents-2025',
      'textbook-y-stenting-2025',
      'textbook-airway-stents-primer-2025',
    ],
    evidenceNote:
      'The supplied placement, silicone, Y-stenting, and primer chapters describe secretion retention, mucus obstruction, infection context, and reassessment.',
    evidenceBoundary:
      'The secretion sequence is a qualitative teaching progression, not a predicted time course, clearance calculation, infection diagnosis, or management protocol.',
    reducedMotionSummary:
      'Static cutaways show partial inner-surface coating, a dependent retention pocket, and a larger plug leaving a narrowed residual lumen with distal context to inspect.',
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'granulation',
    number: 7,
    category: 'failure',
    shortLabel: 'Granulation',
    title: 'Interrogate new tissue at the device-airway interface',
    summary:
      'Map directly observable tissue and lumen findings, then compare competing explanations for the interface change.',
    clinicalHook:
      'At follow-up, tissue narrows the lumen near a device end. Document its location, extent, remaining lumen, and surrounding airway, then use the layered scene to test three competing interpretations of what those observations mean.',
    architectureOptions: [
      solidSiliconeArchitecture,
      freeCrossingBraidArchitecture,
      hookCrossCoveredArchitecture,
      laserCutCoveredArchitecture,
      singleWireKnitArchitecture,
    ],
    defaultArchitectureId: 'solid-silicone',
    controls: stentExplorerControlsByStation.granulation,
    phases: [
      {
        id: 'granulation-interface',
        label: 'Map the interface',
        instruction:
          'Inspect the tissue location, device end, and remaining lumen before adding explanatory overlays.',
        textEquivalent:
          'The baseline marks directly observable tissue, device, and airway relationships without choosing an explanation.',
      },
      {
        id: 'granulation-contributors',
        label: 'Layer contributors',
        instruction:
          'Add secretions or infection context, dwell time, surface factors, and host response.',
        textEquivalent:
          'Mechanical, infectious-secretory, time, surface, and host domains are shown together; none is treated as sufficient alone.',
      },
      {
        id: 'granulation-encroachment',
        label: 'Reveal tissue encroachment',
        instruction:
          'Inspect location, extent, residual lumen, and the device beyond the visible tissue.',
        textEquivalent:
          'Progressive generic tissue encroachment appears near the end contact region and narrows the modeled lumen.',
      },
    ],
    hotspots: [
      {
        id: 'device-end-contact',
        label: 'End contact',
        description:
          'Inspect focal contact, fit, and relative motion at the tissue-device interface.',
      },
      {
        id: 'secretion-biofilm-context',
        label: 'Secretory context',
        description:
          'Look for retained secretions and clinical evidence of infection or biofilm-related burden.',
      },
      {
        id: 'tissue-margin',
        label: 'Tissue margin',
        description:
          'Define the location and extent of tissue encroachment rather than labeling it from color alone.',
      },
      {
        id: 'remaining-lumen',
        label: 'Remaining lumen',
        description:
          'Inspect the functional lumen and downstream airway beyond the visible lesion.',
      },
    ],
    prediction: {
      question: 'Which context is most important before interpreting why this tissue appeared?',
      instruction: 'Commit before all contributor layers are revealed.',
      choices: [
        {
          id: 'multidomain-context',
          label: 'Fit or contact, motion, secretions or infection, time, and host context together',
          rationale:
            'Tissue response is multifactorial. These domains organize inspection and hypotheses without assigning individual causality, probability, or the effect size of one factor.',
        },
        {
          id: 'tissue-color-alone',
          label: 'Tissue color alone',
          rationale:
            'Visual appearance alone does not establish pathology, mechanism, or the relative contribution of mechanical and infectious-secretory factors.',
        },
        {
          id: 'diameter-association-universal',
          label: 'One diameter association treated as a universal rule',
          rationale:
            'The reported Dumon diameter association is study-specific and cannot be converted into a universal sizing rule or individual prediction.',
        },
      ],
      bestChoiceId: 'multidomain-context',
    },
    whatChanged: [
      'Multiple contributor domains accumulated around one device-tissue interface.',
      'Generic tissue encroachment reduced the modeled lumen near the device end.',
    ],
    whyItMatters: [
      'Treating only visible tissue can miss infection or secretions, fit, position, architecture, and the continuing indication.',
      'Observational associations should guide inspection and hypothesis generation, not individual risk prediction.',
    ],
    inspect: [
      'Tissue location and extent',
      'Device ends and position',
      'Secretions or infection',
      'Ongoing indication and exit plan',
    ],
    conceptualResponse: [
      'Restore airway patency as clinically appropriate while evaluating secretion or infectious contributors.',
      'Reassess fit, position, architecture, dwell context, ongoing indication, and an exit or follow-up plan.',
    ],
    evidenceRefs: [
      'ost-infection-granulation-2012',
      'hu-granulation-diameter-2011',
      'gupta-granulation-review-2025',
      'textbook-airway-stents-primer-2025',
    ],
    evidenceNote:
      'Ost and Hu provide observational associations in defined cohorts; the contemporary review and supplied primer support a multifactorial mechanistic framework.',
    evidenceBoundary:
      'The scene is not a causal score or patient-level prediction. The reported Dumon diameter association remains study-specific and is not encoded as a universal percentage or sizing rule.',
    reducedMotionSummary:
      'A static layered diagram links a device-end contact region with relative motion, secretions or infection, time, surface factors, and host response before showing generic tissue narrowing the lumen.',
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'tumor-ingrowth-overgrowth',
    number: 8,
    category: 'failure',
    shortLabel: 'Tumor ingrowth & overgrowth',
    title: 'Map where recurrent tissue meets the device',
    summary:
      'Map recurrent tissue relative to the scaffold body, covering, device margins, and remaining lumen.',
    clinicalHook:
      'A malignant obstruction returns after initial stent patency. New tissue is visible, but one view does not establish its route through the device-airway interface. Compare construction and location while keeping mucus, granulation, and migration in the differential.',
    architectureOptions: [
      freeCrossingBraidArchitecture,
      singleWireKnitArchitecture,
      hookCrossCoveredArchitecture,
      laserCutCoveredArchitecture,
      balloonExpandedMetalArchitecture,
      solidSiliconeArchitecture,
    ],
    defaultArchitectureId: 'free-crossing-braid',
    controls: stentExplorerControlsByStation['tumor-ingrowth-overgrowth'],
    phases: [
      {
        id: 'tumor-baseline',
        label: 'Inspect construction',
        instruction: 'Identify open cells, a cover barrier, and both device ends.',
        textEquivalent:
          'The baseline contrasts an uncovered open-cell scaffold with covered and continuous-wall alternatives.',
      },
      {
        id: 'tumor-pathway',
        label: 'Reveal the growth path',
        instruction:
          'Scrub tissue toward the cells or around an end according to the selected architecture.',
        textEquivalent:
          'Generic tumor passes through open cells in the uncovered model or advances around the end of a covered barrier.',
      },
      {
        id: 'tumor-lumen',
        label: 'Inspect recurrent narrowing',
        instruction: 'Use cutaway and endoscopic views to map tissue location and residual lumen.',
        textEquivalent:
          'The modeled tissue encroaches on the lumen by an architecture-dependent route; pathology is not diagnosed by appearance alone.',
      },
    ],
    hotspots: [
      {
        id: 'open-scaffold-cells',
        label: 'Open cells',
        description: 'An uncovered pathway permits tissue to extend between scaffold elements.',
      },
      {
        id: 'cover-barrier',
        label: 'Cover barrier',
        description:
          'Inspect cover continuity without treating it as absolute protection from restenosis.',
      },
      {
        id: 'device-end-margin',
        label: 'Device end',
        description:
          'Covered architectures can still be compromised by tissue growing around an end.',
      },
      {
        id: 'recurrent-lumen',
        label: 'Recurrent narrowing',
        description:
          'End-on inspection maps the location and severity of modeled lumen encroachment.',
      },
    ],
    prediction: {
      question: 'How does coverage most directly change the modeled tumor pathway?',
      instruction: 'Choose before toggling from uncovered to covered architecture.',
      choices: [
        {
          id: 'path-through-versus-around',
          label: 'Through open cells versus around a covered end',
          rationale:
            'A cover changes the available pathway through the device body but does not guarantee freedom from end overgrowth or other obstruction.',
        },
        {
          id: 'covered-prevents-all-growth',
          label: 'Coverage prevents all recurrent growth',
          rationale:
            'Covered constructions can still be affected by overgrowth at their ends and by other obstruction mechanisms.',
        },
        {
          id: 'coverage-no-effect',
          label: 'Coverage never changes the tissue pathway',
          rationale:
            'An intact barrier changes whether tissue can pass directly through the modeled scaffold body.',
        },
      ],
      bestChoiceId: 'path-through-versus-around',
    },
    whatChanged: [
      'Uncovered cells provided a modeled pathway into the device body.',
      'A cover redirected the modeled pathway toward the device end rather than eliminating recurrence.',
    ],
    whyItMatters: [
      'The location of recurrent tissue helps frame ingrowth, overgrowth, granulation, mucus, and migration in the differential.',
      'Coverage is an architecture tradeoff, not absolute protection or a universal recommendation.',
    ],
    inspect: [
      'Cell or cover continuity',
      'Both device ends',
      'Tissue distribution',
      'Residual lumen and distal airway',
    ],
    conceptualResponse: [
      'Confirm the obstruction mechanism and pathology context rather than relying on surface appearance alone.',
      'Restore patency as appropriate and reassess the ongoing device, disease, and treatment strategy with a multidisciplinary team.',
    ],
    evidenceRefs: ['textbook-sems-2025', 'textbook-airway-stents-primer-2025'],
    evidenceNote:
      'The supplied SEMS and primer chapters support the architectural distinction between uncovered ingrowth and covered-device end overgrowth.',
    evidenceBoundary:
      'The tissue is generic and qualitative. The scene does not diagnose malignancy, predict growth rate, guarantee cover integrity, or recommend a device for an individual patient.',
    reducedMotionSummary:
      'Static cutaways show generic tissue extending through open cells of an uncovered scaffold and, in the covered comparison, advancing around a device end while the body barrier remains intact.',
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'fracture-cover-failure',
    number: 9,
    category: 'failure',
    shortLabel: 'Fracture & cover failure',
    title: 'Localize a new structural abnormality',
    summary:
      'Compare airway geometry, scaffold continuity, cover continuity, and focal lumen effects before assigning a mechanism.',
    clinicalHook:
      'A patient with a metallic scaffold develops recurrent focal obstruction and a new contour abnormality on follow-up. Decide which airway, scaffold, and covering findings should be compared before attributing the change to one loading event.',
    architectureOptions: [
      freeCrossingBraidArchitecture,
      hookCrossCoveredArchitecture,
      laserCutCoveredArchitecture,
      singleWireKnitArchitecture,
      balloonExpandedMetalArchitecture,
    ],
    defaultArchitectureId: 'laser-cut-covered',
    controls: stentExplorerControlsByStation['fracture-cover-failure'],
    phases: [
      {
        id: 'fracture-curve',
        label: 'Establish the geometry',
        instruction:
          'Inspect the airway path, scaffold continuity, cover, and adjacent tissue before the loading sequence.',
        textEquivalent:
          'The baseline shows an intact generic segmented scaffold within a non-straight schematic airway.',
      },
      {
        id: 'fracture-hotspot',
        label: 'Reveal the hotspot',
        instruction: 'Scrub accumulated qualitative loading and inspect wire and cover separately.',
        textEquivalent:
          'A structural hotspot becomes visible at the curve; no cycle count or fatigue threshold is assigned.',
      },
      {
        id: 'fracture-consequence',
        label: 'Inspect failure consequences',
        instruction:
          'Compare wire discontinuity, cover tear, focal tissue contact, and lumen compromise.',
        textEquivalent:
          'The final pose shows either a wire discontinuity or cover tear with generic focal obstruction or tissue-contact consequences.',
      },
    ],
    hotspots: [
      {
        id: 'tortuous-curve',
        label: 'Tortuous curve',
        description: 'Inspect where airway geometry repeatedly bends the scaffold.',
      },
      {
        id: 'wire-hotspot',
        label: 'Wire hotspot',
        description:
          'A generic localized structural discontinuity appears after qualitative repeated loading.',
      },
      {
        id: 'cover-tear',
        label: 'Cover tear',
        description: 'Inspect the barrier independently from the underlying scaffold.',
      },
      {
        id: 'focal-lumen-effect',
        label: 'Focal consequence',
        description: 'Broken or deformed structure can crowd the lumen or alter tissue contact.',
      },
    ],
    prediction: {
      question: 'Which explanation is best supported for the fracture scene?',
      instruction: 'Commit before the structural hotspot is revealed.',
      choices: [
        {
          id: 'tortuosity-repeated-loading',
          label: 'Tortuosity plus repeated architecture-specific loading',
          rationale:
            'A retrospective airway cohort identified tortuosity as an associated factor; general fatigue concepts help explain localization but do not predict an individual failure.',
        },
        {
          id: 'cough-alone',
          label: 'Cough alone determines fracture',
          rationale:
            'The available evidence does not support a single-cause rule, universal cycle threshold, or patient-level prediction.',
        },
        {
          id: 'all-designs-same',
          label: 'Every scaffold fails in the same way',
          rationale:
            'Finished geometry, wire path, cover, airway constraint, and device-specific construction influence load localization.',
        },
      ],
      bestChoiceId: 'tortuosity-repeated-loading',
    },
    whatChanged: [
      'Repeated qualitative bending localized at the modeled airway curve.',
      'The scaffold developed a wire discontinuity or a separate cover defect with a focal lumen consequence.',
    ],
    whyItMatters: [
      'Fracture and cover failure are distinct findings that can change obstruction, tissue contact, and removal planning.',
      'Tortuosity is an observational association, not an individual fracture forecast.',
    ],
    inspect: [
      'High-curvature segments',
      'Wire continuity',
      'Cover continuity',
      'Focal lumen and tissue effects',
    ],
    conceptualResponse: [
      'Define the structural problem and airway consequence before planning specialist retrieval, removal, or replacement.',
      'Review the ongoing indication, device-specific instructions, imaging, and bronchoscopic findings together.',
    ],
    evidenceRefs: [
      'chung-airway-fracture-2008',
      'pelton-nitinol-fatigue-2008',
      'textbook-sems-2025',
      'ratnovsky-airway-mechanics-2015',
    ],
    evidenceNote:
      'Chung provides retrospective airway-specific associations, including tortuosity; Pelton supplies a general fatigue framework, and the other sources constrain architecture-specific interpretation.',
    evidenceBoundary:
      'No cough-only mechanism, fatigue cycle count, dwell threshold, failure probability, or cross-device ranking is modeled. The fracture and cover tear are generic qualitative states.',
    reducedMotionSummary:
      'Static views mark a tortuous airway curve, a generic scaffold hotspot, and a final structural discontinuity or cover tear with focal lumen and tissue-interface consequences.',
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'y-stent',
    number: 10,
    category: 'carina',
    shortLabel: 'Carina & Y-stent fit',
    title: 'A whole-Y must fit more than one airway segment',
    summary:
      'Test how a bifurcated device aligns across the carina and how a mismatch changes downstream clearance.',
    clinicalHook:
      'A whole-Y stent appears acceptable in the trachea, yet a downstream region remains narrowed and secretions recur. Predict which additional relationships must be inspected before calling the bifurcation fit acceptable.',
    architectureOptions: [siliconeYArchitecture, dynamicYArchitecture, metallicYArchitecture],
    defaultArchitectureId: 'silicone-y',
    controls: stentExplorerControlsByStation['y-stent'],
    phases: [
      {
        id: 'y-align-saddle',
        label: 'Establish the bifurcation view',
        instruction:
          'Inspect the trachea, carinal region, and main bronchi before changing the device-airway relationship.',
        textEquivalent:
          'The baseline records a generic bifurcation and device from the external view without interpreting the downstream compromise.',
      },
      {
        id: 'y-load-motion',
        label: 'Apply branch and posterior motion',
        instruction:
          'Scrub branch-angle mismatch and posterior-wall movement while watching the saddle.',
        textEquivalent:
          'The device and airway move differently at the saddle and branch angles; the dynamic schematic shows greater posterior accommodation.',
      },
      {
        id: 'y-inspect-orifices',
        label: 'Inspect distal orifices',
        instruction: 'Reveal secretion pockets and distal-orifice compromise in cutaway view.',
        textEquivalent:
          'A mismatched limb crowds a distal branch and a low-clearance pocket appears near the carinal saddle.',
      },
    ],
    hotspots: [
      {
        id: 'carinal-saddle',
        label: 'Carinal saddle',
        description: 'Inspect contact, orientation, and gaps at the bifurcation ridge.',
      },
      {
        id: 'posterior-wall',
        label: 'Posterior wall',
        description: 'Compare posterior movement with the selected bifurcated architecture.',
      },
      {
        id: 'limb-ends',
        label: 'Limb ends',
        description: 'Assess diameter, length, angulation, and relationship to distal orifices.',
      },
      {
        id: 'carinal-pocket',
        label: 'Secretion pocket',
        description: 'A gap behind the saddle can become a modeled site of secretion retention.',
      },
    ],
    prediction: {
      question:
        'What could explain persistent distal compromise despite an acceptable tracheal view?',
      instruction: 'Commit before the fit controls are enabled.',
      choices: [
        {
          id: 'saddle-limbs-branches-motion',
          label: 'Saddle, both limbs, branch angles, orifices, and motion',
          rationale:
            'Whole-Y fit depends on the three-dimensional carina, limb geometry, adjacent branches, contact, and secretion spaces.',
        },
        {
          id: 'tracheal-diameter-only',
          label: 'Tracheal diameter alone',
          rationale:
            'A single diameter misses saddle position, branch angles, limb length, distal orifices, and posterior-wall behavior.',
        },
        {
          id: 'material-name-only',
          label: 'The material name determines fit',
          rationale:
            'Finished bifurcated geometry and anatomy must be inspected directly; material labels do not solve the fit problem.',
        },
      ],
      bestChoiceId: 'saddle-limbs-branches-motion',
    },
    whatChanged: [
      'Branch-angle mismatch shifted saddle and limb relationships during qualitative motion.',
      'A distal orifice became crowded and a secretion-retention pocket appeared near the saddle.',
    ],
    whyItMatters: [
      'A technically deployed Y can still compromise a branch, create focal contact, or retain secretions.',
      'Bifurcation fit is architecture- and anatomy-specific and must be inspected in multiple views.',
    ],
    inspect: [
      'Saddle orientation',
      'Posterior wall',
      'Both limb ends',
      'Distal orifices and secretion pockets',
    ],
    conceptualResponse: [
      'Inspect the full tracheobronchial device and all relevant branch orifices immediately after placement and when symptoms change.',
      'Reassess geometry, position, patency, and ongoing mechanical job before any specialist repositioning or replacement strategy.',
    ],
    evidenceRefs: ['textbook-y-stenting-2025', 'textbook-airway-stents-primer-2025'],
    evidenceNote:
      'The supplied Y-stenting chapter supports whole-Y geometry, deployment concepts, secretion burden, localized contact, and postdeployment inspection.',
    evidenceBoundary:
      'The generic bifurcation is not patient anatomy, a sizing template, a deployment instruction, or a device comparison. No fixed limb dimensions or surveillance schedule are prescribed.',
    reducedMotionSummary:
      'Static external and cutaway views show the saddle, posterior wall, both limbs, a mismatched distal orifice, and a secretion pocket at the carina for three generic Y architectures.',
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'deploy-rescue',
    number: 11,
    category: 'procedure',
    shortLabel: 'Deploy, inspect & rescue',
    title: 'From constrained device to post-deployment decision point',
    summary:
      'Compare conceptual deployment states, then decide what the final airway-device assessment must establish.',
    clinicalHook:
      'A device has just been placed across a central obstruction and the first endoscopic frame looks open. Decide which additional observations are needed before accepting the result and how an unexpected finding would change the conceptual response pathway.',
    architectureOptions: [
      solidSiliconeArchitecture,
      freeCrossingBraidArchitecture,
      hookCrossCoveredArchitecture,
      laserCutCoveredArchitecture,
      singleWireKnitArchitecture,
      siliconeYArchitecture,
      metallicYArchitecture,
    ],
    defaultArchitectureId: 'laser-cut-covered',
    controls: stentExplorerControlsByStation['deploy-rescue'],
    phases: [
      {
        id: 'deploy-constrained',
        label: 'Position conceptually',
        instruction: 'Align fixed airway and lesion landmarks before release or unfolding.',
        textEquivalent:
          'The constrained generic device is aligned with target and branch landmarks; no instrument sequence is provided.',
      },
      {
        id: 'deploy-release',
        label: 'Release or unfold',
        instruction:
          'Scrub qualitative silicone unfolding or scaffold expansion while tracking both ends.',
        textEquivalent:
          'The silicone schematic unfolds into position; the self-expanding scaffold enlarges with architecture-dependent length behavior.',
      },
      {
        id: 'deploy-verify',
        label: 'Inspect and frame response',
        instruction:
          'Check expansion, position, patency, branches, tissue, and secretion findings before opening response pathways.',
        textEquivalent:
          'The final static checklist links findings to conceptual observation, clearance, repositioning, removal, or replacement pathways under specialist judgment.',
      },
    ],
    hotspots: [
      {
        id: 'proximal-distal-ends',
        label: 'Both ends',
        description: 'Confirm position and target coverage against fixed landmarks.',
      },
      {
        id: 'expansion-lumen',
        label: 'Expansion and lumen',
        description: 'Inspect the entire device for incomplete expansion, folding, or obstruction.',
      },
      {
        id: 'adjacent-branches',
        label: 'Adjacent branches',
        description: 'Confirm that nearby branch orifices remain appropriately patent.',
      },
      {
        id: 'interface-findings',
        label: 'Interface findings',
        description:
          'Inspect bleeding, tissue contact, gaps, secretions, and other immediate concerns.',
      },
    ],
    prediction: {
      question:
        'What is the most important action after the modeled device reaches its deployed state?',
      instruction: 'Commit before the inspection overlay appears.',
      choices: [
        {
          id: 'systematic-immediate-inspection',
          label: 'Systematically inspect the device, airway, and branches',
          rationale:
            'Release alone does not establish position, expansion, target coverage, lumen patency, branch preservation, or an acceptable tissue interface.',
        },
        {
          id: 'assume-success',
          label: 'Assume technical success after release',
          rationale:
            'A deployed appearance can still hide malposition, incomplete expansion, folding, obstruction, bleeding, or branch compromise.',
        },
        {
          id: 'use-one-universal-rescue',
          label: 'Apply one rescue pathway to every finding',
          rationale:
            'Response depends on the complication, architecture, anatomy, indication, device instructions, and specialist judgment.',
        },
      ],
      bestChoiceId: 'systematic-immediate-inspection',
    },
    whatChanged: [
      'The generic device moved from a constrained or folded state to its qualitative deployed geometry.',
      'The inspection overlay reframed deployment as the start of verification and complication response.',
    ],
    whyItMatters: [
      'Position, expansion, patency, branch preservation, and tissue-interface findings cannot be inferred from release alone.',
      'Repositioning and removal constraints differ by architecture, device, timing, anatomy, and applicable instructions.',
    ],
    inspect: [
      'Both ends and target coverage',
      'Full lumen and expansion',
      'Adjacent branches',
      'Bleeding, tissue, and secretions',
    ],
    conceptualResponse: [
      'Match the response to the observed finding: verify, clear obstruction, control an immediate issue, or consider specialist repositioning, removal, or replacement.',
      'Use device-specific instructions, multidisciplinary planning, patient anatomy, and operator judgment; this explorer is not procedural training.',
    ],
    evidenceRefs: [
      'textbook-stent-placement',
      'textbook-silicone-stents-2025',
      'textbook-sems-2025',
      'textbook-y-stenting-2025',
      'chest-cao-guideline-2024',
    ],
    evidenceNote:
      'The supplied chapters structure conceptual delivery, immediate verification, repositioning, removal, and complication-response teaching; the guideline supplies high-level clinical context.',
    evidenceBoundary:
      'Animations omit instrument handling and operative steps. They are not instructions for unsupervised placement, repositioning, removal, rescue, sizing, or surveillance.',
    reducedMotionSummary:
      'Static constrained, deployed, and verification states compare generic silicone unfolding with scaffold expansion, then mark both ends, the full lumen, branches, and tissue-interface findings.',
    clinicalReviewStatus: 'draft',
  },
]

const missingEvidenceRefs = findMissingEvidenceRefs(
  stentExplorerStations.flatMap((station) => [...station.evidenceRefs]),
)

if (missingEvidenceRefs.length > 0) {
  throw new Error(
    `Explorer stations contain unresolved evidence: ${missingEvidenceRefs.join(', ')}`,
  )
}

export const stentExplorerStationById = Object.freeze(
  Object.fromEntries(stentExplorerStations.map((station) => [station.id, station])) as Record<
    StentExplorerStationId,
    (typeof stentExplorerStations)[number]
  >,
)

export function getStentExplorerStation(id: string) {
  return (stentExplorerStationById as Readonly<Record<string, StentExplorerStation>>)[id]
}
