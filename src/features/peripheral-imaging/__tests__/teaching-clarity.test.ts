/** @jest-environment node */
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { smearWidth } from '../components/suite/dtsModel'
import { suiteFrame } from '../components/suite/suiteModel'
import { demonstrationReminders } from '../content/demonstrationOrigins'
import { DOSE_NOTE_TEMPLATE_LINES, DOSE_QUANTITIES } from '../content/doseQuantities'
import {
  GLOSSARY_TERMS,
  firstSectionUsing,
  glossaryProvenanceLabel,
  glossaryTerm,
  termsForSection,
} from '../content/glossary'
import { INTERPRETATION_CHECKS } from '../content/interpretationChecks'
import { imagingLearningActivities } from '../content/learningActivities'
import { imagingMicroCaseById } from '../content/microCases'
import { peripheralImagingSectionIds } from '../content/pathway'
import { RECONSTRUCTION_ACCOUNTS } from '../content/reconstruction'
import { relatedPracticeCase } from '../content/relatedCases'
import { IMAGING_SHARED_BOUNDARY, imagingSectionSpec } from '../content/sectionSpecs'
import { imagingStageLesson } from '../content/stageLessons'
import { imagingSectionItems, questionIdOf } from '../content/stageItems'
import { teachingDemonstration } from '../content/teachingExamples'
import { PI_NUMBERS } from '../content/teachingNumbers'
import { transferOrigin } from '../content/transferOrigins'
import { WARNING_INVENTORY, warningsInCategory } from '../content/warningInventory'
import { LESSONS } from '../data/lessons'
import { QUESTIONS } from '../data/questions'
import { MODALITIES } from '../data/resources'
import { SOURCE_BY_ID } from '../data/sources'
import {
  LAB_CONTROLS,
  LAB_METRIC_MEANINGS,
  LAB_METRICS,
  type LabMetricId,
} from '../engine/labMetrics'
import { IMAGING_LAB_GOALS } from '../content/labGoals'
import { dtsShift, radians, windowRelationship } from '../lib/physics'

/*
 * PI-FELLOW-03 — the data behind the teaching-clarity pass. Source IDs are the AI-assisted fellow
 * walkthrough's own, with the PDF page. These hold what is authored and what it is derived from;
 * the rendered file holds what the learner sees.
 */

