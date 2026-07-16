import { render, screen } from '@testing-library/react'

import { pccmPleuralTechnicalProcedureVideos } from '../content/technicalProcedureVideos'
import { PccmTechnicalProcedureVideoCard } from './PccmTechnicalProcedureVideoCard'

describe('PccmTechnicalProcedureVideoCard', () => {
  const youtubeVideo = pccmPleuralTechnicalProcedureVideos[0]
  const nejmVideo = pccmPleuralTechnicalProcedureVideos[2]

  it('renders an unlocked YouTube video inline with source attribution', () => {
    render(<PccmTechnicalProcedureVideoCard locked={false} video={youtubeVideo} />)

    expect(screen.getByTitle(`${youtubeVideo.title} video`)).toHaveAttribute(
      'src',
      youtubeVideo.embedUrl,
    )
    expect(screen.getByRole('link', { name: /view source: thoracentesis/i })).toHaveAttribute(
      'href',
      youtubeVideo.sourceUrl,
    )
  })

  it('uses a publisher link when inline framing is not available', () => {
    render(<PccmTechnicalProcedureVideoCard locked={false} video={nejmVideo} />)

    expect(screen.queryByTitle(`${nejmVideo.title} video`)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /watch on nejm/i })).toHaveAttribute(
      'href',
      nejmVideo.sourceUrl,
    )
  })

  it('does not expose a player or source link while videos are locked', () => {
    render(<PccmTechnicalProcedureVideoCard locked video={youtubeVideo} />)

    expect(screen.getByText(/complete both pretests to unlock this video/i)).toBeInTheDocument()
    expect(screen.queryByTitle(`${youtubeVideo.title} video`)).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
