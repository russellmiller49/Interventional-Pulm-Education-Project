import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { GlossaryTerms } from '../components/Glossary'
import { SequenceActivity } from '../components/SequenceActivity'
import { SourceList } from '../components/SourceList'
import { QuestionBody } from '../components/QuestionBody'
import { LESSONS } from '../content/curriculum'
import { GLOSSARY } from '../content/glossary'
import { SOURCE_CHECK_DATE, SOURCES } from '../content/sources'

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const lesson = (id: string) => LESSONS.find((entry) => entry.id === id)!

describe('Step 13: approved wording with bounded source and behavior scope', () => {
  it('OD-01 compares mechanisms with the same identity, key and held-image policy', () => {
    const question = lesson('contact-cutaway-model').observation
    expect(question.id).toBe('cutaway-observe')
    expect(question.imagePolicy).toBe('retained-acquisition')
    expect(question.namesContactMode).toBeUndefined()
    expect(question.choices.filter((choice) => choice.correct).map((choice) => choice.id)).toEqual([
      'b',
    ])
    const onCommit = jest.fn()
    function Check() {
      const [selected, setSelected] = useState('')
      const [committed, setCommitted] = useState<string>()
      return (
        <QuestionBody
          question={question}
          selected={selected}
          committed={committed}
          onSelect={setSelected}
          onCheck={() => {
            onCommit(selected)
            setCommitted(selected)
          }}
          onRetry={() => setCommitted(undefined)}
        />
      )
    }
    render(<Check />)
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText(question.explanation)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Hide explanation' }))
    fireEvent.click(screen.getByRole('radio', { name: question.choices[0].text }))
    fireEvent.click(screen.getByRole('button', { name: 'Check response' }))
    expect(onCommit).toHaveBeenCalledWith('a')
  })

  it('OD-03 distinguishes protected preparation without changing the accepted sequence', () => {
    const sequence = lesson('needle-safety').sequence!
    expect(sequence.steps.map((step) => step.id)).toEqual([
      'step-0',
      'step-1',
      'step-2',
      'step-3',
      'step-4',
    ])
    expect(sequence.steps[0].text).toBe(
      'Confirm the labeled target, live image, and acceptable vascular path',
    )
    expect(sequence.steps[1].text).toBe(
      'Confirm protected needle position and prepare the assembly per the IFU',
    )
    const onComplete = jest.fn()
    render(<SequenceActivity sequence={sequence} onComplete={onComplete} />)
    // A reversed first pair still differs from the authored example. The feedback must carry
    // the owner's distinction rather than declaring protected preparation unsafe.
    for (const index of [1, 0, 2, 3, 4]) {
      fireEvent.click(screen.getByRole('button', { name: sequence.steps[index].text }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Check sequence' }))
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Protected needle/assembly preparation may occur according to the device and local workflow.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show the sequence' }))
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'immediately before needle exposure and advancement',
    )
  })

  it('OD-05/06/10 render exact approved scope and preserve recorded-caliper practice', () => {
    expect(lesson('scope-orientation').paragraphs).toContain(
      'The ultrasound sector lies in a plane that contains the scope’s long axis. In this model, image right is toward the patient’s head; check the orientation convention of the processor you use.',
    )
    expect(lesson('scope-orientation').paragraphs).toContain(
      'In this model, 0° is the preset’s authored depth axis; it is not a universal anatomical direction.',
    )
    for (const id of ['scope-orientation', 'ct-map', 'measurement-phantoms']) {
      expect(lesson(id).paragraphs.join(' ')).toContain(
        'Measurements in this simulator are shown in millimeters for teaching and relative comparison.',
      )
    }
    expect(lesson('capture').lab!.instruction).toContain(
      'This practices controls; border placement is not scored as a clinical measurement.',
    )
    expect(lesson('preparation').paragraphs).toContain(
      'Patients should fast before EBUS. Follow the applicable anesthesia and local procedural policy for the required fasting interval.',
    )
  })

  it('OD-11 lists the approved core reference without a source-verification upgrade', () => {
    const results = lesson('results-reporting')
    expect(results.paragraphs.join(' ')).toContain(
      'recommends against routine add-on confirmatory mediastinoscopy; it may still be considered when the risk of a false-negative result is high.',
    )
    expect(SOURCE_CHECK_DATE).toBe('2026-09-12')
    expect(SOURCES.find((source) => source.id === 'chest2024')!.title).toContain(
      '2024 online; Chest 2025',
    )
    render(<SourceList ids={results.sources} />)
    fireEvent.click(screen.getByText('Sources and model limits'))
    expect(screen.getByRole('link', { name: /Miller RJ, Chrissian AA/ })).toHaveAttribute(
      'href',
      'https://doi.org/10.1097/LBR.0000000000001034',
    )
    expect(
      screen.getByText(/owner-approved scope; full text not independently verified/),
    ).toBeVisible()
  })

  it('OD-12 exposes all approved expansions and keeps CHS/IFU limits beside definitions', () => {
    render(<GlossaryTerms entries={GLOSSARY} heading="Glossary" />)
    const expanded = GLOSSARY.filter((entry) => entry.sourceContext)
    expect(expanded.map((entry) => entry.id)).toEqual([
      'tnm',
      'iaslc',
      'nsclc',
      'pet',
      'fna',
      'ers-esge-ests',
      'chest',
      'ifu',
      'chs',
    ])
    for (const entry of expanded) {
      const details = document.querySelector(`[data-glossary-term="${entry.id}"]`) as HTMLElement
      fireEvent.click(within(details).getByText(entry.term))
      expect(within(details).getByText(entry.definition)).toBeVisible()
      expect(details).toHaveTextContent('Source and limits:')
    }
    expect(screen.getByText(/Fujiwara 2010 full text remains unverified/)).toBeVisible()
    expect(screen.getByText(/Manufacturer-specific interpretation requires/)).toBeVisible()
  })
})