describe('reports CW3, O2, 1.1/6.1, 1.8, 4.4, 4.6 — every term the walkthrough met undefined has a defined, provenanced entry', () => {
  const named = [
    'dts',
    'cbct',
    'kap',
    'reference-air-kerma',
    'automatic-exposure-regulation',
    'last-image-hold',
    'isocenter',
    'binning',
    'anisotropy',
    'missing-wedge',
    'regularization',
    'iterative-reconstruction',
    'validated-endpoint',
    'sampling-component',
    'side-cutting-window',
    'mpr',
    'tool-plane-spread',
    'vespa',
    'obliquity-and-tilt',
  ]

  it.each(named)(
    '%s is in the registry with a definition and a named source of its words',
    (id) => {
      const term = glossaryTerm(id)
      expect(term.definition.length).toBeGreaterThan(40)
      expect(flaggedLearnerCopyTerms(term.definition)).toEqual([])
      expect(term.provenance.kind).toBeTruthy()
      expect(firstSectionUsing(id)).not.toBeNull()
    },
  )

  it('shows no review status on a definition; the two written for the course name their sources', () => {
    // Teaching-first rules, 2026-10-08: review status is project metadata and never renders.
    expect(GLOSSARY_TERMS.filter((term) => term.status === 'drafted')).toEqual([])
    const written = GLOSSARY_TERMS.filter((term) => term.provenance.kind === 'drafted')
    expect(written.map((term) => term.id)).toEqual(['binning', 'stored-contour'])
    for (const term of written) {
      if (term.provenance.kind !== 'drafted') throw new Error('unreachable')
      expect(term.provenance.basis.length).toBeGreaterThan(20)
      expect(term.provenance.sourceIds.length).toBeGreaterThan(0)
      for (const sourceId of term.provenance.sourceIds)
        expect(SOURCE_BY_ID.has(sourceId)).toBe(true)
      const label = glossaryProvenanceLabel(term)
      expect(label).toMatch(/^Written for this course from \S/)
      expect(label).not.toMatch(/draft|awaiting|review/i)
    }
  })

  it('defines VESPA from the registered study record, not from memory', () => {
    const term = glossaryTerm('vespa')
    expect(term.provenance).toEqual({ kind: 'registered-source', sourceId: 'vespa' })
    expect(SOURCE_BY_ID.get('vespa')?.title).toMatch(/VESPA Trial/)
    // The facts stated are the record's: a multicenter randomized trial; ETT, recruitment, FiO₂
    // below 1.0 and PEEP 8–10 against a laryngeal mask, full oxygen and no PEEP; atelectasis on CT.
    expect(term.definition).toMatch(/multicenter randomized trial/)
    expect(term.definition).toMatch(/recruitment maneuver/)
    expect(term.definition).toMatch(/PEEP of 8 to 10 cm H₂O/)
    expect(term.definition).toMatch(/laryngeal mask/)
    expect(term.definition).toMatch(/does not say which part of the bundle/)
    // The Section 16 teaching carries the same clause.
    const block = LESSONS.find((l) => l.id === 'changing-anatomy')!.blocks.find((b) =>
      /Treat atelectasis/.test(b.title),
    )!
    expect(block.body).toMatch(/VESPA, a multicenter randomized trial/)
    expect(block.body).toMatch(/PEEP of 8 to 10 cm H₂O/)
    expect(block.sources).toContain('vespa')
  })

  it('defines the spread readout from the arithmetic that prints it (report 4.6)', () => {
    const term = glossaryTerm('tool-plane-spread')
    expect(term.provenance.kind).toBe('implementation')
    // smearWidth is the difference of the shift-and-add displacement at the two ends of the arc.
    for (const [object, plane, sweep] of [
      [-18, 0, 30],
      [-18, -18, 30],
      [0, 10, 60],
      [25, -30, 20],
    ] as const) {
      const expected = Math.abs(
        dtsShift(object, plane, sweep / 2) - dtsShift(object, plane, -sweep / 2),
      )
      expect(smearWidth(object, plane, sweep)).toBeCloseTo(expected, 10)
      expect(smearWidth(object, plane, sweep)).toBeCloseTo(
        2 * Math.abs(object - plane) * Math.tan(radians(sweep / 2)),
        10,
      )
    }
    // Zero on the object's own plane; growing with distance from it and with the arc.
    expect(smearWidth(-18, -18, 30)).toBe(0)
    expect(smearWidth(-18, 0, 30)).toBeGreaterThan(smearWidth(-18, -9, 30))
    expect(smearWidth(-18, 0, 60)).toBeGreaterThan(smearWidth(-18, 0, 30))
    expect(term.definition).toMatch(/zero when the plane passes through the object/)
  })

  it('states the model’s signed-angle convention from its own geometry, and maps it to RAO/LAO and cranial the same way (reports 2.6, 3.2)', () => {
    // x is patient left, z superior (lib/physics.ts). Positive obliquity moves the detector end of
    // the C-arm toward the patient's right; positive tilt moves it toward the head.
    expect(suiteFrame(30, 0).detectorCenter[0]).toBeLessThan(0)
    expect(suiteFrame(30, 0).source[0]).toBeGreaterThan(0)
    expect(suiteFrame(-30, 0).detectorCenter[0]).toBeGreaterThan(0)
    expect(suiteFrame(0, 10).detectorCenter[2]).toBeGreaterThan(0)
    expect(suiteFrame(0, -10).detectorCenter[2]).toBeLessThan(0)
    const term = glossaryTerm('obliquity-and-tilt')
    expect(term.definition).toMatch(
      /positive obliquity swings the detector toward the patient’s right/,
    )
    expect(term.definition).toMatch(/positive tilt swings it toward the head/)
    // Owner item 2.6, adopted 2026-10-08: the mapping is taught, and it agrees with the geometry
    // pinned above — detector toward the patient's right is RAO, detector toward the head is cranial.
    expect(term.definition).toMatch(
      /On a console that names the detector’s side, positive obliquity here corresponds to RAO and negative to LAO, and positive tilt to cranial angulation/,
    )
    expect(term.definition).toMatch(/check your own system’s convention/)
  })

  it('resolves a deep-linked section’s own terms from its own text', () => {
    expect(termsForSection('dts-acquisition').map((t) => t.id)).toEqual(
      expect.arrayContaining(['dts', 'missing-wedge', 'anisotropy', 'tool-plane-spread']),
    )
    expect(termsForSection('dts-interpretation').map((t) => t.id)).toEqual(
      expect.arrayContaining(['iterative-reconstruction', 'regularization', 'validated-endpoint']),
    )
    expect(termsForSection('imaging-questions').map((t) => t.id)).toEqual(
      expect.arrayContaining([
        'dts',
        'cbct',
        'radial-ebus',
        'sampling-component',
        'side-cutting-window',
        'mpr',
      ]),
    )
    expect(termsForSection('chain-walk').map((t) => t.id)).toEqual(
      expect.arrayContaining(['kap', 'binning']),
    )
    expect(termsForSection('changing-anatomy').map((t) => t.id)).toContain('vespa')
    expect(termsForSection('dose-reporting').map((t) => t.id)).toEqual(
      expect.arrayContaining(['kap', 'reference-air-kerma', 'peak-skin-dose', 'effective-dose']),
    )
    // The detector's "field of view" is not the CBCT reconstruction volume.
    expect(termsForSection('chain-walk').map((t) => t.id)).not.toContain('reconstruction-volume')
  })

  it('spells the modalities out at first use on the entry surfaces and in Section 1 (report O2)', () => {
    const s1 = LESSONS[0].blocks.find((b) => b.title === 'Match the modality to the question')!
    expect(s1.body).toMatch(/Digital tomosynthesis \(DTS\)/)
    expect(s1.body).toMatch(/Cone-beam CT \(CBCT\)/)
    expect(s1.body).toMatch(/Radial endobronchial ultrasound \(radial EBUS\)/)
    expect(MODALITIES.map((m) => m.name)).toEqual(
      expect.arrayContaining([
        'Digital tomosynthesis (DTS)',
        'Fixed cone-beam CT (CBCT)',
        'Mobile cone-beam CT (CBCT)',
      ]),
    )
  })
})

