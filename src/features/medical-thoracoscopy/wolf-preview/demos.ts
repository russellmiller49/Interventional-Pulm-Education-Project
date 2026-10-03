import type { WolfPreviewItem } from './paths'

/**
 * What the private preview's hub shows, and the two presentation demonstrations it opens. Safe for
 * pages: files are named by their published path inside a group (the hub's `hub`, or the
 * demonstration's id), never by storage object. The wording keeps the demonstrations' own
 * statements of what is CT-derived, authored, conceptual and not claimed.
 */
export type WolfPreviewDemoId = Exclude<WolfPreviewItem, 'device-explorer'>

export interface WolfPreviewCard {
  readonly item: WolfPreviewItem
  readonly title: string
  readonly kind: string
  readonly summary: string
  readonly contents: readonly string[]
  /** Published path in the `hub` group. */
  readonly image: string
  readonly imageAlt: string
}

export interface WolfPreviewStill {
  /** Full-resolution still, then its gallery preview (published paths in the demo's group). */
  readonly file: string
  readonly preview: string
  readonly caption: string
}

export interface WolfPreviewSection {
  readonly heading: string
  readonly items: readonly string[]
}

export interface WolfPreviewDemo {
  readonly id: WolfPreviewDemoId
  readonly title: string
  readonly kind: string
  readonly summary: string
  /** The demonstration's own opening statement, shown before anything else on its page. */
  readonly statement: { readonly lead: string; readonly detail: string } | null
  readonly viewer: { readonly file: string; readonly how: string }
  readonly video: { readonly file: string; readonly poster: string; readonly caption: string }
  readonly stills: readonly WolfPreviewStill[]
  readonly sections: readonly WolfPreviewSection[]
  readonly footer: readonly string[]
}

export const WOLF_PREVIEW_DEMO_WORDS = {
  openViewer: 'Open the interactive viewer',
  viewerNote:
    'Opens full-window in this tab and runs in the browser (WebGL); a desktop or laptop is easier to use than a phone. Use the browser’s Back button to return.',
  viewerHeading: 'Interactive viewer',
  videoHeading: 'Video',
  stillsHeading: 'Stills',
  stillsNote: 'Select a still to open it at full resolution in a new tab.',
  aboutHeading: 'What this shows',
} as const

export const WOLF_PREVIEW_CARDS: readonly WolfPreviewCard[] = [
  {
    item: 'device-explorer',
    title: 'Device Explorer',
    kind: 'Interactive 3D',
    summary:
      'Thirteen parametric models of the thoracoscopy equipment: the operative telescope with an illustrative cutaway, trocar sleeves and trocars, forceps, electrodes, probe, suction tube and a tower blockout.',
    contents: [
      'Orbit, labels, exploded view',
      'Assembly sequence with the forceps through the channel',
      'Hotspots tagged by kind of claim; a quality class per model',
    ],
    image: 'cards/device-explorer.jpg',
    imageAlt: 'Rendering of the operative telescope model on a grey studio background.',
  },
  {
    item: 'pleural-model-progress',
    title: 'Pleural Model Progress',
    kind: 'Development prototype',
    summary:
      'The pleural model as built so far: CT-derived ribs, pleural cavity, lung and effusion, the port, the authored lung collapse, and the operative telescope moved through poses the module itself computed.',
    contents: ['Interactive viewer', 'Video, 88 s', 'Seven stills'],
    image: 'cards/pleural-model-progress.jpg',
    imageAlt:
      'Translucent right chest wall and pleural cavity with the collapsed lung, the port and the telescope above it.',
  },
  {
    item: 'portable-trainer-concept',
    title: 'Portable Hybrid Thoracoscopy Trainer',
    kind: 'Early engineering concept',
    summary:
      'A concept for a portable physical controller: a real thoracoscope through a sensorized port, one USB cable, and the module’s linked Chest and Scope views in the browser. Not built, measured or validated.',
    contents: ['Interactive viewer', 'Video, 60 s', 'Six concept images'],
    image: 'cards/portable-trainer-concept.jpg',
    imageAlt:
      'Concept drawing of a white trainer housing with a thoracoscope in its port, cabled to a laptop showing chest and scope views.',
  },
]

