import PageContainer from '@/components/layout/page-container';
import { WorkspaceNotesManager } from '@/features/quality-hub/components/workspace-notes-manager';

export default function WorkspaceNotesPage() {
  return (
    <PageContainer
      pageTitle='Workspace Notes'
      pageDescription='Attach private or team-shared notes to project/env/cluster scopes.'
    >
      <WorkspaceNotesManager />
    </PageContainer>
  );
}
