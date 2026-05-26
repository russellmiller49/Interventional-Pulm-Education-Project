import {
  afterNondiagnosticTaps,
  diagnosticYieldLabel,
  postDrainageBranch,
} from '../engine/diagnostic'

describe('malignant effusion diagnostic engine', () => {
  it('escalates after two nondiagnostic taps', () => {
    expect(afterNondiagnosticTaps(2).shouldEscalate).toBe(true)
    expect(afterNondiagnosticTaps(2).recommendation).toContain('Stop fluid-only cycling')
  })

  it('branches trapped lung to IPC-preferred teaching', () => {
    expect(postDrainageBranch('trapped').arm).toBe('ipcPreferred')
  })

  it('labels thoracentesis yield as contextual', () => {
    expect(diagnosticYieldLabel('thoracentesis')).toContain('40-60%')
  })
})
