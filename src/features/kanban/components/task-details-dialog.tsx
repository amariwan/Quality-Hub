'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
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
  PRIORITY_ORDER,
  normalizeLabels,
  priorityLabel
} from '../utils/task-metadata';
import { Task, useTaskStore } from '../utils/store';

export function TaskDetailsDialog({
  task,
  trigger
}: {
  task: Task;
  trigger: ReactNode;
}) {
  const updateTask = useTaskStore((state) => state.updateTask);
  const columns = useTaskStore((state) => state.columns);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);

  useEffect(() => {
    setStatus(task.status);
    setPriority(task.priority);
  }, [task.priority, task.status]);

  const statusOptions = useMemo(
    () =>
      columns.map((column) => ({ id: String(column.id), title: column.title })),
    [columns]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className='sm:max-w-[560px]'>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update planning data and delivery details.
          </DialogDescription>
        </DialogHeader>

        <form
          id={`task-form-${task.id}`}
          className='grid gap-3 py-2'
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const estimateRaw = String(
              formData.get('estimatePoints') ?? ''
            ).trim();
            const estimate = estimateRaw ? Number(estimateRaw) : undefined;

            updateTask(task.id, {
              title: String(formData.get('title') ?? ''),
              description: String(formData.get('description') ?? ''),
              assignee: String(formData.get('assignee') ?? ''),
              dueDate: String(formData.get('dueDate') ?? ''),
              labels: normalizeLabels(String(formData.get('labels') ?? '')),
              estimatePoints:
                typeof estimate === 'number' && Number.isFinite(estimate)
                  ? Math.max(1, Math.round(estimate))
                  : undefined,
              blocked: formData.get('blocked') === 'on',
              status,
              priority
            });
            setOpen(false);
          }}
        >
          <Input name='title' defaultValue={task.title} required />
          <Textarea
            name='description'
            defaultValue={task.description ?? ''}
            className='min-h-20'
          />

          <div className='grid gap-3 sm:grid-cols-2'>
            <div>
              <p className='mb-1 text-xs font-medium'>Status</p>
              <select
                className='border-input bg-background ring-offset-background h-9 w-full rounded-md border px-3 text-sm'
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className='mb-1 text-xs font-medium'>Priority</p>
              <select
                className='border-input bg-background ring-offset-background h-9 w-full rounded-md border px-3 text-sm'
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
                  )
                }
              >
                {PRIORITY_ORDER.map((item) => (
                  <option key={item} value={item}>
                    {priorityLabel[item]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <Input name='assignee' defaultValue={task.assignee ?? ''} />
            <Input
              name='dueDate'
              type='date'
              defaultValue={task.dueDate ?? ''}
            />
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <Input
              name='labels'
              defaultValue={task.labels.join(', ')}
              placeholder='Labels, comma separated'
            />
            <Input
              name='estimatePoints'
              type='number'
              min={1}
              step={1}
              defaultValue={task.estimatePoints ?? ''}
              placeholder='Story points'
            />
          </div>

          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='blocked'
              defaultChecked={task.blocked}
            />
            Blocked
          </label>
        </form>

        <DialogFooter>
          <Button type='submit' form={`task-form-${task.id}`}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
