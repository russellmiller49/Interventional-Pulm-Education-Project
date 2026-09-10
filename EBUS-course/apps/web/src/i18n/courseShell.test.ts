import { describe, expect, it } from 'vitest';

import { courseInfo } from '@/content/course';
import { homeModuleCards } from '@/content/modules';
import { welcomeLecture } from '@/content/welcome';
import {
  getLocalizedCourseInfo,
  getLocalizedHomeModuleCards,
  getLocalizedWelcomeLecture,
} from '@/i18n/courseShell';

describe('course shell localization overlays', () => {
  it('localizes welcome display text while preserving source-owned machine fields', () => {
    const localizedWelcome = getLocalizedWelcomeLecture('es');

    expect(localizedWelcome.id).toBe(welcomeLecture.id);
    expect(localizedWelcome.status).toBe(welcomeLecture.status);
    expect(localizedWelcome.video).toBe(welcomeLecture.video);
    expect(localizedWelcome.resourceUrl).toBe(welcomeLecture.resourceUrl);
    expect(localizedWelcome.title).not.toBe(welcomeLecture.title);
  });

  it('localizes course shell content while preserving asset and external URLs', () => {
    const localizedCourseInfo = getLocalizedCourseInfo('zh-CN');

    expect(localizedCourseInfo.courseTitle).not.toBe(courseInfo.courseTitle);
    expect(localizedCourseInfo.visuals.hero.src).toBe(courseInfo.visuals.hero.src);
    expect(localizedCourseInfo.visuals.logo.src).toBe(courseInfo.visuals.logo.src);
    expect(localizedCourseInfo.facilityUrl).toBe(courseInfo.facilityUrl);
  });

  it('localizes module catalog cards without changing route paths or ids', () => {
    const localizedCards = getLocalizedHomeModuleCards('es');
    const localizedKnobology = localizedCards.find((card) => card.id === 'knobology');
    const sourceKnobology = homeModuleCards.find((card) => card.id === 'knobology');

    expect(localizedKnobology).toBeDefined();
    expect(sourceKnobology).toBeDefined();
    expect(localizedKnobology?.id).toBe(sourceKnobology?.id);
    expect(localizedKnobology?.path).toBe(sourceKnobology?.path);
    expect(localizedKnobology?.title).not.toBe(sourceKnobology?.title);
  });
});
