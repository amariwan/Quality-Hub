import PageContainer from '@/components/layout/page-container';
import { TeamProjectMappingsManager } from '@/features/quality-hub/components/team-project-mappings-manager';

export default function TeamProjectMappingsPage() {
  return (
    <PageContainer
      pageTitle='Team Project Mapping'
      pageDescription='Exakte Team-Zuordnung fuer Risk Radar und Qualitaetsindikatoren.'
    >
      <TeamProjectMappingsManager />
    </PageContainer>
  );
}
