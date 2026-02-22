'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createWorkspaceNote,
  listWorkspaceGroups,
  deleteWorkspaceNote,
  updateWorkspaceNote
} from '@/features/quality-hub/api/client';
import { useWorkspaceNotes } from '@/features/quality-hub/api/swr';
import {
  readActiveWorkspaceContext,
  workspaceSlugFromGroupPath
} from '@/features/quality-hub/workspace-context';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

type NoteVisibility = 'PRIVATE' | 'TEAM';
type NoteScope = 'PROJECT' | 'ENV' | 'CLUSTER';
type VisibilityFilter = 'all' | NoteVisibility;
type ScopeFilter = 'all' | NoteScope;

const PINNED_STORAGE_PREFIX = 'qh.workspace.notes.pinned';
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

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolvePinnedStorageKey() {
  if (typeof window === 'undefined') return `${PINNED_STORAGE_PREFIX}.global`;
  const context = readActiveWorkspaceContext();
  const scope = context.gitlabGroupId
    ? `group:${context.gitlabGroupId}`
    : 'global';
  return `${PINNED_STORAGE_PREFIX}.${scope}`;
}

function readPinnedIds(storageKey: string): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as number[];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => Number.isInteger(id)));
  } catch {
    return new Set();
  }
}

function extractWorkspaceSlugFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  if (segments[0] !== 'dashboard') return null;
  const candidate = segments[1] || null;
  if (!candidate || DASHBOARD_STATIC_SEGMENTS.has(candidate)) return null;
  return candidate;
}

