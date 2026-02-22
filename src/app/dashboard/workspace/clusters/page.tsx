import PageContainer from '@/components/layout/page-container';
import { WorkspaceSettingsSectionPlaceholder } from '@/features/quality-hub/components/workspace-settings-section-placeholder';

export default function WorkspaceClustersPage() {
  return (
    <PageContainer
      pageTitle='Clusters'
      pageDescription='Operational cluster view for readiness, ownership, and rollout controls.'
    >
      <WorkspaceSettingsSectionPlaceholder
        heading='Clusters'
        description='Use this page as the workspace-level cluster operations center.'
        bullets={[
          'Review cluster inventory grouped by workspace scope.',
          'Track readiness states and rollout constraints.',
          'Assign platform ownership and maintenance windows.'
        ]}
      />
    </PageContainer>
  );
}
