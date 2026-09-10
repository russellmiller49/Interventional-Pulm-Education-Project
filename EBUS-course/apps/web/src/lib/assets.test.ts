import { describe, expect, it } from 'vitest';

import { mapNestedAssetPaths, resolveCourseAssetPath } from '@/lib/assets';

describe('resolveCourseAssetPath', () => {
  it('leaves /media paths unchanged when BASE_URL is root', () => {
    expect(import.meta.env.BASE_URL).toBe('/');
    expect(resolveCourseAssetPath('/media/stations/x.png')).toBe('/media/stations/x.png');
  });

  it('treats simulator case files as course assets', () => {
    expect(resolveCourseAssetPath('/simulator/case-001/case_manifest.web.json')).toBe(
      '/simulator/case-001/case_manifest.web.json',
    );
  });

  it('ignores absolute URLs', () => {
    expect(resolveCourseAssetPath('https://example.com/media/x.png')).toBe('https://example.com/media/x.png');
  });

  it('does not rewrite paths outside course asset prefixes', () => {
    expect(resolveCourseAssetPath('/auth/callback')).toBe('/auth/callback');
  });
});

describe('mapNestedAssetPaths', () => {
  it('rewrites nested /media strings while preserving shape', () => {
    const input = { a: { b: ['/media/a.jpg', '/other'] }, c: 'plain' };
    const out = mapNestedAssetPaths(input);
    expect(out.a.b[0]).toBe(resolveCourseAssetPath('/media/a.jpg'));
    expect(out.a.b[1]).toBe('/other');
    expect(out.c).toBe('plain');
  });
});
