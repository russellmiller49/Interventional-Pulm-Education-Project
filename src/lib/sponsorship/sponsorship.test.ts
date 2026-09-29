/** @jest-environment node */
import { approvedDisclosure, PROMOTIONAL_WORDING, sponsorshipForModule } from './policy'
import { NOT_A_PERSON, sponsorshipSchema, sponsorships, type Sponsorship } from './registry'

const thoracoscopy = sponsorships.find((record) => record.moduleId === 'medical-thoracoscopy')
if (!thoracoscopy) throw new Error('the medical thoracoscopy sponsorship is missing')

function approved(change: (record: Sponsorship) => void = () => {}): Sponsorship {
  const copy = JSON.parse(JSON.stringify(thoracoscopy)) as Sponsorship
  copy.disclosure = {
    wording:
      'Richard Wolf sponsors this module. Its content is independent: the site owner keeps editorial control. The sponsor checked device facts only.',
    approvedBy: 'A. Owner',
    approvedOn: '2026-10-01',
    note: 'Approved.',
  }
  change(copy)
  return copy
}

describe('sponsorship registry', () => {
  it('records Medical Thoracoscopy as sponsored, with editorial control kept by the owner', () => {
    expect(thoracoscopy.sponsor).toBe('Richard Wolf')
    expect(thoracoscopy.modulePath).toBe('/medical-thoracoscopy')
    expect(thoracoscopy.editorialControl).toBe('owner')
    expect(thoracoscopy.sponsorReviews.join(' ')).not.toMatch(/clinical|teaching|source/i)
  })

  it('records no legal entity, dates or approval the owner has not given', () => {
    expect(thoracoscopy.legalEntity).toBeNull()
    expect(thoracoscopy.startedOn).toBeNull()
    expect(thoracoscopy.disclosure).toMatchObject({
      wording: null,
      approvedBy: null,
      approvedOn: null,
    })
  })

  it('accepts approved wording that names the sponsor and the editorial control', () => {
    expect(sponsorshipSchema.safeParse(approved()).success).toBe(true)
  })

  it.each([
    ['wording with no approver', (record: Sponsorship) => (record.disclosure.approvedBy = null)],
    ['wording with no date', (record: Sponsorship) => (record.disclosure.approvedOn = null)],
    [
      'an approver who is not a person',
      (record: Sponsorship) => (record.disclosure.approvedBy = 'Claude'),
    ],
    [
      'wording that does not name the sponsor',
      (record: Sponsorship) =>
        (record.disclosure.wording =
          'This module is sponsored. The owner keeps editorial control.'),
    ],
    [
      'wording silent on editorial control',
      (record: Sponsorship) => (record.disclosure.wording = 'Richard Wolf sponsors this module.'),
    ],
    [
      'an approval with nothing approved',
      (record: Sponsorship) => {
        record.disclosure.wording = null
      },
    ],
    [
      'a sponsor that reviews clinical teaching',
      (record: Sponsorship) => record.sponsorReviews.push('Clinical teaching'),
    ],
  ])('refuses %s', (_name, change) => {
    expect(sponsorshipSchema.safeParse(approved(change)).success).toBe(false)
  })

  it('knows a person from a machine', () => {
    for (const name of ['Claude', 'Codex', 'GPT-5', 'AI assistant', 'review bot']) {
      expect(NOT_A_PERSON.test(name)).toBe(true)
    }
    expect(NOT_A_PERSON.test('Russell Miller')).toBe(false)
  })
})

describe('sponsorship policy', () => {
  it('shows nothing for Medical Thoracoscopy until the owner approves wording', () => {
    expect(sponsorshipForModule('medical-thoracoscopy')).toBe(thoracoscopy)
    expect(approvedDisclosure('medical-thoracoscopy')).toBeNull()
  })

  it('shows nothing for a module that is not sponsored', () => {
    expect(sponsorshipForModule('bronchoscopy-foundations')).toBeNull()
    expect(approvedDisclosure('bronchoscopy-foundations')).toBeNull()
  })

  it('refuses praise and claims of superiority', () => {
    for (const sentence of [
      'The best view of the pleura.',
      'A unique single-port design.',
      'Maximum versatility with minimal access.',
      'State-of-the-art optics.',
    ]) {
      expect(PROMOTIONAL_WORDING.test(sentence)).toBe(true)
    }
    for (const sentence of [
      'The telescope has a 3.5 mm working channel.',
      'The sleeve is threaded along its length.',
    ]) {
      expect(PROMOTIONAL_WORDING.test(sentence)).toBe(false)
    }
  })
})
