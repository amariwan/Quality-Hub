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
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createGitlabIssue,
  listGitlabIssues,
  listGitlabProjects
} from '@/features/quality-hub/api/client';
import { GitlabIssue, GitlabProject } from '@/features/quality-hub/types';
import { readActiveWorkspaceContext } from '@/features/quality-hub/workspace-context';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type BoardStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
type BoardFilter = 'all' | BoardStatus;
type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
type PriorityFilter = 'all' | PriorityLevel;
type SortMode = 'updated_desc' | 'due_date_asc' | 'priority_desc';

type AnnotatedIssue = {
  issue: GitlabIssue;
  boardStatus: BoardStatus;
  priority: PriorityLevel;
  dueDate: Date | null;
  isOverdue: boolean;
  isDueSoon: boolean;
};

function toBoardStatus(issue: GitlabIssue): BoardStatus {
  if ((issue.state || '').toLowerCase() === 'closed') return 'DONE';

  const labels = new Set(issue.labels.map((label) => label.toLowerCase()));
  if (
    labels.has('in_progress') ||
    labels.has('in-progress') ||
    labels.has('doing') ||
    labels.has('wip') ||
    labels.has('status::in_progress')
  ) {
    return 'IN_PROGRESS';
  }

  return 'TODO';
}

function toPriority(issue: GitlabIssue): PriorityLevel {
  const labels = issue.labels.map((label) => label.toLowerCase());
  if (
    labels.some((label) =>
      [
        'priority::high',
        'priority:high',
        'prio::high',
        'p1',
        'severity::high'
      ].includes(label)
    )
  ) {
    return 'HIGH';
  }

  if (
    labels.some((label) =>
      [
        'priority::medium',
        'priority:medium',
        'prio::medium',
        'p2',
        'severity::medium'
      ].includes(label)
    )
  ) {
    return 'MEDIUM';
  }

  if (
    labels.some((label) =>
      [
        'priority::low',
        'priority:low',
        'prio::low',
        'p3',
        'severity::low'
      ].includes(label)
    )
  ) {
    return 'LOW';
  }

  return 'NONE';
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const withTime = raw.length <= 10 ? `${raw}T00:00:00` : raw;
  const date = new Date(withTime);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(raw: string | null | undefined): string {
  const parsed = parseDate(raw);
  if (!parsed) return '-';
  return parsed.toLocaleDateString();
}

function priorityRank(priority: PriorityLevel): number {
  if (priority === 'HIGH') return 3;
  if (priority === 'MEDIUM') return 2;
  if (priority === 'LOW') return 1;
  return 0;
}

function priorityBadgeVariant(
  priority: PriorityLevel
): 'destructive' | 'default' | 'secondary' | 'outline' {
  if (priority === 'HIGH') return 'destructive';
  if (priority === 'MEDIUM') return 'default';
  if (priority === 'LOW') return 'secondary';
  return 'outline';
}

function boardLabel(status: BoardStatus): string {
  if (status === 'IN_PROGRESS') return 'In Progress';
  if (status === 'DONE') return 'Done';
  return 'Todo';
}

export function TicketboardManager() {
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groupPath, setGroupPath] = useState<string | null>(null);

  const [issues, setIssues] = useState<GitlabIssue[]>([]);
  const [projects, setProjects] = useState<GitlabProject[]>([]);
  const [stateFilter, setStateFilter] = useState<'opened' | 'closed' | 'all'>(
    'opened'
  );
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('updated_desc');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [createProjectId, setCreateProjectId] = useState<number | null>(null);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createLabels, setCreateLabels] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createPriority, setCreatePriority] = useState<
    'none' | 'high' | 'medium' | 'low'
  >('none');
  const [createBoardStatus, setCreateBoardStatus] = useState<
    'TODO' | 'IN_PROGRESS'
  >('TODO');
  const [creatingIssue, setCreatingIssue] = useState(false);

  useEffect(() => {
    const context = readActiveWorkspaceContext();
    setGroupId(context.gitlabGroupId);
    setGroupPath(context.gitlabGroupPath);
  }, []);

  const loadData = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      setError(null);

      const [issuesRes, projectsRes] = await Promise.all([
        listGitlabIssues({
          groupId,
          state: stateFilter,
          search: search || undefined
        }),
        listGitlabProjects(groupId)
      ]);

      setIssues(issuesRes.items);
      setProjects(projectsRes);
      setCreateProjectId((current) => current ?? projectsRes[0]?.id ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load GitLab tickets'
      );
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, search, stateFilter]);

  useEffect(() => {
    if (!groupId) return;
    void loadData();
  }, [groupId, loadData]);

  const annotatedIssues = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return issues.map((issue) => {
      const boardStatus = toBoardStatus(issue);
      const priority = toPriority(issue);
      const dueDate = parseDate(issue.due_date);
      const isOpen = boardStatus !== 'DONE';
      const isOverdue = Boolean(
        isOpen && dueDate && dueDate.getTime() < today.getTime()
      );
      const isDueSoon = Boolean(
        isOpen &&
        dueDate &&
        dueDate.getTime() >= today.getTime() &&
        dueDate.getTime() <= nextWeek.getTime()
      );

      return {
        issue,
        boardStatus,
        priority,
        dueDate,
        isOverdue,
        isDueSoon
      } satisfies AnnotatedIssue;
    });
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return annotatedIssues.filter((item) => {
      if (boardFilter !== 'all' && item.boardStatus !== boardFilter)
        return false;
      if (priorityFilter !== 'all' && item.priority !== priorityFilter)
        return false;
      return true;
    });
  }, [annotatedIssues, boardFilter, priorityFilter]);

  const sortedIssues = useMemo(() => {
    return [...filteredIssues].sort((a, b) => {
      if (sortMode === 'priority_desc') {
        const priorityDiff =
          priorityRank(b.priority) - priorityRank(a.priority);
        if (priorityDiff !== 0) return priorityDiff;
      }

      if (sortMode === 'due_date_asc') {
        if (a.dueDate && b.dueDate) {
          const dueDiff = a.dueDate.getTime() - b.dueDate.getTime();
          if (dueDiff !== 0) return dueDiff;
        } else if (a.dueDate && !b.dueDate) {
          return -1;
        } else if (!a.dueDate && b.dueDate) {
          return 1;
        }
      }

      const updatedA = parseDate(a.issue.updated_at)?.getTime() || 0;
      const updatedB = parseDate(b.issue.updated_at)?.getTime() || 0;
      return updatedB - updatedA;
    });
  }, [filteredIssues, sortMode]);

  const allStats = useMemo(() => {
    return {
      total: annotatedIssues.length,
      todo: annotatedIssues.filter((item) => item.boardStatus === 'TODO')
        .length,
      inProgress: annotatedIssues.filter(
        (item) => item.boardStatus === 'IN_PROGRESS'
      ).length,
      done: annotatedIssues.filter((item) => item.boardStatus === 'DONE')
        .length,
      highPriority: annotatedIssues.filter((item) => item.priority === 'HIGH')
        .length,
      overdue: annotatedIssues.filter((item) => item.isOverdue).length,
      dueSoon: annotatedIssues.filter((item) => item.isDueSoon).length
    };
  }, [annotatedIssues]);

  const visibleStats = useMemo(() => {
    return {
      total: sortedIssues.length,
      todo: sortedIssues.filter((item) => item.boardStatus === 'TODO').length,
      inProgress: sortedIssues.filter(
        (item) => item.boardStatus === 'IN_PROGRESS'
      ).length,
      done: sortedIssues.filter((item) => item.boardStatus === 'DONE').length
    };
  }, [sortedIssues]);

  const boardColumns = useMemo(() => {
    const grouped = {
      TODO: [] as AnnotatedIssue[],
      IN_PROGRESS: [] as AnnotatedIssue[],
      DONE: [] as AnnotatedIssue[]
    };
    for (const item of sortedIssues) {
      grouped[item.boardStatus].push(item);
    }
    return grouped;
  }, [sortedIssues]);

  const createIssue = async () => {
    if (!createProjectId || !createTitle.trim()) return;
    try {
      setCreatingIssue(true);
      setError(null);

      const manualLabels = createLabels
        .split(',')
        .map((label) => label.trim())
        .filter(Boolean);

      const generatedLabels: string[] = [];
      if (createPriority !== 'none') {
        generatedLabels.push(`priority::${createPriority}`);
      }
      if (createBoardStatus === 'IN_PROGRESS') {
        generatedLabels.push('status::in_progress');
      }

      await createGitlabIssue({
        project_id: createProjectId,
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        labels: Array.from(new Set([...manualLabels, ...generatedLabels])),
        due_date: createDueDate || undefined
      });

      setCreateTitle('');
      setCreateDescription('');
      setCreateLabels('');
      setCreateDueDate('');
      setCreatePriority('none');
      setCreateBoardStatus('TODO');
      setCreateIssueOpen(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create GitLab issue'
      );
    } finally {
      setCreatingIssue(false);
    }
  };

  const renderBoardCard = (item: AnnotatedIssue, keySuffix: string) => {
    const key = `${keySuffix}-${item.issue.project_id}-${item.issue.iid}-${item.issue.id}`;

    return (
      <div key={key} className='rounded border p-2'>
        <div className='flex flex-wrap items-center gap-1'>
          <Badge variant='outline'>#{item.issue.iid ?? '-'}</Badge>
          {item.priority !== 'NONE' && (
            <Badge variant={priorityBadgeVariant(item.priority)}>
              {item.priority}
            </Badge>
          )}
          {item.isOverdue && <Badge variant='destructive'>Overdue</Badge>}
          {!item.isOverdue && item.isDueSoon && (
            <Badge variant='secondary'>Due soon</Badge>
          )}
        </div>
        <p className='mt-2 text-sm font-medium'>
          {item.issue.title || '(untitled)'}
        </p>
        <p className='text-muted-foreground mt-1 text-xs'>
          {item.issue.project_id ? `Project ${item.issue.project_id}` : '-'}
        </p>
        <p className='text-muted-foreground mt-1 text-xs'>
          Due: {formatDate(item.issue.due_date)}
        </p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className='gap-2'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle>Workspace Tickets Board (GitLab)</CardTitle>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              onClick={() => void loadData()}
              disabled={loading || !groupId}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>

            <Dialog open={createIssueOpen} onOpenChange={setCreateIssueOpen}>
              <DialogTrigger asChild>
                <Button>Create GitLab Issue</Button>
              </DialogTrigger>
              <DialogContent className='sm:max-w-[640px]'>
                <DialogHeader>
                  <DialogTitle>Create issue in GitLab</DialogTitle>
                  <DialogDescription>
                    Ticket mit Prioritaet, Board-Status und optionalem Due-Date.
                  </DialogDescription>
                </DialogHeader>

                <div className='space-y-3'>
                  <select
                    className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                    value={createProjectId ?? ''}
                    onChange={(event) =>
                      setCreateProjectId(Number(event.target.value) || null)
                    }
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.path_with_namespace || project.name}
                      </option>
                    ))}
                  </select>

                  <Input
                    value={createTitle}
                    onChange={(event) => setCreateTitle(event.target.value)}
                    placeholder='Issue title'
                  />

                  <Textarea
                    value={createDescription}
                    onChange={(event) =>
                      setCreateDescription(event.target.value)
                    }
                    placeholder='Description (optional)'
                    rows={5}
                  />

                  <div className='grid gap-2 md:grid-cols-3'>
                    <select
                      className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                      value={createPriority}
                      onChange={(event) =>
                        setCreatePriority(
                          event.target.value as
                            | 'none'
                            | 'high'
                            | 'medium'
                            | 'low'
                        )
                      }
                    >
                      <option value='none'>No priority label</option>
                      <option value='high'>Priority high</option>
                      <option value='medium'>Priority medium</option>
                      <option value='low'>Priority low</option>
                    </select>

                    <select
                      className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                      value={createBoardStatus}
                      onChange={(event) =>
                        setCreateBoardStatus(
                          event.target.value as 'TODO' | 'IN_PROGRESS'
                        )
                      }
                    >
                      <option value='TODO'>Todo</option>
                      <option value='IN_PROGRESS'>In Progress</option>
                    </select>

                    <Input
                      type='date'
                      value={createDueDate}
                      onChange={(event) => setCreateDueDate(event.target.value)}
                    />
                  </div>

                  <Input
                    value={createLabels}
                    onChange={(event) => setCreateLabels(event.target.value)}
                    placeholder='Additional labels (comma separated), e.g. backend,bug'
                  />
                </div>

                <DialogFooter>
                  <Button
                    variant='outline'
                    onClick={() => setCreateIssueOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={
                      creatingIssue || !createProjectId || !createTitle.trim()
                    }
                    onClick={() => void createIssue()}
                  >
                    {creatingIssue ? 'Creating...' : 'Create in GitLab'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <p className='text-muted-foreground text-sm'>
          Board und Ticketliste verwenden dieselben GitLab-Issues.
        </p>

        <p className='text-muted-foreground text-xs'>
          Scope:{' '}
          {groupId
            ? groupPath || `group #${groupId}`
            : 'Kein Workspace-Group Context'}
        </p>
      </CardHeader>

      <CardContent className='space-y-4'>
        {!groupId && (
          <p className='text-sm text-amber-700'>
            Bitte zuerst eine Workspace Group waehlen.
          </p>
        )}

        {groupId && (
          <>
            <div className='grid gap-2 md:grid-cols-[160px_160px_180px_180px_1fr]'>
              <select
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                value={stateFilter}
                onChange={(event) =>
                  setStateFilter(
                    event.target.value as 'opened' | 'closed' | 'all'
                  )
                }
              >
                <option value='opened'>Opened</option>
                <option value='closed'>Closed</option>
                <option value='all'>All</option>
              </select>

              <select
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                value={boardFilter}
                onChange={(event) =>
                  setBoardFilter(event.target.value as BoardFilter)
                }
              >
                <option value='all'>All board status</option>
                <option value='TODO'>Todo</option>
                <option value='IN_PROGRESS'>In Progress</option>
                <option value='DONE'>Done</option>
              </select>

              <select
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as PriorityFilter)
                }
              >
                <option value='all'>All priorities</option>
                <option value='HIGH'>High</option>
                <option value='MEDIUM'>Medium</option>
                <option value='LOW'>Low</option>
                <option value='NONE'>No priority</option>
              </select>

              <select
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as SortMode)
                }
              >
                <option value='updated_desc'>Sort: recently updated</option>
                <option value='due_date_asc'>Sort: nearest due date</option>
                <option value='priority_desc'>Sort: highest priority</option>
              </select>

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='Search title/description'
              />
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <span className='rounded-md border px-2 py-1 text-xs'>
                Total: {allStats.total}
              </span>
              <span className='rounded-md border px-2 py-1 text-xs'>
                Todo: {allStats.todo}
              </span>
              <span className='rounded-md border px-2 py-1 text-xs'>
                In Progress: {allStats.inProgress}
              </span>
              <span className='rounded-md border px-2 py-1 text-xs'>
                Done: {allStats.done}
              </span>
              <span className='rounded-md border px-2 py-1 text-xs'>
                High priority: {allStats.highPriority}
              </span>
              <span className='rounded-md border px-2 py-1 text-xs'>
                Overdue: {allStats.overdue}
              </span>
              <span className='rounded-md border px-2 py-1 text-xs'>
                Due in 7d: {allStats.dueSoon}
              </span>
              <span className='bg-muted rounded-md border px-2 py-1 text-xs'>
                Visible after filters: {visibleStats.total}
              </span>
            </div>

            {error && <p className='text-destructive text-sm'>{error}</p>}

            <div className='grid gap-3 md:grid-cols-3'>
              <div className='rounded-md border p-3'>
                <p className='mb-2 text-sm font-medium'>
                  {boardLabel('TODO')} ({visibleStats.todo})
                </p>
                <div className='space-y-2'>
                  {boardColumns.TODO.length === 0 && (
                    <p className='text-muted-foreground text-xs'>No issues</p>
                  )}
                  {boardColumns.TODO.map((item, index) =>
                    renderBoardCard(item, `todo-${index}`)
                  )}
                </div>
              </div>

              <div className='rounded-md border p-3'>
                <p className='mb-2 text-sm font-medium'>
                  {boardLabel('IN_PROGRESS')} ({visibleStats.inProgress})
                </p>
                <div className='space-y-2'>
                  {boardColumns.IN_PROGRESS.length === 0 && (
                    <p className='text-muted-foreground text-xs'>No issues</p>
                  )}
                  {boardColumns.IN_PROGRESS.map((item, index) =>
                    renderBoardCard(item, `in-progress-${index}`)
                  )}
                </div>
              </div>

              <div className='rounded-md border p-3'>
                <p className='mb-2 text-sm font-medium'>
                  {boardLabel('DONE')} ({visibleStats.done})
                </p>
                <div className='space-y-2'>
                  {boardColumns.DONE.length === 0 && (
                    <p className='text-muted-foreground text-xs'>No issues</p>
                  )}
                  {boardColumns.DONE.map((item, index) =>
                    renderBoardCard(item, `done-${index}`)
                  )}
                </div>
              </div>
            </div>

            <div className='space-y-2'>
              <p className='text-muted-foreground text-sm'>
                {sortedIssues.length} issue
                {sortedIssues.length === 1 ? '' : 's'}
              </p>

              {loading && (
                <p className='text-muted-foreground text-sm'>
                  Loading issues...
                </p>
              )}

              {!loading && sortedIssues.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No issues found.
                </p>
              )}

              {!loading &&
                sortedIssues.map((item, index) => (
                  <div
                    key={`${item.issue.project_id}-${item.issue.iid}-${item.issue.id}-${index}`}
                    className='rounded-md border p-3'
                  >
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='outline'>#{item.issue.iid ?? '-'}</Badge>
                      <Badge
                        variant={
                          item.issue.state === 'opened'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {item.issue.state || 'unknown'}
                      </Badge>
                      <Badge variant='outline'>
                        {boardLabel(item.boardStatus)}
                      </Badge>
                      {item.priority !== 'NONE' && (
                        <Badge variant={priorityBadgeVariant(item.priority)}>
                          Priority: {item.priority}
                        </Badge>
                      )}
                      {item.isOverdue && (
                        <Badge variant='destructive'>Overdue</Badge>
                      )}
                      {!item.isOverdue && item.isDueSoon && (
                        <Badge variant='secondary'>Due soon</Badge>
                      )}
                      {item.issue.labels.map((label) => (
                        <Badge
                          key={`${item.issue.id}-${label}`}
                          variant='outline'
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>

                    <p className='mt-2 text-sm font-medium'>
                      {item.issue.title || '(untitled)'}
                    </p>

                    {item.issue.description && (
                      <p className='text-muted-foreground mt-1 line-clamp-3 text-xs'>
                        {item.issue.description}
                      </p>
                    )}

                    <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-3 text-xs'>
                      <span>Author: {item.issue.author || '-'}</span>
                      <span>
                        Assignees:{' '}
                        {item.issue.assignees.length > 0
                          ? item.issue.assignees.join(', ')
                          : '-'}
                      </span>
                      <span>Due: {formatDate(item.issue.due_date)}</span>
                      <span>Updated: {formatDate(item.issue.updated_at)}</span>
                      {item.issue.web_url && (
                        <Link
                          href={item.issue.web_url}
                          target='_blank'
                          className='underline'
                        >
                          Open in GitLab
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
