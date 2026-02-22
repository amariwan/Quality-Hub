import PageContainer from '@/components/layout/page-container';
import { WorkspaceViewsManager } from '@/features/quality-hub/components/workspace-views-manager';

export default function WorkspaceViewsPage() {
  return (
    <PageContainer
      pageTitle='Workspace Views'
      pageDescription='Saved filter and sorting views for portfolio and pipelines.'
    >
      <WorkspaceViewsManager />
    </PageContainer>
  );
}
