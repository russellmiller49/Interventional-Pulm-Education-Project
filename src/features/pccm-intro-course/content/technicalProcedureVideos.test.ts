import { pccmPleuralTechnicalProcedureVideos } from './technicalProcedureVideos'
import { pccmCourseVideos } from './videos'

describe('PCCM pleural technical procedure videos', () => {
  it('publishes the four requested resources with three privacy-enhanced embeds', () => {
    expect(pccmPleuralTechnicalProcedureVideos).toHaveLength(4)
    expect(pccmPleuralTechnicalProcedureVideos.filter((video) => video.embedUrl)).toHaveLength(3)

    for (const video of pccmPleuralTechnicalProcedureVideos) {
      if (video.embedUrl) {
        expect(video.embedUrl).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//)
      }
    }
  })

  it('keeps the supplementary resources out of tracked course-video completion', () => {
    const trackedVideoIds = new Set(pccmCourseVideos.map((video) => video.id))

    for (const video of pccmPleuralTechnicalProcedureVideos) {
      expect(trackedVideoIds.has(video.id)).toBe(false)
    }
  })

  it('uses the canonical publisher URL for the NEJM resource', () => {
    const nejmVideo = pccmPleuralTechnicalProcedureVideos.find((video) => video.provider === 'nejm')

    expect(nejmVideo).toMatchObject({
      sourceUrl: 'https://www.nejm.org/doi/full/10.1056/NEJMvcm071974',
      title: 'Surgical Chest Tube Insertion Technique',
    })
    expect(nejmVideo?.embedUrl).toBeUndefined()
  })
})
