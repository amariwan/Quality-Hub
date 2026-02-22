import PageContainer from '@/components/layout/page-container';
import { TeamManagement } from '@/features/quality-hub/components/team-management';

export default function WorkspaceTeamsPage() {
  return (
    <PageContainer
      pageTitle='Workspace Teams'
      pageDescription='Create teams and manage memberships for TEAM visibility sharing.'
    >
      <TeamManagement />
    </PageContainer>
  );
}
