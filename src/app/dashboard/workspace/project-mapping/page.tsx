import PageContainer from '@/components/layout/page-container';
import { WorkspaceSettingsSectionPlaceholder } from '@/features/quality-hub/components/workspace-settings-section-placeholder';

export default function WorkspaceProjectMappingPage() {
  return (
    <PageContainer
      pageTitle='Project Mapping'
      pageDescription='Map workspace teams to GitLab projects for clear ownership.'
    >
      <WorkspaceSettingsSectionPlaceholder
        heading='Project Mapping'
        description='Define and maintain ownership mapping between teams and projects.'
        bullets={[
          'Create direct team-to-project ownership relationships.',
          'Validate missing or conflicting mappings early.',
          'Use mappings as a base for risk and readiness views.'
        ]}
      />
    </PageContainer>
  );
}
