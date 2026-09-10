import sonographicInterpretationData from '../../../../../../content/modules/sonographic-interpretation.json';

import { EducationModuleRenderer } from '@/components/education/EducationModuleRenderer';
import type { EducationalModuleContent } from '@/content/types';

const sonographicInterpretation = sonographicInterpretationData as EducationalModuleContent;

export function SonographicInterpretationPage() {
  return <EducationModuleRenderer module={sonographicInterpretation} />;
}
