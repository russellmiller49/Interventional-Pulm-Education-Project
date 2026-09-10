import lecturesData from '@/content/lectures.json';
import type { LectureManifestItem } from '@/content/types';
import { mapNestedAssetPaths } from '@/lib/assets';

export const lectureManifest = mapNestedAssetPaths(lecturesData as LectureManifestItem[]);

export function getLectureById(lectureId: string): LectureManifestItem | undefined {
  return lectureManifest.find((lecture) => lecture.id === lectureId);
}
