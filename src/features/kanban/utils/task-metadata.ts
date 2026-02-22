import type { Priority, Task } from './store';

export const PRIORITY_ORDER: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export const priorityWeight: Record<Priority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

export const priorityLabel: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical'
};

export const priorityBadgeClass: Record<Priority, string> = {
  LOW: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  MEDIUM: 'border-blue-300 bg-blue-50 text-blue-700',
  HIGH: 'border-amber-300 bg-amber-50 text-amber-700',
  CRITICAL: 'border-red-300 bg-red-50 text-red-700'
};

export function normalizeLabels(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((label, index, arr) => arr.indexOf(label) === index)
    .slice(0, 8);
}

export function isTaskOverdue(task: Task, reference = new Date()): boolean {
  if (!task.dueDate || task.status === 'DONE') return false;
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const refDay = new Date(reference);
  refDay.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < refDay.getTime();
}

export function formatDueDate(value?: string): string {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}
