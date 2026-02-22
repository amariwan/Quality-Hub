import PageContainer from '@/components/layout/page-container';
import { OpsCenterDashboard } from '@/features/quality-hub/components/ops-center-dashboard';

export default function WorkspaceOpsCenterPage() {
  return (
    <PageContainer
      pageTitle='Ops Center'
      pageDescription='Release gates, alerting, DORA metrics, ownership heatmap, simulations, incidents, templates, and audit insights in one place.'
    >
      <OpsCenterDashboard />
    </PageContainer>
  );
}
