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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from '@/components/ui/sidebar';
import { listWorkspaceGroups } from '@/features/quality-hub/api/client';
import {
  readActiveWorkspaceContext,
  workspaceSlugFromGroupPath,
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
  { title: 'Risk Radar', url: '/dashboard/risk-radar', icon: 'dashboard' },
  {
    title: 'Release Readiness',
    url: '/dashboard/release-readiness',
    icon: 'dashboard'
  },
  { title: 'Portfolio', url: '/dashboard/portfolio', icon: 'dashboard' },
  { title: 'GitLab Groups', url: '/dashboard/groups', icon: 'kanban' }
] as const;

const groupNavItems: GroupNavItem[] = [
  { title: 'Teams', url: '/dashboard/:workspace/teams' },
  {
    title: 'Team Mapping',
    url: '/dashboard/:workspace/team-project-mappings'
  },
  { title: 'Tickets', url: '/dashboard/:workspace/tickets' },
  { title: 'Change Log', url: '/dashboard/:workspace/change-log' },
  { title: 'Risk Radar', url: '/dashboard/:workspace/risk-radar' },
  {
    title: 'Release Readiness',
    url: '/dashboard/:workspace/release-readiness'
  },
  { title: 'Ops Center', url: '/dashboard/:workspace/ops-center' },
  { title: 'Deployments', url: '/dashboard/portfolio' },
  { title: 'Pipelines', url: '/dashboard/:workspace/pipelines' },
  { title: 'Saved Views', url: '/dashboard/:workspace/views' },
  { title: 'Watchlist', url: '/dashboard/:workspace/watchlist' },
  { title: 'Notes', url: '/dashboard/:workspace/notes' },
  { title: 'Tags', url: '/dashboard/:workspace/tags' },
  {
    title: 'Project Mapping',
    url: '/dashboard/:workspace/project-mapping'
  },
  {
    title: 'Cluster Registry',
    url: '/dashboard/:workspace/cluster-registry'
  },
  {
    title: 'Services',
    url: '/dashboard/:workspace/services'
  },
  {
    title: 'Clusters',
    url: '/dashboard/:workspace/clusters'
  },
  {
    title: 'Environments',
    url: '/dashboard/:workspace/environments'
  },
  { title: 'Settings', url: '/dashboard/:workspace/settings' }
];

const DASHBOARD_STATIC_SEGMENTS = new Set([
  'dashboard',
  'risk-radar',
  'release-readiness',
  'portfolio',
  'pipelines',
  'gitlab',
  'groups',
  'projects',
  'product',
  'profile',
  'workspaces',
  'overview',
  'kanban',
  'workspace'
]);

function encodedGroupPath(path: string) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function resolveWorkspaceUrl(url: string, group: WorkspaceGroup) {
  const slug =
    workspaceSlugFromGroupPath(group.gitlab_group_path) || 'workspace';
  return url.replace(':workspace', slug);
}

function extractWorkspaceSlugFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  if (segments[0] !== 'dashboard') return null;
  const candidate = segments[1] || null;
  if (!candidate) return null;
  if (DASHBOARD_STATIC_SEGMENTS.has(candidate)) return null;
  return candidate;
}

export default function AppSidebar() {
  const pathname = usePathname();
  const [workspaceGroups, setWorkspaceGroups] = useState<WorkspaceGroup[]>([]);
  const [preferredWorkspaceId, setPreferredWorkspaceId] = useState<
    number | null
  >(null);

  const activeWorkspaceId = useMemo(() => {
    if (workspaceGroups.length === 0) return null;

    const pathnameWorkspaceSlug = extractWorkspaceSlugFromPathname(pathname);
    const pathnameWorkspaceId = pathnameWorkspaceSlug
      ? (workspaceGroups.find(
          (group) =>
            workspaceSlugFromGroupPath(group.gitlab_group_path) ===
            pathnameWorkspaceSlug
        )?.id ?? null)
      : null;
    if (pathnameWorkspaceId) return pathnameWorkspaceId;

    if (
      preferredWorkspaceId &&
      workspaceGroups.some((group) => group.id === preferredWorkspaceId)
    ) {
      return preferredWorkspaceId;
    }

    const context = readActiveWorkspaceContext();
    if (
      context.workspaceId &&
      workspaceGroups.some((group) => group.id === context.workspaceId)
    ) {
      return context.workspaceId;
    }

    return workspaceGroups[0]?.id ?? null;
  }, [pathname, preferredWorkspaceId, workspaceGroups]);

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
    return groupNavItems.some((item) => {
      const activePath = resolveWorkspaceUrl(
        item.activePath || item.url,
        group
      );
      return isRouteActive(activePath);
    });
  };

  useEffect(() => {
    const loadWorkspaceGroups = async () => {
      try {
        const groups = await listWorkspaceGroups();
        setWorkspaceGroups(groups);
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
                                resolveWorkspaceUrl(
                                  item.activePath || item.url,
                                  group
                                )
                              )}
                              className='hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/15 data-[active=true]:text-primary before:bg-primary animate-in fade-in-0 slide-in-from-left-1 relative overflow-hidden transition-all duration-200 before:absolute before:top-1/2 before:left-0 before:h-0 before:w-0.5 before:-translate-y-1/2 before:rounded before:opacity-0 before:transition-all before:duration-200 data-[active=true]:before:h-5 data-[active=true]:before:opacity-100'
                              style={{
                                transitionDelay: `${index * 25}ms`,
                                animationDelay: `${index * 25}ms`
                              }}
                            >
                              <Link
                                href={resolveWorkspaceUrl(item.url, group)}
                                onClick={() =>
                                  setPreferredWorkspaceId(group.id)
                                }
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
                              onClick={() => setPreferredWorkspaceId(group.id)}
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
