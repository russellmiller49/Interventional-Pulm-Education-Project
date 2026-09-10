import { describe, expect, it } from 'vitest';

import { getDepthFieldClipPath } from '@/features/knobology/depthField';

describe('getDepthFieldClipPath', () => {
  it('returns a polygon clip path for each supported depth frame', () => {
    expect(getDepthFieldClipPath(0)).toContain('polygon(');
    expect(getDepthFieldClipPath(4)).toContain('polygon(');
  });

  it('returns null when a depth frame has no hidden field metadata', () => {
    expect(getDepthFieldClipPath(-1)).toBeNull();
    expect(getDepthFieldClipPath(8)).toBeNull();
  });
});
