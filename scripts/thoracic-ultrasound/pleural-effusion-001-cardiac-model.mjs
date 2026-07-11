/**
 * Case-calibrated educational fallback inside pleural-effusion-001's single
 * whole-heart segment. Coordinates are LPS millimetres; chamber dimensions are
 * illustrative and must not be used for patient-specific measurement.
 */
export const pleuralEffusion001CardiacModel = {
  kind: 'parametric-cardiac-v1',
  sourceLabel: 'heart',
  centerLpsMm: [37.89, -226.32, -364.12],
  basis: {
    leftAxis: [0.958, 0.24, 0.156],
    anteriorAxis: [0.223, -0.967, 0.12],
    baseAxis: [-0.18, 0.08, 0.98],
  },
  defaultHeartRateBpm: 72,
  respiratoryRateBpm: 15,
  respiratoryExcursionMm: 3,
  chambers: [
    {
      id: 'left-ventricle',
      centerLocalMm: [17, -4, -13],
      endDiastolicRadiiMm: [22, 23, 41],
      endSystolicRadiiMm: [15, 16, 31],
    },
    {
      id: 'right-ventricle',
      centerLocalMm: [-16, 12, -10],
      endDiastolicRadiiMm: [27, 17, 37],
      endSystolicRadiiMm: [19, 11, 28],
      crescent: 0.52,
    },
    {
      id: 'left-atrium',
      centerLocalMm: [15, -8, 31],
      endDiastolicRadiiMm: [19, 16, 17],
      endSystolicRadiiMm: [22, 18, 19],
    },
    {
      id: 'right-atrium',
      centerLocalMm: [-17, 2, 29],
      endDiastolicRadiiMm: [21, 17, 18],
      endSystolicRadiiMm: [24, 19, 20],
    },
  ],
  valves: [
    {
      id: 'mitral',
      centerLocalMm: [15, -6, 13],
      normalLocal: [0, 0, 1],
      radiusMm: 14,
      thicknessMm: 1.8,
      timing: 'atrioventricular',
    },
    {
      id: 'tricuspid',
      centerLocalMm: [-16, 7, 12],
      normalLocal: [0, 0, 1],
      radiusMm: 15,
      thicknessMm: 1.8,
      timing: 'atrioventricular',
    },
    {
      id: 'aortic',
      centerLocalMm: [5, -1, 26],
      normalLocal: [0.22, -0.12, 0.97],
      radiusMm: 8,
      thicknessMm: 1.6,
      timing: 'semilunar',
    },
  ],
}
