import PageContainer from '@/components/layout/page-container';
import { PipelinesTable } from '@/features/quality-hub/components/pipelines-table';

export default function PipelinesPage() {
  return (
    <PageContainer
      pageTitle='Broken Pipelines'
      pageDescription='Release-readiness and full-scope broken pipeline inspection.'
    >
      <PipelinesTable />
    </PageContainer>
  );
}
