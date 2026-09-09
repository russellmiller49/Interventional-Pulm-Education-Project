import type { ObjectiveId, Question, SourceId } from '../types'

function item(
  id: string,
  objective: ObjectiveId,
  stem: string,
  correct: string,
  options: [string, string][],
  takeaway: string,
  sources: SourceId[],
  critical = false,
): Question {
  return {
    id,
    objective,
    stem,
    correct,
    choices: options.map(([text, rationale], index) => ({
      id: ['a', 'b', 'c'][index],
      text,
      rationale,
    })),
    takeaway,
    sources,
    critical,
  }
}

export const QUESTIONS: Question[] = [
  item(
    'choose-1',
    'choose',
    'Navigation places the catheter at the virtual target. The lesion is not visible on fluoroscopy, and the needle is visible. Which statement is best supported?',
    'b',
    [
      [
        'The needle has established lesion contact.',
        'Visible hardware and a virtual destination do not establish current lesion contact. Obtain evidence of the actual lesion–tool relationship.',
      ],
      [
        'The display establishes a map-relative hardware location.',
        'The display supports a map-relative catheter location. Current lesion identity and the sampling component still need appropriate confirmation.',
      ],
      [
        'The specimen will represent the intended lesion.',
        'A geometric display cannot predict the specimen. Establish localization and assess pathology as separate outcomes.',
      ],
    ],
    'Navigation, localization, tool confirmation and diagnosis are distinct outcomes.',
    ['setser', 'confirm'],
  ),
  item(
    'anatomy-1',
    'choose',
    'During bronchoscopy, central landmarks remain aligned to the planning CT, but new dependent opacity obscures a previously distinct peripheral target. What is the best next step?',
    'c',
    [
      [
        'Repeat tracking calibration and keep the same target.',
        'A peripheral anatomical change can occur despite accurate central tracking. Recalibration alone does not address collapse or target identity.',
      ],
      [
        'Increase navigation precision and sample the map location.',
        'More precise navigation to a stale coordinate does not identify the current lesion. Reassess the target before sampling.',
      ],
      [
        'Assess current aeration, coverage and target identity.',
        'These observations show whether anatomy or acquisition changed. Coordinate reassessment with anesthesia and current imaging before relying on the old map.',
      ],
    ],
    'A well-aligned central map can coexist with peripheral divergence.',
    ['setser', 'ilocate'],
  ),
  item(
    'geometry-1',
    'optimize',
    'A needle and nodule overlap frontally but separate after an oblique acquisition. The tool remained still. What best explains the change?',
    'a',
    [
      [
        'The new view exposes a component of their separation.',
        'The changed beam direction reveals parallax. Use that new information to reassess the trajectory; the view change did not move the needle.',
      ],
      [
        'The oblique acquisition moved the needle toward the lesion.',
        'An angle change alters the projection, not the instrument position. Do not mistake changed evidence for a physical correction.',
      ],
      [
        'The frontal overlap establishes contact despite the new view.',
        'A projection compresses depth. The separate view shows why the first overlap was insufficient evidence of contact.',
      ],
    ],
    'Projection changes alter the evidence, not the anatomy.',
    ['setser', 'pritchett'],
  ),
  item(
    'signal-1',
    'optimize',
    'A stable image shows a crisp tool and little grain. The target is superimposed on the heart. Which adjustment most directly addresses this limitation?',
    'b',
    [
      [
        'Increase photon output while preserving the same projection.',
        'Additional photons can reduce quantum noise but still image the superimposed heart. Address the beam path before escalating exposure.',
      ],
      [
        'Select a useful projection based on the planning anatomy.',
        'A different beam path may separate the target from the heart. Recenter, check clearance and assess the output required by the new angle.',
      ],
      [
        'Apply display enlargement while preserving the same projection.',
        'Enlargement helps inspect existing pixels but retains the same anatomical overlap. It addresses a different problem.',
      ],
    ],
    'Anatomical clutter and quantum noise require different responses.',
    ['tg272', 'setser'],
  ),
  item(
    'field-1',
    'optimize',
    'The technologist crops the displayed image after acquisition. The physical shutters and acquisition settings remain unchanged. What happened to the radiation already delivered?',
    'a',
    [
      [
        'It does not change.',
        'Post-acquisition cropping changes the visible image only. Physical collimation must restrict the beam before a subsequent exposure to affect its field.',
      ],
      [
        'It decreased in proportion to the visible field.',
        'This confuses displayed pixels with irradiated tissue. Review shutter position and actual acquisition indices.',
      ],
      [
        'It increased because the displayed pixels are larger.',
        'Display processing of a stored image does not deliver new X-rays. Acquisition-field changes are a separate operation.',
      ],
    ],
    'Inspect whether a control changes acquisition or only display.',
    ['tg272', 'wabip'],
  ),
  item(
    'time-1',
    'optimize',
    'In an authored fixed-current example, pulse rate is halved and pulse width doubled. Voltage, filtration and geometry remain fixed. What happens to mAs per second?',
    'c',
    [
      [
        'It halves with the pulse rate.',
        'That would require exposure per pulse to remain unchanged. Here each pulse is twice as long.',
      ],
      [
        'It doubles with the pulse width.',
        'That ignores the simultaneous reduction in pulse count. Account for both duration and rate.',
      ],
      [
        'It remains constant under these conditions.',
        'Current × pulse duration × pulse rate is unchanged. There are fewer time samples and more motion per pulse; patient dose is not calculated by this exercise.',
      ],
    ],
    'Pulse rate alone does not establish dose reduction or motion fidelity.',
    ['tg125', 'tg272'],
  ),
  item(
    'workflow-1',
    'choose',
    'After appropriate field restriction and a useful angle change, a faint lesion remains indistinct. The hardware is well seen and sampling depth is uncertain. What is the most useful next step?',
    'b',
    [
      [
        'Acquire a longer loop of the same static hardware position.',
        'A longer view of the same position is unlikely to resolve lesion identity or depth. Choose the missing information explicitly.',
      ],
      [
        'Obtain current localization that addresses the remaining uncertainty.',
        'A suitable additional modality can address depth or current anatomy. Match the acquisition to what would change safe sampling.',
      ],
      [
        'Advance until the visible needle reaches the virtual target.',
        'Visible hardware and a virtual coordinate do not resolve the uncertain current target. Confirm the relationship before further uncertain deployment.',
      ],
    ],
    'Escalate for missing information, not image appearance alone.',
    ['setser', 'mobile'],
  ),
  item(
    'dts-1',
    'dts',
    'A limited-angle reconstruction displays tiny voxels and sharp in-plane edges, but structures are elongated in depth. Which interpretation is best supported?',
    'a',
    [
      [
        'Angular coverage still limits resolution in some directions.',
        'Fine sampling of the displayed volume cannot supply unmeasured directions. Interpret the depth relationship within that limit.',
      ],
      [
        'Small displayed voxels establish equally fine resolution in depth.',
        'This confuses the reconstruction grid with measured resolution. Assess angular coverage and validated performance.',
      ],
      [
        'Additional projections at the same angles remove missing directions.',
        'Repeated sampling of the same angular range does not recover the missing viewing directions. Frame count and angular coverage differ.',
      ],
    ],
    'DTS adds depth information with direction-dependent uncertainty.',
    ['saad'],
  ),
  item(
    'prior-1',
    'dts',
    'A prior-aided reconstruction study improves image similarity to reference CBCT in a phantom and a small set of patient datasets. What can be concluded directly?',
    'c',
    [
      [
        'The method increases diagnostic yield across bronchoscopy programs.',
        'Image similarity is not diagnostic yield. A clinical outcomes study is needed to establish that claim.',
      ],
      [
        'The method lowers whole-procedure exposure across clinical targets.',
        'A reconstruction comparison does not measure all procedural exposures or all case types. Keep the endpoint specific.',
      ],
      [
        'The method shows closer agreement under tested conditions.',
        'This matches the technical endpoint. Prior information can help reconstruction, while clinical outcomes and generalizability require separate evidence.',
      ],
    ],
    'Keep conclusions at the level of the measured endpoint.',
    ['saad'],
  ),
  item(
    'acquisition-1',
    'cbct',
    'A target is centered on the frontal scout but lies near the anterior edge of the planned volume on the lateral view. What should happen before the spin?',
    'a',
    [
      [
        'Reposition using the supported centering method and recheck clearance.',
        'Frontal centering leaves another dimension unresolved. Fix the offset and verify the new setup before exposure.',
      ],
      [
        'Increase the reconstruction matrix and preserve the current setup.',
        'A finer grid cannot recover an excluded target. Fix coverage rather than changing display sampling.',
      ],
      [
        'Acquire first and use a thicker slab to recover the target.',
        'A thicker slab cannot restore anatomy that was outside the reconstruction field. Establish coverage before imaging.',
      ],
    ],
    'Center the actual target in the full acquisition volume.',
    ['setser'],
  ),
  item(
    'fixed-1',
    'cbct',
    'In a fixed suite, the overlay tracks a supported table move. A subsequent recruitment maneuver changes lung inflation. How should the overlay now be treated?',
    'c',
    [
      [
        'As current anatomy because table tracking remained active.',
        'Equipment tracking does not establish that peripheral lung inflation is unchanged. Reassess the target.',
      ],
      [
        'As current anatomy because the contour still looks plausible.',
        'Plausibility can reinforce confirmation bias. Check the underlying image and the acquisition state.',
      ],
      [
        'As a prior segmentation requiring reassessment after the change.',
        'Supported mechanical movement and physiological change are different. Re-establish current validity before relying on the contour.',
      ],
    ],
    'Geometric registration is not automatically anatomical tracking.',
    ['pritchett', 'setser'],
  ),
  item(
    'mobile-1',
    'cbct',
    'A mobile scanner exports a volume to a workstation. No navigation target-update integration has been validated. Which capability is established?',
    'b',
    [
      [
        'Automatic correction of the navigation target coordinates.',
        'Volume export does not establish coordinate transfer or a validated map update. Verify integration separately.',
      ],
      [
        'Inspection of current imaging on the receiving display.',
        'The images can support current anatomical review there. Map updates and live overlays require separately supported workflows.',
      ],
      [
        'A registered contour that follows subsequent fluoroscopy.',
        'A live registered overlay requires additional geometry and integration. DICOM export alone does not establish it.',
      ],
    ],
    'Volume review, target updates and augmented fluoroscopy are separate capabilities.',
    ['mobile', 'setser'],
  ),
  item(
    'tool-1',
    'verify',
    'A thick slab shows a needle overlapping the lesion. Thin reformats show the sampling opening separated from it in depth. What is the best interpretation?',
    'a',
    [
      [
        'The slab combined structures that occupy different depths.',
        'The thin planes expose separation hidden by the slab. Review the actual sampling component and current trajectory before proceeding.',
      ],
      [
        'The slab establishes sampling contact because it shows more anatomy.',
        'More included depth can conceal a gap. It does not override a resolved separation on adequate thin views.',
      ],
      [
        'The brightest tip pixel establishes where tissue will be sampled.',
        'Tip brightness does not define the sampling region. Identify the actual opening, jaws or active component for the real instrument.',
      ],
    ],
    'Trace the actual sampling region, not just hardware overlap.',
    ['setser', 'pritchett'],
  ),
  item(
    'change-1',
    'verify',
    'A reconstruction contains duplicated tool and lesion edges after movement during the sweep. What most directly addresses the cause before repeating?',
    'b',
    [
      [
        'Increase exposure while repeating the same unstable acquisition.',
        'More photons do not undo motion inconsistency. Restore stability and respiratory coordination first.',
      ],
      [
        'Reassess stability and a tolerable coordinated acquisition state.',
        'This addresses the inconsistency between projections. Anesthesia safety and actual tool stability govern the next attempt.',
      ],
      [
        'Increase the display slab thickness and accept the overlap.',
        'Combining depths can hide artifact without restoring reliable localization. Establish an adequate acquisition.',
      ],
    ],
    'Fix the cause of a degraded acquisition before repeating it.',
    ['setser', 'vespa'],
  ),
  item(
    'safety-1',
    'protect',
    'During a lateral fluoroscopic task, a clinician proposes holding an accessory in the primary beam while wearing a protective glove. What is the best response?',
    'c',
    [
      [
        'Proceed because the glove substitutes for keeping hands outside the beam.',
        'A protective glove does not justify direct-beam hand exposure and may affect exposure regulation. Use a supported stabilization method outside the field.',
      ],
      [
        'Proceed if a colleague confirms the monitor brightness is unchanged.',
        'Brightness does not establish exposure or hand protection. Automatic output control can mask changes.',
      ],
      [
        'Stabilize the tool with hands outside the irradiated field.',
        'This addresses the exposure pathway. Confirm instrument position after stabilization and use the local protection program.',
      ],
    ],
    'Protective equipment does not make direct-beam hand placement acceptable.',
    ['icrp', 'wabip', 'tg125'],
  ),
  item(
    'dose-1',
    'protect',
    'After collimation, reference air kerma rises slightly while KAP falls. Which interpretation best fits these observations?',
    'b',
    [
      [
        'The two values conflict, so the lower number should be discarded.',
        'They describe different quantities. A smaller irradiated area can outweigh a local kerma increase in the area product.',
      ],
      [
        'A smaller exposed area can outweigh a rise in local output.',
        'KAP combines kerma and area. Interpret each index and the included modes; neither directly measures peak skin dose.',
      ],
      [
        'The falling KAP proves that the peak skin dose also fell.',
        'Peak skin dose depends on geometry, overlap and tissue corrections. KAP alone cannot establish that change.',
      ],
    ],
    'Specify the dose quantity before making a radiation claim.',
    ['aapm12', 'skin', 'tg125'],
  ),
  item(
    'case-1',
    'choose',
    'A target lies near the pleura. Navigation reports arrival, but neither fluoroscopy nor current local imaging identifies a convincing lesion boundary. The needle remains retracted. What should happen next?',
    'c',
    [
      [
        'Extend the needle toward the map coordinate before obtaining a volume.',
        'This exposes an uncertain path to deployment before clarifying the target and hazards. Keep the tool safely positioned and obtain the missing anatomical evidence.',
      ],
      [
        'Use a longer sampling excursion to cover possible map divergence.',
        'A larger blind excursion does not resolve uncertainty and can reach unintended structures. Clarify the current target and safe path.',
      ],
      [
        'Acquire localization evidence before deploying the instrument.',
        'Current localization should resolve the uncertainty while the instrument remains safely positioned. A later tool-deployed scan can answer a different confirmation question when appropriate.',
      ],
    ],
    'Do not create a tool-in-lesion image by deploying into an uncharacterized region.',
    ['setser', 'mobile'],
    true,
  ),
  item(
    'case-2',
    'optimize',
    'On a held image, the relevant instrument edge is resolved but too small for comfortable inspection at the operator’s monitor. Which action addresses the stated problem?',
    'a',
    [
      [
        'Use display enlargement of the existing data.',
        'This makes existing information easier to inspect without acquiring new radiation. Return to a wider view when surrounding context is needed.',
      ],
      [
        'Select a higher-dose acquisition preset and acquire another loop.',
        'The edge is already resolved. More acquisition does not directly address the monitor viewing problem.',
      ],
      [
        'Move the patient closer to the source for geometric enlargement.',
        'This changes geometry, exposure and focal-spot blur for a problem in viewing existing data. Use display enlargement first.',
      ],
    ],
    'Solve a display problem with a display operation when the information is already present.',
    ['tg272', 'tg125'],
  ),
  item(
    'case-3',
    'dts',
    'A vendor-neutral research report evaluates an algorithm on limited-angle projections plus registered prior CT. The reconstructed lung looks more like the reference scan. Which additional evidence would address clinical effectiveness?',
    'b',
    [
      [
        'A demonstration of a finer displayed reconstruction grid.',
        'Grid spacing is not a patient outcome and does not independently measure recovered information.',
      ],
      [
        'An outcomes study with defined diagnostic and safety endpoints.',
        'Clinical endpoints show whether the imaging method benefits the procedural question. Specify population, comparator, outcome definition and all exposures.',
      ],
      [
        'A demonstration that the prior contour remains visually familiar.',
        'Similarity to the prior can reflect its influence on reconstruction. It does not establish current anatomy or clinical effectiveness.',
      ],
    ],
    'Technical validation and clinical effectiveness answer different questions.',
    ['saad', 'frontier'],
  ),
  item(
    'case-4',
    'cbct',
    'A mobile C-arm clears the patient in the frontal position. After robot docking, the full orbit has not been checked and tubing crosses the expected path. What is the best next action?',
    'c',
    [
      [
        'Start the spin and rely on the frontal clearance already observed.',
        'A static check cannot establish rotational clearance after a setup change. Resolve the tubing and verify the supported orbit before exposure.',
      ],
      [
        'Use a lower-dose mode while preserving the current arrangement.',
        'Dose mode does not resolve a mechanical collision or access problem. Reconfigure safely and recheck.',
      ],
      [
        'Reconfigure the lines and perform a supported clearance check.',
        'This directly addresses the changed setup. Include table, robot, source, detector, patient and anesthesia access in the readiness check.',
      ],
    ],
    'Readiness must match the setup that will actually be scanned.',
    ['setser', 'mobile'],
    true,
  ),
  item(
    'case-5',
    'verify',
    'A fictional side-window needle has its tip beyond a spherical target. Thin views place part of its opening inside the target. Which documentation is most accurate?',
    'a',
    [
      [
        'The opening partly intersects the target in the acquired state.',
        'This states the component and extent that the images demonstrate. Clinical adequacy and safety remain separate judgments for the real tool.',
      ],
      [
        'The tip is intralesional because the opening intersects the target.',
        'Tip position and opening position are distinct. Describe the actual component shown rather than substituting one for the other.',
      ],
      [
        'Diagnostic sampling is assured because some metal crosses the lesion.',
        'Geometric intersection does not guarantee viable or adequate tissue. Maintain a separate diagnostic endpoint.',
      ],
    ],
    'Document the actual sampling component and the state of confirmation.',
    ['setser', 'confirm'],
  ),
  item(
    'case-6',
    'verify',
    'During an imaging pause, anesthesia reports worsening hemodynamic tolerance and asks to terminate the hold before the scan has finished. What is the best response?',
    'b',
    [
      [
        'Complete the scan while increasing image quality to avoid a repeat.',
        'Finishing imaging does not override physiological intolerance. More exposure does not make the pause tolerable.',
      ],
      [
        'Stop exposure and restore appropriate physiological support.',
        'Patient tolerance governs the pause. Reassess the cause, scan adequacy and a safer strategy before another acquisition.',
      ],
      [
        'Continue the pause if oxygen saturation remains acceptable.',
        'Oxygen saturation alone does not establish ventilation, CO₂, pressure or hemodynamic safety. Respond to the reported intolerance.',
      ],
    ],
    'An imaging milestone never supersedes physiological safety.',
    ['setser', 'vespa'],
    true,
  ),
  item(
    'case-7',
    'protect',
    'During a rotational acquisition, staff can maintain required monitoring from the room’s verified protected positions. One person proposes remaining unshielded at an arbitrary distance from the patient. What is the best plan?',
    'a',
    [
      [
        'Use established barriers with continued observation and patient access.',
        'Use the actual room protection plan. Arbitrary distance does not establish a safe rotational scatter exposure.',
      ],
      [
        'Use the proposed distance because the scanner is mobile.',
        'Portability does not establish room shielding adequacy or a safe distance. Apply the measured local protection plan.',
      ],
      [
        'Use the proposed distance if the patient’s KAP display looks low.',
        'Patient KAP is not a staff-location dose measurement. Staff exposure also depends on geometry and barriers.',
      ],
    ],
    'No universal unshielded safe zone follows from a scanner category or distance.',
    ['wabip', 'icrp'],
    true,
  ),
  item(
    'case-8',
    'protect',
    'An authored dose report lists 12 Gy·cm² total KAP, comprising 8 from fluoroscopy and 4 from rotational acquisitions. What should the whole-procedure entry say?',
    'c',
    [
      [
        '24 Gy·cm², adding the total and both components.',
        'This double counts the same exposure. Preserve component values without adding them again to the stated total.',
      ],
      [
        '4 Gy·cm², recording the rotational acquisition subtotal.',
        'This omits fluoroscopy, which contributes to the procedure. Record the total and identify its components.',
      ],
      [
        '12 Gy·cm² total, with the two component values identified.',
        'The components sum to the stated total. Record units and included modes, and separately retain other available dose indices and fluoroscopy time.',
      ],
    ],
    'Count every acquisition mode once and keep units explicit.',
    ['wabip', 'aapm12'],
  ),
  item(
    'choose-transfer-1',
    'choose',
    'A radial ultrasound image shows tissue all the way round the probe, and the catheter icon sits on the virtual target. Which statement is best supported?',
    'b',
    [
      [
        'The lesion has been identified and the biopsy will be diagnostic.',
        'A tissue pattern around the probe is a local acoustic finding. Lesion identity and specimen adequacy are separate outcomes that this image does not settle.',
      ],
      [
        'The probe is surrounded by tissue here; what that tissue is, and where a later tool samples, remain open.',
        'The image measures its own surroundings. Collapsed lung can look the same, and the sampling tool follows its own path once the probe is withdrawn.',
      ],
      [
        'The navigation display has been confirmed, so the target can be sampled at the icon.',
        'Two displays agreeing about position is not confirmation of tissue. A map and a local measurement answer different questions.',
      ],
    ],
    'Each display answers its own question; none of them answers all four.',
    ['ilocate', 'mobile'],
  ),
  item(
    'walk-1',
    'optimize',
    'A nodule and the needle tip land on the same pixel of the image although they are two centimetres apart. At which stop of the chain is that overlap made?',
    'a',
    [
      [
        'The beam',
        'Every pixel collects one ray from the source. Two objects on that ray share the pixel however far apart they are along it.',
      ],
      [
        'The detector',
        'The panel records what each ray delivered. It cannot tell where along the ray the attenuation happened; the overlap arrived already made.',
      ],
      [
        'The display',
        'Zoom and window change how a pixel is shown. The overlap was decided before the image reached the monitor.',
      ],
    ],
    'Overlap is decided on the beam, not on the screen.',
    ['tg272', 'setser'],
  ),
  item(
    'good-1',
    'optimize',
    'On a held image the target is clear but small. Which of these changes what is measured, rather than how it is shown?',
    'c',
    [
      [
        'Zooming the stored image.',
        'Display zoom enlarges existing pixels. Nothing new is measured and no exposure follows.',
      ],
      [
        'Changing the window and level.',
        'Windowing maps the same measured values to different greys. The information is unchanged.',
      ],
      [
        'Selecting a smaller acquisition field.',
        'An acquisition-field change alters what the panel measures on the next exposure, and may change binning and output. It is one of the things you change at the C-arm.',
      ],
    ],
    'Ask whether a control changes the acquisition or only the display.',
    ['tg272', 'tg125'],
  ),
  item(
    'capstone-1',
    'verify',
    'After a useful oblique view, a collimated field and a paused breath, the nodule is still not distinct although the needle is crisp. Which stop of the chain holds the remaining problem?',
    'a',
    [
      [
        'The patient — what the ray crosses',
        'Angle, field and timing have been set well. What is left is the anatomy on the ray, or the identity of the target, and more of the same exposure cannot change either.',
      ],
      [
        'The source — more photons',
        'More photons lower the grain, but the image is not grainy. The limit here is not the photon count.',
      ],
      [
        'The display — a stronger window',
        'The window changes the contrast of what was measured. It cannot separate a target from what lies on the same ray.',
      ],
    ],
    'When the beam and the timing are right, the remaining limit lives in the patient or in the question.',
    ['setser', 'tg272', 'mobile'],
  ),
  item(
    'capstone-transfer-1',
    'protect',
    'The procedure record lists fluoroscopy time and the number of rotational acquisitions, but no area product or reference air kerma. What does the record still lack?',
    'b',
    [
      [
        'Nothing; time and spin count describe the exposure.',
        'Time and count omit the output per second and per spin. Two procedures with the same minutes can differ several-fold in exposure.',
      ],
      [
        'The measured output indices with their units and the modes they include.',
        'The kerma–area product and the reference air kerma, with units and the acquisition modes they cover, are what a whole-procedure review needs. Time and count are incomplete on their own.',
      ],
      [
        'An effective dose in millisieverts, so the exposure can be compared with a chest CT.',
        'Effective dose is an estimate with disclosed assumptions, not a measured index. A comparison with a CT without the method behind it is not a report.',
      ],
    ],
    'Record the quantity, its units and the modes it covers.',
    ['wabip', 'aapm12'],
  ),
]

export const QUESTION_BY_ID = Object.fromEntries(
  QUESTIONS.map((question) => [question.id, question]),
) as Record<string, Question>
