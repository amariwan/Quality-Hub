import PageContainer from '@/components/layout/page-container';
import { UserWidgetBoard } from '@/features/dashboard/components/user-widget-board';

export default function QualityHubRootPage() {
  return (
    <PageContainer
      pageTitle='Dashboard'
      pageDescription='Build your own dashboard with custom widgets and templates.'
    >
      <UserWidgetBoard />
    </PageContainer>
  );
}
