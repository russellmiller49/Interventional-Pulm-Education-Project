import { EducationModuleRenderer } from '@/components/education/EducationModuleRenderer';
import { stationEducationModules } from '@/content/education';

export function StationsHandbookPage() {
  return (
    <div className="page-stack">
      {stationEducationModules.map((module) => (
        <EducationModuleRenderer key={module.id} compact module={module} />
      ))}
    </div>
  );
}
