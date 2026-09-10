import { describe, expect, it } from 'vitest';

import { getKnobologyLearnMoreSections } from '@/features/knobology/learnMore';
import type { LessonSection } from '@/content/types';

const sections: LessonSection[] = [
  { id: 'image-formation', title: 'Image formation', kind: 'core-concept', body: 'A' },
  { id: 'control-sequence', title: 'Control sequence', kind: 'technique', body: 'B' },
  { id: 'doppler-sampling', title: 'Doppler', kind: 'clinical-pearl', body: 'C' },
];

describe('getKnobologyLearnMoreSections', () => {
  it('returns sections in the configured instructional order', () => {
    const results = getKnobologyLearnMoreSections('depth', sections);

    expect(results.map((section) => section.id)).toEqual(['image-formation', 'control-sequence']);
  });

  it('skips configured sections that are not present', () => {
    const results = getKnobologyLearnMoreSections('color-doppler', sections);

    expect(results.map((section) => section.id)).toEqual(['doppler-sampling']);
  });
});
