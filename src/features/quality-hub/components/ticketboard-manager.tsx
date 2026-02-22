'use client';

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
import { KanbanBoard } from '@/features/kanban/components';
import NewTaskDialog from '@/features/kanban/components/new-task-dialog';
import { Status, useTaskStore } from '@/features/kanban/utils/store';
import { readActiveWorkspaceContext } from '@/features/quality-hub/workspace-context';
import { useEffect, useMemo, useRef, useState } from 'react';

type TicketTemplate = {
  id: string;
  name: string;
  description: string;
  tasks: Array<{ title: string; description: string; status: Status }>;
};

const TEMPLATES: TicketTemplate[] = [
  {
    id: 'incident',
    name: 'Incident Board',
    description: 'Hotfix, owner assignment and postmortem follow-up.',
    tasks: [
      {
        title: 'Incident triage',
        description: 'Assess impact and severity',
        status: 'TODO'
      },
      {
        title: 'Assign owner + backup',
        description: 'Single point of contact',
        status: 'IN_PROGRESS'
      },
      {
        title: 'Customer communication',
        description: 'Status update for stakeholders',
        status: 'TODO'
      },
      {
        title: 'Postmortem draft',
        description: 'Timeline, root cause, actions',
        status: 'DONE'
      }
    ]
  },
  {
    id: 'release',
    name: 'Release Board',
    description: 'Release readiness, QA, deployment and rollback checks.',
    tasks: [
      {
        title: 'Freeze scope',
        description: 'Lock release content',
        status: 'TODO'
      },
      {
        title: 'QA sign-off',
        description: 'Run regression suite',
        status: 'IN_PROGRESS'
      },
      {
        title: 'Deploy to production',
        description: 'Execute release plan',
        status: 'TODO'
      },
      {
        title: 'Rollback validation',
        description: 'Check fallback path',
        status: 'TODO'
      }
    ]
  },
  {
    id: 'ops',
    name: 'Ops Leadership Board',
    description: 'Cross-team operational priorities and blockers.',
    tasks: [
      {
        title: 'Pipeline reliability initiative',
        description: 'Reduce failed runs by 30%',
        status: 'IN_PROGRESS'
      },
      {
        title: 'Top 5 blocking MRs',
        description: 'Escalate and unblock',
        status: 'TODO'
      },
      {
        title: 'Monthly risk review',
        description: 'Review attention=high projects',
        status: 'TODO'
      }
    ]
  }
];

const BOARD_STORAGE_KEY = 'qh.ticketboard.snapshots.v1';

type BoardSnapshot = {
  tasks: ReturnType<typeof useTaskStore.getState>['tasks'];
  columns: ReturnType<typeof useTaskStore.getState>['columns'];
};

