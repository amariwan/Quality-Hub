'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Priority, Status, Task } from '../utils/store';

type SortMode = 'created_desc' | 'due_asc' | 'priority_desc';

export type KanbanFilters = {
  query: string;
  assignee: string;
  status: Status | 'ALL';
  priority: Priority | 'ALL';
  blockedOnly: boolean;
  overdueOnly: boolean;
  sortBy: SortMode;
};

const defaultFilters: KanbanFilters = {
  query: '',
  assignee: '',
  status: 'ALL',
  priority: 'ALL',
  blockedOnly: false,
  overdueOnly: false,
  sortBy: 'created_desc'
};

export function KanbanToolbar({
  columns,
  filters,
  onChange,
  total,
  visible,
  overdue,
  blocked
}: {
  columns: Array<{ id: string; title: string }>;
  filters: KanbanFilters;
  onChange: (next: KanbanFilters) => void;
  total: number;
  visible: number;
  overdue: number;
  blocked: number;
}) {
  const set = (patch: Partial<KanbanFilters>) =>
    onChange({ ...filters, ...patch });

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex flex-wrap items-center gap-2 text-xs'>
        <span className='rounded border px-2 py-1'>Visible: {visible}</span>
        <span className='rounded border px-2 py-1'>Total: {total}</span>
        <span className='rounded border px-2 py-1'>Blocked: {blocked}</span>
        <span className='rounded border px-2 py-1'>Overdue: {overdue}</span>
      </div>

      <div className='grid gap-2 lg:grid-cols-6'>
        <Input
          placeholder='Search title/description/labels'
          value={filters.query}
          onChange={(event) => set({ query: event.target.value })}
          className='lg:col-span-2'
        />
        <Input
          placeholder='Assignee'
          value={filters.assignee}
          onChange={(event) => set({ assignee: event.target.value })}
        />

        <select
          className='border-input bg-background ring-offset-background h-9 rounded-md border px-3 text-sm'
          value={filters.status}
          onChange={(event) =>
            set({ status: event.target.value as KanbanFilters['status'] })
          }
        >
          <option value='ALL'>All status</option>
          {columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title}
            </option>
          ))}
        </select>

        <select
          className='border-input bg-background ring-offset-background h-9 rounded-md border px-3 text-sm'
          value={filters.priority}
          onChange={(event) =>
            set({ priority: event.target.value as KanbanFilters['priority'] })
          }
        >
          <option value='ALL'>All priority</option>
          <option value='CRITICAL'>Critical</option>
          <option value='HIGH'>High</option>
          <option value='MEDIUM'>Medium</option>
          <option value='LOW'>Low</option>
        </select>

        <select
          className='border-input bg-background ring-offset-background h-9 rounded-md border px-3 text-sm'
          value={filters.sortBy}
          onChange={(event) =>
            set({ sortBy: event.target.value as KanbanFilters['sortBy'] })
          }
        >
          <option value='created_desc'>Sort: Newest</option>
          <option value='priority_desc'>Sort: Priority</option>
          <option value='due_asc'>Sort: Due Date</option>
        </select>
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          size='sm'
          variant={filters.blockedOnly ? 'default' : 'outline'}
          onClick={() => set({ blockedOnly: !filters.blockedOnly })}
        >
          Blocked only
        </Button>
        <Button
          size='sm'
          variant={filters.overdueOnly ? 'default' : 'outline'}
          onClick={() => set({ overdueOnly: !filters.overdueOnly })}
        >
          Overdue only
        </Button>
        <Button
          size='sm'
          variant='ghost'
          onClick={() => onChange(defaultFilters)}
        >
          Reset filters
        </Button>
      </div>
    </div>
  );
}

export function filterAndSortTasks(
  tasks: Task[],
  filters: KanbanFilters,
  isOverdue: (task: Task) => boolean,
  priorityWeight: Record<Priority, number>
): Task[] {
  const query = filters.query.trim().toLowerCase();
  const assignee = filters.assignee.trim().toLowerCase();

  const filtered = tasks.filter((task) => {
    if (filters.status !== 'ALL' && task.status !== filters.status)
      return false;
    if (filters.priority !== 'ALL' && task.priority !== filters.priority)
      return false;
    if (filters.blockedOnly && !task.blocked) return false;
    if (filters.overdueOnly && !isOverdue(task)) return false;
    if (
      assignee &&
      !String(task.assignee ?? '')
        .toLowerCase()
        .includes(assignee)
    ) {
      return false;
    }

    if (!query) return true;

    const haystack = [
      task.title,
      task.description ?? '',
      task.assignee ?? '',
      task.labels.join(' ')
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  return filtered.sort((a, b) => {
    if (filters.sortBy === 'priority_desc') {
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    }
    if (filters.sortBy === 'due_asc') {
      const aDue = a.dueDate
        ? new Date(a.dueDate).getTime()
        : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate
        ? new Date(b.dueDate).getTime()
        : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
