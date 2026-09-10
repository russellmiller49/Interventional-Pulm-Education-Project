import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLocaleFromSearch, normalizeLocale, withPreservedCourseQuery } from '@/i18n/locale';

describe('locale helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes supported locale query values and zh-Hans import aliases', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('es')).toBe('es');
    expect(normalizeLocale('zh-CN')).toBe('zh-CN');
    expect(normalizeLocale('zh-cn')).toBe('zh-CN');
    expect(normalizeLocale('zh-Hans')).toBe('zh-CN');
    expect(normalizeLocale('fr')).toBeNull();
  });

  it('reads locale from a query string and falls back for unsupported values', () => {
    expect(getLocaleFromSearch('?locale=es')).toBe('es');
    expect(getLocaleFromSearch('?locale=zh-Hans')).toBe('zh-CN');
    expect(getLocaleFromSearch('?locale=fr')).toBeNull();
  });

  it('preserves locale and embedded-course access query keys across internal links', () => {
    expect(
      withPreservedCourseQuery(
        '/knobology',
        'zh-CN',
        '?locale=zh-Hans&publicTraining=1&publicScope=ebus&adminPreview=1',
      ),
    ).toBe('/knobology?locale=zh-CN&publicTraining=1&publicScope=ebus&adminPreview=1');

    expect(withPreservedCourseQuery('/auth?mode=support', 'es', '?locale=es&publicTraining=1')).toBe(
      '/auth?mode=support&locale=es&publicTraining=1',
    );
  });

  it('merges browser and hash-router query keys when preserving embedded course links', () => {
    vi.stubGlobal('window', {
      location: {
        hash: '#/stations?publicTraining=1&publicScope=ebus',
        search: '?locale=es',
      },
    });

    expect(withPreservedCourseQuery('/stations/explore', 'es')).toBe(
      '/stations/explore?locale=es&publicTraining=1&publicScope=ebus',
    );
  });

  it('does not rewrite external or fragment-only targets', () => {
    expect(withPreservedCourseQuery('https://example.com', 'es', '?locale=es')).toBe('https://example.com');
    expect(withPreservedCourseQuery('#details', 'es', '?locale=es')).toBe('#details');
  });
});
