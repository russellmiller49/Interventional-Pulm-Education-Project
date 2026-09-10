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
    'Navigation places the catheter at the virtual target. The needle is visible on fluoroscopy, but the lesion is not. What does the imaging confirm?',
    'b',
    [
      [
        'The needle is within the lesion, since the catheter reached the navigation target and the needle is seen.',
        'Reaching the navigation target and seeing the needle do not establish tool-in-lesion. With CT-to-body divergence the lesion may no longer sit at the virtual target, and it has not been visualized.',
      ],
      [
        'The catheter reached the navigation target; the lesion and needle–lesion relationship are unconfirmed.',
        'Navigation confirms catheter position relative to the navigation target. The current lesion location, and the actual biopsy tool’s relationship to it, still need intraprocedural imaging.',
      ],
      [
        'The biopsy will be diagnostic, since the catheter reached the navigation target and the needle is in view.',
        'Navigation and imaging cannot predict the specimen. Lesion localization, tool-in-lesion confirmation and diagnostic tissue are separate endpoints.',
      ],
    ],
    'Navigation target reached, lesion localized, tool-in-lesion confirmed and diagnostic tissue obtained are distinct endpoints.',
    ['setser', 'confirm'],
  ),
  item(
    'anatomy-1',
    'choose',
    'During bronchoscopy, central airway landmarks remain aligned with the planning CT, but a new dependent opacity now obscures a previously distinct peripheral lesion. What is the best next step?',
    'c',
    [
      [
        'Recalibrate navigation and continue sampling at the same virtual target.',
        'Peripheral CT-to-body divergence can occur while central registration is accurate. Recalibration does not address atelectasis or show where the lesion is now.',
      ],
      [
        'Navigate more precisely to the virtual target and sample at that location.',
        'Greater precision toward a target derived from the planning CT does not identify the current lesion. Reconfirm the lesion before sampling.',
      ],
      [
        'Assess for atelectasis and re-localize the lesion on current imaging.',
        'A new dependent opacity suggests atelectasis, one form of CT-to-body divergence. Agree a ventilation strategy with anesthesia and re-localize the lesion on current imaging before relying on the virtual target.',
      ],
    ],
    'Accurate central registration can coexist with peripheral CT-to-body divergence.',
    ['setser', 'ilocate'],
  ),
  item(
    'geometry-1',
    'optimize',
    'A needle and nodule overlap on the frontal projection but separate on an oblique projection. The needle was not moved. What best explains the change?',
    'a',
    [
      [
        'Parallax: needle and nodule were only superimposed on the frontal view.',
        'Rotating the C-arm changed the projection, and the separation reflects a depth difference the frontal view collapsed. Reassess the trajectory; the projection change did not move the needle.',
      ],
      [
        'Rotating the C-arm moved the needle toward the nodule in the oblique view.',
        'Changing the projection alters the image, not the instrument position. Do not mistake a new view for a physical correction of the needle.',
      ],
      [
        'The frontal overlap confirms tool-in-lesion; the oblique separation is artifact.',
        'A single projection collapses depth. The oblique view shows why the frontal overlap was superimposition rather than tool-in-lesion.',
      ],
    ],
    'Changing the projection changes the image, not the anatomy or the tool.',
    ['setser', 'pritchett'],
  ),
  item(
    'signal-1',
    'optimize',
    'The image is stable, the tool is sharp and there is little noise, but the lesion is projected over the cardiac silhouette. Which adjustment most directly improves lesion conspicuity?',
    'b',
    [
      [
        'Increase radiation output and keep the same C-arm projection throughout.',
        'More photons reduce quantum noise but still image the heart superimposed on the lesion. Change the projection before increasing dose.',
      ],
      [
        'Change the C-arm projection, planned from the CT, to clear the heart.',
        'A different projection can separate the lesion from the cardiac silhouette. Recenter, recollimate, check clearance, and recheck the dose rate after the angle change.',
      ],
      [
        'Apply display zoom while keeping the same C-arm projection.',
        'Display zoom enlarges acquired pixels but keeps the same superimposition. It addresses a different problem.',
      ],
    ],
    'Anatomical superimposition and quantum noise require different responses.',
    ['tg272', 'setser'],
  ),
  item(
    'field-1',
    'optimize',
    'After acquisition, the technologist electronically crops the displayed image. The collimator blades and acquisition settings are unchanged. What happened to the radiation already delivered?',
    'a',
    [
      [
        'It is unchanged; cropping acts only on the displayed image.',
        'Electronic cropping changes the displayed image only. Physical collimation must narrow the beam before the next exposure to change the irradiated field.',
      ],
      [
        'It fell in proportion to the smaller field shown on the monitor.',
        'This confuses displayed pixels with irradiated tissue. Check the collimator position and the dose indices.',
      ],
      [
        'It rose, because the cropped image displays larger pixels.',
        'Display processing of a stored image delivers no new X-rays. Changing the acquisition field is a separate operation.',
      ],
    ],
    'Ask whether a control changes the acquisition, the detector readout, or only the display.',
    ['tg272', 'wabip'],
  ),
  item(
    'time-1',
    'optimize',
    'In an authored example at fixed tube current, pulse rate is halved and pulse width is doubled. kV, filtration and geometry are held fixed. What happens to mAs per second?',
    'c',
    [
      [
        'It halves, in proportion to the lower pulse rate.',
        'That would require the exposure per pulse to stay the same. Here each pulse is twice as long.',
      ],
      [
        'It doubles, in proportion to the longer pulse width.',
        'That ignores the simultaneous halving of the pulse rate. Account for both pulse width and pulse rate.',
      ],
      [
        'It remains constant under these conditions.',
        'Tube current × pulse width × pulse rate is the same. There are fewer images per second and more motion within each pulse; this exercise does not calculate patient dose.',
      ],
    ],
    'Reducing pulse rate alone does not establish dose reduction or adequate temporal resolution.',
    ['tg125', 'tg272'],
  ),
  item(
    'workflow-1',
    'choose',
    'After collimation and a better oblique projection, a faint lesion remains poorly defined. The needle is well seen, but its depth relative to the lesion is uncertain. What is the most useful next step?',
    'b',
    [
      [
        'Acquire a longer fluoroscopy loop in the same projection.',
        'A longer loop of the same static projection will not resolve lesion identity or depth. The imaging needs to answer a different question.',
      ],
      [
        'Obtain a depth-resolving projection or DTS/CBCT before advancing the needle.',
        'A sufficiently separated projection, DTS or CBCT can resolve the depth relationship and the current lesion location. Match the acquisition to what would change safe sampling.',
      ],
      [
        'Advance the needle under fluoroscopy until it reaches the navigation virtual target.',
        'A visible needle and a virtual target do not establish the current lesion location. Confirm the lesion–tool relationship before advancing into an uncertain target.',
      ],
    ],
    'Fix the limiting factor before increasing dose, and change modality when 2D fluoroscopy stops resolving depth.',
    ['setser', 'mobile'],
  ),
  item(
    'dts-1',
    'dts',
    'A DTS reconstruction shows small voxels and sharp in-plane edges, but structures are elongated in the depth direction. Which interpretation is best supported?',
    'a',
    [
      [
        'Angular coverage still limits resolution in some directions.',
        'Fine sampling of the reconstructed volume cannot supply viewing directions that were not acquired. Interpret the depth relationship within that limit.',
      ],
      [
        'Small voxels establish equally fine resolution in depth.',
        'This confuses the reconstruction matrix with measured resolution. Assess angular coverage and validated performance.',
      ],
      [
        'More projections over the same arc would remove the depth blur.',
        'Additional projections within the same angular range do not add the missing viewing directions. Projection count and angular coverage are different.',
      ],
    ],
    'DTS adds depth information, but depth resolution depends on angular coverage.',
    ['saad'],
  ),
  item(
    'prior-1',
    'dts',
    'A prior-aided DTS reconstruction study improves image similarity to reference CBCT in a phantom and a small set of patient datasets. What can be concluded directly?',
    'c',
    [
      [
        'The method increases diagnostic yield across bronchoscopy programs.',
        'Image similarity is not diagnostic yield. A clinical outcomes study is needed to establish that claim.',
      ],
      [
        'The method lowers whole-procedure radiation dose across all clinical targets.',
        'A reconstruction comparison does not measure all procedural exposures or all case types. Keep the endpoint specific.',
      ],
      [
        'The method shows closer agreement with CBCT under the studied conditions.',
        'This matches the technical endpoint. Prior information can help reconstruction, while clinical outcomes and generalizability require separate evidence.',
      ],
    ],
    'Keep conclusions at the level of the measured endpoint.',
    ['saad'],
  ),
  item(
    'acquisition-1',
    'cbct',
    'The lesion is centered on the frontal view but lies near the anterior edge of the planned reconstruction volume on the lateral view. What should happen before the CBCT spin?',
    'a',
    [
      [
        'Reposition using the supported centering method and recheck clearance.',
        'Frontal centering leaves the anteroposterior dimension unresolved. Fix the offset at the isocenter and verify the new setup before exposure.',
      ],
      [
        'Increase the reconstruction matrix size and keep the current table position.',
        'A finer matrix cannot recover a lesion outside the reconstruction volume. Fix the coverage rather than the display sampling.',
      ],
      [
        'Acquire now and use a thicker slab to recover the lesion.',
        'A thicker slab cannot restore anatomy that was outside the reconstruction volume. Establish coverage before acquisition.',
      ],
    ],
    'Center the lesion, not just the chest, in the reconstruction volume.',
    ['setser'],
  ),
  item(
    'fixed-1',
    'cbct',
    'In a fixed C-arm suite, the augmented-fluoroscopy overlay follows a supported table move. A recruitment maneuver then changes lung inflation. How should the overlay now be treated?',
    'c',
    [
      [
        'As the current lesion location, because table tracking remained active.',
        'Equipment tracking does not establish that peripheral lung inflation is unchanged. Reconfirm the lesion.',
      ],
      [
        'As the current lesion location, because the contour still looks plausible.',
        'Plausibility invites confirmation bias. Check the underlying fluoroscopic image and the respiratory state.',
      ],
      [
        'As a prior segmentation that must be reconfirmed after the change.',
        'A registered table move and a physiological change are different. Re-establish overlay validity before relying on the contour.',
      ],
    ],
    'Equipment registration is not anatomical tracking.',
    ['pritchett', 'setser'],
  ),
  item(
    'mobile-1',
    'cbct',
    'A mobile CBCT scanner exports a volume to a workstation. No navigation target-update integration has been validated. What capability is established?',
    'b',
    [
      [
        'Automatic correction of the navigation target coordinates on the platform.',
        'Exporting a volume does not establish coordinate transfer or a validated navigation update. Verify integration separately.',
      ],
      [
        'Review of current CBCT images on the receiving workstation.',
        'The images support current anatomical review there. A navigation target update and a live overlay each need their own validated workflow.',
      ],
      [
        'A registered overlay that follows subsequent fluoroscopy.',
        'A live registered overlay requires additional geometry and integration. DICOM export alone does not establish it.',
      ],
    ],
    'CBCT image review, navigation target update and augmented fluoroscopy are separate capabilities.',
    ['mobile', 'setser'],
  ),
  item(
    'tool-1',
    'verify',
    'A thick-slab MIP shows the needle overlapping the lesion. Thin multiplanar reformats show the needle’s side-cutting window separated from the lesion in depth. What is the best interpretation?',
    'a',
    [
      [
        'The slab superimposed structures that lie at different depths.',
        'The thin planes resolve a separation the slab concealed. Identify the sampling window, not just the needle, and review the trajectory before sampling.',
      ],
      [
        'The slab confirms tool-in-lesion because it shows more anatomy.',
        'Including more depth can conceal a gap. A slab does not override a separation resolved on adequate thin reformats.',
      ],
      [
        'The brightest needle-tip pixel shows where tissue will be sampled.',
        'Tip brightness does not define the sampling region. Identify the side-cutting window, forceps jaws or cryoprobe active segment of the actual tool.',
      ],
    ],
    'Confirm the part of the biopsy tool that acquires tissue, not just overlap of the needle.',
    ['setser', 'pritchett'],
  ),
  item(
    'change-1',
    'verify',
    'A CBCT reconstruction shows duplicated tool and lesion edges from motion during the spin. What most directly addresses the cause before repeating it?',
    'b',
    [
      [
        'Increase exposure and repeat the same acquisition.',
        'More photons do not undo motion between projections. Restore stability and breath-hold coordination first.',
      ],
      [
        'Re-establish a stable, tolerable breath hold with anesthesia.',
        'This addresses the inconsistency between projections. Anesthesia safety and tool stability govern the timing of the next acquisition.',
      ],
      [
        'Use a thicker display slab and accept the duplicated edges as they are.',
        'Combining depths can hide motion artifact without restoring reliable localization. Obtain an adequate acquisition.',
      ],
    ],
    'Address the cause of a degraded acquisition before repeating it.',
    ['setser', 'vespa'],
  ),
  item(
    'safety-1',
    'protect',
    'During a lateral projection, a clinician proposes holding an accessory in the primary beam while wearing a lead glove. What is the best response?',
    'c',
    [
      [
        'Proceed; the glove substitutes for keeping hands out of the beam.',
        'A protective glove does not justify placing a hand in the primary beam, and it can drive automatic exposure regulation up. Use a supported stabilization method outside the field.',
      ],
      [
        'Proceed if the monitor brightness looks unchanged.',
        'Brightness does not indicate exposure or hand protection. Automatic exposure regulation can mask an increase in output.',
      ],
      [
        'Stabilize the tool with hands outside the irradiated field.',
        'This removes the exposure pathway. Confirm the instrument position after stabilization and follow the local radiation protection program.',
      ],
    ],
    'Protective equipment does not make hand placement in the primary beam acceptable.',
    ['icrp', 'wabip', 'tg125'],
  ),
  item(
    'dose-1',
    'protect',
    'After tighter collimation, reference air kerma rises slightly while KAP falls. Which interpretation best fits these observations?',
    'b',
    [
      [
        'The two values conflict, so the lower one should be disregarded.',
        'They are different quantities. A smaller irradiated area can outweigh a local kerma increase in the area product.',
      ],
      [
        'A smaller exposed area can outweigh a rise in local output.',
        'KAP combines air kerma and field area. Interpret each index and the modes included; neither directly measures peak skin dose.',
      ],
      [
        'The falling KAP proves that the peak skin dose also fell.',
        'Peak skin dose depends on geometry, field overlap and tissue corrections. KAP alone cannot establish that change.',
      ],
    ],
    'Name the dose quantity before making a radiation claim.',
    ['aapm12', 'skin', 'tg125'],
  ),
  item(
    'case-1',
    'choose',
    'A lesion lies near the pleura. Navigation reports arrival at the target, but neither fluoroscopy nor current imaging identifies a convincing lesion boundary. The needle is still retracted. What should happen next?',
    'c',
    [
      [
        'Extend the needle toward the virtual target before obtaining a CBCT spin.',
        'This deploys the needle along an uncertain path before the lesion and nearby pleura are defined. Keep the tool retracted and obtain the missing localization.',
      ],
      [
        'Use a longer needle excursion to allow for CT-to-body divergence.',
        'A longer blind excursion does not resolve CT-to-body divergence and can reach the pleura or other unintended structures. Localize the lesion first.',
      ],
      [
        'Localize the lesion on intraprocedural imaging before deploying the needle.',
        'Localization while the needle is retracted resolves the uncertainty safely. A later tool-in-lesion CBCT answers a different question when appropriate.',
      ],
    ],
    'Do not create a tool-in-lesion image by deploying a needle into an uncharacterized region.',
    ['setser', 'mobile'],
    true,
  ),
  item(
    'case-2',
    'optimize',
    'On a last-image-hold frame, the needle edge is resolved but too small to inspect comfortably on the operator’s monitor. Which action addresses this?',
    'a',
    [
      [
        'Apply display zoom to the stored image.',
        'Display zoom makes acquired information easier to inspect without new exposure. Return to the full view when surrounding anatomy is needed.',
      ],
      [
        'Select a higher-dose preset and acquire another loop.',
        'The edge is already resolved. More acquisition does not address a viewing problem.',
      ],
      [
        'Move the patient toward the tube for geometric magnification.',
        'This changes geometry, exposure and focal-spot blur to solve a viewing problem with information that is already present. Use display zoom first.',
      ],
    ],
    'When the information is already present, solve a viewing problem with display zoom.',
    ['tg272', 'tg125'],
  ),
  item(
    'case-3',
    'dts',
    'A vendor-neutral research report evaluates a DTS algorithm that combines limited-angle projections with a registered prior CT. The reconstructed lung looks more like the reference scan. Which additional evidence would address clinical effectiveness?',
    'b',
    [
      [
        'A demonstration of a finer reconstruction matrix.',
        'Matrix spacing is not a patient outcome and does not independently measure recovered information.',
      ],
      [
        'An outcomes study with defined diagnostic and safety endpoints.',
        'Clinical endpoints show whether the imaging method benefits the procedure. Specify the population, comparator, outcome definitions and all exposures.',
      ],
      [
        'A demonstration that the prior contour remains visually familiar.',
        'Resemblance to the prior can reflect the prior’s influence on the reconstruction. It does not establish current anatomy or clinical effectiveness.',
      ],
    ],
    'Technical validation and clinical effectiveness answer different questions.',
    ['saad', 'frontier'],
  ),
  item(
    'case-4',
    'cbct',
    'A mobile C-arm clears the patient in the frontal position. After robot docking, the full CBCT spin path has not been checked and ventilator tubing crosses the expected path. What is the best next action?',
    'c',
    [
      [
        'Start the spin, relying on the frontal clearance already observed.',
        'A static check cannot establish clearance for a rotational acquisition after a setup change. Resolve the tubing and verify the supported spin path before exposure.',
      ],
      [
        'Use a lower-dose protocol and keep the current setup.',
        'A dose protocol does not resolve a collision or access problem. Reconfigure safely and recheck.',
      ],
      [
        'Reposition the tubing and perform a supported collision check.',
        'This addresses the changed setup. Include the table, robot, tube, detector, patient and anesthesia access in the collision check.',
      ],
    ],
    'The collision check must match the setup that will actually be scanned.',
    ['setser', 'mobile'],
    true,
  ),
  item(
    'case-5',
    'verify',
    'In the course’s fictional needle design, the tip lies beyond a spherical lesion, and thin reformats place part of the side-cutting window inside it. Which documentation is most accurate?',
    'a',
    [
      [
        'The side-cutting window partly intersects the lesion in this acquisition.',
        'This states the component and extent the images demonstrate. Diagnostic adequacy and safety remain separate judgments for the real tool.',
      ],
      [
        'The needle tip is in the lesion because the window intersects it.',
        'Tip position and window position are distinct. Describe the component the images actually show.',
      ],
      [
        'Diagnostic sampling is assured because metal crosses the lesion.',
        'Geometric intersection does not guarantee adequate tissue. Keep the diagnostic endpoint separate.',
      ],
    ],
    'Document which part of the biopsy tool is in the lesion, and in which acquisition.',
    ['setser', 'confirm'],
  ),
  item(
    'case-6',
    'verify',
    'During a breath hold for a CBCT spin, anesthesia reports worsening hemodynamic tolerance and asks to end the hold before the spin is complete. What is the best response?',
    'b',
    [
      [
        'Complete the spin and raise image quality to avoid a repeat.',
        'Completing the acquisition does not override physiological intolerance. More exposure does not make the breath hold tolerable.',
      ],
      [
        'Stop the exposure and restore physiological support.',
        'Patient tolerance governs the breath hold. Reassess the cause, the adequacy of the scan and a safer strategy before another acquisition.',
      ],
      [
        'Continue the hold while oxygen saturation remains acceptable.',
        'Oxygen saturation alone does not establish ventilation, CO₂ elimination, airway pressure or hemodynamic safety. Respond to the reported intolerance.',
      ],
    ],
    'An imaging milestone never supersedes physiological safety.',
    ['setser', 'vespa'],
    true,
  ),
  item(
    'case-7',
    'protect',
    'During a CBCT spin, staff can maintain the required monitoring from the room’s verified protected positions. One person proposes remaining unshielded at an arbitrary distance from the patient. What is the best plan?',
    'a',
    [
      [
        'Use the verified barriers, with continued observation and patient access.',
        'Follow the room’s radiation protection plan. An arbitrary distance does not establish acceptable scatter exposure during a rotational acquisition.',
      ],
      [
        'Use the proposed distance, because the scanner is mobile.',
        'Portability does not establish room shielding adequacy or a safe distance. Apply the measured local protection plan.',
      ],
      [
        'Use the proposed distance if the patient’s KAP display looks low.',
        'Patient KAP is not a measure of dose at a staff position. Staff exposure also depends on geometry and barriers.',
      ],
    ],
    'No universal unshielded safe zone follows from a scanner category or a distance.',
    ['wabip', 'icrp'],
    true,
  ),
  item(
    'case-8',
    'protect',
    'An authored dose report lists a total KAP of 12 Gy·cm², comprising 8 Gy·cm² from fluoroscopy and 4 Gy·cm² from CBCT spins. What should the whole-procedure entry say?',
    'c',
    [
      [
        '24 Gy·cm², adding the total and both components.',
        'This double counts the same exposure. Keep the component values without adding them again to the stated total.',
      ],
      [
        '4 Gy·cm², recording the CBCT subtotal.',
        'This omits fluoroscopy, which contributes to the procedure. Record the total and identify its components.',
      ],
      [
        '12 Gy·cm² total, with both component values identified.',
        'The components sum to the stated total. Record units and included modes, and separately keep the other available dose indices and fluoroscopy time.',
      ],
    ],
    'Count every acquisition mode once and state the units.',
    ['wabip', 'aapm12'],
  ),
  item(
    'choose-transfer-1',
    'choose',
    'The radial EBUS view is concentric, and the catheter icon sits on the virtual target. What does this confirm?',
    'b',
    [
      [
        'The lesion has been identified, so the biopsy that follows at this position will be diagnostic.',
        'A concentric view is a local ultrasound finding. Lesion identity and specimen adequacy are separate endpoints this view does not establish.',
      ],
      [
        'Tissue surrounds the probe; lesion identity and the biopsy tool’s path remain unconfirmed.',
        'The rEBUS probe images only its own surroundings. Atelectatic lung can look similar, and the biopsy tool follows its own path once the probe is withdrawn.',
      ],
      [
        'Navigation is confirmed, so the lesion can be sampled at the catheter icon.',
        'Agreement between navigation and rEBUS is not tool-in-lesion confirmation. The navigation target and the local ultrasound view answer different questions.',
      ],
    ],
    'A concentric rEBUS view localizes the probe, not the biopsy tool.',
    ['ilocate', 'mobile'],
  ),
  item(
    'walk-1',
    'optimize',
    'The needle tip and the nodule are superimposed on the image although they are two centimetres apart along the X-ray path. At which component of image formation does that superimposition arise?',
    'a',
    [
      [
        'Beam geometry',
        'Each detector location records the attenuation along one X-ray path from the focal spot. Two objects on that path project to the same location however far apart they are in depth.',
      ],
      [
        'Flat-panel detector',
        'The detector records what arrives along each path. It cannot tell where along the path the attenuation occurred; the superimposition was already present.',
      ],
      [
        'Display and interpretation',
        'Zoom and window/level change how acquired pixels are shown. The superimposition was fixed before the image reached the monitor.',
      ],
    ],
    'Superimposition is decided by beam geometry, not by the display.',
    ['tg272', 'setser'],
  ),
  item(
    'good-1',
    'optimize',
    'On a last-image-hold frame the lesion is clear but small. Which of these changes what is acquired, rather than how it is displayed?',
    'c',
    [
      [
        'Applying display zoom to the stored image.',
        'Display zoom enlarges acquired pixels. Nothing new is acquired and no exposure follows.',
      ],
      [
        'Adjusting window and level on the stored image.',
        'Window/level maps the same acquired values to different grey levels. The acquired information is unchanged.',
      ],
      [
        'Selecting a smaller acquisition field of view.',
        'A smaller acquisition field, such as a flat-panel magnification mode, changes what the detector acquires on the next exposure and may change binning and exposure. It is an acquisition change, not a display change.',
      ],
    ],
    'Ask whether a control changes the acquisition, the detector readout, or only the display.',
    ['tg272', 'tg125'],
  ),
  item(
    'capstone-1',
    'verify',
    'After an oblique projection that clears the heart, tight collimation and a ventilation pause, the nodule is still indistinct although the needle is sharp. Where does the remaining problem arise?',
    'a',
    [
      [
        'Patient anatomy — superimposition or lesion identity',
        'Projection, collimation and timing are optimized. What remains is anatomy in the X-ray path or uncertainty about lesion identity, and more of the same exposure changes neither; change the modality or reconfirm the target.',
      ],
      [
        'X-ray tube — too few photons reaching the detector',
        'More photons reduce noise, but this image is not noisy. Photon count is not the limiting factor here.',
      ],
      [
        'Display and interpretation — contrast and window/level',
        'Window/level changes the contrast of what was acquired. It cannot separate a lesion from anatomy superimposed on it.',
      ],
    ],
    'When projection, collimation and timing are optimized, the remaining limit is the anatomy or the question, not the dose.',
    ['setser', 'tg272', 'mobile'],
  ),
  item(
    'capstone-transfer-1',
    'protect',
    'The procedure record lists fluoroscopy time and the number of CBCT spins, but no kerma–area product or reference air kerma. What does the record still lack?',
    'b',
    [
      [
        'Nothing; fluoroscopy time and spin count describe the exposure.',
        'Time and spin count omit the output per second and per spin. Two procedures with the same fluoroscopy time can differ several-fold in exposure.',
      ],
      [
        'Kerma–area product and reference air kerma, with units and included modes.',
        'These dose indices, with units and the acquisition modes they cover, are what a whole-procedure review needs. Time and spin count are incomplete on their own.',
      ],
      [
        'An effective dose in mSv, so the exposure can be compared with a chest CT scan.',
        'Effective dose is an estimate with disclosed assumptions, not a measured index. A comparison with CT without the method behind it is not a report.',
      ],
    ],
    'Record the dose quantity, its units and the acquisition modes it covers.',
    ['wabip', 'aapm12'],
  ),

  // --- Practice: short cases, one decision each, paired to a section by its mechanism.
  // Authored against each section's own teaching and the module's reviewed sources, then put
  // through three rounds of independent review for vocabulary, evidence, cueing and fit, and
  // rewritten into standard procedural terminology. Every one is a draft awaiting
  // subject-matter review, like the rest of the bank.
  item(
    'signal-practice-1',
    'optimize',
    'The lesion does not stand out from the surrounding lung. What is limiting lesion conspicuity?',
    'b',
    [
      [
        'Quantum noise: too few photons reach the detector through a thick chest.',
        'Too few photons produce visible mottle, but here the background is smooth and the catheter edge is sharp. Raising output in the same wide field raises scatter along with the primary beam, so contrast stays low while patient and staff exposure rise.',
      ],
      [
        'Scatter from the large irradiated volume, reducing contrast across the whole image.',
        'A uniform loss of contrast over dense and soft structures alike, with a sharp catheter edge and a smooth background, indicates scatter. Tighter collimation reduces the scattering volume and can restore contrast; if it does not, consider a different imaging modality.',
      ],
      [
        'Anatomical superimposition that no single projection can separate.',
        'Superimposition reduces contrast where structures overlap and spares the rest of the field; here contrast is reduced everywhere. Changing the projection keeps the same wide field through the same thick chest, so the scatter haze persists.',
      ],
    ],
    'A uniform haze over dense and soft structures, with a sharp catheter edge and a smooth background, indicates scatter rather than quantum noise or superimposition. Collimation, projection and output each address a different limitation; name the limitation before changing any of them.',
    ['setser', 'wabip', 'tg272', 'tg125'],
  ),
  item(
    'signal-practice-2',
    'optimize',
    'The lesion is clear of the mediastinum and the needle is in view. What is the most useful adjustment now?',
    'c',
    [
      [
        'Adjust window/level until the needle edges stand out.',
        'Window/level can help read an acquired image, but stretching a scatter-degraded image stretches the haze and the noise with it. The contrast is lost before the image reaches the display.',
      ],
      [
        'Increase output or select a higher-dose preset to penetrate the arm.',
        'Too few photons appear as noise, not as an even loss of contrast. The arm scatters as well as attenuates, so more output raises primary and scattered radiation together: the image stays flat while dose rises.',
      ],
      [
        'Collimate to the working area and move the arm out of the field.',
        'A washed-out image over a wide field and a thick path indicates scatter. Collimation reduces the irradiated volume, and moving the arm out of the field with the anesthesia team, within safe positioning limits and without disturbing the scope or docked equipment, removes tissue that scatters.',
      ],
    ],
    'A washed-out image and a noisy one have different causes. A wide field and a thick path point to scatter, and the thicker path also drives automatic exposure regulation to a harder beam that flattens contrast. More output raises scatter with the primary beam, and steady monitor brightness would not show the increase.',
    ['wabip', 'tg125'],
  ),
  item(
    'field-practice-1',
    'optimize',
    'Which adjustment acts most directly on the cause of this flat, low-contrast image?',
    'b',
    [
      [
        'Electronically crop the displayed image to the working area.',
        'Cropping moves the displayed border, not the beam. The same tissue still scatters onto the detector on every frame, so the flat appearance and the exposure outside the visible border both remain.',
      ],
      [
        'Collimate the beam to the working area.',
        'Collimation shrinks the irradiated volume, where the scatter flattening this image is produced; the image is not short of photons. Leave enough surrounding anatomy for orientation and the planned tool excursion, then check the dose rate: with the shoulder and abdomen out of the field, automatic exposure regulation responds to the working area and can partly offset the smaller field.',
      ],
      [
        'Select the next higher-dose fluoroscopy preset.',
        'More photons address noise, not scatter from a wide beam, and automatic exposure regulation may already be holding brightness steady. This adds dose for the patient and the team while the cause remains in the beam.',
      ],
    ],
    'Collimation and electronic cropping can look alike on the monitor, so name which one you are using before judging its effect. Scatter from a wide beam is reduced by collimation; more output raises scatter with the primary beam, and automatic exposure regulation can keep the displayed image looking much the same.',
    ['wabip', 'tg125'],
  ),
  item(
    'field-practice-2',
    'optimize',
    'Surrounding anatomy is needed for orientation. Which action comes first?',
    'c',
    [
      [
        'Open the collimator and acquire a new frame.',
        'This restores anatomy if collimation was the limit, and it may be needed. Acquiring before reviewing the stored frame risks exposing anatomy that was already acquired but not displayed.',
      ],
      [
        'Scroll back through the stored run to earlier frames.',
        'Earlier frames in the same run were probably acquired with the same field, so they may show no more anatomy. It also leaves unresolved whether the border was set by collimation or by cropping.',
      ],
      [
        'Restore the full displayed field and review the stored frame.',
        'The workstation can return only what the stored frame contains, and it does so without exposure. If the surrounding anatomy appears, the border was an electronic crop; if it does not, the field was collimated before acquisition, and restoring it needs a new exposure either way.',
      ],
    ],
    'Undo a display restriction first: it costs no exposure, and it shows whether the missing anatomy was ever acquired, which tells you whether you were looking at collimation or at an electronic crop.',
    ['wabip', 'tg272'],
  ),
  item(
    'time-practice-1',
    'optimize',
    'As the sheath advances, it appears at a series of separated positions. Where does that movement occur?',
    'b',
    [
      [
        'Within each exposure: motion blur from the pulse width.',
        'Motion during one exposure smears the tool along its path and softens its edge. Each last-image-hold frame here has a sharp edge and a defined tip, so nothing is moving during an exposure. Shortening the pulse width treats blur and leaves the separated positions unchanged.',
      ],
      [
        'Between exposures: the interval set by the pulse rate.',
        'Sharp individual frames exclude within-exposure blur, and an image that settles when the hand stops excludes processing lag, which leaves the interval between exposures. The distance travelled in that interval depends on advancement speed and pulse rate: advance more slowly, increase the pulse rate, or accept the image. Only the pulse-rate increase adds dose.',
      ],
      [
        'After acquisition: frame averaging and display lag.',
        'Frame averaging and display latency are real and delay the displayed image, but they appear as an image that keeps moving briefly after the hand stops. Here the image settles when the hand settles, so the effect arises before the display.',
      ],
    ],
    'Three temporal effects act on a moving image. A sharp last-image-hold frame excludes motion blur within an exposure; an image that settles when the hand settles excludes lag from frame averaging; what remains is the interval between pulses, set by pulse rate and advancement speed. Identify the limiting effect before changing pulse width or pulse rate.',
    ['tg272', 'wabip'],
  ),
  item(
    'two-dimensional-practice-1',
    'choose',
    'The radial EBUS view is eccentric, and no lesion is visible on either fluoroscopic projection. What is the best next step?',
    'b',
    [
      [
        'Withdraw the probe and advance the needle down the same airway to that depth.',
        'An eccentric view is often read as arrival. The probe images only its immediate surroundings at one position, and once it is withdrawn the needle follows its own path down the sheath; the depth does not carry the direction in which the tissue lay. Dependent atelectasis can produce the same eccentric pattern.',
      ],
      [
        'Move the probe back and forth along the airway to define the lesion margins.',
        'The 360-degree image shows how far around the probe the tissue extends at one position, not how far it runs along the airway. Moving the probe back and forth answers that: a lesion with margins at both ends behaves differently from tissue that continues without a margin, as dependent atelectasis usually does.',
      ],
      [
        'Advance the probe deeper along the same airway and look again.',
        'Advancing deeper is a common reflex, but it abandons the one position that has shown tissue before that position has been characterized. A radial probe cannot be steered toward tissue beside it; it follows the airway it is in and reports a new location.',
      ],
    ],
    'An eccentric rEBUS view shows how far around the probe tissue extends at one position, not how far it runs along the airway. Moving the probe along the airway defines the margins without additional exposure; if no margin appears, the limit is the modality, and the next question needs another kind of imaging.',
    ['ilocate', 'setser', 'mobile'],
  ),
  item(
    'dts-acquisition-practice-1',
    'dts',
    'The team cannot tell whether the catheter tip lies anterior to, posterior to or against the nodule. Which acquisition addresses that?',
    'b',
    [
      [
        'Two single images at opposite ends of the arc, compared side by side.',
        'Two separated projections do carry some depth information: the direction of parallax between them is a real cue. But each still collapses depth along its own projection, the shift across a short arc is small, and neither separates the rib superimposed on the lesion.',
      ],
      [
        'A DTS acquisition across the arc, reconstructed into planes.',
        'Reconstructing planes from a series across the arc lets structures at the chosen depth reinforce while structures at other depths, the rib included, blur out. Depth resolution is partial and poorest along the beam direction, so read the tip and nodule on the reconstructed planes and treat the gap as narrowed rather than settled. The available arc and performance depend on the installed system.',
      ],
      [
        'The frontal projection again, in the finer detector mode.',
        'Finer sampling in the same projection resolves structures lying side by side across the image, not along the X-ray path where these two are superimposed. A detector-mode label also describes a setting rather than delivered performance, which commissioning establishes.',
      ],
    ],
    'Two separated projections across a short arc give a small, loose parallax cue; a DTS reconstruction from a series across the same arc lets one depth reinforce while others blur, including a superimposed rib. Depth resolution remains partial and poorest along the beam direction, so DTS narrows the depth relationship rather than settling it.',
    ['saad', 'frontier', 'tg272'],
  ),
  item(
    'dts-acquisition-practice-2',
    'dts',
    'The nodule is the biopsy target. Which next step does this DTS support?',
    'c',
    [
      [
        'Sample from the current tip position, since tip and nodule share the brightest plane.',
        'Appearing brightest on a plane means the projections reinforced there, not that the structure lies at that depth. The vessel is bright on the nodule’s plane and on the planes either side, because what DTS separates least well along the beam stays spread across planes.',
      ],
      [
        'Repeat the DTS over the same arc in finer steps and advance by those planes.',
        'Finer steps give more planes, but every plane is built from the same arc. Depth separation along the beam is set by the angular range, not by the number of samples within it, so advancing by these planes drives the needle along the least-resolved axis, toward the vessel.',
      ],
      [
        'Repeat the DTS with the C-arm rotated to a different arc, then position the tip.',
        'Position across the image is well resolved from the projections. Depth along the beam is limited by the first acquisition’s angular range, and an acquisition from a different arc adds the direction the first resolved least well, which is the direction this placement depends on.',
      ],
    ],
    'DTS places the tip and nodule far more reliably across the image than along the beam. Repeating the same arc in finer steps leaves depth resolution unchanged; an acquisition from a different angular range is what improves it.',
    ['saad'],
  ),
  item(
    'dts-interpretation-practice-1',
    'dts',
    'Which interpretation of the reconstructed view is best supported?',
    'a',
    [
      [
        'The lesion margin on these planes comes from another acquisition, since the catheter is absent from them.',
        'Each DTS plane is built from X-ray paths that crossed whatever lay in the field during the acquisition, and a catheter that live fluoroscopy shows this clearly could not be missed. Its absence means these pixels were not acquired while the catheter was there: the margin was supplied by another acquisition, such as the planning CT, and describes the lesion as it was then.',
      ],
      [
        'The catheter is too thin to appear on these planes, so the lesion margin comes from this DTS acquisition.',
        'Limited angular coverage does blur structures in depth, but a dense catheter within the imaged volume brightens more planes, not none. The same acquisition is supposedly drawing fine lesion margins on the very planes that miss the catheter, and one DTS acquisition does not do that on its own.',
      ],
      [
        'Registration has drifted, so the catheter lies on other planes and the margin comes from this DTS.',
        'Registration drift does occur, but a shift moves the catheter and the airway around it together, because one set of projections drew both. The planes that show that airway would show the catheter, and waiting for a refreshed registration cannot add a catheter those planes never contained.',
      ],
    ],
    'A catheter present throughout a DTS acquisition cannot be absent from planes built from that acquisition. Its absence marks prior-derived content: the margin describes the lesion when the prior was acquired. Finding the catheter elsewhere in the volume would show only that some of the display was acquired now, because a reconstruction can carry a live catheter over a contour from an older scan.',
    ['saad', 'pritchett'],
  ),
  item(
    'cbct-acquisition-practice-1',
    'cbct',
    'How should the team use this CBCT to judge the needle–nodule relationship?',
    'a',
    [
      [
        'Read the relationship where the volume covers it, then re-center on the nodule and repeat the spin.',
        'The needle and the near side of the nodule lie inside the reconstruction volume, so that relationship was imaged. Anatomy beyond the edge was never in the field; coverage is set by the detector field and the isocenter, so the far side comes into view only after re-centering on the nodule and a new spin. Re-centering moves the imaging, not the catheter or needle; recheck collision clearance around the docked arm before the next exposure.',
      ],
      [
        'Read the relationship where the volume covers it, then repeat the spin over a wider angular range.',
        'A wider angular range addresses missing projection directions, which blur anatomy inside the volume. Nothing here is blurred: edges are single, and the far side is truncated rather than poorly resolved. More rotation around the same isocenter adds views of the same anatomy, needs a longer collision-free path around the docked arm, and leaves the far side outside the volume.',
      ],
      [
        'Read the relationship where the volume covers it, then request a wider reconstruction of this spin.',
        'Checking the reconstruction before another exposure is reasonable, but the volume is built from the acquired projections. Beyond the field there are none, so a wider reconstruction enlarges the frame around the same anatomy and leaves the far side as truncated as before.',
      ],
    ],
    'A CBCT volume answers only for the anatomy inside the acquired field, so find the truncation edge before judging a needle against a lesion. Sharpness inside the volume says nothing about anatomy outside it; the far side comes into view only when the isocenter or field changes and the anatomy is imaged again, or when other current imaging is used. Angular range sets which directions are sampled; field of view and centering set how much anatomy is covered.',
    ['setser', 'mobile'],
  ),
  item(
    'fixed-suite-practice-1',
    'cbct',
    'What should the team do next?',
    'c',
    [
      [
        'Rotate to a steep oblique projection and judge the needle against the overlay contour.',
        'A different projection changes which direction is collapsed but still collapses depth, so the needle can overlap the nodule and stop short of it. The nodule in that view is the registered overlay contour, a boundary drawn over live fluoroscopy rather than imaged there.',
      ],
      [
        'Acquire a CBCT spin and judge the needle against the overlay contour on it.',
        'The acquisition is right; what is read on it is not. An overlay contour shows where a boundary was placed when it was created, and the system will draw it on images acquired after the needle moved. The lesion appears on the CBCT as tissue, and the sampling part of the needle has to lie within that tissue.',
      ],
      [
        'Acquire a CBCT spin and judge the needle against the lesion tissue on it.',
        'One CBCT spin contains the needle and the lesion together, so their relationship along the beam is imaged rather than inferred. Reading the lesion from its tissue on those images takes the boundary from the anatomy the needle is in now, not from a contour carried over from an earlier spin.',
      ],
    ],
    'A projection shows overlap, not depth, and an overlay contour shows where a boundary was placed, not where the lesion is now. To judge a needle within a lesion, one acquisition must contain both, and the lesion must be read from the tissue on those images. Which CBCT protocol suits which question is settled locally with the technologist and medical physicist.',
    ['verhoeven', 'setser', 'pritchett'],
  ),
  item(
    'mobile-suite-practice-1',
    'cbct',
    'What should the team change before repeating the CBCT spin?',
    'c',
    [
      [
        'Lift the monitoring lines off the chest and unhook them from the rail.',
        'Cables and tubing do cause thin streaks, and lifting them off the chest is worthwhile. The alternating dark and bright bands and the broken lesion margin here are what a dense, sharp-edged object produces when the beam crosses it on some projections and not others; cables attenuate too little to cause that.',
      ],
      [
        'Select metal-artifact reduction, leaving the rail and bracket in place.',
        'Metal-artifact reduction exists for metal that cannot be removed: an implant, a spinal rod, the biopsy tool. For removable hardware it still works from projections in which the margin was never cleanly acquired, and it can suppress banding without restoring the boundary. What the setting does, and what it is called, differs by model and software version.',
      ],
      [
        'Remove the side rail and armboard bracket from the scan field.',
        'Clearing the C-arm’s path and being out of the beam are different. Through the lateral part of the spin, the raised rail and bracket lie between the tube and the detector, so those projections are acquired through them; removing them changes the projections the next reconstruction is built from.',
      ],
    ],
    'The volume is built from what the beam crosses on its way around the table. Hardware can clear the C-arm’s path yet still lie in the beam during part of the spin. Lifting light cables or changing a reconstruction setting leaves dense hardware in the projections, so removable hardware comes out before the spin. That is why a table and its fittings are part of the acquisition, and why the room, table and scanner are commissioned together.',
    ['setser', 'mobile', 'tg272'],
  ),
  item(
    'tool-confirmation-practice-1',
    'verify',
    'How should the team review the CBCT to confirm the needle’s position relative to the lesion?',
    'a',
    [
      [
        'Build oblique reformats along and across the needle, then assess the sampling window against the lesion.',
        'A plane shows only the metal within it, so a needle angled across the axial stack appears as fragments. A reformat along the needle’s course shows its whole length, and one across it shows the lateral relationship. Both come from the volume already acquired, and together they support a statement about where the sampling window was at that moment.',
      ],
      [
        'Review coronal and sagittal planes through the lesion, then assess the needle and window in those views.',
        'Two perpendicular planes do settle the position of something lying within both, which is why a compact lesion reads well this way. But coronal and sagittal planes are fixed like the axial stack: an angled needle is fragmented in each, and planes placed through the lesion need not contain the sampling window.',
      ],
      [
        'Count the axial images containing metal, multiply by slice thickness, and compare with the planned depth.',
        'For an angled needle, the axial extent is only the component of its length along the stack, so a slice count understates how far the needle has advanced by an amount set by an angle the axial images do not show. Each axial image holds a cross-section of the needle, not a segment of its length.',
      ],
    ],
    'The plane you review decides whether a tool can be followed at all. An angled needle appears as fragments on a fixed stack, and neither the longest fragment nor the number of slices containing metal is the needle. Reformats along and across the tool, from the volume already acquired, support a statement about where the sampling window was: a statement about position, not about the tissue the needle will acquire.',
    ['setser', 'confirm'],
  ),
  item(
    'changing-anatomy-practice-1',
    'verify',
    'What is the most useful next step?',
    'a',
    [
      [
        'Re-localize the nodule on the current CBCT and treat the stored contour as historical.',
        'A region that appeared between the two spins, with the rest of the volume unchanged and blood suctioned in between, is best read as a change in the patient rather than an image-quality limitation. Re-localizing the nodule on current imaging re-establishes where it is; if it cannot be separated from the new region on thin reformats, another needle placement is not yet supported.',
      ],
      [
        'Repeat the CBCT spin at higher output and reassess the indistinct border.',
        'This treats a change in the patient as an image-quality problem. Noise degrades the whole reconstruction, not one region around one nodule, and the first spin, acquired the same way, showed nothing there; more output shows this region more clearly rather than removing it.',
      ],
      [
        'Move the stored contour onto the new region and treat it as the target.',
        'Moving a stored contour onto a region of uncertain identity makes the display agree with itself while the anatomy remains unconfirmed. An overlay may be re-derived from a volume in which the lesion has been identified, not aimed at tissue of unknown identity.',
      ],
    ],
    'A new region that appeared while the rest of the volume stayed the same, with blood suctioned in between, is best read as a change in the patient until current imaging shows otherwise. Motion during the spin, streak from indwelling hardware or limited angular coverage can also make a finding appear on one volume and not another, so name the mechanism before acting. The contour from the first spin records lung that has since changed; it can guide the next look but cannot replace it.',
    ['setser', 'tg272', 'pritchett'],
  ),
  item(
    'staff-protection-practice-1',
    'protect',
    'Fluoroscopy in this lateral projection is about to begin. Which position leaves the fellow least exposed?',
    'c',
    [
      [
        'Step farther back along the table on the tube side.',
        'Distance generally helps, but stepping back on the same side keeps the fellow on the side where scatter is higher, and both positions are already outside the primary beam. Aprons attenuate rather than eliminate scatter and do not cover the eyes, so protective garments do not make the two sides equivalent.',
      ],
      [
        'Stay beside the X-ray tube housing.',
        'This assumes the hazard sits where the primary beam exits. Staff exposure comes mainly from scatter off the irradiated patient, which is higher toward the tube side, where the beam enters.',
      ],
      [
        'Move to the detector side of the table.',
        'Most staff exposure is scatter from the irradiated patient, and scatter is greater toward the beam-entrance side, so the detector side is generally lower-exposure in this geometry. Distance from the table is similar for all three positions, so the side of the patient is what separates them.',
      ],
    ],
    'Two people at the same distance from the table can receive quite different exposure depending on which side of the C-arm they occupy, and angulation shapes that asymmetry. Distance and protective garments are only part of the plan; the room survey and the radiation safety officer set the verified positions.',
    ['wabip', 'icrp'],
  ),
  item(
    'dose-reporting-practice-1',
    'protect',
    'How should the team interpret this dose notification, and what does it prompt?',
    'a',
    [
      [
        'A cumulative reference air kerma notification: record the mGy value and included acquisitions, then start the patient dose review.',
        'The notification is set on the cumulative reference air kerma at the interventional reference point, a running patient index across every fluoroscopic and CBCT acquisition in the case. Local policy defines the level and what the review covers: the total so far, the record entry, the imaging still planned and any follow-up. Recording the value, its units and the acquisitions included keeps it distinct from the KAP printed beside it and from peak skin dose.',
      ],
      [
        'A system output alert: record the mGy value and included acquisitions, then request an equipment performance review.',
        'A dose notification is set on an index that accumulates over one patient’s imaging, not on equipment performance. A high cumulative air kerma describes how the beam was used in this case; acceptance and periodic evaluation assess the equipment. An equipment review leaves the patient dose review unstarted.',
      ],
      [
        'A peak skin dose notification: record the mGy value and included acquisitions, then start a skin-injury review.',
        'Cumulative reference air kerma is an equipment-reference index, not the highest dose to any area of skin. It does not account for how oblique projections moved the entrance field, table height or backscatter, so reading it as skin dose overstates it in some geometries and understates it in others, and the review the notification exists to prompt still has not begun.',
      ],
    ],
    'A dose notification is set on an index that accumulates across one patient’s imaging, and it prompts review under local policy: the total so far, the record, the imaging still planned and any follow-up. It is not peak skin dose and not a statement about equipment performance. Record the quantity, its units and the acquisitions it includes.',
    ['aapm12', 'wabip', 'skin'],
  ),
]

export const QUESTION_BY_ID = Object.fromEntries(
  QUESTIONS.map((question) => [question.id, question]),
) as Record<string, Question>
