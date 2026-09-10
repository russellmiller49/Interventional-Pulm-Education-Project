import videosData from '@/content/aabip-procedural-videos.json';
import type { ProceduralVideoContentItem, ProceduralVideoLibraryContent } from '@/content/types';

export const AABIP_EBUS_PLAYLIST_ID = 'PLz2NeO-gj6IW70aQwTFdU1IwU_b17639q';

export interface ProceduralVideoItem extends ProceduralVideoContentItem {
  thumbnailUrl: string;
  watchUrl: string;
}

export interface ProceduralVideoLibrary extends Omit<ProceduralVideoLibraryContent, 'videos'> {
  videos: ProceduralVideoItem[];
}

export function getProceduralVideoWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}&list=${AABIP_EBUS_PLAYLIST_ID}`;
}

export function getProceduralVideoThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

const proceduralVideoLibraryData = videosData as ProceduralVideoLibraryContent;

export const aabipProceduralVideoLibrary: ProceduralVideoLibrary = {
  ...proceduralVideoLibraryData,
  videos: proceduralVideoLibraryData.videos.map((video) => ({
    ...video,
    thumbnailUrl: getProceduralVideoThumbnailUrl(video.youtubeId),
    watchUrl: getProceduralVideoWatchUrl(video.youtubeId),
  })),
};
