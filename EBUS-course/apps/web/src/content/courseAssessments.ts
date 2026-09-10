import courseAssessmentData from '../../../../content/course/course-assessments.json';

import { resolveAssessmentImageSrc } from '@/content/assessmentImages';
import type { CourseAssessmentContent } from '@/content/types';
import { mapNestedAssetPaths } from '@/lib/assets';

function resolveAssessmentImages(assessment: CourseAssessmentContent): CourseAssessmentContent {
  return {
    ...assessment,
    questions: assessment.questions.map((question) => ({
      ...question,
      imageAsset: question.imageAsset
        ? {
            ...question.imageAsset,
            src: resolveAssessmentImageSrc(question.imageAsset.src),
          }
        : undefined,
    })),
  };
}

export const courseAssessments = mapNestedAssetPaths(
  (courseAssessmentData.assessments as CourseAssessmentContent[]).map(resolveAssessmentImages),
);

export const postLectureCourseAssessments = courseAssessments.filter(
  (assessment) => assessment.kind === 'post-lecture-quiz',
);

export const finalPostTestAssessment = courseAssessments.find((assessment) => assessment.kind === 'post-test') ?? null;

export function getCourseAssessmentById(assessmentId: string): CourseAssessmentContent | undefined {
  return courseAssessments.find((assessment) => assessment.id === assessmentId);
}
