import PageContainer from '@/components/layout/page-container';
import { GitlabCatalog } from '@/features/quality-hub/components/gitlab-catalog';

export default function GitlabPage() {
  return (
    <PageContainer
      pageTitle='GitLab'
      pageDescription='Gruppen und Projekte aus GitLab direkt im Frontend anzeigen.'
    >
      <GitlabCatalog />
    </PageContainer>
  );
}
