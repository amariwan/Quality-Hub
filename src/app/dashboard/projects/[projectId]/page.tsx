import PageContainer from '@/components/layout/page-container';
import { ProjectMatrix } from '@/features/quality-hub/components/project-matrix';

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const id = Number(projectId);

  return (
    <PageContainer
      pageTitle={`Project ${projectId}`}
      pageDescription='Deployment matrix with version bundle and actor metadata.'
    >
      <ProjectMatrix projectId={id} />
    </PageContainer>
  );
}
