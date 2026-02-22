import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { persist } from 'zustand/middleware';
import { UniqueIdentifier } from '@dnd-kit/core';
import { Column } from '../components/board-column';

export const BASE_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type BaseStatus = (typeof BASE_STATUSES)[number];
export type Status = BaseStatus | string;

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const defaultCols: Column[] = [
  { id: 'TODO', title: 'Todo' },
  { id: 'IN_PROGRESS', title: 'In Progress' },
  { id: 'DONE', title: 'Done' }
];

export type ColumnId = Status;

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  dueDate?: string;
  assignee?: string;
  labels: string[];
  estimatePoints?: number;
  blocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NewTaskInput = {
  title: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  dueDate?: string;
  assignee?: string;
  labels?: string[];
  estimatePoints?: number;
  blocked?: boolean;
};

export type State = {
  tasks: Task[];
  columns: Column[];
  draggedTask: string | null;
};

const nowIso = () => new Date().toISOString();

const normalizeTaskInput = (input: NewTaskInput): Task => {
  const now = nowIso();
  return {
    id: uuid(),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    status: input.status ?? 'TODO',
    priority: input.priority ?? 'MEDIUM',
    dueDate: input.dueDate || undefined,
    assignee: input.assignee?.trim() || undefined,
    labels: (input.labels ?? []).map((label) => label.trim()).filter(Boolean),
    estimatePoints:
      typeof input.estimatePoints === 'number' &&
      Number.isFinite(input.estimatePoints)
        ? Math.max(1, Math.round(input.estimatePoints))
        : undefined,
    blocked: Boolean(input.blocked),
    createdAt: now,
    updatedAt: now
  };
};

const initialTasks: Task[] = [
  normalizeTaskInput({
    title: 'Project initiation and planning',
    priority: 'HIGH',
    labels: ['planning', 'kickoff']
  }),
  normalizeTaskInput({
    title: 'Gather requirements from stakeholders',
    priority: 'MEDIUM',
    assignee: 'Product Owner',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3)
      .toISOString()
      .slice(0, 10)
  })
];

export type Actions = {
  addTask: (input: NewTaskInput) => void;
  updateTask: (id: string, patch: Partial<NewTaskInput>) => void;
  duplicateTask: (id: string) => void;
  dragTask: (id: string | null) => void;
  removeTask: (id: string) => void;
  addCol: (title: string) => void;
  removeCol: (id: UniqueIdentifier) => void;
  setTasks: (updatedTask: Task[]) => void;
  setCols: (cols: Column[]) => void;
  updateCol: (id: UniqueIdentifier, newName: string) => void;
};

const normalizePersistedTask = (task: Task): Task => {
  const normalized = normalizeTaskInput({
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    assignee: task.assignee,
    labels: task.labels,
    estimatePoints: task.estimatePoints,
    blocked: task.blocked
  });

  return {
    ...normalized,
    id: task.id,
    createdAt: task.createdAt ?? normalized.createdAt,
    updatedAt: task.updatedAt ?? normalized.updatedAt
  };
};

export const useTaskStore = create<State & Actions>()(
  persist(
    (set) => ({
      tasks: initialTasks,
      columns: defaultCols,
      draggedTask: null,
      addTask: (input) =>
        set((state) => ({
          tasks: [...state.tasks, normalizeTaskInput(input)]
        })),
      updateTask: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id !== id) return task;
            const updated = normalizeTaskInput({
              title: patch.title ?? task.title,
              description: patch.description ?? task.description,
              status: patch.status ?? task.status,
              priority: patch.priority ?? task.priority,
              dueDate: patch.dueDate ?? task.dueDate,
              assignee: patch.assignee ?? task.assignee,
              labels: patch.labels ?? task.labels,
              estimatePoints: patch.estimatePoints ?? task.estimatePoints,
              blocked: patch.blocked ?? task.blocked
            });
            return {
              ...task,
              ...updated,
              id: task.id,
              createdAt: task.createdAt,
              updatedAt: nowIso()
            };
          })
        })),
      duplicateTask: (id) =>
        set((state) => {
          const source = state.tasks.find((task) => task.id === id);
          if (!source) return state;
          const duplicated = normalizeTaskInput({
            title: `${source.title} (copy)`,
            description: source.description,
            status: source.status,
            priority: source.priority,
            dueDate: source.dueDate,
            assignee: source.assignee,
            labels: source.labels,
            estimatePoints: source.estimatePoints,
            blocked: source.blocked
          });
          return { tasks: [...state.tasks, duplicated] };
        }),
      updateCol: (id: UniqueIdentifier, newName: string) =>
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === id ? { ...col, title: newName } : col
          )
        })),
      addCol: (title: string) =>
        set((state) => {
          const trimmed = title.trim();
          if (!trimmed) return state;
          const normalizedId = trimmed
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
          const baseId = normalizedId || `SECTION_${state.columns.length + 1}`;
          const existingIds = new Set(
            state.columns.map((col) => String(col.id))
          );
          let finalId = baseId;
          let suffix = 2;
          while (existingIds.has(finalId)) {
            finalId = `${baseId}_${suffix}`;
            suffix += 1;
          }

          return {
            columns: [...state.columns, { title: trimmed, id: finalId }]
          };
        }),
      dragTask: (id: string | null) => set({ draggedTask: id }),
      removeTask: (id: string) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id)
        })),
      removeCol: (id: UniqueIdentifier) =>
        set((state) => ({
          columns: state.columns.filter((col) => col.id !== id),
          tasks: state.tasks.filter((task) => task.status !== String(id))
        })),
      setTasks: (newTasks: Task[]) =>
        set({ tasks: newTasks.map((task) => normalizePersistedTask(task)) }),
      setCols: (newCols: Column[]) => set({ columns: newCols })
    }),
    { name: 'task-store', skipHydration: true }
  )
);
