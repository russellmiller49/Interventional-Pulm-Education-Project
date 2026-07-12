import { rigidBronchoscopyEquipment } from '../content/equipment'
import { rigidCoreBlocks } from '../content/learnContent'
import { airwayReferences } from '../content/references'

describe('rigid bronchoscopy v2 clinical content', () => {
  it('teaches four distinct EFER interfaces without treating a ventilation port as an instrument route', () => {
    const barrel = rigidBronchoscopyEquipment.find((item) => item.id === 'rigid-barrel')
    const hotspotById = new Map(barrel?.hotspots.map((hotspot) => [hotspot.id, hotspot]))

    expect([...hotspotById.keys()]).toEqual(
      expect.arrayContaining([
        'main-axial-port',
        'accessory-port',
        'anesthesia-circuit-port',
        'jet-ventilation-port',
      ]),
    )
    expect(hotspotById.get('main-axial-port')?.description).toContain('optical forceps')
    expect(hotspotById.get('accessory-port')?.description).toContain('smaller lateral port')
    expect(hotspotById.get('anesthesia-circuit-port')?.description).toContain('breathing circuit')
    expect(hotspotById.get('jet-ventilation-port')?.description).toContain(
      'Instruments must not be routed',
    )
  })

  it('keeps assisted ventilation on the anesthesia circuit and distinguishes obstruction mechanics', () => {
    const ventilation = rigidCoreBlocks.find((block) => block.id === 'anesthesia-ventilation')
    const copy = ventilation?.bullets?.join(' ') ?? ''

    expect(copy).toContain('same anaesthesia-circuit port')
    expect(copy).toContain('does not ventilate through the main axial instrument port')
    expect(copy).toContain('very low certainty of evidence')
    expect(copy).toContain(
      'ball-valve lesion may admit inspired gas but restrict passive expiration',
    )
    expect(copy).toContain('fixed complete obstruction instead blocks distal inspiration')
  })

  it('requires both depth and rotation for contralateral fenestration teaching', () => {
    const ventilation = rigidCoreBlocks.find((block) => block.id === 'anesthesia-ventilation')
    const copy = ventilation?.bullets?.join(' ') ?? ''

    expect(copy).toContain('both depth and rotation')
    expect(copy).toContain('“nonfenestrated” does not mean leak-free')
  })

  it('registers the current guideline and principal ventilation storyboard sources', () => {
    const references = new Map(airwayReferences.map((reference) => [reference.id, reference]))

    expect(references.get('sarkiss-eapen-airway-management-2022')?.citation).toContain(
      'Curr Anesthesiol Rep. 2022;12:390-397',
    )
    expect(references.get('chest-cao-guideline-2025')?.citation).toContain(
      'Chest. 2025;167(1):283-295',
    )
    expect(references.get('chest-cao-guideline-2025')?.useNote).toContain(
      'very low certainty of evidence',
    )
    expect(references.get('putz-jet-ventilation-2016')?.url).toBe(
      'https://doi.org/10.1155/2016/4234861',
    )
  })
})