export function WorkspaceNotesManager() {
  const pathname = usePathname();
  const { data: workspaceGroups } = useSWR(
    'quality-hub-workspace-groups-for-notes',
    () => listWorkspaceGroups()
  );
  const activeContext = readActiveWorkspaceContext();
  const workspaceSlugFromPath = useMemo(
    () => extractWorkspaceSlugFromPathname(pathname || ''),
    [pathname]
  );
  const { workspaceId, workspacePath } = useMemo(() => {
    if (workspaceSlugFromPath && workspaceGroups?.length) {
      const matched = workspaceGroups.find(
        (group) =>
          workspaceSlugFromGroupPath(group.gitlab_group_path) ===
          workspaceSlugFromPath
      );
      if (matched) {
        return {
          workspaceId: matched.id,
          workspacePath: matched.gitlab_group_path
        };
      }
    }

    return {
      workspaceId: activeContext.workspaceId,
      workspacePath: activeContext.gitlabGroupPath
    };
  }, [
    activeContext.gitlabGroupPath,
    activeContext.workspaceId,
    workspaceGroups,
    workspaceSlugFromPath
  ]);
  const [visibility, setVisibility] = useState<NoteVisibility>('PRIVATE');
  const [scopeType, setScopeType] = useState<NoteScope>('PROJECT');
  const [content, setContent] = useState('');
  const [teamIdInput, setTeamIdInput] = useState('');
  const [projectIdInput, setProjectIdInput] = useState('');
  const [envInput, setEnvInput] = useState('');
  const [clusterIdInput, setClusterIdInput] = useState('');
  const [filterText, setFilterText] = useState('');
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editVisibility, setEditVisibility] =
    useState<NoteVisibility>('PRIVATE');
  const [editScopeType, setEditScopeType] = useState<NoteScope>('PROJECT');
  const [editTeamIdInput, setEditTeamIdInput] = useState('');
  const [editProjectIdInput, setEditProjectIdInput] = useState('');
  const [editEnvInput, setEditEnvInput] = useState('');
  const [editClusterIdInput, setEditClusterIdInput] = useState('');
  const pinnedStorageKey = useMemo(() => resolvePinnedStorageKey(), []);
  const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<number>>(() =>
    readPinnedIds(pinnedStorageKey)
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useWorkspaceNotes(workspaceId);
  const items = useMemo(() => data ?? [], [data]);

  const persistPinned = (next: Set<number>) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      pinnedStorageKey,
      JSON.stringify(Array.from(next))
    );
  };

  const togglePinned = (id: number) => {
    setPinnedNoteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistPinned(next);
      return next;
    });
  };

  const filteredItems = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    return items
      .filter((item) => {
        if (
          visibilityFilter !== 'all' &&
          item.visibility !== visibilityFilter
        ) {
          return false;
        }
        if (scopeFilter !== 'all' && item.scope_type !== scopeFilter) {
          return false;
        }
        if (!term) return true;
        return (
          item.content.toLowerCase().includes(term) ||
          String(item.id).includes(term) ||
          String(item.project_id ?? '').includes(term) ||
          String(item.team_id ?? '').includes(term) ||
          String(item.env ?? '')
            .toLowerCase()
            .includes(term)
        );
      })
      .sort((a, b) => {
        const aPinned = pinnedNoteIds.has(a.id);
        const bPinned = pinnedNoteIds.has(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return b.id - a.id;
      });
  }, [items, filterText, pinnedNoteIds, scopeFilter, visibilityFilter]);

  const startEdit = (item: (typeof items)[number]) => {
    setEditingId(item.id);
    setEditContent(item.content);
    setEditVisibility(item.visibility === 'TEAM' ? 'TEAM' : 'PRIVATE');
    setEditScopeType(
      item.scope_type === 'ENV'
        ? 'ENV'
        : item.scope_type === 'CLUSTER'
          ? 'CLUSTER'
          : 'PROJECT'
    );
    setEditTeamIdInput(item.team_id ? String(item.team_id) : '');
    setEditProjectIdInput(item.project_id ? String(item.project_id) : '');
    setEditEnvInput(item.env || '');
    setEditClusterIdInput(item.cluster_id ? String(item.cluster_id) : '');
  };

  const errorMessage =
    actionError ||
    (error
      ? error instanceof Error
        ? error.message
        : 'Failed to load notes'
      : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Notes</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 pt-0'>
        <div className='space-y-2 rounded-md border p-3'>
          <Textarea
            placeholder='Write a note for project planning, risks, or handovers...'
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
          />

          <div className='grid gap-2 md:grid-cols-5'>
            <select
              className='border-input bg-background h-9 rounded-md border px-3 text-sm'
              value={visibility}
              onChange={(event) =>
                setVisibility(event.target.value as NoteVisibility)
              }
            >
              <option value='PRIVATE'>PRIVATE</option>
              <option value='TEAM'>TEAM</option>
            </select>

            <select
              className='border-input bg-background h-9 rounded-md border px-3 text-sm'
              value={scopeType}
              onChange={(event) =>
                setScopeType(event.target.value as NoteScope)
              }
            >
              <option value='PROJECT'>PROJECT</option>
              <option value='ENV'>ENV</option>
              <option value='CLUSTER'>CLUSTER</option>
            </select>

            {visibility === 'TEAM' ? (
              <Input
                placeholder='Team ID (optional)'
                value={teamIdInput}
                onChange={(event) => setTeamIdInput(event.target.value)}
              />
            ) : (
              <div />
            )}

            {scopeType === 'PROJECT' && (
              <Input
                placeholder='Project ID (optional)'
                value={projectIdInput}
                onChange={(event) => setProjectIdInput(event.target.value)}
              />
            )}
            {scopeType === 'ENV' && (
              <Input
                placeholder='Environment (e.g. prod)'
                value={envInput}
                onChange={(event) => setEnvInput(event.target.value)}
              />
            )}
            {scopeType === 'CLUSTER' && (
              <Input
                placeholder='Cluster ID (optional)'
                value={clusterIdInput}
                onChange={(event) => setClusterIdInput(event.target.value)}
              />
            )}

            <Button
              onClick={async () => {
                if (!content.trim() || !workspaceId) return;
                try {
                  setActionError(null);
                  await createWorkspaceNote({
                    workspace_id: workspaceId,
                    content: content.trim(),
                    visibility,
                    team_id:
                      visibility === 'TEAM'
                        ? parseOptionalNumber(teamIdInput)
                        : null,
                    scope_type: scopeType,
                    project_id:
                      scopeType === 'PROJECT'
                        ? parseOptionalNumber(projectIdInput)
                        : null,
                    env: scopeType === 'ENV' ? envInput.trim() || null : null,
                    cluster_id:
                      scopeType === 'CLUSTER'
                        ? parseOptionalNumber(clusterIdInput)
                        : null
                  });
                  setContent('');
                  setProjectIdInput('');
                  setEnvInput('');
                  setClusterIdInput('');
                  await mutate();
                } catch (err) {
                  setActionError(
                    err instanceof Error ? err.message : 'Failed to create note'
                  );
                }
              }}
              disabled={!workspaceId}
            >
              Add Note
            </Button>
          </div>
        </div>

        {!workspaceId && (
          <p className='text-sm text-amber-700'>
            Kein aktiver Workspace ausgewaehlt. Bitte Workspace in der Sidebar
            waehlen.
          </p>
        )}
        {workspaceId && (
          <p className='text-muted-foreground text-xs'>
            Scope: {workspacePath || `workspace #${workspaceId}`}
          </p>
        )}

        <div className='flex flex-wrap items-center gap-2'>
          <Input
            className='max-w-sm'
            placeholder='Search by text, note id, project id, team id...'
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
          />
          <select
            className='border-input bg-background h-9 rounded-md border px-3 text-sm'
            value={visibilityFilter}
            onChange={(event) =>
              setVisibilityFilter(event.target.value as VisibilityFilter)
            }
          >
            <option value='all'>All visibility</option>
            <option value='PRIVATE'>PRIVATE</option>
            <option value='TEAM'>TEAM</option>
          </select>
          <select
            className='border-input bg-background h-9 rounded-md border px-3 text-sm'
            value={scopeFilter}
            onChange={(event) =>
              setScopeFilter(event.target.value as ScopeFilter)
            }
          >
            <option value='all'>All scopes</option>
            <option value='PROJECT'>PROJECT</option>
            <option value='ENV'>ENV</option>
            <option value='CLUSTER'>CLUSTER</option>
          </select>
          <Badge variant='outline'>Total: {items.length}</Badge>
          <Badge variant='secondary'>Visible: {filteredItems.length}</Badge>
          <Badge variant='outline'>Pinned: {pinnedNoteIds.size}</Badge>
        </div>

        {isLoading && (
          <p className='text-muted-foreground text-sm'>Loading notes...</p>
        )}
        {errorMessage && (
          <p className='text-destructive text-sm'>{errorMessage}</p>
        )}

        <div className='space-y-2'>
          {filteredItems.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <div key={item.id} className='space-y-2 rounded-md border p-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>#{item.id}</Badge>
                  <Badge
                    variant={
                      item.visibility === 'TEAM' ? 'default' : 'secondary'
                    }
                  >
                    {item.visibility}
                  </Badge>
                  <Badge variant='outline'>{item.scope_type}</Badge>
                  {item.project_id && (
                    <Badge variant='outline'>Project {item.project_id}</Badge>
                  )}
                  {item.team_id && (
                    <Badge variant='outline'>Team {item.team_id}</Badge>
                  )}
                  {item.env && <Badge variant='outline'>env {item.env}</Badge>}
                  {item.cluster_id && (
                    <Badge variant='outline'>cluster {item.cluster_id}</Badge>
                  )}
                  <Button
                    size='sm'
                    variant={pinnedNoteIds.has(item.id) ? 'default' : 'outline'}
                    onClick={() => togglePinned(item.id)}
                  >
                    {pinnedNoteIds.has(item.id) ? 'Pinned' : 'Pin'}
                  </Button>
                </div>

                {isEditing ? (
                  <div className='space-y-2'>
                    <Textarea
                      rows={4}
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                    />
                    <div className='grid gap-2 md:grid-cols-5'>
                      <select
                        className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                        value={editVisibility}
                        onChange={(event) =>
                          setEditVisibility(
                            event.target.value as NoteVisibility
                          )
                        }
                      >
                        <option value='PRIVATE'>PRIVATE</option>
                        <option value='TEAM'>TEAM</option>
                      </select>

                      <select
                        className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                        value={editScopeType}
                        onChange={(event) =>
                          setEditScopeType(event.target.value as NoteScope)
                        }
                      >
                        <option value='PROJECT'>PROJECT</option>
                        <option value='ENV'>ENV</option>
                        <option value='CLUSTER'>CLUSTER</option>
                      </select>

                      {editVisibility === 'TEAM' ? (
                        <Input
                          placeholder='Team ID (optional)'
                          value={editTeamIdInput}
                          onChange={(event) =>
                            setEditTeamIdInput(event.target.value)
                          }
                        />
                      ) : (
                        <div />
                      )}

                      {editScopeType === 'PROJECT' && (
                        <Input
                          placeholder='Project ID (optional)'
                          value={editProjectIdInput}
                          onChange={(event) =>
                            setEditProjectIdInput(event.target.value)
                          }
                        />
                      )}
                      {editScopeType === 'ENV' && (
                        <Input
                          placeholder='Environment (e.g. prod)'
                          value={editEnvInput}
                          onChange={(event) =>
                            setEditEnvInput(event.target.value)
                          }
                        />
                      )}
                      {editScopeType === 'CLUSTER' && (
                        <Input
                          placeholder='Cluster ID (optional)'
                          value={editClusterIdInput}
                          onChange={(event) =>
                            setEditClusterIdInput(event.target.value)
                          }
                        />
                      )}
                    </div>

                    <div className='flex gap-2'>
                      <Button
                        size='sm'
                        disabled={!workspaceId}
                        onClick={async () => {
                          if (!editContent.trim() || !workspaceId) return;
                          try {
                            setActionError(null);
                            await updateWorkspaceNote(item.id, workspaceId, {
                              content: editContent.trim(),
                              visibility: editVisibility,
                              team_id:
                                editVisibility === 'TEAM'
                                  ? parseOptionalNumber(editTeamIdInput)
                                  : null,
                              scope_type: editScopeType,
                              project_id:
                                editScopeType === 'PROJECT'
                                  ? parseOptionalNumber(editProjectIdInput)
                                  : null,
                              env:
                                editScopeType === 'ENV'
                                  ? editEnvInput.trim() || null
                                  : null,
                              cluster_id:
                                editScopeType === 'CLUSTER'
                                  ? parseOptionalNumber(editClusterIdInput)
                                  : null
                            });
                            setEditingId(null);
                            await mutate();
                          } catch (err) {
                            setActionError(
                              err instanceof Error
                                ? err.message
                                : 'Failed to update note'
                            );
                          }
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className='text-sm whitespace-pre-wrap'>{item.content}</p>
                )}

                {!isEditing && (
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      size='sm'
                      variant='destructive'
                      onClick={async () => {
                        if (!workspaceId) return;
                        const confirmed = window.confirm(
                          `Delete note #${item.id}?`
                        );
                        if (!confirmed) return;
                        try {
                          setActionError(null);
                          await deleteWorkspaceNote(item.id, workspaceId);
                          if (pinnedNoteIds.has(item.id)) {
                            const next = new Set(pinnedNoteIds);
                            next.delete(item.id);
                            setPinnedNoteIds(next);
                            persistPinned(next);
                          }
                          await mutate();
                        } catch (err) {
                          setActionError(
                            err instanceof Error
                              ? err.message
                              : 'Failed to delete note'
                          );
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredItems.length === 0 && (
            <p className='text-muted-foreground text-sm'>No notes found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
