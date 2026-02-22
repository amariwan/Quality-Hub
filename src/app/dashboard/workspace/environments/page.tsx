import PageContainer from '@/components/layout/page-container';
import { WorkspaceSettingsSectionPlaceholder } from '@/features/quality-hub/components/workspace-settings-section-placeholder';

export default function WorkspaceEnvironmentsPage() {
  return (
    <PageContainer
      pageTitle='Environments'
      pageDescription='Environment model and promotion flow for controlled releases.'
    >
      <WorkspaceSettingsSectionPlaceholder
        heading='Environments'
        description='Standardize deployment environments and rules across projects.'
        bullets={[
          'Maintain standardized environment names and tiers.',
          'Set promotion paths from lower to higher environments.',
          'Define quality gates and required checks per environment.'
        ]}
      />
    </PageContainer>
  );
}
