import PageContainer from '@/components/layout/page-container';
import { DoraDashboard } from '@/features/quality-hub/components/dora-dashboard';

export default function WorkspaceDoraDashboardPage() {
  return (
    <PageContainer
      pageTitle='DORA Metrics'
      pageDescription='Deployment Frequency, Lead Time for Changes, Change Failure Rate, and MTTR — the four key engineering performance indicators.'
    >
      <DoraDashboard />
    </PageContainer>
  );
}
