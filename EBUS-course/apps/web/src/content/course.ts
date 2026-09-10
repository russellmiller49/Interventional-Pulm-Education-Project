import courseInfoData from '../../../../content/course/course-info.json';

import type { CourseInfoContent } from '@/content/types';
import { mapNestedAssetPaths } from '@/lib/assets';

export const courseInfo = mapNestedAssetPaths(courseInfoData as CourseInfoContent);
