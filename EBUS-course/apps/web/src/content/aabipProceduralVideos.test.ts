import { describe, expect, it } from 'vitest';

import {
  AABIP_EBUS_PLAYLIST_ID,
  aabipProceduralVideoLibrary,
  getProceduralVideoThumbnailUrl,
  getProceduralVideoWatchUrl,
} from '@/content/aabipProceduralVideos';

describe('aabip procedural videos', () => {
  it('maps the playlist into stable watch and thumbnail urls', () => {
    const firstVideo = aabipProceduralVideoLibrary.videos[0];

    expect(aabipProceduralVideoLibrary.videos).toHaveLength(21);
    expect(firstVideo.title).toBe('EBUS Lymph Node Station 11R(s)');
    expect(getProceduralVideoWatchUrl(firstVideo.youtubeId)).toBe(
      `https://www.youtube.com/watch?v=${firstVideo.youtubeId}&list=${AABIP_EBUS_PLAYLIST_ID}`,
    );
    expect(getProceduralVideoThumbnailUrl(firstVideo.youtubeId)).toBe(
      `https://i.ytimg.com/vi/${firstVideo.youtubeId}/hqdefault.jpg`,
    );
    expect(firstVideo.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${firstVideo.youtubeId}/hqdefault.jpg`);
  });
});
