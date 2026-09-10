import { EducationModuleRenderer } from '@/components/education/EducationModuleRenderer';
import { useLocalizedSonographicInterpretationContent } from '@/i18n/localizedContent';

export function SonographicInterpretationPage() {
  const sonographicInterpretation = useLocalizedSonographicInterpretationContent();

  return <EducationModuleRenderer module={sonographicInterpretation} />;
}
