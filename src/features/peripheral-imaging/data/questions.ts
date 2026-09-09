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

  // --- Practice: short cases, one decision each, paired to a section by its mechanism.
  // Authored against each section's own teaching and the module's reviewed sources, then put
  // through three rounds of independent review for vocabulary, evidence, cueing and fit.
  // Every one is a draft awaiting subject-matter review, like the rest of the bank.
  item(
    'signal-practice-1',
    'optimize',
    'The lesion does not separate from what surrounds it. Which limitation is this picture showing?',
    'b',
    [
      [
        'A chest this deep is stopping too much of the beam, so the picture is being built out of too little signal.',
        'A thin supply of transmitted radiation announces itself as speckle, and here the background is smooth while the catheter edge holds its sharpness. Raising output would also drive more radiation into the same wide field, so what scatters rises in step with what transmits: the flat grey stays where it is, and the patient and the room take the added exposure for nothing.',
      ],
      [
        'A chest this deep puts so much tissue in the beam that radiation scattering sideways out of it hazes the picture.',
        'The smooth background and the crisp catheter edge put the transmitted supply outside the problem, and a grey that lies on the diaphragm and the vessels as heavily as on the lesion is the signature of radiation arriving without having carried anatomy. Bringing the shutters in shrinks the volume that scatters and can return the contrast; if it stays flat, the question moves to imaging built to answer it.',
      ],
      [
        'A chest this deep stacks so much tissue along each line of the beam that one flat picture cannot pull it apart.',
        'Stacked anatomy costs contrast where one structure lies over another and leaves the rest of the field alone; here the contrast is down everywhere at once, including where nothing lies over anything. An angle change also carries the same open shutters through the same deep chest, so the flat grey travels with the new projection rather than lifting off it.',
      ],
    ],
    'A grey that lies on everything at once, the dense structures included, while the hardware stays sharp and the background stays smooth, is describing radiation that left the tissue sideways rather than too few photons crossing it or anatomy stacked along the beam. Stacked anatomy takes contrast away in one place; a scatter haze takes a share of it everywhere. Shutters, angle and output each answer a different limitation, so name the one in front of you before moving any of them.',
    ['setser', 'wabip', 'tg272', 'tg125'],
  ),
  item(
    'signal-practice-2',
    'optimize',
    'The lesion is clear of the mediastinum and the needle is in view. What is the most useful adjustment now?',
    'c',
    [
      [
        'Adjust the display window until the needle edges stand out again.',
        'The window belongs on the shortlist and can help read what was already acquired, but stretching a veiled image stretches the veil with it, and whatever noise it carries. The contrast is being lost before the image reaches the display.',
      ],
      [
        'Raise the output and reach for a brighter preset to get through the arm.',
        'Too few photons show up as grain, not as an even loss of contrast. The arm scatters as well as absorbs, and more output lifts the primary beam and the scattered radiation together, so the picture stays flat while exposure rises.',
      ],
      [
        'Close the shutters onto the working area and move the arm aside.',
        'A washed-out image over a wide field and a thick path is the look of scattered radiation reaching the detector; the arm both thickens what the beam crosses and adds tissue that scatters. Restricting the irradiated area and moving the arm out of the beam with the anesthesia team, within safe positioning limits and without disturbing the scope or docked equipment, act on the source of that scatter.',
      ],
    ],
    'A washed-out picture and a grainy one come from different causes, and a wide field over a thick path names this one; the thicker path also drives the automatic response harder, and a harder beam flattens contrast on its own. More output would lift the scattered radiation along with the beam, and steady monitor brightness would not reveal that anything rose.',
    ['wabip', 'tg125'],
  ),
  item(
    'field-practice-1',
    'optimize',
    'Which adjustment acts most directly on the cause of this flat, low-contrast picture?',
    'b',
    [
      [
        'Crop the displayed picture on the monitor to the working area.',
        'The border on the monitor moves; the beam does not. The same tissue keeps scattering into the detector on every frame, so the flat appearance survives the crop, and so does the exposure of everything outside the visible border.',
      ],
      [
        'Bring the collimator blades in to the working area.',
        'Restricting the beam shrinks the irradiated volume, and irradiated tissue is where the scattered radiation that flattens contrast is made; scatter off a field this wide is what is flattening this picture, which is not short of photons. Leave a rim of surrounding anatomy for orientation and the planned tool excursion, and look at the output afterwards — with the shoulder and abdomen outside the field, the exposure regulation responds to the working area, and it can partly offset the smaller field.',
      ],
      [
        'Step up to the next higher-output fluoroscopy setting.',
        'More photons answer a grainy picture, not scattered radiation off a wide beam, and automatic exposure regulation may already be holding the monitor brightness where it wants it. Acting on this adds exposure for the patient and everyone at the table while the cause stays in the beam.',
      ],
    ],
    'Blades at the tube and a border drawn on the monitor look alike on the screen, so name which one you are moving before you judge what it did. Haze made by a wide beam is answered by narrowing the beam; output added to the same wide beam raises the scattered signal in step with the useful one, so the haze survives while the exposure rises and the regulation can hold the displayed picture looking much the same.',
    ['wabip', 'tg125'],
  ),
  item(
    'field-practice-2',
    'optimize',
    'Surrounding anatomy is needed for orientation. Which action comes first?',
    'c',
    [
      [
        'Open the shutters wider and acquire a new frame of the chest.',
        'This does restore context when the blades were the limit, and it may well be needed. Spending an exposure before looking at the frame already on the screen risks paying for anatomy that was acquired and simply not shown.',
      ],
      [
        'Scroll back through the stored run and check earlier frames.',
        'Earlier frames in the same run were most likely acquired with the same field in place, so they may hold no more of the chest than this one does. Looking back also leaves the team no way to say whether this border was set at the shutters or at the workstation.',
      ],
      [
        'Restore the displayed field and read the frame you have.',
        'The workstation can only give back what is in the frame it is holding, and it gives it back without further exposure. If the surroundings appear, the border was drawn on the monitor; if they do not, the surrounding anatomy was never in the stored frame, the field was narrowed before the exposure at the shutters or in the acquisition, and bringing it back costs a new exposure either way.',
      ],
    ],
    'A border drawn on the monitor can be undone at no cost, and undoing it also says whether the surrounding anatomy was ever acquired. Reach for that operation first because it costs no exposure and because it also tells you which of the two restrictions you have been looking at.',
    ['wabip', 'tg272'],
  ),
  item(
    'time-practice-1',
    'optimize',
    'Reading these signals together, where does the movement that is showing up as separated positions belong?',
    'b',
    [
      [
        'The movement being seen is inside each exposure.',
        'Movement during one exposure draws the tool out along its direction of travel and softens the edge that should be sharp. Every held image here has a clean edge and a defined tip, so nothing is moving during the moment an image is being collected. This is the commonest reach at the console: an operator taught that motion smears an image shortens the exposure, which does answer blur, and leaves the separated positions exactly where they were.',
      ],
      [
        'The movement being seen is between exposures.',
        'A clean held image places nothing inside the moment an image is collected, and a picture that settles as the hand settles places nothing after acquisition, which leaves the interval from one exposure to the next. How far the tool goes in that interval is set jointly by how fast it is advanced and how often a fresh exposure is taken, so the same appearance can be answered by advancing more slowly, by sampling more often, or by working with the picture as it is, and only one of those three adds output.',
      ],
      [
        'The movement being seen is after the exposures.',
        'Handling after acquisition is real and does put the shown picture behind the hand: averaging across frames smears moving structures, and processing and refresh add delay. It announces itself differently, though, as a picture that keeps moving for a moment once the hand has already stopped. Here the picture settles when the hand settles, which places what is being seen before the display rather than in it.',
      ],
    ],
    'Three clocks act on a moving picture, and the room tells them apart. An image held still says whether anything moved while that image was being collected. Whether the picture settles when the hand settles says whether anything is being added after acquisition. What is left over is the interval from one exposure to the next, and how far the tool goes in it depends on the advance and on how often a fresh exposure is taken. Naming which clock is the limiting one, rather than which is briefest, is what decides whether a control would change what is seen or change nothing at all.',
    ['tg272', 'wabip'],
  ),
  item(
    'two-dimensional-practice-1',
    'choose',
    'Tissue lies to one side of the probe, and no lesion is separately visible on either projection. What is the best next move?',
    'b',
    [
      [
        'Withdraw the probe and advance the needle down the same branch to the depth where tissue appeared.',
        'Many teams read an eccentric picture as arrival and go straight to sampling. The probe reports only what lies beside it at one spot, and once it is withdrawn the needle takes its own line down the sheath: a depth does not carry the direction the tissue lay in. A dependent lower lobe that has lost its air reads as tissue on this same picture, so what would be sampled is a region nobody has yet identified.',
      ],
      [
        'Draw the probe slowly back and forth along the same branch to find where that tissue ends.',
        'The circle already says how far round the tissue reaches at this one station; what it cannot say is how far the tissue runs along the airway, or whether it ends. Drawing the probe back and forward answers that. Tissue that gives way to snowstorm at both ends behaves unlike tissue that runs on without a margin, and dependent lung emptied of air is the usual reason for the second.',
      ],
      [
        'Advance the probe deeper along the same branch and look for that tissue again from there.',
        'Going deeper is the reflex when a picture disappoints, and distance is sometimes what is missing. Here it moves before the station in hand has been read out. A radial probe cannot be aimed — it follows whatever airway it sits in — so travelling on does not carry it toward the tissue that appeared beside it; it only reports somewhere new, and gives up the one spot that has reported tissue at all.',
      ],
    ],
    'The circle around the probe says how far round tissue reaches at one station and nothing about how far it runs along the airway. Drawing the probe back and forward answers that without another exposure; if no edge comes back, the limit is what the probe itself can show, and the next question belongs to a measurement of another kind rather than to another picture of the same one.',
    ['ilocate', 'setser', 'mobile'],
  ),
  item(
    'dts-acquisition-practice-1',
    'dts',
    'The team still cannot say whether the tip lies in front of the nodule, behind it or against it. Which of the three on offer would speak to that here?',
    'b',
    [
      [
        'Two images, one at each end of the arc, read against each other.',
        'Two separated directions do carry part of what one direction hides, and which way the pair shifts relative to each other is a real cue to front and behind; this is the same reflex that reaches for one steep oblique, and it is not an empty one. What each of the pair returns, though, is a shift across the image rather than a distance along the ray, and inside a short arc that shift is small, so a pair that still reads close together bounds the relationship only loosely. Neither image spreads anything either: a projection lands everything along a ray on one pixel, so a rib sharing that ray is drawn across the target at full strength.',
      ],
      [
        'A short series of images taken across the arc, end to end.',
        'A span of directions carries a separation that any one of them compresses, and combining them lets what lies at the depth in question reinforce while what lies at other depths, the rib among them, spreads instead of being redrawn. Two images from the ends of the same arc cannot do that, however far apart they are taken, because each is read as itself and neither spreads anything. What returns is partial and comes back thinnest along the beam direction, which is the direction being asked about, so read the tip and the nodule on the planes and treat the gap as narrowed rather than settled. How wide an arc is available, and how much it returns, depends on the installed platform.',
      ],
      [
        'The frontal image again, in the finer detector mode.',
        'Sampling the same direction more finely separates structures lying side by side across the image; it does nothing along the ray, which is where these two are stacked. The mode name also describes a setting rather than what the system delivers, and that is a matter for commissioning rather than for the label. Either way it is silent about the directions this acquisition never sampled.',
      ],
    ],
    'Each image is one direction, and what a separated pair returns is a shift across the image rather than a distance along the ray; inside a short arc that shift is small, so a pair that still reads together bounds the relationship only loosely. A series across that same arc is combined, and that is what lets one depth reinforce while other depths, a crossing rib among them, spread instead of being redrawn. What comes back is partial, and thinnest along the beam direction itself, so the relationship is narrowed rather than settled.',
    ['saad', 'frontier', 'tg272'],
  ),
  item(
    'dts-acquisition-practice-2',
    'dts',
    'The nodule is the target for this biopsy. Which next move does the imaging support?',
    'c',
    [
      [
        'Hold the plane where the sweep brings tip and nodule up together, and sample from where the tip sits now.',
        "Coming up bright on a plane says the projections reinforced there, not that the structure lies at that depth. The vessel is bright on the nodule's plane and bright on the ones either side of it, because whatever a sweep separates least firmly along the beam stays spread across the planes it builds. Sharing a plane with the nodule is a claim about the picture, not about contact with the target.",
      ],
      [
        'Repeat the sweep across the same arc in finer steps, advance the tip to the nodule by what those planes show, and sample.',
        'Finer steps deliver more planes, and more planes look like more depth information, but each of them is built from the directions the arm has already travelled. How finely two structures can be told apart along the beam was set by the span of those directions, not by how many samples were taken inside it, so the separation read off the new planes is as loose a quantity as the one read off the first set. Advancing by it drives the needle along the axis this acquisition holds most loosely, toward neighbours it holds just as loosely, the vessel among them.',
      ],
      [
        'Sweep again with the arm swung around toward the side, place the tip on the nodule from those planes, and sample.',
        'Where the tip and the nodule sit relative to each other across the image comes from the projections themselves, so that half of the reading is firm. How loosely they separate along the beam was set by the span of directions the first sweep covered, and neither stepping through the planes it built nor walking that same span more finely adds a direction it never took. A sweep from outside that span carries the component the first one holds most loosely, which is the component this placement turns on.',
      ],
    ],
    'These planes place the tip and the nodule far more firmly across the image than along the beam. How loosely the two separate along the beam was set by the span of directions swept, before any plane reached the monitor, and walking that same span in finer steps leaves that separation as loose as it was, still too loose to advance a needle on. A direction outside the span is what sharpens it.',
    ['saad'],
  ),
  item(
    'dts-interpretation-practice-1',
    'dts',
    'Which reading of the second monitor is best supported by what is visible on the screens?',
    'a',
    [
      [
        'A sweep with the instrument standing in the field brings it onto the planes it builds, so the margin they draw came from a different acquisition than this sweep.',
        'Each plane is assembled from rays that crossed whatever lay in the field while the sweep ran, and an instrument the live image resolves this cleanly is not something those rays could have missed. Its absence therefore says nothing about where the catheter is; it says the pixels drawn in that region were not measured while the catheter sat there. Something else supplied that margin, at some other moment, so the contour describes the lesion as it was then, and nothing on the second monitor speaks to where it sits now.',
      ],
      [
        "The sweep's narrow fan of angles leaves a thin instrument too poorly sampled in depth to appear on these planes, so the margin they draw is this sweep's own measurement.",
        "A narrow fan of angles really does leave depth poorly sampled, and an object at another depth stays bright across neighbouring planes instead of resolving onto one; that behaviour is what this reading reaches for. Poor sampling in depth is not exclusion, though. A dense instrument standing in the imaged volume brightens more planes, not none of them, and the same coverage is drawing the lesion's fine margins on the very planes it is supposed to have left the catheter off. Detail that fine surviving while a dense instrument is nowhere is not something one sweep's projections do on their own.",
      ],
      [
        "A drift in the stored alignment leaves the instrument on other planes, so the margin they draw is this sweep's, addressed to a frame that has slipped from what lies beneath it.",
        'Operators do meet stored alignments that have slipped from what lies beneath them, and asking where a display is addressed is a fair instinct. A drift moves what it addresses, though; it does not empty the planes of anything. The instrument and the airway holding it were drawn by one set of rays, so a shift in depth carries both together, and the planes still showing that airway and the lesion are the planes that would show the instrument lying in them. This reading also credits the margin to the very sweep the instrument is missing from, and the move it yields, waiting on a refreshed alignment, cannot supply an instrument these planes never held.',
      ],
    ],
    "An instrument that sat in the airway for the whole sweep is the one thing an image built from that sweep's projections could not leave out. Limited angular coverage smears such an object along depth, brightening more planes rather than emptying them; a shift in how planes are addressed carries the instrument and the anatomy around it together, because one set of rays drew both, so a refreshed alignment would not place an instrument onto planes that never held one. What the absence marks is which acquisition supplied those pixels: the margin describes the lesion at whatever moment that acquisition was made. Anatomy that looks familiar is one picture resembling an older picture, not evidence about the lesion since. Finding the instrument somewhere in the volume would settle only that something on the display was measured during the sweep, because a reconstruction can carry a live instrument over a contour an older scan supplied; the two questions stay apart.",
    ['saad', 'pritchett'],
  ),
  item(
    'cbct-acquisition-practice-1',
    'cbct',
    'How should the team use this volume to judge the needle against the nodule?',
    'a',
    [
      [
        'Read the needle against the nodule where this spin reaches, then re-center the arc on the nodule and spin again.',
        'The needle and the near side of the nodule both sat inside what the orbit took in, so the meeting shown there is something this spin imaged. Anatomy beyond that edge was never in the beam, and what a spin takes in is fixed by the field it sweeps and where that field is centred, so the far side comes inside only when the arc is centred on the nodule and the anatomy is imaged again. Centring the arc moves the imaging rather than the patient, so the catheter stays where it sits and the needle stays where it was placed, and the whole orbit is walked for clearance around the docked arm before the next exposure.',
      ],
      [
        'Read the needle against the nodule where this spin reaches, then swing the arc through more angles and spin again.',
        'More angles answers a different shortfall. Where directions are missing, anatomy that was inside the volume all along is smeared along depth, and a fuller turn measures those directions and firms it up. Nothing inside this volume is smeared: edges are single throughout, and the far side is not measured poorly but not measured at all. What a spin takes in is fixed by the field it sweeps and where that field is centred, so travelling further around the same centre gathers more views of the same anatomy, gives a longer swing that still has to clear the docked arm, and leaves the far side outside the volume as before.',
      ],
      [
        'Read the needle against the nodule where this spin reaches, then ask for a wider rebuild of this spin, the arc left as it is.',
        'Rebuilding before spending another exposure is a fair instinct, and it leaves a working setup alone. But a volume is built from the projections the orbit collected, and out where the beam never swept there are none to build from, so a wider rebuild enlarges the frame around the same measured anatomy and leaves the far side as unimaged as it already was.',
      ],
    ],
    'A finished volume answers only for the anatomy the orbit actually took in, so find where that coverage ends before reading a needle against a target. Sharpness inside the volume says nothing about anatomy outside it, and a wider rebuild draws on the same projections, so the far side comes in only when the geometry that set the coverage is changed and the anatomy is imaged again, or when other current evidence is used instead. Which part of that geometry is changed decides whether anything is gained: how far the source travels around settles which directions are measured, while the field it sweeps and where that field is centred settle how much of the patient is measured at all.',
    ['setser', 'mobile'],
  ),
  item(
    'fixed-suite-practice-1',
    'cbct',
    'What should the team do next?',
    'c',
    [
      [
        'Swing the live image well away from the projection in use and read the needle against the nodule as the contour there marks it.',
        'Changing the angle changes which direction is flattened; it does not remove the flattening. A projection compresses whatever lies along its own beam into a single plane, so metal can sit over the nodule in the image and still stop short of it in the patient. And what such an image offers as the nodule is the contour laid onto it, a boundary the room draws over live anatomy rather than one it measures there.',
      ],
      [
        "Turn one of the room's chest studies and read the needle against the nodule as the contour on them marks it.",
        'The acquisition here is the one the question needs; what gets read on it is not. A contour reports where a boundary was placed at the moment it was placed, and the room will lay it onto whatever it displays, images taken after the needle moved included. Those images carry the lesion as tissue, and tissue is what the sampling end has to sit inside.',
      ],
      [
        "Turn one of the room's chest studies and read the needle against the nodule as the tissue on them shows it.",
        'One orbit carries the metal and the lesion in the same images, so how far apart they lie along the beam is measured rather than inferred. Reading the nodule as the tissue on those images takes the boundary from the geometry the needle now sits in, instead of from the contour the room is carrying in from a spin turned before it moved.',
      ],
    ],
    "A projection reports overlap, not depth, and a contour reports where a boundary was placed rather than where tissue lies now. When the question is where metal sits inside a lesion, one acquisition has to carry both of them, and the reading has to be taken from the tissue those images measured rather than from the contour laid over them. Which of a room's studies suits which question is settled locally with the technologist and the medical physicist.",
    ['verhoeven', 'setser', 'pritchett'],
  ),
  item(
    'mobile-suite-practice-1',
    'cbct',
    'What should the team change before spinning again?',
    'c',
    [
      [
        'Lift the monitoring lines off the chest and unhook them from the rail, then spin again.',
        'Cable and tubing do lay their own thin bright lines through a volume, and lifting them off the chest is worth doing before a spin. What is on these slices is heavier than that. Paired dark and bright banding, and a boundary that comes apart, are what a dense, sharply bounded object throws when the beam has to get through it on some views and not others; cable and tubing attenuate too little to build that. Lifting them changes a small part of what the beam crosses and leaves the dense hardware standing where it is.',
      ],
      [
        'Switch the reconstruction to metal reduction, rail and bracket in place, then spin again.',
        'That setting exists for metal nobody can take out of the beam: an implant, a spinal rod, the instrument in the airway. Asked to stand in for hardware that unclips in a moment, it still works from views in which the margin was never cleanly sampled, and it can quiet the banding without giving the boundary back. What such a setting does, and what a given workstation calls it, differs by model and software version.',
      ],
      [
        'Unclip the rail and the armboard bracket and set them both aside, then spin again.',
        'Clearing the gantry and being out of the beam are different things. Through the lateral part of the orbit the raised rail and the bracket lie between the tube and the detector, so those views are recorded through them, and the volume is built from those views. Unclipping the two fittings is the change that alters what the next set of views has to work from; lifting light cable off the chest, or altering something downstream at the workstation, hands the reconstruction the same measurement over again.',
      ],
    ],
    "What the beam crosses on its way round the table is the measurement the volume is made of. Clearing the gantry and being out of the beam are different things: hardware can stand clear of the arc's path and still lie between the tube and the detector through part of the orbit. Cable lifted off the chest, and a reconstruction setting chosen at the workstation, both leave that dense hardware in the views the volume is built from, while hardware that unclips is dealt with in the room, before the arc moves. That is why a table and its fittings belong to the acquisition and not only to patient positioning, and why a room, its table and a scanner are brought up together rather than one at a time.",
    ['setser', 'mobile', 'tg272'],
  ),
  item(
    'tool-confirmation-practice-1',
    'verify',
    'How should the team read the acquired volume to say where the needle now stands in relation to the target?',
    'a',
    [
      [
        "Reformat the axial images into a plane that runs along the shaft's own course, and another across it, then read the whole metal shaft and its sampling opening against the target.",
        "A plane holds only the metal lying inside it, so a shaft running at an angle to a stack of images leaves a fragment wherever it cuts through one, and the fragments strung down a run of images are sections through the shaft rather than its length. A plane built along the shaft's own course carries the whole of it, and a plane built across the shaft gives the lateral relationship the first cannot show. Both come out of the volume already acquired, and what the pair supports is a statement about where the sampling opening stood at that moment.",
      ],
      [
        'Reformat the axial images into the coronal and sagittal planes through the target, then read the metal shaft and its sampling opening against it in those two perpendicular views.',
        'Two perpendicular planes do settle a relationship for something that lies within both of them, which is why a compact lesion reads well this way. The shaft is the difficulty. Coronal and sagittal are fixed planes just as the axial images are, so a shaft lying at an angle to them is fragmentary in each, and a pair placed through the target need not contain the sampling opening at all. Perpendicular is not the property that resolves this; a plane that follows the tool is.',
      ],
      [
        'Count the axial images that carry metal and multiply by their thickness, then set the metal shaft and its sampling opening against the depth planned to the target.',
        'The extent of an angled shaft across a stack is only the component of its length that runs along the scrolling direction, so a count of images multiplied by their thickness understates how far the shaft has travelled, by an amount set by an angle those images do not display. The metal on each image is a section through the shaft rather than a piece of it laid end to end, which is why the count answers a different question from the one the team is asking.',
      ],
    ],
    "Which plane you look at decides whether an instrument's course can be followed at all. A plane holds only the metal inside it, so a tool lying at an angle to a stack leaves a fragment on each image it crosses, and neither the longest fragment nor the number of images carrying metal is the shaft. Planes built along the tool and across it come out of the volume already in hand, and what they support is a statement about where the sampling opening stood at that moment: a statement about position, not about the tissue that will enter the needle.",
    ['setser', 'confirm'],
  ),
  item(
    'changing-anatomy-practice-1',
    'verify',
    'What is the most useful next step?',
    'a',
    [
      [
        'Re-identify the nodule in the current volume and treat the stored contour as historical.',
        'A region that appeared between the two acquisitions, with the rest of the volume unchanged and blood suctioned in between, is best read as a change in the patient rather than a limitation of the picture. Identifying the nodule again in current imaging is what re-establishes where it is; if it cannot be separated from the new region on thin reformats, another needle placement is not yet supported.',
      ],
      [
        'Repeat the rotational acquisition at higher output and re-read the indistinct border on that volume.',
        'This reads a change in the patient as an image-quality limitation. Noise degrades the whole reconstruction rather than one region around one nodule, and the first volume, acquired the same way, showed nothing there at all; raising output renders this region more clearly, which is the opposite of removing it.',
      ],
      [
        'Shift the stored contour onto the new region and treat it as the current target.',
        'Moving a stored outline onto a region whose identity has not been established makes the display agree with itself while the anatomy underneath stays unconfirmed. An overlay may be re-derived from a volume in which the lesion has been identified; it may not be aimed at material of unknown identity.',
      ],
    ],
    'Here the new region appeared while the rest of the volume looked the same and blood had been suctioned in between, so it is best read as a change in the patient until current imaging shows otherwise; movement during the sweep, streak from indwelling hardware or limited angular coverage can also make a finding appear on one volume and not the other, so name the mechanism before acting on it. The contour drawn on the first volume records lung that has since changed, and more output would render either kind of finding more clearly rather than removing it, so the earlier picture can inform the next look but cannot stand in for it.',
    ['setser', 'tg272', 'pritchett'],
  ),
  item(
    'staff-protection-practice-1',
    'protect',
    'The run is about to begin. Which of the three positions leaves the fellow least exposed during this projection?',
    'c',
    [
      [
        'Step farther back along the table on the tube side.',
        'Distance generally helps, but a step back along the same side keeps the fellow on the side where scatter is heavier, and both locations under consideration are already outside the irradiated field. Worn shielding attenuates what arrives rather than removing it, and the eyes are not covered by an apron at all, so garments do not make the two sides equivalent.',
      ],
      [
        'Stay beside the tube housing where the fellow is.',
        'This follows the primary beam downstream and expects the hazard to sit where it exits. What reaches staff is scattered off the irradiated tissue and is heavier back toward the tube, so the near side is not the sheltered one.',
      ],
      [
        'Move around to the detector side of the table.',
        'Nearly all of what reaches the room is scattered off the irradiated patient, and that scatter is more intense back toward the surface the beam enters, so the detector side is generally the lower-exposure side in this geometry. Distance from the table is comparable at all three locations, so which side of the patient the beam enters is what separates them here.',
      ],
    ],
    "Two people the same distance from the table can be exposed quite differently depending on which side of the C-arm they occupy, and angulation shapes that asymmetry. Distance and worn shielding are only part of the plan, because the side the beam enters sets the pattern around the table; the room's survey and radiation safety officer set the verified locations.",
    ['wabip', 'icrp'],
  ),
  item(
    'dose-reporting-practice-1',
    'protect',
    'How should the team read this notification, and what does it ask of them?',
    'a',
    [
      [
        "The level marks where local policy asks for a review of this patient's dose record: log that line in mGy — the running total for this patient over the case — and the acquisitions it covers, then open that review.",
        "The line the notification names is this patient's running total at the interventional reference point, an index that climbs across every fluoroscopic and rotational run of one case, which is why the level is set on it and why it belongs in this patient's record. What the review covers is the running total so far, the record entry, the imaging still planned and any follow-up; where the level sits is institution dependent. Logging that line, its units and the acquisitions it covers is what keeps it apart from the figures printed beside it — the kerma–area product sums a different quantity, the same line is not what one patch of skin has taken, and neither figure describes how the equipment is performing.",
      ],
      [
        "The level marks where local policy asks for a review of this system's output: log that line in mGy — the running total for this system over the case — and the acquisitions it covers, then open that review.",
        "A dose notification is set on a figure that accumulates over one patient's imaging, not on how the system is performing. Cumulative reference air kerma climbs with every angle, mode and minute the beam is used in this case, so a high running total describes how the beam was used here rather than whether the equipment meets its own specification — which acceptance and periodic evaluation settle, not one patient's total. Opening an output review of the system leaves the patient-side review, the record entry, the imaging still planned and any follow-up unopened.",
      ],
      [
        "The level marks where local policy asks for a review of this patient's skin: log that line in mGy — the running total for one patch of skin over the case — and the acquisitions it covers, then open that review.",
        'Cumulative reference air kerma is an equipment-reference index reported at the interventional reference point, not the highest dose any one patch of skin has received. It takes no account of how far the steep obliques moved the entrance beam across the back, of table height, or of backscatter, so reading the mGy line as a skin figure overstates that dose in some geometries and understates it in others — and a skin review then rests on that figure, while the review the level exists to open is still not started.',
      ],
    ],
    "A notification level is set on a figure that accumulates across one patient's imaging, and what it opens is review under local policy: the running total so far, the record, the imaging still planned and any follow-up. It is not the dose reached on one patch of skin, and it is not a statement about how the equipment is performing. Naming the line the notification reports, its units and the acquisitions it covers is what keeps it apart from the other figures printed beside it.",
    ['aapm12', 'wabip', 'skin'],
  ),
]

export const QUESTION_BY_ID = Object.fromEntries(
  QUESTIONS.map((question) => [question.id, question]),
) as Record<string, Question>
