'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from '@/components/ui/sidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { listWorkspaceGroups } from '@/features/quality-hub/api/client';
import {
  readActiveWorkspaceContext,
  writeActiveWorkspaceContext
} from '@/features/quality-hub/workspace-context';
import { WorkspaceGroup } from '@/features/quality-hub/types';
import { IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Icons } from '../icons';

type GroupNavItem = {
  title: string;
  url: string;
  activePath?: string;
};

const baseNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: 'dashboard' },
  { title: 'Portfolio', url: '/dashboard/portfolio', icon: 'dashboard' },
  { title: 'GitLab Groups', url: '/dashboard/groups', icon: 'kanban' }
] as const;

const groupNavItems: GroupNavItem[] = [
  { title: 'Teams', url: '/dashboard/workspace/teams' },
  { title: 'Tickets', url: '/dashboard/workspace/tickets' },
  { title: 'Release Readiness', url: '/dashboard/portfolio' },
  { title: 'Deployments', url: '/dashboard/portfolio' },
  { title: 'Pipelines', url: '/dashboard/pipelines' },
  { title: 'Saved Views', url: '/dashboard/workspace/views' },
  { title: 'Watchlist', url: '/dashboard/workspace/watchlist' },
  { title: 'Notes', url: '/dashboard/workspace/notes' },
  { title: 'Tags', url: '/dashboard/workspace/tags' },
  {
    title: 'Project Mapping',
    url: '/dashboard/workspace/settings?tab=project-mapping',
    activePath: '/dashboard/workspace/settings'
  },
  {
    title: 'Cluster Registry',
    url: '/dashboard/workspace/settings?tab=cluster-registry',
    activePath: '/dashboard/workspace/settings'
  },
  {
    title: 'Services',
    url: '/dashboard/workspace/settings?tab=services',
    activePath: '/dashboard/workspace/settings'
  },
  {
    title: 'Clusters',
    url: '/dashboard/workspace/settings?tab=clusters',
    activePath: '/dashboard/workspace/settings'
  },
  {
    title: 'Environments',
    url: '/dashboard/workspace/settings?tab=environments',
    activePath: '/dashboard/workspace/settings'
  },
  { title: 'Settings', url: '/dashboard/workspace/settings' }
];

function encodedGroupPath(path: string) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export default function AppSidebar() {
  const pathname = usePathname();
  const [workspaceGroups, setWorkspaceGroups] = useState<WorkspaceGroup[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(
    null
  );

  const isRouteActive = (url: string) => {
    if (!url || url === '#') return false;
    const basePath = url.split('?')[0];
    if (basePath === '/dashboard') return pathname === '/dashboard';
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  };

  const isGroupBlockActive = (group: WorkspaceGroup) => {
    if (group.id === activeWorkspaceId) return true;
    const groupPath = `/dashboard/groups/${encodedGroupPath(group.gitlab_group_path)}`;
    if (isRouteActive(groupPath)) return true;
    return groupNavItems.some((item) =>
      isRouteActive(item.activePath || item.url)
    );
  };

  useEffect(() => {
    const loadWorkspaceGroups = async () => {
      try {
        const groups = await listWorkspaceGroups();
        setWorkspaceGroups(groups);

        const context = readActiveWorkspaceContext();
        const hasContext =
          context.workspaceId &&
          groups.some((group) => group.id === context.workspaceId);
        setActiveWorkspaceId(
          hasContext ? context.workspaceId : (groups[0]?.id ?? null)
        );
      } catch {
        setWorkspaceGroups([]);
      }
    };

    void loadWorkspaceGroups();
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const active = workspaceGroups.find(
      (group) => group.id === activeWorkspaceId
    );
    if (!active) return;

    writeActiveWorkspaceContext({
      workspaceId: active.id,
      gitlabGroupId: active.gitlab_group_id,
      gitlabGroupPath: active.gitlab_group_path
    });
  }, [activeWorkspaceId, workspaceGroups]);

  const groupOptions = useMemo(
    () =>
      workspaceGroups.map((group) => ({
        value: String(group.id),
        label: group.gitlab_group_path
      })),
    [workspaceGroups]
  );

  return (
    <Sidebar collapsible='icon'>
      <SidebarContent className='overflow-x-hidden'>
        <SidebarGroup>
          <SidebarMenu>
            {baseNavItems.map((item) => {
              const Icon = Icons[item.icon] || Icons.logo;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isRouteActive(item.url)}
                    className='group hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/15 data-[active=true]:text-primary before:bg-primary relative overflow-hidden transition-all duration-200 before:absolute before:top-1/2 before:left-0 before:h-0 before:w-0.5 before:-translate-y-1/2 before:rounded before:opacity-0 before:transition-all before:duration-200 data-[active=true]:before:h-6 data-[active=true]:before:opacity-100'
                  >
                    <Link href={item.url}>
                      <Icon className='transition-transform duration-200 group-hover:scale-105' />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {workspaceGroups.map((group) => {
          const groupUrl = `/dashboard/groups/${encodedGroupPath(group.gitlab_group_path)}`;
          return (
            <SidebarGroup key={`workspace-group-${group.id}`}>
              <SidebarMenu>
                <Collapsible
                  asChild
                  defaultOpen={group.id === activeWorkspaceId}
                  className='group/collapsible'
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={group.gitlab_group_path}
                        isActive={isGroupBlockActive(group)}
                        className='group hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/15 data-[active=true]:text-primary before:bg-primary relative overflow-hidden transition-all duration-200 before:absolute before:top-1/2 before:left-0 before:h-0 before:w-0.5 before:-translate-y-1/2 before:rounded before:opacity-0 before:transition-all before:duration-200 data-[active=true]:before:h-6 data-[active=true]:before:opacity-100'
                      >
                        <Icons.workspace className='transition-transform duration-200 group-hover:scale-105' />
                        <span>{group.gitlab_group_path}</span>
                        <IconChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent className='data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-hidden'>
                      <SidebarMenuSub>
                        {groupNavItems.map((item, index) => (
                          <SidebarMenuSubItem key={`${group.id}-${item.title}`}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isRouteActive(
                                item.activePath || item.url
                              )}
                              className='hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/15 data-[active=true]:text-primary before:bg-primary animate-in fade-in-0 slide-in-from-left-1 relative overflow-hidden transition-all duration-200 before:absolute before:top-1/2 before:left-0 before:h-0 before:w-0.5 before:-translate-y-1/2 before:rounded before:opacity-0 before:transition-all before:duration-200 data-[active=true]:before:h-5 data-[active=true]:before:opacity-100'
                              style={{
                                transitionDelay: `${index * 25}ms`,
                                animationDelay: `${index * 25}ms`
                              }}
                            >
                              <Link
                                href={item.url}
                                onClick={() => setActiveWorkspaceId(group.id)}
                              >
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}

                        <SidebarMenuSubItem key={`${group.id}-gitlab-sources`}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isRouteActive(groupUrl)}
                            className='hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/15 data-[active=true]:text-primary before:bg-primary relative overflow-hidden transition-all duration-200 before:absolute before:top-1/2 before:left-0 before:h-0 before:w-0.5 before:-translate-y-1/2 before:rounded before:opacity-0 before:transition-all before:duration-200 data-[active=true]:before:h-5 data-[active=true]:before:opacity-100'
                          >
                            <Link
                              href={groupUrl}
                              onClick={() => setActiveWorkspaceId(group.id)}
                            >
                              <span>GitLab Sources</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
