import { plus, times, type Point3 } from './frame'
export interface DeviceOptics {
  id: string
  fieldOfViewDeg: number
  forwardObliquityDeg: number
  shaftDiameterMm: number
  source?: { title: string; url: string }
}
export const BF_UC180F_NOMINAL: DeviceOptics = {
  id: 'olympus-bf-uc180f',
  fieldOfViewDeg: 80,
  forwardObliquityDeg: 35,
  shaftDiameterMm: 6.2,
  source: {
    title: 'Olympus BF-UC180F specifications',
    url: 'https://medical.olympusamerica.com/products/bf-uc180f-ebus-bronchoscope',
  },
}
export const ebusWebToPatient = ([x, y, z]: Point3): Point3 => [x, -z, y]
export const patientToEbusWeb = ([l, p, s]: Point3): Point3 => [l, s, -p]
export const rasToPatient = ([r, a, s]: Point3): Point3 => [-r, -a, s]
export const patientToTrainerWeb = ([l, p, s]: Point3): Point3 => [-l, s, p]
export const trainerWebToPatient = ([x, y, z]: Point3): Point3 => [-x, z, y]
/** Explicit origins: a calibrated contact is the transducer apex, not the optical lens. */
export function scopeOrigins(
  transducer: Point3,
  shaftAxis: Point3,
  depthAxis: Point3,
  lateralAxis: Point3,
  eyeOffset: { shaft: number; depth: number; lateral: number },
  probeOffsetMm = 6,
) {
  return {
    transducer,
    shaft: plus(transducer, times(shaftAxis, -probeOffsetMm)),
    optical: plus(
      plus(plus(transducer, times(shaftAxis, eyeOffset.shaft)), times(depthAxis, eyeOffset.depth)),
      times(lateralAxis, eyeOffset.lateral),
    ),
  }
}
