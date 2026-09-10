import figure1Url from '@/assets/assessments/ebus-2026-final/question-figure-1.png?url';
import figure2Url from '@/assets/assessments/ebus-2026-final/question-figure-2.png?url';
import figure3Url from '@/assets/assessments/ebus-2026-final/question-figure-3.png?url';
import postLecture02Question3Url from '@/assets/assessments/post-lecture-02/question-figure-3.png?url';
import postLecture03Question4Url from '@/assets/assessments/post-lecture-03/question-figure-4.png?url';
import { resolveCourseAssetPath } from '@/lib/assets';

export const assessmentImageUrls = {
  postLecture02ColorDoppler: postLecture02Question3Url,
  postLecture03NeedlePuncture: postLecture03Question4Url,
  station4r: figure1Url,
  mediastinalPet: figure2Url,
  reverberation: figure3Url,
} as const;

const assessmentImageSrcByPublicPath: Record<string, string> = {
  '/media/assessments/post-lecture-02/question-figure-3.png': assessmentImageUrls.postLecture02ColorDoppler,
  '/media/assessments/post-lecture-03/question-figure-4.png': assessmentImageUrls.postLecture03NeedlePuncture,
  '/media/assessments/ebus-2026-final/question-figure-1.png': assessmentImageUrls.station4r,
  '/media/assessments/ebus-2026-final/question-figure-2.png': assessmentImageUrls.mediastinalPet,
  '/media/assessments/ebus-2026-final/question-figure-3.png': assessmentImageUrls.reverberation,
};

export function resolveAssessmentImageSrc(src: string) {
  return assessmentImageSrcByPublicPath[src] ?? resolveCourseAssetPath(src);
}
