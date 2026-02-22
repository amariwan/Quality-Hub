import PageContainer from '@/components/layout/page-container';
import { PortfolioTable } from '@/features/quality-hub/components/portfolio-table';

export default function ReleaseReadinessPage() {
  return (
    <PageContainer
      pageTitle='Release Readiness'
      pageDescription='Readiness-Status über Environments und Cluster für verlässliche Releases.'
    >
      <PortfolioTable />
    </PageContainer>
  );
}
