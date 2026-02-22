'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  createWorkspaceGroup,
  deleteWorkspaceGroup,
  listGitlabGroups,
  listGitlabProjects,
  listWorkspaceGroups
} from '@/features/quality-hub/api/client';
import {
  GitlabGroup,
  GitlabProject,
  WorkspaceGroup
} from '@/features/quality-hub/types';
import {
  readActiveWorkspaceContext,
  readWorkspaceOrderIds,
  writeActiveWorkspaceContext,
  writeWorkspaceOrderIds
} from '@/features/quality-hub/workspace-context';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

function parentPath(fullPath: string): string | null {
  const idx = fullPath.lastIndexOf('/');
  if (idx < 0) return null;
  return fullPath.slice(0, idx);
}

export function WorkspaceGroupManager({
  initialBrowsePath = null,
  routeBase = '/dashboard/groups'
}: {
  initialBrowsePath?: string | null;
  routeBase?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [gitlabGroups, setGitlabGroups] = useState<GitlabGroup[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceGroup[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(
    null
  );
  const [workspaceOrderIds, setWorkspaceOrderIds] = useState<number[]>([]);
  const [browsePath, setBrowsePath] = useState<string | null>(
    initialBrowsePath
  );
  const [repos, setRepos] = useState<GitlabProject[]>([]);
  const [repoFilter, setRepoFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [repoLoading, setRepoLoading] = useState(false);
  const [workingWorkspaceId, setWorkingWorkspaceId] = useState<number | null>(
    null
  );
  const [pendingAddGroup, setPendingAddGroup] = useState<GitlabGroup | null>(
    null
  );
  const [pendingRemoveWorkspace, setPendingRemoveWorkspace] =
    useState<WorkspaceGroup | null>(null);
  const [detailWorkspaceId, setDetailWorkspaceId] = useState<number | null>(
    null
  );
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupById = useMemo(
    () => new Map(gitlabGroups.map((item) => [item.id, item])),
    [gitlabGroups]
  );
  const groupByPath = useMemo(
    () => new Map(gitlabGroups.map((item) => [item.full_path, item])),
    [gitlabGroups]
  );
  const workspaceById = useMemo(
    () => new Map(workspaces.map((item) => [item.id, item])),
    [workspaces]
  );
  const workspaceByGitlabGroupId = useMemo(
    () => new Map(workspaces.map((item) => [item.gitlab_group_id, item])),
    [workspaces]
  );

  const orderedWorkspaces = useMemo(() => {
    if (workspaceOrderIds.length === 0) return workspaces;
    const rank = new Map(workspaceOrderIds.map((id, index) => [id, index]));
    return [...workspaces].sort((a, b) => {
      const left = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const right = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    });
  }, [workspaceOrderIds, workspaces]);

  const activeWorkspace = activeWorkspaceId
    ? (workspaceById.get(activeWorkspaceId) ?? null)
    : null;
  const detailWorkspace = detailWorkspaceId
    ? (workspaceById.get(detailWorkspaceId) ?? null)
    : null;

  const activeBrowseGroup = browsePath
    ? (groupByPath.get(browsePath) ?? null)
    : null;

  useEffect(() => {
    setBrowsePath(initialBrowsePath);
  }, [initialBrowsePath]);

  useEffect(() => {
    const normalizedBase = routeBase.endsWith('/')
      ? routeBase.slice(0, -1)
      : routeBase;
    const expectedPath = browsePath
      ? `${normalizedBase}/${browsePath
          .split('/')
          .map((part) => encodeURIComponent(part))
          .join('/')}`
      : normalizedBase;
    if (pathname !== expectedPath) {
      router.replace(expectedPath);
    }
  }, [browsePath, pathname, routeBase, router]);

  const gitlabDashboardGroupsUrl = useMemo(() => {
    if (gitlabGroups.length === 0) return null;
    const sample = gitlabGroups.find((group) => Boolean(group.web_url));
    if (!sample?.web_url) return null;
    const base = sample.web_url.split('/-/')[0];
    return `${base}/dashboard/groups`;
  }, [gitlabGroups]);

  const visibleGroups = useMemo(() => {
    return gitlabGroups
      .filter((group) => parentPath(group.full_path) === browsePath)
      .sort((a, b) => a.full_path.localeCompare(b.full_path));
  }, [browsePath, gitlabGroups]);

  const browseCrumbs = useMemo(() => {
    if (!browsePath) return [];
    const parts = browsePath.split('/');
    return parts.map((_, idx) => parts.slice(0, idx + 1).join('/'));
  }, [browsePath]);

  const filteredRepos = useMemo(() => {
    const term = repoFilter.trim().toLowerCase();
    if (!term) return repos;
    return repos.filter((repo) => {
      const value =
        `${repo.name} ${repo.path_with_namespace ?? ''}`.toLowerCase();
      return value.includes(term);
    });
  }, [repoFilter, repos]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [groupRows, workspaceRows] = await Promise.all([
        listGitlabGroups(),
        listWorkspaceGroups()
      ]);
      setGitlabGroups(groupRows);
      setWorkspaces(workspaceRows);

      const context = readActiveWorkspaceContext();
      const storedOrder = readWorkspaceOrderIds();
      const existingIds = new Set(workspaceRows.map((item) => item.id));
      const normalizedOrder = [
        ...storedOrder.filter((id) => existingIds.has(id)),
        ...workspaceRows
          .map((item) => item.id)
          .filter((id) => !storedOrder.includes(id))
      ];
      setWorkspaceOrderIds(normalizedOrder);
      writeWorkspaceOrderIds(normalizedOrder);

      setActiveWorkspaceId((prev) => {
        if (
          context.workspaceId &&
          workspaceRows.some((item) => item.id === context.workspaceId)
        ) {
          return context.workspaceId;
        }
        if (prev && workspaceRows.some((item) => item.id === prev)) return prev;
        return workspaceRows[0]?.id ?? null;
      });

      setBrowsePath((prev) => {
        if (prev && groupRows.some((item) => item.full_path === prev))
          return prev;
        if (
          context.gitlabGroupPath &&
          groupRows.some((item) => item.full_path === context.gitlabGroupPath)
        ) {
          return context.gitlabGroupPath;
        }
        return null;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load workspace groups'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!activeWorkspace) {
      writeActiveWorkspaceContext({
        workspaceId: null,
        gitlabGroupId: null,
        gitlabGroupPath: null
      });
      return;
    }
    writeActiveWorkspaceContext({
      workspaceId: activeWorkspace.id,
      gitlabGroupId: activeWorkspace.gitlab_group_id,
      gitlabGroupPath: activeWorkspace.gitlab_group_path
    });
  }, [activeWorkspace]);

  const loadBrowseRepos = useCallback(async () => {
    if (!activeBrowseGroup) {
      setRepos([]);
      return;
    }
    setRepoLoading(true);
    try {
      setError(null);
      const rows = await listGitlabProjects(activeBrowseGroup.id);
      setRepos(rows);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load repositories'
      );
      setRepos([]);
    } finally {
      setRepoLoading(false);
    }
  }, [activeBrowseGroup]);

  useEffect(() => {
    void loadBrowseRepos();
  }, [loadBrowseRepos]);

  const addWorkspace = async (groupId: number) => {
    setWorkingWorkspaceId(groupId);
    try {
      setError(null);
      await createWorkspaceGroup({ gitlab_group_id: groupId });
      await loadCatalog();
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create workspace'
      );
      return false;
    } finally {
      setWorkingWorkspaceId(null);
    }
  };

  const removeWorkspace = async (workspaceId: number) => {
    setWorkingWorkspaceId(workspaceId);
    try {
      setError(null);
      await deleteWorkspaceGroup(workspaceId);
      await loadCatalog();
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to remove workspace'
      );
      return false;
    } finally {
      setWorkingWorkspaceId(null);
    }
  };

  const confirmAddWorkspace = async () => {
    if (!pendingAddGroup) return;
    const ok = await addWorkspace(pendingAddGroup.id);
    if (ok) setPendingAddGroup(null);
  };

  const confirmRemoveWorkspace = async () => {
    if (!pendingRemoveWorkspace) return;
    const ok = await removeWorkspace(pendingRemoveWorkspace.id);
    if (ok) setPendingRemoveWorkspace(null);
  };

  const moveWorkspace = (workspaceId: number, direction: -1 | 1) => {
    setWorkspaceOrderIds((prev) => {
      const order =
        prev.length > 0 ? [...prev] : workspaces.map((item) => item.id);
      const index = order.indexOf(workspaceId);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= order.length) return order;
      [order[index], order[next]] = [order[next], order[index]];
      writeWorkspaceOrderIds(order);
      return order;
    });
  };

  return (
    <Card>
      <CardHeader className='gap-2'>
        <CardTitle>Workspace Explorer</CardTitle>
        <p className='text-muted-foreground text-sm'>
          Wie in GitLab: durch Groups navigieren, Untergruppen öffnen und
          darunter Projekte sehen. Gruppen als Workspaces markieren.
        </p>
      </CardHeader>
      <CardContent className='space-y-4'>
        {error && <p className='text-destructive text-sm'>{error}</p>}

        <div className='flex flex-wrap items-center gap-2'>
          <Button variant='outline' onClick={() => setBrowsePath(null)}>
            Root Groups
          </Button>
          <Button
            variant='outline'
            disabled={loading}
            onClick={() => void loadCatalog()}
          >
            {loading ? 'Loading...' : 'Reload'}
          </Button>
          {gitlabDashboardGroupsUrl && (
            <a
              className='text-sm underline'
              href={gitlabDashboardGroupsUrl}
              target='_blank'
              rel='noreferrer'
            >
              Open GitLab /dashboard/groups
            </a>
          )}
          <Badge variant='outline'>Groups: {gitlabGroups.length}</Badge>
          <Badge variant='secondary'>Workspaces: {workspaces.length}</Badge>
        </div>

        <div className='flex flex-wrap items-center gap-2 text-xs'>
          <Button size='sm' variant='ghost' onClick={() => setBrowsePath(null)}>
            /
          </Button>
          {browseCrumbs.map((crumb) => (
            <Button
              key={crumb}
              size='sm'
              variant='ghost'
              onClick={() => setBrowsePath(crumb)}
            >
              {crumb}
            </Button>
          ))}
        </div>

        <div className='grid gap-4 lg:grid-cols-[360px_1fr]'>
          <div className='space-y-3'>
            <div className='rounded-md border p-3'>
              <p className='text-sm font-medium'>Untergruppen</p>
              <div className='mt-2 max-h-[320px] space-y-2 overflow-auto pr-1'>
                {visibleGroups.map((group) => {
                  const workspace = workspaceByGitlabGroupId.get(group.id);
                  return (
                    <div
                      key={group.id}
                      className='space-y-2 rounded border p-2'
                    >
                      <Button
                        className='h-auto w-full justify-start px-0 text-left'
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => setBrowsePath(group.full_path)}
                      >
                        <p className='truncate text-sm font-medium'>
                          {group.name}
                        </p>
                        <p className='text-muted-foreground truncate text-xs'>
                          {group.full_path}
                        </p>
                      </Button>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => setBrowsePath(group.full_path)}
                        >
                          Open
                        </Button>
                        {workspace ? (
                          <Button
                            size='sm'
                            variant='destructive'
                            disabled={workingWorkspaceId === workspace.id}
                            onClick={() => setPendingRemoveWorkspace(workspace)}
                          >
                            {workingWorkspaceId === workspace.id
                              ? 'Working...'
                              : 'Remove workspace'}
                          </Button>
                        ) : (
                          <Button
                            size='sm'
                            variant='secondary'
                            disabled={workingWorkspaceId === group.id}
                            onClick={() => setPendingAddGroup(group)}
                          >
                            {workingWorkspaceId === group.id
                              ? 'Working...'
                              : 'Add workspace'}
                          </Button>
                        )}
                        {group.web_url && (
                          <a
                            className='text-xs underline'
                            href={group.web_url}
                            target='_blank'
                            rel='noreferrer'
                          >
                            GitLab
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
                {visibleGroups.length === 0 && (
                  <p className='text-muted-foreground text-sm'>
                    Keine Untergruppen auf dieser Ebene.
                  </p>
                )}
              </div>
            </div>

            <div className='rounded-md border p-3'>
              <p className='text-sm font-medium'>Meine Workspaces</p>
              <div className='mt-2 max-h-[320px] space-y-2 overflow-auto pr-1'>
                {orderedWorkspaces.map((workspace, index) => {
                  const group = groupById.get(workspace.gitlab_group_id);
                  const isActive = workspace.id === activeWorkspaceId;
                  return (
                    <div
                      key={workspace.id}
                      className='space-y-2 rounded border p-2'
                    >
                      <Button
                        className='h-auto w-full justify-start px-0 text-left'
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => {
                          setActiveWorkspaceId(workspace.id);
                          setBrowsePath(workspace.gitlab_group_path);
                        }}
                      >
                        <p className='truncate text-sm font-medium'>
                          {group?.name || workspace.gitlab_group_path}
                        </p>
                        <p className='text-muted-foreground truncate text-xs'>
                          {workspace.gitlab_group_path}
                        </p>
                      </Button>
                      <div className='flex flex-wrap items-center gap-2'>
                        {isActive && <Badge variant='secondary'>Active</Badge>}
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => setDetailWorkspaceId(workspace.id)}
                        >
                          Details
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={index === 0}
                          onClick={() => moveWorkspace(workspace.id, -1)}
                        >
                          Up
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={index === orderedWorkspaces.length - 1}
                          onClick={() => moveWorkspace(workspace.id, 1)}
                        >
                          Down
                        </Button>
                        <Button
                          size='sm'
                          variant='destructive'
                          disabled={workingWorkspaceId === workspace.id}
                          onClick={() => setPendingRemoveWorkspace(workspace)}
                        >
                          {workingWorkspaceId === workspace.id
                            ? 'Working...'
                            : 'Remove'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {orderedWorkspaces.length === 0 && (
                  <p className='text-muted-foreground text-sm'>
                    Noch keine Workspaces.
                  </p>
                )}
              </div>
              <div className='mt-2'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={orderedWorkspaces.length < 2}
                  onClick={() => setOrderDialogOpen(true)}
                >
                  Reorder Workspaces
                </Button>
              </div>
            </div>
          </div>

          <div className='space-y-3 rounded-md border p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <h3 className='text-sm font-medium'>
                Projekte{' '}
                {activeBrowseGroup
                  ? `(${activeBrowseGroup.full_path})`
                  : '(Root auswählen)'}
              </h3>
              <Badge variant='outline'>Repos: {repos.length}</Badge>
            </div>

            <Input
              placeholder='Filter repositories by name/path...'
              value={repoFilter}
              onChange={(event) => setRepoFilter(event.target.value)}
              disabled={!activeBrowseGroup}
            />

            {activeBrowseGroup?.web_url && (
              <a
                className='text-xs underline'
                href={activeBrowseGroup.web_url}
                target='_blank'
                rel='noreferrer'
              >
                Open {activeBrowseGroup.full_path} in GitLab
              </a>
            )}

            <div className='max-h-[680px] space-y-2 overflow-auto pr-1'>
              {repoLoading && (
                <p className='text-muted-foreground text-sm'>
                  Loading repositories...
                </p>
              )}
              {!repoLoading &&
                activeBrowseGroup &&
                filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className='flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs'
                  >
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium'>
                        {repo.name}
                      </p>
                      <p className='text-muted-foreground truncate'>
                        {repo.path_with_namespace || `project-${repo.id}`}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      {repo.default_branch && (
                        <Badge variant='outline'>{repo.default_branch}</Badge>
                      )}
                      {repo.web_url && (
                        <a
                          className='underline'
                          href={repo.web_url}
                          target='_blank'
                          rel='noreferrer'
                        >
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              {!repoLoading &&
                activeBrowseGroup &&
                filteredRepos.length === 0 && (
                  <p className='text-muted-foreground text-sm'>
                    Keine Projekte gefunden.
                  </p>
                )}
              {!activeBrowseGroup && (
                <p className='text-muted-foreground text-sm'>
                  Wähle links eine Group oder Untergruppe wie in GitLab aus.
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <Dialog
        open={Boolean(pendingAddGroup)}
        onOpenChange={(open) => !open && setPendingAddGroup(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Workspace</DialogTitle>
            <DialogDescription>
              Soll die Group{' '}
              <strong>{pendingAddGroup?.full_path || '-'}</strong> als Workspace
              hinzugefuegt werden?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setPendingAddGroup(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmAddWorkspace()}
              disabled={
                !pendingAddGroup || workingWorkspaceId === pendingAddGroup.id
              }
            >
              {pendingAddGroup && workingWorkspaceId === pendingAddGroup.id
                ? 'Adding...'
                : 'Add workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingRemoveWorkspace)}
        onOpenChange={(open) => !open && setPendingRemoveWorkspace(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Workspace</DialogTitle>
            <DialogDescription>
              Soll der Workspace{' '}
              <strong>
                {pendingRemoveWorkspace?.gitlab_group_path || '-'}
              </strong>{' '}
              entfernt werden?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setPendingRemoveWorkspace(null)}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => void confirmRemoveWorkspace()}
              disabled={
                !pendingRemoveWorkspace ||
                workingWorkspaceId === pendingRemoveWorkspace.id
              }
            >
              {pendingRemoveWorkspace &&
              workingWorkspaceId === pendingRemoveWorkspace.id
                ? 'Removing...'
                : 'Remove workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailWorkspace !== null}
        onOpenChange={(open) => {
          if (!open) setDetailWorkspaceId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workspace Details</DialogTitle>
            <DialogDescription>
              Infos und Schnellaktionen fuer den gewaehlten Workspace.
            </DialogDescription>
          </DialogHeader>
          {detailWorkspace && (
            <div className='space-y-3 text-sm'>
              <div className='grid gap-1'>
                <p>
                  <strong>ID:</strong> {detailWorkspace.id}
                </p>
                <p>
                  <strong>Group ID:</strong> {detailWorkspace.gitlab_group_id}
                </p>
                <p className='break-all'>
                  <strong>Path:</strong> {detailWorkspace.gitlab_group_path}
                </p>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Button
                  size='sm'
                  onClick={() => {
                    setActiveWorkspaceId(detailWorkspace.id);
                    setBrowsePath(detailWorkspace.gitlab_group_path);
                    setDetailWorkspaceId(null);
                  }}
                >
                  Set Active
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      detailWorkspace.gitlab_group_path
                    );
                  }}
                >
                  Copy Path
                </Button>
                <Button
                  size='sm'
                  variant='destructive'
                  onClick={() => {
                    setDetailWorkspaceId(null);
                    setPendingRemoveWorkspace(detailWorkspace);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reorder Workspaces</DialogTitle>
            <DialogDescription>
              Reihenfolge der Workspaces global fuer die Sidebar/Ansichten
              festlegen.
            </DialogDescription>
          </DialogHeader>
          <div className='max-h-[50vh] space-y-2 overflow-auto pr-1'>
            {orderedWorkspaces.map((workspace, index) => {
              const isActive = workspace.id === activeWorkspaceId;
              return (
                <div
                  key={`order-${workspace.id}`}
                  className='flex items-center justify-between gap-2 rounded border p-2'
                >
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium'>
                      {workspace.gitlab_group_path}
                    </p>
                    {isActive && <Badge variant='secondary'>Active</Badge>}
                  </div>
                  <div className='flex items-center gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={index === 0}
                      onClick={() => moveWorkspace(workspace.id, -1)}
                    >
                      Up
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={index === orderedWorkspaces.length - 1}
                      onClick={() => moveWorkspace(workspace.id, 1)}
                    >
                      Down
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setOrderDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