describe('reports 1.3 and 3.10 — the radial EBUS limitation is taught where the rEBUS items are', () => {
  it('brings Section 9’s existing limitation into Section 1 with its sources, and changes no item', () => {
    const s1 = LESSONS[0].blocks.find((b) => b.title === 'Match the modality to the question')!
    const s9 = LESSONS.find((l) => l.id === 'two-dimensional')!.blocks.find(
      (b) => b.title === 'Radial EBUS is a different kind of evidence',
    )!
    expect(s1.body).toMatch(/atelectatic lung can also look lesion-like/)
    expect(s1.body).toMatch(/the probe is not the biopsy tool/)
    expect(s9.body).toMatch(/atelectatic lung can also look lesion-like/)
    expect(s1.sources).toEqual(expect.arrayContaining(['ilocate', 'mobile']))
    // The concentric-view claim itself is an owner decision: the items are as they were.
    const transfer = imagingSectionItems('imaging-questions').transfer
    expect(transfer.explanation).toBe(
      'A concentric rEBUS view localizes the probe, not the biopsy tool.',
    )
  })
})

describe('report CW1 — a reused closing question is labelled as the optional review it is', () => {
  it('maps every reused transfer to the section that authored it and the sections that rendered it', () => {
    const table = peripheralImagingSectionIds.map((id) => {
      const origin = transferOrigin(id)
      return origin
        ? [id, origin.questionId, origin.origin.sectionId, origin.seenIn.map((s) => s.sectionId)]
        : [id, questionIdOf(imagingSectionItems(id).transfer.id), null, []]
    })
    expect(table).toEqual([
      ['imaging-questions', 'choose-transfer-1', null, []],
      // Section 1 renders its QS-1 check (OD4-05) instead of choose-1, so the worked example's twin
      // is first met as Section 2's review, and the label says so rather than "asked again".
      ['chain-walk', 'choose-1', 'imaging-questions', []],
      ['good-image', 'walk-1', 'chain-walk', ['chain-walk']],
      ['current-anatomy', 'choose-1', 'imaging-questions', ['chain-walk']],
      ['projection', 'anatomy-1', 'current-anatomy', ['current-anatomy']],
      ['signal', 'geometry-1', 'projection', []],
      ['field', 'signal-1', 'signal', []],
      ['time', 'field-1', 'field', []],
      ['two-dimensional', 'time-1', 'time', []],
      ['dts-acquisition', 'geometry-1', 'projection', ['signal']],
      ['dts-interpretation', 'anatomy-1', 'current-anatomy', ['current-anatomy', 'projection']],
      ['cbct-acquisition', 'dts-1', 'dts-acquisition', ['dts-acquisition']],
      ['fixed-suite', 'field-1', 'field', ['time']],
      ['mobile-suite', 'acquisition-1', 'cbct-acquisition', ['cbct-acquisition']],
      ['tool-confirmation', 'geometry-1', 'projection', ['signal', 'dts-acquisition']],
      ['changing-anatomy', 'prior-1', 'dts-interpretation', ['dts-interpretation']],
      ['staff-protection', 'field-1', 'field', ['time', 'fixed-suite']],
      ['dose-reporting', 'time-1', 'time', ['two-dimensional']],
      ['suite-cases', 'capstone-transfer-1', null, []],
    ])
  })

  it('labels the step honestly and keeps the two genuinely new closing questions as they were', () => {
    for (const id of peripheralImagingSectionIds) {
      const lesson = imagingStageLesson(id)
      const step = lesson.steps[lesson.transferStepIndex]
      const origin = transferOrigin(id)
      if (!origin) {
        expect(step.title).toBe('Apply it to another situation')
        continue
      }
      expect(step.title).toBe(`Optional review · ${origin.origin.shortTitle}`)
      expect(step.title).not.toMatch(/\d/)
      expect(step.instruction).toMatch(new RegExp(`Section ${origin.origin.number} \\(`))
      expect(step.instruction).toMatch(
        /optional review: answer it, show the explanation, or continue without answering/,
      )
      // A question Section 5 never rendered is not said to have been asked by Section 5.
      if (origin.seenIn.length === 0) expect(step.instruction).not.toMatch(/asked again/)
      if (origin.seenIn[0] && origin.seenIn[0].sectionId !== origin.origin.sectionId)
        expect(step.instruction).toMatch(/it first appears at the end of Section/)
    }
  })

  it('changes no item identity, key or storage identity', () => {
    for (const id of peripheralImagingSectionIds) {
      const lesson = imagingStageLesson(id)
      const step = lesson.steps[lesson.transferStepIndex]
      if (step.interaction.kind !== 'prediction') throw new Error('unreachable')
      const questionId = questionIdOf(imagingSectionItems(id).transfer.id)
      expect(step.interaction.item.id).toBe(`${id}:${questionId}`)
      expect(step.interaction.item.transferVariantId).toBe(`${questionId}-in-${id}`)
      expect(step.interaction.item.phase).toBe('transfer')
      expect(step.interaction.round).toBe(1)
      expect(step.id).toBe(`${id}:transfer`)
      expect(step.gate).toBe('open')
    }
  })
})

