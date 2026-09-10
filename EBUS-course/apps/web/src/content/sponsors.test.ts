import { describe, expect, it } from 'vitest';

import { sponsors } from '@/content/sponsors';

describe('sponsors content', () => {
  it('maps each sponsor logo to an external website', () => {
    expect(sponsors).toHaveLength(10);
    expect(new Set(sponsors.map((sponsor) => sponsor.id)).size).toBe(sponsors.length);

    for (const sponsor of sponsors) {
      expect(sponsor.logoSrc).toMatch(/\.(png|jpg|jpeg|webp|svg)(\?|$)/i);
      expect(sponsor.websiteUrl).toMatch(/^https:\/\//);
    }
  });
});
