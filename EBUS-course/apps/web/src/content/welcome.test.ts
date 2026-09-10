import { describe, expect, it } from 'vitest';

import { welcomeLecture } from '@/content/welcome';

describe('welcomeLecture', () => {
  it('uses the 2026 welcome video from the course S3 bucket', () => {
    expect(welcomeLecture.id).toBe('lecture-01');
    expect(welcomeLecture.duration).toBe('Video');
    expect(welcomeLecture.video).toBe('https://ebus2026.s3.us-east-1.amazonaws.com/LECTURE+WELCOME_INTRO.mp4');
    expect(welcomeLecture.resourceUrl).toBeUndefined();
  });
});
