import { fireEvent, render, screen } from '@testing-library/react'
import { Object3D, PropertyBinding } from 'three'

import {
  cloneSemanticNode,
  getAirwayMaterialVisibilityProfile,
  getViewerMaterialVisibilityProfile,
  isPartDragGesture,
  RigidBronchoscopyAssemblyLab,
} from '../components/RigidBronchoscopyAssemblyLab'

let mockReducedMotion = false

jest.mock('@react-three/fiber', () => ({
  Canvas: () => null,
  useFrame: () => undefined,
}))

jest.mock('@react-three/drei', () => {
  const useGLTF = Object.assign(() => ({ scene: { getObjectByName: () => null } }), {
    preload: () => undefined,
  })
  return {
    OrbitControls: () => null,
    useGLTF,
  }
})

jest.mock('framer-motion', () => ({
  useReducedMotion: () => mockReducedMotion,
}))

describe('RigidBronchoscopyAssemblyLab', () => {
  beforeEach(() => {
    mockReducedMotion = false
  })

  it('reserves alternate mouse gestures for view navigation', () => {
    const pointer = {
      button: 0,
      ctrlKey: false,
      metaKey: false,
      pointerType: 'mouse',
      shiftKey: false,
    }

    expect(isPartDragGesture(pointer)).toBe(true)
    expect(isPartDragGesture({ ...pointer, button: 1 })).toBe(false)
    expect(isPartDragGesture({ ...pointer, button: 2 })).toBe(false)
    expect(isPartDragGesture({ ...pointer, shiftKey: true })).toBe(false)
    expect(isPartDragGesture({ ...pointer, ctrlKey: true })).toBe(false)
    expect(isPartDragGesture({ ...pointer, metaKey: true })).toBe(false)
    expect(isPartDragGesture({ ...pointer, pointerType: 'touch' })).toBe(true)
  })

  it('keeps anatomy and device materials visible while preserving cutaway transparency', () => {
    const solidDevice = getViewerMaterialVisibilityProfile(false)
    const cutawayDevice = getViewerMaterialVisibilityProfile(true)
    const solidAirway = getAirwayMaterialVisibilityProfile(false)
    const cutawayAirway = getAirwayMaterialVisibilityProfile(true)

    expect(solidDevice.opacity).toBe(1)
    expect(cutawayDevice.opacity).toBeGreaterThanOrEqual(0.5)
    expect(cutawayDevice.opacity).toBeLessThan(solidDevice.opacity)
    expect(cutawayDevice.depthWrite).toBe(false)
    expect(cutawayDevice.metalnessCap).toBeLessThan(solidDevice.metalnessCap)
    expect(cutawayDevice.emissiveScale).toBeGreaterThan(solidDevice.emissiveScale)

    expect(cutawayAirway.opacity).toBeGreaterThanOrEqual(0.35)
    expect(cutawayAirway.opacity).toBeLessThan(solidAirway.opacity)
    expect(cutawayAirway.emissiveIntensity).toBeGreaterThan(solidAirway.emissiveIntensity)
  })

  it('finds tube roots after Three.js sanitizes periods in glTF node names', () => {
    const originalName = 'BT2103_3_Adult_bronchial_tube_10.00_9.20_mm'
    const scene = new Object3D()
    const tube = new Object3D()
    tube.name = PropertyBinding.sanitizeNodeName(originalName)
    scene.add(tube)

    const clone = cloneSemanticNode(scene, originalName)
    expect(clone).not.toBeNull()
    expect(clone).not.toBe(tube)
    expect(clone?.name).toBe(tube.name)
  })

  it('offers all tube sizes and advances the puzzle from the keyboard control', () => {
    render(<RigidBronchoscopyAssemblyLab />)

    expect(screen.getByRole('heading', { name: 'Assemble a rigid bronchoscopy set' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Select interchangeable tube' })).toHaveValue(
      'tube-bt2103-3',
    )
    expect(screen.getAllByRole('option')).toHaveLength(9)
    expect(screen.getByText('0 of 8 pieces seated')).toBeVisible()
    expect(screen.getByRole('button', { name: /C1 light adapter/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /C2 light adapter/i })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Place selected part' }))

    expect(screen.getByText('1 of 8 pieces seated')).toBeVisible()
    expect(screen.getAllByText(/BT2103-3 adult bronchial tube.*seated/i)).toHaveLength(2)
    expect(screen.getByText('Double-gate obturator')).toBeVisible()
  })

  it('offers orbit, pan, zoom, and centering without changing puzzle progress', () => {
    render(<RigidBronchoscopyAssemblyLab />)

    expect(screen.getByRole('toolbar', { name: '3D view controls' })).toBeVisible()
    const orbitButton = screen.getByRole('button', { name: 'Orbit' })
    const panButton = screen.getByRole('button', { name: 'Pan' })

    expect(orbitButton).toHaveAttribute('aria-pressed', 'true')
    expect(panButton).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(panButton)
    expect(orbitButton).toHaveAttribute('aria-pressed', 'false')
    expect(panButton).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Center view' }))

    expect(screen.getByText('0 of 8 pieces seated')).toBeVisible()
    expect(screen.getByRole('button', { name: /BT2103-3 · 10.0\/9.2 mm/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('adds a configure-predict-reveal ventilation comparison without leaking the answer', () => {
    render(<RigidBronchoscopyAssemblyLab />)

    fireEvent.click(screen.getByRole('button', { name: 'Place selected part' }))
    expect(screen.getByText('1 of 8 pieces seated')).toBeVisible()

    const pathwayMode = screen.getByRole('button', { name: /Pathway lab/i })
    fireEvent.click(pathwayMode)
    expect(pathwayMode).toHaveAttribute('aria-pressed', 'true')

    const ventilation = screen.getByRole('button', { name: /Ventilation flow/i })
    const instrument = screen.getByRole('button', { name: /Instrument route/i })
    const optics = screen.getByRole('button', { name: /Optics and light/i })
    expect(ventilation).toHaveAttribute('aria-pressed', 'true')
    expect(instrument).toHaveAttribute('aria-pressed', 'false')
    expect(optics).toHaveAttribute('aria-pressed', 'false')

    expect(
      screen.getByRole('button', { name: /Conventional.*controlled positive-pressure/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /Spontaneous ventilation with assistance/i }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /Low-frequency jet ventilation/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /High-frequency jet ventilation/i })).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Bronchoscope.*long bronchial pattern/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Tracheoscope.*short/i })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Bronchoscope.*distal fenestrations/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Past the carina/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByText('Anatomical route result')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play animation' })).not.toBeInTheDocument()

    const commit = screen.getByRole('button', { name: 'Commit prediction' })
    const reveal = screen.getByRole('button', { name: 'Reveal modeled flow' })
    expect(commit).toBeDisabled()
    expect(reveal).toBeDisabled()

    fireEvent.click(
      screen.getByRole('button', {
        name: /opposite main bronchus remains reachable through bronchoscope fenestrations/i,
      }),
    )
    expect(commit).toBeEnabled()
    fireEvent.click(commit)
    expect(screen.getByRole('button', { name: 'Reveal modeled flow' })).toBeEnabled()
    expect(screen.queryByText('Anatomical route result')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal modeled flow' }))

    expect(screen.getByText('Anatomical route result')).toBeVisible()
    expect(screen.getByText('Your prediction matches this schematic.')).toBeVisible()
    expect(screen.getByText(/correctly aligned long bronchoscope fenestration/i)).toBeVisible()
    expect(screen.getByText('Intermittent controlled positive-pressure breaths')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pause animation' })).toBeVisible()
    expect(screen.getByRole('status', { name: 'Animation status' })).toHaveTextContent(
      'Animation playing.',
    )

    const cutaway = screen.getByRole('button', { name: 'Cutaway view' })
    expect(cutaway).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(cutaway)
    expect(cutaway).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Blocked egress' }))
    expect(screen.queryByText('Anatomical route result')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reveal modeled flow' })).toBeDisabled()
    fireEvent.click(
      screen.getByRole('button', {
        name: /opposite main bronchus remains reachable through bronchoscope fenestrations/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal modeled flow' }))
    expect(screen.getByText('Anatomical route result')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: /Anatomically, the distal lumen serves/i }),
    ).toBeVisible()
    expect(screen.getAllByText(/Gas remains trapped on the lung side/i)).not.toHaveLength(0)

    fireEvent.click(instrument)
    expect(instrument).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText(/lateral gate through the shared working lumen/i)).not.toHaveLength(
      0,
    )
    fireEvent.click(optics)
    expect(optics).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText(/returning image through the telescope/i)).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: /Assembly puzzle/i }))
    expect(screen.getByText('1 of 8 pieces seated')).toBeVisible()
  })

  it('teaches proximal fenestration leak and preserves assembly progress while comparing tubes', () => {
    render(<RigidBronchoscopyAssemblyLab />)

    fireEvent.click(screen.getByRole('button', { name: 'Place selected part' }))
    fireEvent.click(screen.getByRole('button', { name: /Pathway lab/i }))
    fireEvent.click(screen.getByRole('button', { name: /Proximal trachea/i }))
    fireEvent.click(screen.getByRole('button', { name: /Both main bronchi remain downstream/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal modeled flow' }))

    expect(
      screen.getByText(/distal fenestrations lie above the cords and add an escape route/i),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Tracheoscope.*short/i }))
    expect(
      screen.queryByText(/distal fenestrations lie above the cords and add an escape route/i),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Both main bronchi remain downstream/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal modeled flow' }))
    expect(screen.getByText(/conventional setup caps the proximal opening/i)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Assembly puzzle/i }))
    expect(screen.getByText('1 of 8 pieces seated')).toBeVisible()
  })

  it('asks the learner to reconsider an incorrect branch prediction', () => {
    render(<RigidBronchoscopyAssemblyLab />)

    fireEvent.click(screen.getByRole('button', { name: /Pathway lab/i }))
    fireEvent.click(
      screen.getByRole('button', {
        name: /Only the entered main bronchus has a direct distal route/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal modeled flow' }))

    expect(screen.getByText('Compare your prediction with the highlighted route.')).toBeVisible()
  })

  it('labels past-carina tracheoscope placement as counterfactual and reveals mainstem-only flow', () => {
    render(<RigidBronchoscopyAssemblyLab />)

    fireEvent.click(screen.getByRole('button', { name: /Pathway lab/i }))
    fireEvent.click(screen.getByRole('button', { name: /Tracheoscope.*short tracheal pattern/i }))

    expect(screen.getByText(/Counterfactual comparison.*short tracheal tube/i)).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', {
        name: /Only the entered main bronchus has a direct distal route/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal modeled flow' }))

    expect(
      screen.getByRole('heading', {
        name: /after mainstem entry only the entered main bronchus/i,
      }),
    ).toBeVisible()
    expect(screen.getByText(/no distal fenestration route toward the opposite/i)).toBeVisible()
  })

  it('announces every scenario change before requiring a new prediction', () => {
    render(<RigidBronchoscopyAssemblyLab />)

    fireEvent.click(screen.getByRole('button', { name: /Pathway lab/i }))
    const resetNotice = 'Scenario changed. Make a new prediction before revealing flow.'
    const choosePrediction = () =>
      fireEvent.click(screen.getByRole('button', { name: /Both main bronchi remain downstream/i }))

    fireEvent.click(screen.getByRole('button', { name: /High-frequency jet ventilation/i }))
    expect(screen.getByText(resetNotice)).toBeInTheDocument()
    choosePrediction()
    expect(screen.queryByText(resetNotice)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Tracheoscope.*short tracheal pattern/i }))
    expect(screen.getByText(resetNotice)).toBeInTheDocument()
    choosePrediction()

    fireEvent.click(screen.getByRole('button', { name: /At the carina/i }))
    expect(screen.getByText(resetNotice)).toBeInTheDocument()
    choosePrediction()

    fireEvent.click(screen.getByRole('button', { name: 'Blocked egress' }))
    expect(screen.getByText(resetNotice)).toBeInTheDocument()
  })

  it.each([
    ['Spontaneous ventilation with assistance', 'Patient-driven cycles with assisted breaths'],
    ['Low-frequency jet ventilation', 'Discrete lower-frequency jet pulses'],
    ['High-frequency jet ventilation', 'Rapid small-volume jet pulses'],
  ])('reveals the %s pulse summary', (modeName, pulseSummary) => {
    render(<RigidBronchoscopyAssemblyLab />)

    fireEvent.click(screen.getByRole('button', { name: /Pathway lab/i }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(modeName, 'i') }))
    fireEvent.click(
      screen.getByRole('button', {
        name: /opposite main bronchus remains reachable through bronchoscope fenestrations/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal modeled flow' }))

    expect(screen.getByText(pulseSummary)).toBeVisible()
  })

  it('shows the complete static pathway when reduced motion is requested', () => {
    mockReducedMotion = true
    render(<RigidBronchoscopyAssemblyLab />)

    fireEvent.click(screen.getByRole('button', { name: /Pathway lab/i }))
    fireEvent.click(
      screen.getByRole('button', {
        name: /opposite main bronchus remains reachable through bronchoscope fenestrations/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal modeled flow' }))

    expect(screen.getByRole('status', { name: 'Animation status' })).toHaveTextContent(
      'Static pathway shown for reduced-motion mode.',
    )
    expect(screen.queryByRole('button', { name: 'Play animation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset animation' })).not.toBeInTheDocument()
  })

  it('lets the learner select any loose piece and reveals a target only after Hint', () => {
    render(<RigidBronchoscopyAssemblyLab />)

    const c2Button = screen.getByRole('button', { name: /C2 light adapter/i })
    fireEvent.click(c2Button)
    expect(c2Button).toHaveAttribute('aria-pressed', 'true')

    const hintButton = screen.getByRole('button', { name: 'Hint' })
    expect(hintButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Place selected part' }))
    expect(screen.getAllByText(/Connect C1 light adapter before placing C2/i)).toHaveLength(2)
    expect(hintButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(hintButton)
    expect(hintButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Move C2 light adapter to the cyan outline/i)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Camera head/i }))
    expect(hintButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('switches to the four-item tool explorer and supports localized chrome overrides', () => {
    render(
      <RigidBronchoscopyAssemblyLab
        copy={{ title: 'Laboratorio de montaje', toolMode: 'Explorar instrumentos' }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Laboratorio de montaje' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Explorar instrumentos/i }))

    expect(screen.getByText('Selected instrument')).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Optical grasping forceps 32-3230-430HM/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /BPS2002 semi-rigid grasping forceps/i }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /BPS2001 semi-rigid biopsy forceps/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /3 mm semi-rigid suction catheter/i })).toBeVisible()
  })

  it('turns the shared lab into an answer-visible Learn demonstration', () => {
    render(<RigidBronchoscopyAssemblyLab experience="demonstration" />)

    expect(screen.queryByRole('button', { name: 'Hint' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
    expect(screen.getByText('0 of 8 pieces seated')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Place selected part' }))
    expect(screen.getByText('1 of 8 pieces seated')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Pathway lab/i }))
    expect(screen.getByText('Anatomical route result')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Commit prediction' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal modeled flow' })).not.toBeInTheDocument()
    expect(screen.queryByText('Your prediction matches this schematic.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Proximal trachea/i }))
    expect(screen.getByText('Anatomical route result')).toBeVisible()
    expect(
      screen.getByText(/distal fenestrations lie above the cords and add an escape route/i),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Tool explorer/i }))
    expect(screen.getByText('Selected instrument')).toBeVisible()
  })
})
