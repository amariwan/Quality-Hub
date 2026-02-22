import PageContainer from '@/components/layout/page-container';
import { SettingsManager } from '@/features/quality-hub/components/settings-manager';

export default function WorkspaceSettingsPage() {
  return (
    <PageContainer
      pageTitle='Workspace Settings'
      pageDescription='Konfigurationen für Live-Daten, GitLab-Ansicht und Runtime-Checks.'
    >
      <SettingsManager />
    </PageContainer>
  );
}
