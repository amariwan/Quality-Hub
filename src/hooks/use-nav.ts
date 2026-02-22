'use client';

import {
  readActiveWorkspaceContext,
  workspaceSlugFromGroupPath
} from '@/features/quality-hub/workspace-context';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import type { NavItem } from '@/types';

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

function extractWorkspaceSlugFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  if (segments[0] !== 'dashboard') return null;
  const candidate = segments[1] || null;
  if (!candidate || DASHBOARD_STATIC_SEGMENTS.has(candidate)) return null;
  return candidate;
}

function resolveNavUrl(url: string, workspaceSlug: string): string {
  if (!url) return url;
  if (url.includes(':workspace')) {
    return url.replace(':workspace', workspaceSlug);
  }
  if (url.startsWith('/dashboard/workspace/')) {
    return `/dashboard/${workspaceSlug}/${url.slice('/dashboard/workspace/'.length)}`;
  }
  return url;
}

function mapNavItems(items: NavItem[], workspaceSlug: string): NavItem[] {
  return items.map((item) => ({
    ...item,
    url: resolveNavUrl(item.url, workspaceSlug),
    items: item.items ? mapNavItems(item.items, workspaceSlug) : item.items
  }));
}

export function useFilteredNavItems(items: NavItem[]) {
  const pathname = usePathname();

  return useMemo(() => {
    const slugFromPath = extractWorkspaceSlugFromPathname(pathname || '');
    const slugFromContext = workspaceSlugFromGroupPath(
      readActiveWorkspaceContext().gitlabGroupPath
    );
    const activeWorkspaceSlug = slugFromPath || slugFromContext || 'workspace';
    return mapNavItems(items, activeWorkspaceSlug);
  }, [items, pathname]);
}
