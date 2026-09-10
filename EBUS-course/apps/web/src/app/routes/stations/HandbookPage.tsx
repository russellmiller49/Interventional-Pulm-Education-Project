import { EducationModuleRenderer } from '@/components/education/EducationModuleRenderer';
import { useLocalizedStationEducationModules } from '@/i18n/localizedContent';

export function StationsHandbookPage() {
  const stationEducationModules = useLocalizedStationEducationModules();

  return (
    <div className="page-stack">
      {stationEducationModules.map((module) => (
        <EducationModuleRenderer key={module.id} compact module={module} />
      ))}
    </div>
  );
}
