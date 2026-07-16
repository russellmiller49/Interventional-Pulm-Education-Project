import { createPccmS3VideoUrl } from '@/features/pccm-intro-course/s3-media'

const originalEnv = process.env

describe('PCCM intro course S3 media URLs', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PCCM_INTRO_COURSE_S3_BASE_URL: 'https://pccmintro.s3.us-east-1.amazonaws.com',
      PCCM_INTRO_COURSE_S3_BUCKET: 'pccmintro',
      PCCM_INTRO_COURSE_S3_REGION: 'us-east-1',
    }
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    delete process.env.AWS_SESSION_TOKEN
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('builds public S3 URLs from manifest source paths', () => {
    const videoUrl = createPccmS3VideoUrl(
      {
        sourcePath: 'UCSD_bronch_videos/Bronch and Bronchoscope Anatomy [bdt final].mp4',
      },
      1800,
    )

    expect(videoUrl).toEqual({
      signed: false,
      url: 'https://pccmintro.s3.us-east-1.amazonaws.com/UCSD_bronch_videos/Bronch%20and%20Bronchoscope%20Anatomy%20%5Bbdt%20final%5D.mp4',
    })
  })

  it('presigns S3 URLs when AWS credentials are configured', () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE'
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'

    const videoUrl = createPccmS3VideoUrl(
      {
        sourcePath: 'Loma_Linda_bronch videos/1-BIP-Intro and history of bronchoscopy.mp4',
      },
      1800,
      new Date('2026-07-06T00:00:00.000Z'),
    )

    expect(videoUrl.signed).toBe(true)
    expect(videoUrl.url).toContain(
      'https://pccmintro.s3.us-east-1.amazonaws.com/Loma_Linda_bronch%20videos/1-BIP-Intro%20and%20history%20of%20bronchoscopy.mp4?',
    )
    expect(videoUrl.url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256')
    expect(videoUrl.url).toContain(
      'X-Amz-Credential=AKIDEXAMPLE%2F20260706%2Fus-east-1%2Fs3%2Faws4_request',
    )
    expect(videoUrl.url).toContain('X-Amz-Expires=1800')
    expect(videoUrl.url).toMatch(/X-Amz-Signature=[a-f0-9]{64}$/)
    expect(videoUrl.url).not.toContain('test-secret')
  })
})
