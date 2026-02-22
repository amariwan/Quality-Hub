import PageContainer from '@/components/layout/page-container';
import { PortfolioTable } from '@/features/quality-hub/components/portfolio-table';

export default function PortfolioPage() {
  return (
    <PageContainer
      pageTitle='Quality-Hub Portfolio'
      pageDescription='Environment and cluster release-readiness status for monitored services.'
    >
      <PortfolioTable />
    </PageContainer>
  );
}
