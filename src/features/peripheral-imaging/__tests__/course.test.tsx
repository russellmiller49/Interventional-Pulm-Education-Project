import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { PeripheralImagingCourse } from '../components/PeripheralImagingCourse'
import { ImagingLab } from '../components/ImagingLab'
import { emptyProgress, STORAGE_KEY } from '../lib/progress'

jest.mock(
  'next/dynamic',
  () => () =>
    function ModelPlaceholder() {
      return <div>Authored 3D model placeholder</div>
    },
)
beforeEach(() => {
  localStorage.clear()
  Element.prototype.scrollIntoView = jest.fn()
})
it('keeps feedback behind the commit boundary and resumes the committed feedback', async () => {
  const first = render(<PeripheralImagingCourse />)
  fireEvent.click(await screen.findByRole('button', { name: /^Start —/ }))
  fireEvent.click(screen.getByRole('button', { name: /Check$/ }))
  const commit = screen.getByRole('button', { name: /Commit response/ })
  expect(commit).toBeDisabled()
  expect(screen.queryByText(/Visible hardware and a virtual destination/)).not.toBeInTheDocument()
  expect(screen.queryByText('A map, a photograph, and a specimen')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: /The needle has established lesion contact/ }))
  fireEvent.click(commit)
  expect(screen.getAllByText(/Visible hardware and a virtual destination/)[0]).toBeVisible()
  expect(screen.getAllByRole('radio').every((radio) => radio.hasAttribute('disabled'))).toBe(true)
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).feedbackQuestion['imaging-questions'],
    ).toBe('choose-1'),
  )
  first.unmount()
  render(<PeripheralImagingCourse />)
  fireEvent.click(await screen.findByRole('button', { name: /^Continue —/ }))
  expect(screen.getByText('A point to revisit')).toBeVisible()
  expect(
    screen.getByRole('radio', { name: /The needle has established lesion contact/ }),
  ).toBeChecked()
})
it('does not unlock acquisition through centering or checkbox text alone', () => {
  const change = jest.fn()
  const { rerender } = render(
    <ImagingLab lab="acquisition" lessonId="mobile-suite" values={{}} onChange={change} />,
  )
  expect(screen.getByRole('button', { name: 'Capture teaching state' })).toBeDisabled()
  rerender(
    <ImagingLab
      lab="acquisition"
      lessonId="mobile-suite"
      values={{
        offsetX: 0,
        offsetDepth: 18,
        target: true,
        clearance: true,
        state: true,
        protection: true,
      }}
      onChange={change}
    />,
  )
  expect(screen.getByRole('button', { name: 'Capture teaching state' })).toBeDisabled()
  rerender(
    <ImagingLab
      lab="acquisition"
      lessonId="mobile-suite"
      values={{
        offsetX: 0,
        offsetDepth: 0,
        target: true,
        clearance: true,
        state: true,
        protection: true,
      }}
      onChange={change}
    />,
  )
  expect(screen.getByRole('button', { name: 'Capture teaching state' })).toBeEnabled()
  fireEvent.change(screen.getByRole('slider', { name: 'Target depth offset' }), {
    target: { value: '12' },
  })
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({
      offsetDepth: 12,
      target: false,
      clearance: false,
      state: false,
      protection: false,
      captured: false,
    }),
  )
})
it('uses accessible course, check and lab controls with a text alternative for 3D', async () => {
  const saved = emptyProgress()
  saved.lessonId = 'projection'
  saved.phase = 'lab'
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  const { container } = render(<PeripheralImagingCourse />)
  fireEvent.click(await screen.findByRole('button', { name: /^Continue —/ }))
  expect(screen.getByRole('slider', { name: 'Tool depth offset' })).toBeVisible()
  expect(await axe(container)).toHaveNoViolations()
})
