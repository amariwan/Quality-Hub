import PageContainer from '@/components/layout/page-container';
import { WorkspaceGroupManager } from '@/features/quality-hub/components/workspace-group-manager';

export default async function QualityHubGroupsPage({
  params
}: {
  params: Promise<{ groupPath?: string[] }>;
}) {
  const { groupPath } = await params;
  const initialBrowsePath = groupPath?.length ? groupPath.join('/') : null;

  return (
    <PageContainer
      pageTitle='Groups'
      pageDescription='Browse GitLab groups like /dashboard/groups, open subgroups, and inspect repositories.'
    >
      <WorkspaceGroupManager
        initialBrowsePath={initialBrowsePath}
        routeBase='/dashboard/groups'
      />
    </PageContainer>
  );
}
