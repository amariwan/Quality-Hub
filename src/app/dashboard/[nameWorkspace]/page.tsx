import { redirect } from 'next/navigation';

export default async function WorkspaceLandingPage({
  params
}: {
  params: Promise<{ nameWorkspace: string }>;
}) {
  const { nameWorkspace } = await params;
  redirect(`/dashboard/${nameWorkspace}/teams`);
}
