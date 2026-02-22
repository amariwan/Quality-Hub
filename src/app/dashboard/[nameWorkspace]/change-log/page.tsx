import PageContainer from '@/components/layout/page-container';
import { WorkspaceChangelogManager } from '@/features/quality-hub/components/workspace-changelog-manager';

export default function WorkspaceChangeLogPage() {
  return (
    <PageContainer
      pageTitle='Workspace Change Log'
      pageDescription='Durchsucht alle Repositories im Workspace nach CHANGELOG-Dateien und zeigt deren Inhalt.'
    >
      <WorkspaceChangelogManager />
    </PageContainer>
  );
}