describe('reports 2.8 and 3.4 — a demonstration reused from an earlier section is framed as a reminder', () => {
  it('finds exactly the cross-section reuses, one per section, and keeps the originals unframed', () => {
    expect(demonstrationReminders().map((r) => [r.activityId, r.origin.sectionId])).toEqual([
      ['good-image:projection', 'chain-walk'],
      ['projection:parallax', 'chain-walk'],
      ['field:display', 'good-image'],
      ['dts-interpretation:prior', 'dts-acquisition'],
      ['fixed-suite:room', 'cbct-acquisition'],
      ['mobile-suite:commission', 'cbct-acquisition'],
      ['changing-anatomy:timeline', 'current-anatomy'],
    ])
    for (const reminder of demonstrationReminders()) {
      expect(reminder.origin.newHere).toBe(
        imagingSectionSpec(reminder.activityId.split(':')[0] as never).newConcept,
      )
    }
  })
})

describe('reports 3.3, 4.4, 2.14 and 2.11 — the rule or the worked example leads, one name per construct', () => {
  it('leads Section 7’s magnification block with the rule and keeps the device caveats one disclosure away', () => {
    const block = LESSONS.find((l) => l.id === 'field')!.blocks.find(
      (b) => b.title === 'Display zoom versus acquisition magnification',
    )!
    expect(block.body).toMatch(
      /^Ask whether a control changes the X-ray acquisition, the detector readout, or only the display\./,
    )
    expect(block.detail?.body).toMatch(
      /Image-intensifier electronic magnification generally required increased exposure/,
    )
    expect(block.detail?.body).toMatch(/needs local characterization/)
    expect(block.detail?.body).toMatch(/binning \(combining adjacent detector pixels at readout\)/)
    expect(block.detail?.body).not.toMatch(/draft|awaiting/i)
  })

  it('puts the worked example first where the walkthrough asked (Sections 4, 10 and 11)', () => {
    const first = (section: string, activity: string) =>
      imagingLearningActivities(section as never).find((a) => a.id === `${section}:${activity}`)!
        .content[0]
    expect(first('current-anatomy', 'mismatch')).toBe('@worked')
    expect(first('dts-acquisition', 'planes')).toBe('@worked')
    expect(first('dts-interpretation', 'prior')).toBe('@worked')
  })

  it('glosses the reconstruction jargon in the blocks that use it', () => {
    const s10 = LESSONS.find((l) => l.id === 'dts-acquisition')!.blocks.find(
      (b) => b.title === 'Depth resolution depends on angular coverage',
    )!
    const s11 = LESSONS.find((l) => l.id === 'dts-interpretation')!
    expect(s10.body).toMatch(/anisotropy \(resolution that differs by direction\)/)
    expect(s11.blocks.find((b) => /prior CT can improve/.test(b.title))!.body).toMatch(
      /regularization — an added rule that favours one solution/,
    )
    expect(s11.blocks.find((b) => /Question the claim/.test(b.title))!.body).toMatch(
      /independently validated endpoint: the outcome measured in its own study/,
    )
  })

  it('uses one learner-facing name for the stored contour and none of the look-alikes', () => {
    const labels = LAB_CONTROLS.registration.map((c) => c.label)
    expect(labels).toContain('Show the stored contour')
    expect(labels).toContain('Capture a new stored contour')
    const surfaces = [
      ...labels,
      ...(teachingDemonstration('current-anatomy')?.examples.flatMap((e) => [e.title, e.look]) ??
        []),
      ...IMAGING_LAB_GOALS['current-anatomy']!.act.map((g) => g.label),
      ...IMAGING_LAB_GOALS['changing-anatomy']!.act.map((g) => g.label),
      ...imagingLearningActivities('current-anatomy').map((a) => a.title),
    ]
    for (const text of surfaces) {
      expect(text).not.toMatch(/saved contour|augmented contour|teaching contour/i)
    }
  })

  it('calls the lesion a modeled lesion in the sampling readouts, not a sphere (report 6.3)', () => {
    expect(windowRelationship([10, 0, 0]).label).toBe(
      'Sampling window fully within the modeled lesion',
    )
    expect(windowRelationship([20, 0, 0]).label).toBe(
      'Sampling window partly intersects the modeled lesion',
    )
    expect(windowRelationship([-5, 0, 0]).label).toBe('Sampling window outside the modeled lesion')
    // The geometry is untouched.
    expect(windowRelationship([10, 0, 0])).toMatchObject({
      full: true,
      intersects: true,
      tipInside: false,
    })
  })

  it('gives every printed readout a meaning, and aligns Section 3’s first title with its block', () => {
    for (const metric of Object.keys(LAB_METRICS) as LabMetricId[]) {
      expect(LAB_METRIC_MEANINGS[metric].length).toBeGreaterThan(20)
    }
    expect(LAB_METRIC_MEANINGS.zoomAddsExposure).toMatch(/^Always no/)
    const first = imagingLearningActivities('good-image')[0]
    expect(first.id).toBe('good-image:projection')
    expect(first.title).toBe('Start from the baseline image, then change the projection')
    expect(first.content).toContain('The baseline image')
  })
})

