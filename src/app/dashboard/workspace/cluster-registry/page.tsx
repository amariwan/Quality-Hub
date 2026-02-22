import PageContainer from '@/components/layout/page-container';
import { WorkspaceSettingsSectionPlaceholder } from '@/features/quality-hub/components/workspace-settings-section-placeholder';

export default function WorkspaceClusterRegistryPage() {
  return (
    <PageContainer
      pageTitle='Cluster Registry'
      pageDescription='Central place to standardize cluster metadata and ownership.'
    >
      <WorkspaceSettingsSectionPlaceholder
        heading='Cluster Registry'
        description='Define canonical cluster entries for platform operations and release readiness.'
        bullets={[
          'Define canonical cluster names and IDs across environments.',
          'Document ownership and escalation contacts per cluster.',
          'Attach validation rules before rollout and release gates.'
        ]}
      />
    </PageContainer>
  );
}
