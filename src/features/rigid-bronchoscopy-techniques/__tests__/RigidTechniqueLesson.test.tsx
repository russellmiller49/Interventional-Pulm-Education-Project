import { render, screen } from '@testing-library/react'

import { RigidTechniqueLesson } from '@/features/rigid-bronchoscopy-techniques/components/RigidTechniqueLesson'
import { getTechniqueLesson } from '@/features/rigid-bronchoscopy-techniques/content/techniqueLessons'
import { getTechniqueClipsForLesson } from '@/features/rigid-bronchoscopy-techniques/content/techniqueVideos'

const lesson = getTechniqueLesson('mainstem-direction')
const clips = getTechniqueClipsForLesson('mainstem-direction')

if (!lesson) {
  throw new Error('mainstem-direction lesson is missing from the manifest')
}

describe('RigidTechniqueLesson gating', () => {
  it('production (showDrafts=false) never falls back to draft media', () => {
    const { container } = render(<RigidTechniqueLesson lesson={lesson} clips={clips} />)

    expect(screen.getByText(/No approved technique videos are published yet/i)).toBeInTheDocument()
    expect(screen.queryAllByTestId('technique-review-badge')).toHaveLength(0)
    expect(container.querySelector('video')).toBeNull()
  })

  it('dev/admin (showDrafts=true) shows every draft clip behind a review badge', () => {
    const { container } = render(<RigidTechniqueLesson lesson={lesson} clips={clips} showDrafts />)

    const withMedia = clips.filter((clip) => clip.videoPath.length > 0)
    const withoutMedia = clips.filter((clip) => clip.videoPath.length === 0)

    expect(screen.queryByText(/No approved technique videos/i)).toBeNull()
    expect(screen.getAllByTestId('technique-review-badge')).toHaveLength(clips.length)
    expect(screen.getAllByText(/Draft — not for clinical use/i)).toHaveLength(clips.length)
    // Generated drafts render a <video>; still-planned clips render the placeholder.
    expect(container.querySelectorAll('video')).toHaveLength(withMedia.length)
    expect(screen.getAllByText(/planned\. Media appears here/i)).toHaveLength(withoutMedia.length)
  })

  it('renders the lesson safety statement and key movement rule', () => {
    render(<RigidTechniqueLesson lesson={lesson} clips={clips} showDrafts />)
    expect(screen.getByText(lesson.safetyStatement)).toBeInTheDocument()
    expect(screen.getByText(lesson.keyMovementRule)).toBeInTheDocument()
  })
})