describe('report CW2 — caveats are classed, and only the repeated general one is consolidated', () => {
  it('consolidates nothing in the figure-limitation and immediate-safety classes, and renders no review status', () => {
    for (const category of ['figure-limitation', 'immediate-safety'] as const) {
      const surfaces = warningsInCategory(category)
      expect(surfaces.length).toBeGreaterThan(0)
      for (const surface of surfaces) expect(surface.treatment).not.toBe('consolidated')
    }
    // Review status is project metadata (teaching-first rules, 2026-10-08): no surface carries it.
    expect(warningsInCategory('unresolved-status')).toEqual([])
    // The one module statement: hub, Help and the closing screen.
    expect(WARNING_INVENTORY.find((s) => s.id === 'shared-model-boundary')?.selector).toBe(
      '[data-module-statement], [data-help-models], [data-closing-statement]',
    )
    expect(
      warningsInCategory('general-provenance').some((s) => s.treatment === 'consolidated'),
    ).toBe(true)
    expect(new Set(WARNING_INVENTORY.map((s) => s.id)).size).toBe(WARNING_INVENTORY.length)
  })

  it('keeps the primary-beam warning as its own callout (report 7.4), and no section repeats the module statement', () => {
    const block = LESSONS.find((l) => l.id === 'staff-protection')!.blocks.find(
      (b) => b.title === 'Keep hands out of the primary beam',
    )!
    expect(block.callout).toBe(
      'A lead apron, glove or shield does not justify placing a hand in the primary beam, and it can drive automatic exposure regulation up.',
    )
    expect(block.body).not.toMatch(/lead apron/)
    for (const id of peripheralImagingSectionIds) {
      const boundary = imagingSectionSpec(id).modelBoundary
      // The statement is said once per module, so a section's own limit never carries it.
      expect(boundary).not.toContain(IMAGING_SHARED_BOUNDARY)
      expect(boundary.trim().length).toBeGreaterThan(30)
    }
  })

  it('says "modeled" where the demonstrations said "fictional", and keeps the not-a-real-device limits', () => {
    for (const id of peripheralImagingSectionIds) {
      for (const example of teachingDemonstration(id)?.examples ?? []) {
        expect(example.title).not.toMatch(/fictional/i)
        expect(example.look).not.toMatch(/fictional/i)
      }
    }
    const sampling = teachingDemonstration('tool-confirmation')!.examples
    expect(sampling.some((e) => /do not describe a real device/.test(e.look))).toBe(true)
  })
})

