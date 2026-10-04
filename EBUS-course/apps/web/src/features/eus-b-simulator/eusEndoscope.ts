import { BF_UC180F_NOMINAL } from '@bronchoscopy-core/devices';
import { minus, plus, scalar, times, unit, type Point3 } from '@bronchoscopy-core/frame';

import { pathCenterAt, scopeShaftPointAt, type EusPose } from './eusPose';
import type { EusScopePath } from './types';

/**
 * Optics of the endoscopic view.
 *
 * EUS-B uses the EBUS endoscope, so the view takes that instrument's nominal optics, the same
 * values the EBUS simulator uses: a forward-oblique lens tilted toward the transducer side.
 */
export const EUS_ENDOSCOPE_OBLIQUITY_DEG = BF_UC180F_NOMINAL.forwardObliquityDeg;
export const EUS_ENDOSCOPE_FOV_DEG = BF_UC180F_NOMINAL.fieldOfViewDeg;
/** The lens sits on the shaft this far proximal to the middle of the transducer. Authored. */
export const EUS_ENDOSCOPE_LENS_BACK_MM = 12;
/**
 * Free space kept between the lens and the wall. A real lens loses the view on contact; the
 * simulated view holds this stand-off so the lumen stays readable.
 */
export const EUS_ENDOSCOPE_CLEARANCE_MM = 3;

export interface EusEndoscopeCamera {
  /** Path point beside the lens. Always inside the lumen, so the lens can be pulled back to it. */
  anchorLps: Point3;
  /** Lens position on the shaft, before the wall clearance is applied. */
  eyeLps: Point3;
  /** Optical axis. */
  forwardLps: Point3;
  /** Image-up: the transducer side. */
  upLps: Point3;
}

/**
 * Where the endoscope's lens is and where it looks, for a scope pose.
 *
 * The optical axis is the distal shaft axis turned toward the transducer side by the lens's
 * obliquity, and image-up is that side. Both lie in the ultrasound scan plane, so the scan plane
 * is the vertical midline of the endoscopic image.
 */
export function computeEusEndoscopeCamera(
  path: EusScopePath,
  pose: EusPose,
  sMm: number,
): EusEndoscopeCamera {
  const lensAt = Math.max(0, Math.min(sMm, path.totalLengthMm) - EUS_ENDOSCOPE_LENS_BACK_MM);
  const tilt = (EUS_ENDOSCOPE_OBLIQUITY_DEG * Math.PI) / 180;
  const forwardLps = unit(
    plus(times(pose.shaftAxisLps, Math.cos(tilt)), times(pose.depthAxisLps, Math.sin(tilt))),
  );
  const upLps = unit(minus(pose.depthAxisLps, times(forwardLps, scalar(pose.depthAxisLps, forwardLps))));
  return {
    anchorLps: pathCenterAt(path, lensAt),
    eyeLps: scopeShaftPointAt(path, pose, sMm, lensAt),
    forwardLps,
    upLps,
  };
}

/**
 * How far along the line from the anchor toward the lens the lens may sit, given the first wall
 * met on that line (null when there is none in range). Keeps the clearance in front of the wall.
 */
export function clearLensDistanceMm(
  wallMm: number | null,
  wantedMm: number,
  clearanceMm = EUS_ENDOSCOPE_CLEARANCE_MM,
) {
  return wallMm === null ? wantedMm : Math.min(wantedMm, Math.max(0, wallMm - clearanceMm));
}
