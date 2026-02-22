import PageContainer from '@/components/layout/page-container';
import { WorkspaceTagsManager } from '@/features/quality-hub/components/workspace-tags-manager';

export default function WorkspaceTagsPage() {
  return (
    <PageContainer
      pageTitle='Workspace Tags'
      pageDescription='Manage labels and link them to project/env/cluster scopes.'
    >
      <WorkspaceTagsManager />
    </PageContainer>
  );
}
