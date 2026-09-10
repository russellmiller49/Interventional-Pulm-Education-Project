import welcomeData from '../../../../content/course/welcome.json';

import type { LectureManifestItem } from '@/content/types';
import { mapNestedAssetPaths } from '@/lib/assets';

export const welcomeLecture = mapNestedAssetPaths(welcomeData as LectureManifestItem);
