import { render, screen } from '@testing-library/react'

import { RigidTechniqueLibrary } from '@/features/rigid-bronchoscopy-techniques/components/RigidTechniqueLibrary'
import { getOrderedTechniqueLessons } from '@/features/rigid-bronchoscopy-techniques/content/techniqueLessons'
import { techniqueClips } from '@/features/rigid-bronchoscopy-techniques/content/techniqueVideos'

const lessons = getOrderedTechniqueLessons()
const basePath = '/rigid-bronchoscopy/techniques'

describe('RigidTechniqueLibrary', () => {
  it('renders a linked card for every lesson', () => {
    const { container } = render(
      <RigidTechniqueLibrary lessons={lessons} clips={techniqueClips} basePath={basePath} />,
    )

    for (const lesson of lessons) {
      const link = container.querySelector(`a[href="${basePath}/${lesson.id}"]`)
      expect(link).not.toBeNull()
      expect(link).toHaveTextContent(lesson.title)
    }
  })

  it('summarizes every lesson as in-production while nothing is approved', () => {
    render(<RigidTechniqueLibrary lessons={lessons} clips={techniqueClips} basePath={basePath} />)
    expect(screen.getAllByText(/in production/i)).toHaveLength(lessons.length)
  })

  it('adds the draft-preview notice only in dev/admin mode', () => {
    const { rerender } = render(
      <RigidTechniqueLibrary lessons={lessons} clips={techniqueClips} basePath={basePath} />,
    )
    expect(screen.queryByText(/Development preview/i)).toBeNull()

    rerender(
      <RigidTechniqueLibrary
        lessons={lessons}
        clips={techniqueClips}
        basePath={basePath}
        showDrafts
      />,
    )
    expect(screen.getByText(/Development preview/i)).toBeInTheDocument()
  })
})
