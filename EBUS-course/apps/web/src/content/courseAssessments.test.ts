import { describe, expect, it } from 'vitest';

import { assessmentImageUrls } from '@/content/assessmentImages';
import { finalPostTestAssessment, getCourseAssessmentById } from '@/content/courseAssessments';
import { getPretestImage, pretestContent } from '@/content/pretest';

function getOptionLabels(options: Array<{ label: string }>) {
  return options.map((option) => option.label);
}

describe('course assessment content', () => {
  it('uses the final 25-question set while keeping pretest order and option letters distinct', () => {
    expect(finalPostTestAssessment).not.toBeNull();

    const postTestQuestions = finalPostTestAssessment?.questions ?? [];
    const postTestByPrompt = new Map(postTestQuestions.map((question) => [question.prompt, question]));

    expect(pretestContent.questions).toHaveLength(25);
    expect(postTestQuestions).toHaveLength(25);
    expect(pretestContent.questions.map((question) => question.prompt)).not.toEqual(
      postTestQuestions.map((question) => question.prompt),
    );
    expect(new Set(pretestContent.questions.map((question) => question.prompt))).toEqual(
      new Set(postTestQuestions.map((question) => question.prompt)),
    );
    expect(pretestContent.questions.filter((question) => question.imageAssetKey).map((question) => question.imageAssetKey)).toEqual([
      'ebus-2026-final-station-4r',
      'ebus-2026-final-reverberation',
      'ebus-2026-final-mediastinal-pet',
    ]);
    expect(
      pretestContent.questions
        .filter((question) => question.imageAssetKey)
        .map((question) => getPretestImage(question.imageAssetKey!)?.src),
    ).toEqual([
      assessmentImageUrls.station4r,
      assessmentImageUrls.reverberation,
      assessmentImageUrls.mediastinalPet,
    ]);
    expect(postTestQuestions.filter((question) => question.imageAsset).map((question) => question.imageAsset?.src)).toEqual([
      assessmentImageUrls.station4r,
      assessmentImageUrls.mediastinalPet,
      assessmentImageUrls.reverberation,
    ]);
    expect(postTestQuestions.filter((question) => question.imageAsset).map((question) => question.imageAsset?.src)).not.toContain(
      '/media/assessments/ebus-2026-final/question-figure-1.png',
    );

    for (const postTestQuestion of postTestQuestions) {
      expect(postTestQuestion.options).toHaveLength(4);
      expect(postTestQuestion.explanation.length).toBeGreaterThan(0);
      expect(postTestQuestion.options.some((option) => postTestQuestion.correctOptionIds.includes(option.id))).toBe(
        true,
      );
    }

    for (const pretestQuestion of pretestContent.questions) {
      const matchingPostTestQuestion = postTestByPrompt.get(pretestQuestion.prompt);

      expect(matchingPostTestQuestion).toBeDefined();
      expect('explanation' in pretestQuestion).toBe(false);
      expect(pretestQuestion.options).toHaveLength(4);
      expect(pretestQuestion.options.some((option) => option.id === pretestQuestion.correctOptionId)).toBe(true);
      expect(pretestQuestion.correctOptionId).not.toBe(matchingPostTestQuestion?.correctOptionIds[0]);
      expect(new Set(getOptionLabels(pretestQuestion.options))).toEqual(
        new Set(getOptionLabels(matchingPostTestQuestion?.options ?? [])),
      );
      expect(getOptionLabels(pretestQuestion.options)).not.toEqual(
        getOptionLabels(matchingPostTestQuestion?.options ?? []),
      );
    }
  });

  it('resolves the post-lecture 2 question 3 Doppler figure', () => {
    const assessment = getCourseAssessmentById('post-lecture-02');
    const question = assessment?.questions.find((entry) => entry.id === 'post-lecture-02-q03');

    expect(question?.imageAsset).toMatchObject({
      src: assessmentImageUrls.postLecture02ColorDoppler,
      alt: 'EBUS ultrasound image with color Doppler flow over a hilar target.',
    });
  });

  it('omits the removed question 4 from the post-lecture 2 scope and tools quiz', () => {
    const assessment = getCourseAssessmentById('post-lecture-03');

    expect(assessment?.title).toBe('Post-lecture 2 quiz: Basic scope, tools, and technique');
    expect(assessment?.questions.map((question) => question.id)).not.toContain('post-lecture-03-q04');
    expect(assessment?.questions).toHaveLength(4);
  });

  it('resolves the displayed post-lecture 2 question 4 needle puncture image', () => {
    const assessment = getCourseAssessmentById('post-lecture-03');
    const question = assessment?.questions.find((entry) => entry.id === 'post-lecture-03-q05');

    expect(question?.imageAsset).toMatchObject({
      src: assessmentImageUrls.postLecture03NeedlePuncture,
      alt: 'EBUS monitor image showing reverberation artifact immediately after needle puncture.',
    });
  });
});
