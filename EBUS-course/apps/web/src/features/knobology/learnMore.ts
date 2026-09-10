import type { KnobologyControlId, LessonSection } from '@/content/types';

const learnMoreSectionIds: Record<KnobologyControlId, string[]> = {
  depth: ['image-formation', 'control-sequence'],
  gain: ['image-formation', 'echogenicity-language'],
  contrast: ['echogenicity-language', 'artifacts'],
  'color-doppler': ['doppler-sampling', 'non-diagnostic-frames'],
  calipers: ['control-sequence', 'non-diagnostic-frames'],
  freeze: ['control-sequence', 'non-diagnostic-frames'],
  save: ['control-sequence', 'sampling-vignette'],
};

export function getKnobologyLearnMoreSections(controlId: KnobologyControlId, sections: LessonSection[]): LessonSection[] {
  const sectionById = new Map(sections.map((section) => [section.id, section]));

  return learnMoreSectionIds[controlId].flatMap((sectionId) => {
    const section = sectionById.get(sectionId);
    return section ? [section] : [];
  });
}
