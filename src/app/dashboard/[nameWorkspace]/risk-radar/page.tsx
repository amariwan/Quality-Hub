import PageContainer from '@/components/layout/page-container';
import { RiskRadarDashboard } from '@/features/quality-hub/components/risk-radar-dashboard';

export default function WorkspaceRiskRadarPage() {
  return (
    <PageContainer
      pageTitle='Workspace Risk Radar'
      pageDescription='Workspace-spezifische Sicht auf Release-Risiken, Delivery Confidence und Quality Trends.'
    >
      <RiskRadarDashboard />
    </PageContainer>
  );
}
