import PageContainer from '@/components/layout/page-container';
import { WorkspaceWatchlistManager } from '@/features/quality-hub/components/workspace-watchlist-manager';

export default function WorkspaceWatchlistPage() {
  return (
    <PageContainer
      pageTitle='Workspace Watchlist'
      pageDescription='Track favorite projects with private or team visibility.'
    >
      <WorkspaceWatchlistManager />
    </PageContainer>
  );
}
