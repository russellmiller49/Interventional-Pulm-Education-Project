import { render, screen } from '@testing-library/react'

import { TechniqueVideoPlayer } from '@/features/rigid-bronchoscopy-techniques/components/TechniqueVideoPlayer'

describe('TechniqueVideoPlayer', () => {
  it('renders a native <video> with poster, metadata preload, captions, and no autoplay', () => {
    const { container } = render(
      <TechniqueVideoPlayer
        title="Neutral tracheal position"
        src="clips/approved/RB-NAV-001.mp4"
        poster="posters/RB-NAV-001.jpg"
        webmSrc="clips/approved/RB-NAV-001.webm"
        captionsSrc="captions/en/RB-NAV-001.vtt"
      />,
    )

    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('preload', 'metadata')
    expect(video).not.toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('aria-label', 'Neutral tracheal position')
    expect(video?.getAttribute('poster')).toContain('posters/RB-NAV-001.jpg')

    const sources = container.querySelectorAll('source')
    expect(sources).toHaveLength(2)
    expect(sources[0]).toHaveAttribute('type', 'video/mp4')
    expect(sources[1]).toHaveAttribute('type', 'video/webm')

    const track = container.querySelector('track')
    expect(track).toHaveAttribute('kind', 'captions')
    expect(track).toHaveAttribute('srclang', 'en')
  })

  it('renders an iframe when container is iframe (existing iframe videos still work)', () => {
    const { container } = render(
      <TechniqueVideoPlayer title="Embedded" src="https://example.com/embed" container="iframe" />,
    )

    const iframe = container.querySelector('iframe')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('src', 'https://example.com/embed')
    expect(iframe).toHaveAttribute('loading', 'lazy')
    expect(container.querySelector('video')).toBeNull()
  })

  it('shows the synthetic-content label when required', () => {
    render(
      <TechniqueVideoPlayer
        title="Synthetic"
        src="clips/approved/RB-CORE-002.mp4"
        syntheticLabel
      />,
    )
    expect(screen.getByText('Synthetic procedural visualization')).toBeInTheDocument()
  })

  it('shows a fallback message when there is no media source', () => {
    const { container } = render(<TechniqueVideoPlayer title="none" src="" />)
    expect(screen.getByText('Video resource coming soon')).toBeInTheDocument()
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
  })
})
