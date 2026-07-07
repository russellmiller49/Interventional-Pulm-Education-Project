import {
  getPccmVideosForInstitution,
  pccmCourseVideos,
} from '@/features/pccm-intro-course/content/videos'

describe('PCCM intro course video manifest', () => {
  it('does not publish the retired Basic Bronchoscopy Test Review video', () => {
    expect(pccmCourseVideos).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'loma-linda-bronch-10-test-review',
          title: 'Basic Bronchoscopy Test Review',
        }),
      ]),
    )
    expect(getPccmVideosForInstitution('loma_linda')).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Basic Bronchoscopy Test Review',
        }),
      ]),
    )
  })
})
