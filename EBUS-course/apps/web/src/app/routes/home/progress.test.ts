import { describe, expect, it } from 'vitest';

import { createInitialLearnerProgress } from '@/lib/progress';
import { buildHomeProgressModel } from '@/app/routes/home/progress';

describe('buildHomeProgressModel', () => {
  it('starts the recommended path with the lecture path', () => {
    const state = createInitialLearnerProgress();

    const { learningSteps, resumeModule } = buildHomeProgressModel(state);

    expect(learningSteps[0]?.id).toBe('lectures');
    expect(learningSteps.map((step) => step.id)).toContain('simulator');
    expect(learningSteps.map((step) => step.id)).toContain('tnm-staging');
    expect(learningSteps.map((step) => step.id)).not.toContain('quiz');
    expect(resumeModule?.id).toBe('lectures');
  });

  it('combines station map and explorer progress into one stations step', () => {
    const state = createInitialLearnerProgress();
    state.moduleProgress['station-map'].percentComplete = 40;
    state.moduleProgress['station-explorer'].percentComplete = 60;

    const stationsStep = buildHomeProgressModel(state).learningSteps.find((step) => step.id === 'stations');

    expect(stationsStep?.percent).toBe(50);
  });

  it('prefers the latest incomplete visited module for the resume target', () => {
    const state = createInitialLearnerProgress();
    state.moduleProgress.knobology.percentComplete = 70;
    state.moduleProgress.knobology.visitedAt = '2026-03-20T10:00:00.000Z';
    state.moduleProgress.quiz.percentComplete = 100;
    state.moduleProgress.quiz.visitedAt = '2026-03-26T10:00:00.000Z';
    state.moduleProgress.quiz.completedAt = '2026-03-26T10:00:00.000Z';

    const { resumeModule } = buildHomeProgressModel(state);

    expect(resumeModule?.id).toBe('knobology');
  });
});
