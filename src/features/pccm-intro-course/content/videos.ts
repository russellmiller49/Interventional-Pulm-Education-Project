import videoManifest from './videoManifest.json'
import type {
  PccmCourseSection,
  PccmInstitution,
  PccmVideoAudience,
} from '@/features/pccm-intro-course/types'

export interface PccmCourseVideo {
  id: string
  title: string
  courseSection: PccmCourseSection
  audience: PccmVideoAudience
  sourcePath: string
  storagePath: string
}

export const PCCM_INTRO_COURSE_MEDIA_BUCKET =
  process.env.PCCM_INTRO_COURSE_MEDIA_BUCKET || 'pccm-intro-course-media'

export const PCCM_INTRO_COURSE_MEDIA_SOURCE_DIR = 'intro to bronch and pleural disease course '

export const pccmCourseVideos = videoManifest as PccmCourseVideo[]

export function getPccmVideo(videoId: string | null | undefined) {
  const normalizedVideoId = videoId?.trim()
  if (!normalizedVideoId) {
    return null
  }

  return pccmCourseVideos.find((video) => video.id === normalizedVideoId) ?? null
}

export function userCanAccessPccmVideo(video: PccmCourseVideo, institution: PccmInstitution) {
  return video.audience === 'shared' || video.audience === institution
}

export function pccmAdminCanAccessVideo(
  video: PccmCourseVideo,
  institutions: readonly PccmInstitution[],
  canAccessAll = false,
) {
  if (canAccessAll) {
    return true
  }

  if (video.audience === 'shared') {
    return institutions.length > 0
  }

  return institutions.includes(video.audience)
}

export function getPccmVideosForInstitution(institution: PccmInstitution) {
  return pccmCourseVideos.filter((video) => userCanAccessPccmVideo(video, institution))
}

export function getPccmVideosBySection(institution: PccmInstitution, section: PccmCourseSection) {
  return getPccmVideosForInstitution(institution).filter((video) => video.courseSection === section)
}
