import PageContainer from '@/components/layout/page-container';
import { RiskRadarDashboard } from '@/features/quality-hub/components/risk-radar-dashboard';

export default function RiskRadarPage() {
  return (
    <PageContainer
      pageTitle='Risk Radar'
      pageDescription='Management view for release risk, delivery confidence and quality trend.'
    >
      <RiskRadarDashboard />
    </PageContainer>
  );
}