export function TicketboardManager() {
  const tasks = useTaskStore((state) => state.tasks);
  const columns = useTaskStore((state) => state.columns);
  const setTasks = useTaskStore((state) => state.setTasks);
  const setCols = useTaskStore((state) => state.setCols);
  const [workspaceGroupId, setWorkspaceGroupId] = useState<number | null>(null);
  const [workspaceGroupPath, setWorkspaceGroupPath] = useState<string | null>(
    null
  );
  const [scopeKey, setScopeKey] = useState<string>('global');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const hydratingRef = useRef(false);
  const hasMountedRef = useRef(false);

  const stats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((task) => task.status === 'TODO').length;
    const inProgress = tasks.filter(
      (task) => task.status === 'IN_PROGRESS'
    ).length;
    const done = tasks.filter((task) => task.status === 'DONE').length;
    return { total, todo, inProgress, done };
  }, [tasks]);

  const applyTemplate = (template: TicketTemplate) => {
    setCols([
      { id: 'TODO', title: 'Todo' },
      { id: 'IN_PROGRESS', title: 'In Progress' },
      { id: 'DONE', title: 'Done' }
    ]);
    setTasks(
      template.tasks.map((task, index) => ({
        id: `${template.id}-${index + 1}-${Date.now()}`,
        title: task.title,
        description: task.description,
        status: task.status
      }))
    );
  };

  const clearBoard = () => {
    setCols([
      { id: 'TODO', title: 'Todo' },
      { id: 'IN_PROGRESS', title: 'In Progress' },
      { id: 'DONE', title: 'Done' }
    ]);
    setTasks([]);
  };

  useEffect(() => {
    const context = readActiveWorkspaceContext();
    setWorkspaceGroupId(context.gitlabGroupId);
    setWorkspaceGroupPath(context.gitlabGroupPath);
    setScopeKey(
      context.gitlabGroupId ? `group:${context.gitlabGroupId}` : 'global'
    );
  }, []);

  useEffect(() => {
    if (!scopeKey) return;
    hydratingRef.current = true;
    try {
      const raw = window.localStorage.getItem(BOARD_STORAGE_KEY);
      if (!raw) {
        setCols([
          { id: 'TODO', title: 'Todo' },
          { id: 'IN_PROGRESS', title: 'In Progress' },
          { id: 'DONE', title: 'Done' }
        ]);
        setTasks([]);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, BoardSnapshot>;
      const snapshot = parsed[scopeKey];
      if (!snapshot) {
        setCols([
          { id: 'TODO', title: 'Todo' },
          { id: 'IN_PROGRESS', title: 'In Progress' },
          { id: 'DONE', title: 'Done' }
        ]);
        setTasks([]);
        return;
      }
      setCols(snapshot.columns);
      setTasks(snapshot.tasks);
    } catch {
      setCols([
        { id: 'TODO', title: 'Todo' },
        { id: 'IN_PROGRESS', title: 'In Progress' },
        { id: 'DONE', title: 'Done' }
      ]);
      setTasks([]);
    } finally {
      hasMountedRef.current = true;
      setTimeout(() => {
        hydratingRef.current = false;
      }, 0);
    }
  }, [scopeKey, setCols, setTasks]);

  useEffect(() => {
    if (!hasMountedRef.current || hydratingRef.current) return;
    try {
      const raw = window.localStorage.getItem(BOARD_STORAGE_KEY);
      const parsed = raw
        ? (JSON.parse(raw) as Record<string, BoardSnapshot>)
        : {};
      parsed[scopeKey] = { tasks, columns };
      window.localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore storage write errors
    }
  }, [columns, scopeKey, tasks]);

  return (
    <Card>
      <CardHeader className='gap-2'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle>Ticketboard</CardTitle>
          <NewTaskDialog />
        </div>
        <p className='text-muted-foreground text-sm'>
          Erstelle Tickets direkt hier und starte mit Board-Templates für
          Incident, Release oder Operations.
        </p>
        <p className='text-muted-foreground text-xs'>
          Scope:{' '}
          {workspaceGroupId
            ? workspaceGroupPath || `group #${workspaceGroupId}`
            : 'global'}
        </p>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='rounded-md border px-2 py-1 text-xs'>
            Total: {stats.total}
          </span>
          <span className='rounded-md border px-2 py-1 text-xs'>
            Todo: {stats.todo}
          </span>
          <span className='rounded-md border px-2 py-1 text-xs'>
            In Progress: {stats.inProgress}
          </span>
          <span className='rounded-md border px-2 py-1 text-xs'>
            Done: {stats.done}
          </span>
          <Button
            size='sm'
            variant='destructive'
            onClick={() => setConfirmClearOpen(true)}
          >
            Clear board
          </Button>
        </div>

        <div className='grid gap-2 md:grid-cols-3'>
          {TEMPLATES.map((template) => (
            <div key={template.id} className='rounded-md border p-3'>
              <p className='text-sm font-medium'>{template.name}</p>
              <p className='text-muted-foreground mt-1 text-xs'>
                {template.description}
              </p>
              <Button
                className='mt-2 w-full'
                size='sm'
                variant='outline'
                onClick={() => applyTemplate(template)}
              >
                Use template
              </Button>
            </div>
          ))}
        </div>

        <KanbanBoard />
      </CardContent>

      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Ticketboard</DialogTitle>
            <DialogDescription>
              Willst du wirklich alle Tickets im aktuellen Scope entfernen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setConfirmClearOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                clearBoard();
                setConfirmClearOpen(false);
              }}
            >
              Clear board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
