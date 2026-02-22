import PageContainer from '@/components/layout/page-container';
import { WorkspaceSettingsSectionPlaceholder } from '@/features/quality-hub/components/workspace-settings-section-placeholder';

export default function WorkspaceServicesPage() {
  return (
    <PageContainer
      pageTitle='Services'
      pageDescription='Service catalog and operational ownership for the active workspace.'
    >
      <WorkspaceSettingsSectionPlaceholder
        heading='Services'
        description='Manage service definitions used in dashboards, status pages, and incident workflows.'
        bullets={[
          'Register service catalogue entries and owning teams.',
          'Define status, SLO targets, and health indicators.',
          'Connect services to projects and deployment scopes.'
        ]}
      />
    </PageContainer>
  );
}