export const WOLF_PREVIEW_DEMOS: Readonly<Record<WolfPreviewDemoId, WolfPreviewDemo>> = {
  'pleural-model-progress': {
    id: 'pleural-model-progress',
    title: 'Pleural Model Progress',
    kind: 'Development prototype · progress demonstration',
    summary:
      'Where the Medical Thoracoscopy pleural model stands. It is shown as built: no geometry, clearance rule, port, lung state or device model was changed to make this demonstration.',
    statement: null,
    viewer: {
      file: 'index.html',
      how: 'Play the 88-second sequence or jump to a chapter. Free orbit lets you turn the model, show or hide the ribs, pleural cavity, lung, effusion, port, telescope and the telescope view, and step through the illustrative lung states.',
    },
    video: {
      file: 'media/pleural-model-progress-demo.mp4',
      poster: 'stills/preview/06-combined.jpg',
      caption: 'The sequence as a video: 88 s, 1920 × 1080, no sound.',
    },
    stills: [
      {
        file: 'stills/01-ribs.jpg',
        preview: 'stills/preview/01-ribs.jpg',
        caption: 'CT-derived ribs and sternum.',
      },
      {
        file: 'stills/02-pleural-cavity.jpg',
        preview: 'stills/preview/02-pleural-cavity.jpg',
        caption: 'The parietal surface of the right pleural cavity, from the same segmentation.',
      },
      {
        file: 'stills/03-lung-in-cavity.jpg',
        preview: 'stills/preview/03-lung-in-cavity.jpg',
        caption: 'The right lung, expanded, inside the pleural cavity.',
      },
      {
        file: 'stills/03b-pleural-effusion.jpg',
        preview: 'stills/preview/03b-pleural-effusion.jpg',
        caption:
          'The right pleural effusion as segmented, about 930 mL, where it lay with the patient supine.',
      },
      {
        file: 'stills/04-port.jpg',
        preview: 'stills/preview/04-port.jpg',
        caption:
          'The port: right 7th intercostal space, mid-axillary line (a modelling default, not a recommended site).',
      },
      {
        file: 'stills/05-scope-chest-relationship.jpg',
        preview: 'stills/preview/05-scope-chest-relationship.jpg',
        caption: 'One telescope pose drives the Chest view and the Telescope view.',
      },
      {
        file: 'stills/06-combined.jpg',
        preview: 'stills/preview/06-combined.jpg',
        caption: 'Ribs, pleural cavity, collapsed lung, port and telescope together.',
      },
    ],
    sections: [
      {
        heading: 'From the CT scan',
        items: [
          'One de-identified CT scan from the public AeroPath dataset (Hofstad et al., Zenodo 2023, CC BY 4.0). Surfaces were built from its segmentation and remeshed or simplified; nothing shown is the scan itself.',
          'Ribs and sternum (right ribs 1–12 counted on the scan); the right pleural cavity; the three right lobes, expanded; the right effusion, about 930 mL in one piece.',
          'The port measurements: the gap between the 7th and 8th ribs and the ribs’ depth at the port.',
        ],
      },
      {
        heading: 'Authored',
        items: [
          'Lung collapse: eight authored, illustrative states, the segmented lung reshaped toward the hilum with a gravity drift. No collapsed lung was imaged. The video blends between neighbouring states; the module steps between them.',
          'Drainage: the effusion fades as the port opens and the lung falls away. It stands for “fluid out, air in”; it is not a fluid simulation.',
          'Port site: right 7th intercostal space, mid-axillary line, a modelling default rather than a recommended site. The sleeve tip sitting 5 mm inside the pleura is authored too.',
          'Telescope poses: the module computed every pose, and its clearance check found all 305 sampled poses clear (closest approach 3.2 mm). The collapse plays before the telescope enters because the module finds the seated sleeve clear of the lung only from collapse step 3, and the telescope’s start pose only from step 4.',
          'Device models: the operative telescope and the flexible sleeve from the device explorer, built from published dimensions and reference-image measurements with authored details; not reviewed by the manufacturer.',
          'Presentation: the supine scan is shown turned onto the left side, by rotation only. Colours, transparency, lighting, camera path and captions are presentation choices; the telescope view uses flat-coloured surfaces.',
        ],
      },
      {
        heading: 'Still under clinical and engineering review',
        items: [
          'The lung-collapse model is illustrative and not clinically validated; a CT-informed refinement is in progress.',
          'The effusion surface was built for this demonstration and is not part of the module, which holds the fluid only as a table of volumes and starts every scenario drained. It is not redistributed for the lateral position, where fluid would settle toward the mediastinum.',
          'The port default and the authored instrument values.',
          'Known visual limits: lobe edges at the fissures show a sawtooth at close range in the telescope view. No chest-wall soft tissue or skin is drawn, so the sleeve and telescope appear to stand in open air above the ribs.',
        ],
      },
    ],
    footer: [
      'Development prototype · private preview',
      'Anatomy: AeroPath dataset (Hofstad et al., Zenodo 2023), CC BY 4.0; modified',
      'Not clinically validated',
    ],
  },
  'portable-trainer-concept': {
    id: 'portable-trainer-concept',
    title: 'Portable Hybrid Thoracoscopy Trainer',
    kind: 'Concept · physical instrument + digital pleural environment',
    summary:
      'A portable physical controller for the Medical Thoracoscopy simulation platform: the real thoracoscope through a sensorized port, one USB cable, and the module’s linked Chest and Scope views in the browser.',
    statement: {
      lead: 'No physical thoracoscopy trainer has been built, measured or validated.',
      detail:
        'Everything here is an early engineering concept drawn for discussion. The images and the animation show an idea; they are not a design, a specification, a prototype, a validation result or a product. Sizes are illustrative and must not be read as dimensions. Sensor choices are candidates, not selections. Nothing here was reviewed or approved by the manufacturer, and nothing implies sponsorship or approval of this concept.',
    },
    viewer: {
      file: 'index.html',
      how: 'Orbit the trainer; show or hide the housing, skin insert, ribs, gimbal and sensors, electronics, thoracoscope, laptop and a cutaway; open the exploded view; move the scope with the Depth, Roll, Sup–inf and Ant–post sliders (tilts stay inside the module’s port ellipse); or play the animation.',
    },
    video: {
      file: 'media/portable-thoracoscopy-concept.mp4',
      poster: 'stills/preview/01-hero.jpg',
      caption: 'The concept animation: 60 s, 1920 × 1080, no sound.',
    },
    stills: [
      {
        file: 'stills/01-hero.png',
        preview: 'stills/preview/01-hero.jpg',
        caption:
          'The concept: a real thoracoscope through a sensorized port, one USB cable, and linked Chest and Scope views in the browser.',
      },
      {
        file: 'stills/02-exploded-system.png',
        preview: 'stills/preview/02-exploded-system.jpg',
        caption:
          'Exploded view. Each part is tagged concept, candidate sensing approach, needs engineering validation, from the CT model, or existing model.',
      },
      {
        file: 'stills/03-system-architecture.png',
        preview: 'stills/preview/03-system-architecture.jpg',
        caption:
          'Architecture: the trainer would report what the hand does to the instrument; the browser simulator does everything else.',
      },
      {
        file: 'stills/04-sensorized-port.png',
        preview: 'stills/preview/04-sensorized-port.jpg',
        caption:
          'Sensorized port, cutaway: depth, roll, pitch (superior–inferior) and yaw (anterior–posterior). Mechanism not finalized.',
      },
      {
        file: 'stills/05-port-cartridges.png',
        preview: 'stills/preview/05-port-cartridges.jpg',
        caption:
          'Interchangeable cartridges: standard interspace, narrow interspace, alternate port position. Illustrative configurations.',
      },
      {
        file: 'stills/06-future-tool-tracking.png',
        preview: 'stills/preview/06-future-tool-tracking.jpg',
        caption:
          'Future extension, not part of the initial concept: physical tool input mapped to the virtual forceps.',
      },
    ],
    sections: [
      {
        heading: 'From existing work',
        items: [
          'The operative telescope is the showcase model from the device explorer. The forceps, in the future-extension images only, is the showcase double-spoon forceps with an authored stand-in handle.',
          'The trainer’s ribs are the module’s CT-derived right ribs 5–10 around the modelled port, kept at 1:1; the cartridge is the module’s chest wall around its own port.',
          'The port frame (right 7th intercostal space, mid-axillary line, a modelling default) and every telescope pose come from the module’s own pose calculations. Its clearance check found every virtual pose shown clear, inside the port’s tilt ellipse (closest approach 3.0 mm).',
          'The four inputs map one to one onto the module’s telescope pose: depth, roll, tilt across the ribs (superior–inferior) and tilt along the ribs (anterior–posterior).',
          'The architecture follows the ScopeTracker R5 build plan (R5.0): an RP2040-class microcontroller, an optical sensor reading insertion and roll from the shaft, one USB cable to the browser simulators. R5 itself is a build plan with nominal CAD and is not yet physically validated.',
        ],
      },
      {
        heading: 'Conceptual',
        items: [
          'New geometry: housing, cartridge frame, compliant skin/intercostal insert, two-axis gimbal, sensor carriers, electronics enclosure, cable, laptop and the cartridge variants.',
          'Drawn at about a laptop’s footprint (roughly 30 × 28 cm, 15 cm tall). This is how big it was drawn, not a size anyone has chosen.',
          'The telescope goes in only 7.5–24 mm past the pivot, because the module’s collapsed lung leaves about 22 mm of free space ahead of it; that is why the physical scope stands tall.',
          'Today the module takes keyboard, pointer, touch and scripted input only; a physical-input mode would be new work.',
        ],
      },
      {
        heading: 'Would need engineering validation',
        items: [
          'Optical shaft sensing on this telescope’s shaft (finish, diameter, sleeve, slip); the angle sensors, magnets and their accuracy on both pivot axes; the gimbal’s kinematics, friction, stops and centring at the chest wall.',
          'The port/sleeve insert’s fit with the real telescope; the skin insert’s material, feel, durability and cleaning; how cartridges locate and latch; the housing, stability and portability.',
          'Firmware, the USB report and the browser’s physical-input mode (calibration, homing, tracking loss); all dimensions and tolerances; and, for the future extension, tool depth, tool roll and jaw-state sensing.',
        ],
      },
      {
        heading: 'Not claimed',
        items: [
          'Inputs, not the tip. The port would report what the hand does to the instrument. It would not measure the distal tip in space; the simulator interprets the reported state.',
          'No validated tissue mechanics, pleural force response, injury thresholds, patient-specific physiology or validated haptic forces. No motors or force feedback. No tissue contact, biopsy or clinical performance is shown.',
        ],
      },
    ],
    footer: [
      'Early engineering concept — development and validation required',
      'Concept visualization · sizes illustrative · not to scale for fabrication',
      'Not a validated or manufacturer-approved device',
    ],
  },
}

export function wolfPreviewDemo(value: unknown): WolfPreviewDemo | null {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(WOLF_PREVIEW_DEMOS, value)
    ? WOLF_PREVIEW_DEMOS[value as WolfPreviewDemoId]
    : null
}