describe('reports 7.1, 7.2, 5.3, 3.11, PR4, IC4 — supported distinctions first, no invented values', () => {
  it('tables the four dose quantities from the section’s teaching, with sources, and a template that names the notification levels', () => {
    expect(DOSE_QUANTITIES.map((r) => r.id)).toEqual([
      'reference-air-kerma',
      'kap',
      'peak-skin-dose',
      'effective-dose',
    ])
    for (const row of DOSE_QUANTITIES)
      expect(row.sourceIds.every((s) => SOURCE_BY_ID.has(s))).toBe(true)
    // The blanks stay blank; the only figures are the AAPM notification levels, from the register.
    const notification = PI_NUMBERS.value('aapm-first-notification')
    expect(notification).toMatch(/\d\s*Gy/)
    expect(DOSE_NOTE_TEMPLATE_LINES.filter((line) => /\d/.test(line))).toEqual([
      `Dose notifications (${notification}), limitations and dose-management follow-up: ______`,
    ])
    expect(DOSE_NOTE_TEMPLATE_LINES.join('\n')).toMatch(/kerma–area product/)
    expect(DOSE_NOTE_TEMPLATE_LINES.join('\n')).toMatch(/reference air kerma/)
    expect(DOSE_NOTE_TEMPLATE_LINES.join('\n')).toMatch(/Reason for each repeated acquisition/)
  })

  it('rewords the biopsy-permission rationale for the learner and keeps the limit (report 3.11)', () => {
    const rationale = INTERPRETATION_CHECKS['two-dimensional']!.choices.find(
      (c) => c.id === 'a',
    )!.rationale
    expect(rationale).not.toMatch(/module never grants/)
    expect(rationale).toMatch(/cannot clear a biopsy/)
    expect(rationale).toMatch(/procedure team/)
    expect(INTERPRETATION_CHECKS['two-dimensional']!.correct).toBe('c')
  })

  it('offers the eccentric rEBUS case from Section 1 without moving it, keyed on redirecting the catheter (report PR4)', () => {
    const related = relatedPracticeCase('imaging-questions:transfer')!
    expect(related.microCase.id).toBe('two-dimensional-practice-1')
    expect(related.microCase.sectionId).toBe('two-dimensional')
    expect(related.microCase.presentationTitle).toBe('Eccentric radial EBUS view')
    // Rewritten 2026-10-08 (teaching-first): the first move is with the hands — redirect and
    // re-image until concentric — and imaging is added only if the view stays eccentric.
    const item = imagingMicroCaseById.get('two-dimensional-practice-1')!.item
    expect(item.explanation).toMatch(
      /^An eccentric rEBUS view means the probe is beside the lesion\. Redirect the catheter or enter the adjacent airway and re-image until the view is concentric/,
    )
    const best = item.choices.filter((choice) => choice.plausibility === 'best')
    expect(best).toHaveLength(1)
    const keyed = best[0]
    expect(QUESTIONS.find((q) => q.id === 'two-dimensional-practice-1')?.correct).toBe('b')
    expect(keyed.label).toMatch(/^Redirect the catheter/)
    expect(keyed.rationale).toMatch(/re-imaging until the tissue surrounds the probe/)
    expect(relatedPracticeCase('imaging-questions:interpretation')).toBeNull()
  })

  it('leads each reconstruction account with an analogy in the course’s own words (report 4.1)', () => {
    const dts = RECONSTRUCTION_ACCOUNTS.find((a) => a.id === 'tomosynthesis')!
    const cbct = RECONSTRUCTION_ACCOUNTS.find((a) => a.id === 'cone-beam')!
    expect(dts.analogy).toMatch(/sliding a stack of transparencies/)
    expect(cbct.analogy).toMatch(/projections from a wide rotation/)
    expect(cbct.analogy).not.toMatch(/nothing.*inferred/)
    expect(glossaryTerm('iterative-reconstruction').definition).not.toMatch(/until they agree/)
    expect(DOSE_QUANTITIES.find((row) => row.id === 'kap')?.tells).toMatch(/uniform free-air field/)
  })
})
