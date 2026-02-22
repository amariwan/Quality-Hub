import PageContainer from '@/components/layout/page-container';
import { TicketboardManager } from '@/features/quality-hub/components/ticketboard-manager';

export default function WorkspaceTicketsPage() {
  return (
    <PageContainer
      pageTitle='Workspace Tickets'
      pageDescription='Tickets erstellen, priorisieren und in Ticketboards verwalten.'
    >
      <TicketboardManager />
    </PageContainer>
  );
}
