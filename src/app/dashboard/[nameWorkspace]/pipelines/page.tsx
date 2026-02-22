import PageContainer from '@/components/layout/page-container';
import { PipelinesTable } from '@/features/quality-hub/components/pipelines-table';

export default function WorkspacePipelinesPage() {
  return (
    <PageContainer
      pageTitle='Workspace Pipelines'
      pageDescription='Release-readiness und Full-Scope Broken-Pipeline-Analyse pro Workspace.'
    >
      <PipelinesTable />
    </PageContainer>
  );
}
