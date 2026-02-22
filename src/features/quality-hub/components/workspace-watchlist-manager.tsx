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
  createWorkspaceWatchlist,
  deleteWorkspaceWatchlist,
  listGitlabProjects,
  listProjects,
  listWorkspaceWatchlist
} from '@/features/quality-hub/api/client';
import { readActiveWorkspaceContext } from '@/features/quality-hub/workspace-context';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ProjectRow = {
  id: number;
  gitlab_project_id: number;
  path_with_namespace: string;
  default_branch: string | null;
};

type WatchlistRow = {
  id: number;
  project_id: number;
  visibility: string;
  team_id: number | null;
};

export function WorkspaceWatchlistManager() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [items, setItems] = useState<WatchlistRow[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'watched' | 'unwatched'>(
    'all'
  );
  const [activeWorkspaceGroupId, setActiveWorkspaceGroupId] = useState<
    number | null
  >(null);
  const [activeWorkspaceGroupPath, setActiveWorkspaceGroupPath] = useState<
    string | null
  >(null);
  const [workspaceRepoGitlabIds, setWorkspaceRepoGitlabIds] =
    useState<Set<number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [workingProjectId, setWorkingProjectId] = useState<number | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [confirmBulkRemoveOpen, setConfirmBulkRemoveOpen] = useState(false);
  const [pendingRemoveProjectId, setPendingRemoveProjectId] = useState<
    number | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const context = readActiveWorkspaceContext();
      setActiveWorkspaceGroupId(context.gitlabGroupId);
      setActiveWorkspaceGroupPath(context.gitlabGroupPath);

      const [projectData, watchlistData, workspaceRepos] = await Promise.all([
        listProjects(true),
        listWorkspaceWatchlist(),
        context.gitlabGroupId
          ? listGitlabProjects(context.gitlabGroupId)
          : Promise.resolve([])
      ]);
      setProjects(projectData);
      setItems(watchlistData);
      setWorkspaceRepoGitlabIds(
        context.gitlabGroupId
          ? new Set(workspaceRepos.map((row) => row.id))
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const watchedProjectIds = useMemo(() => {
    return new Set(items.map((item) => item.project_id));
  }, [items]);

  const watchlistItemIdByProject = useMemo(() => {
    return new Map(items.map((item) => [item.project_id, item.id]));
  }, [items]);

  const filteredProjects = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return projects.filter((project) => {
      if (
        workspaceRepoGitlabIds &&
        !workspaceRepoGitlabIds.has(project.gitlab_project_id)
      ) {
        return false;
      }
      const matchesFilter =
        !term ||
        project.path_with_namespace.toLowerCase().includes(term) ||
        String(project.id).includes(term) ||
        String(project.gitlab_project_id).includes(term);
      if (!matchesFilter) return false;

      const isWatched = watchedProjectIds.has(project.id);
      if (viewMode === 'watched') return isWatched;
      if (viewMode === 'unwatched') return !isWatched;
      return true;
    });
  }, [filter, projects, viewMode, watchedProjectIds, workspaceRepoGitlabIds]);

  const toggleSelectedProject = (projectId: number) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const selectFiltered = () => {
    setSelectedProjectIds(filteredProjects.map((project) => project.id));
  };

  const bulkAddSelected = async () => {
    setBulkWorking(true);
    try {
      setError(null);
      for (const projectId of selectedProjectIds) {
        if (watchedProjectIds.has(projectId)) continue;
        await createWorkspaceWatchlist({ project_id: projectId });
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkWorking(false);
    }
  };

  const bulkRemoveSelected = async () => {
    setBulkWorking(true);
    try {
      setError(null);
      for (const projectId of selectedProjectIds) {
        const itemId = watchlistItemIdByProject.get(projectId);
        if (!itemId) continue;
        await deleteWorkspaceWatchlist(itemId);
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkWorking(false);
    }
  };

  const removeSingleProject = async (projectId: number) => {
    const itemId = watchlistItemIdByProject.get(projectId);
    if (!itemId) return;
    try {
      setError(null);
      setWorkingProjectId(projectId);
      await deleteWorkspaceWatchlist(itemId);
      await loadAll();
      setPendingRemoveProjectId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorkingProjectId(null);
    }
  };

  return (
    <Card>
      <CardHeader className='gap-2'>
        <CardTitle>Project Watchlist</CardTitle>
        <p className='text-muted-foreground text-sm'>
          Alle bekannten Projekte anzeigen und per Klick zur Watchlist
          hinzufügen.
        </p>
        {activeWorkspaceGroupId && (
          <p className='text-muted-foreground text-xs'>
            Workspace scope:{' '}
            {activeWorkspaceGroupPath || `group #${activeWorkspaceGroupId}`}
          </p>
        )}
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            placeholder='Suche nach Projektname oder ID...'
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <Button
            size='sm'
            variant={viewMode === 'all' ? 'default' : 'outline'}
            onClick={() => setViewMode('all')}
          >
            All
          </Button>
          <Button
            size='sm'
            variant={viewMode === 'watched' ? 'default' : 'outline'}
            onClick={() => setViewMode('watched')}
          >
            Watched
          </Button>
          <Button
            size='sm'
            variant={viewMode === 'unwatched' ? 'default' : 'outline'}
            onClick={() => setViewMode('unwatched')}
          >
            Unwatched
          </Button>
          <Button
            variant='outline'
            onClick={() => void loadAll()}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Reload'}
          </Button>
          <Badge variant='outline'>Projects: {projects.length}</Badge>
          <Badge variant='secondary'>Watching: {items.length}</Badge>
          <Badge variant='outline'>Selected: {selectedProjectIds.length}</Badge>
          <Button size='sm' variant='outline' onClick={selectFiltered}>
            Select filtered
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setSelectedProjectIds([])}
          >
            Clear selection
          </Button>
          <Button
            size='sm'
            variant='secondary'
            disabled={bulkWorking}
            onClick={() => void bulkAddSelected()}
          >
            {bulkWorking ? 'Working...' : 'Add selected'}
          </Button>
          <Button
            size='sm'
            variant='destructive'
            disabled={bulkWorking || selectedProjectIds.length === 0}
            onClick={() => setConfirmBulkRemoveOpen(true)}
          >
            {bulkWorking ? 'Working...' : 'Remove selected'}
          </Button>
        </div>

        {error && <p className='text-destructive text-sm'>{error}</p>}

        <div className='max-h-[520px] space-y-2 overflow-auto pr-1'>
          {filteredProjects.map((project) => {
            const isWatched = watchedProjectIds.has(project.id);
            return (
              <div
                key={project.id}
                className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'
              >
                <div className='min-w-0'>
                  <p className='truncate text-sm font-medium'>
                    {project.path_with_namespace}
                  </p>
                  <p className='text-muted-foreground truncate text-xs'>
                    internal #{project.id} | gitlab #{project.gitlab_project_id}
                    {project.default_branch
                      ? ` | ${project.default_branch}`
                      : ''}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    size='sm'
                    variant={
                      selectedProjectIds.includes(project.id)
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => toggleSelectedProject(project.id)}
                  >
                    {selectedProjectIds.includes(project.id)
                      ? 'Selected'
                      : 'Select'}
                  </Button>
                  {isWatched && <Badge variant='secondary'>Watched</Badge>}
                  <Button
                    size='sm'
                    variant='default'
                    disabled={isWatched || workingProjectId === project.id}
                    onClick={async () => {
                      try {
                        setError(null);
                        setWorkingProjectId(project.id);
                        await createWorkspaceWatchlist({
                          project_id: project.id
                        });
                        await loadAll();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : String(err)
                        );
                      } finally {
                        setWorkingProjectId(null);
                      }
                    }}
                  >
                    {workingProjectId === project.id
                      ? 'Adding...'
                      : isWatched
                        ? 'Added'
                        : 'Add to watchlist'}
                  </Button>
                  <Button
                    size='sm'
                    variant='destructive'
                    disabled={!isWatched || workingProjectId === project.id}
                    onClick={() => setPendingRemoveProjectId(project.id)}
                  >
                    {workingProjectId === project.id && isWatched
                      ? 'Removing...'
                      : 'Remove'}
                  </Button>
                </div>
              </div>
            );
          })}
          {filteredProjects.length === 0 && (
            <p className='text-muted-foreground text-sm'>
              Keine Projekte gefunden.
            </p>
          )}
        </div>
      </CardContent>

      <Dialog
        open={confirmBulkRemoveOpen}
        onOpenChange={setConfirmBulkRemoveOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Selected</DialogTitle>
            <DialogDescription>
              Sollten {selectedProjectIds.length} ausgewaehlte Projekte aus der
              Watchlist entfernt werden?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setConfirmBulkRemoveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              disabled={bulkWorking}
              onClick={async () => {
                await bulkRemoveSelected();
                setConfirmBulkRemoveOpen(false);
              }}
            >
              {bulkWorking ? 'Working...' : 'Remove selected'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingRemoveProjectId !== null}
        onOpenChange={(open) => !open && setPendingRemoveProjectId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove From Watchlist</DialogTitle>
            <DialogDescription>
              Dieses Projekt wirklich aus der Watchlist entfernen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setPendingRemoveProjectId(null)}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() =>
                pendingRemoveProjectId !== null &&
                void removeSingleProject(pendingRemoveProjectId)
              }
              disabled={
                pendingRemoveProjectId === null ||
                workingProjectId === pendingRemoveProjectId
              }
            >
              {pendingRemoveProjectId !== null &&
              workingProjectId === pendingRemoveProjectId
                ? 'Removing...'
                : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
