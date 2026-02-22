import PageContainer from '@/components/layout/page-container';
import { PortfolioTable } from '@/features/quality-hub/components/portfolio-table';

export default function WorkspaceReleaseReadinessPage() {
  return (
    <PageContainer
      pageTitle='Workspace Release Readiness'
      pageDescription='Workspace-spezifische Readiness-Sicht über Environments und Cluster.'
    >
      <PortfolioTable />
    </PageContainer>
  );
}
