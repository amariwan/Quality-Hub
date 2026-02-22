'use client';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMemo, useState } from 'react';

import {
  PRIORITY_ORDER,
  normalizeLabels,
  priorityLabel
} from '../utils/task-metadata';
import { useTaskStore } from '../utils/store';

export default function NewTaskDialog() {
  const addTask = useTaskStore((state) => state.addTask);
  const columns = useTaskStore((state) => state.columns);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState<
    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  >('MEDIUM');

  const statusOptions = useMemo(
    () =>
      columns.map((column) => ({ id: String(column.id), title: column.title })),
    [columns]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get('title') ?? '').trim();
    if (!title) return;

    const estimateRaw = String(formData.get('estimatePoints') ?? '').trim();
    const estimate = estimateRaw ? Number(estimateRaw) : undefined;

    addTask({
      title,
      description: String(formData.get('description') ?? ''),
      status,
      priority,
      assignee: String(formData.get('assignee') ?? ''),
      dueDate: String(formData.get('dueDate') ?? ''),
      labels: normalizeLabels(String(formData.get('labels') ?? '')),
      estimatePoints:
        typeof estimate === 'number' && Number.isFinite(estimate)
          ? Math.max(1, Math.round(estimate))
          : undefined,
      blocked: formData.get('blocked') === 'on'
    });

    form.reset();
    setStatus('TODO');
    setPriority('MEDIUM');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='secondary' size='sm'>
          ＋ Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[560px]'>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Add planning details like owner, priority and due date.
          </DialogDescription>
        </DialogHeader>
        <form
          id='todo-form'
          className='grid gap-3 py-2'
          onSubmit={handleSubmit}
        >
          <Input id='title' name='title' placeholder='Task title...' required />
          <Textarea
            id='description'
            name='description'
            placeholder='Description...'
            className='min-h-20'
          />
          <div className='grid gap-3 sm:grid-cols-2'>
            <div>
              <p className='mb-1 text-xs font-medium'>Status</p>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder='Select status' />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className='mb-1 text-xs font-medium'>Priority</p>
              <Select
                value={priority}
                onValueChange={(value) =>
                  setPriority(value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select priority' />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_ORDER.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priorityLabel[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Input
              id='assignee'
              name='assignee'
              placeholder='Assignee (optional)'
            />
            <Input id='dueDate' name='dueDate' type='date' />
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Input
              id='labels'
              name='labels'
              placeholder='Labels, comma separated'
            />
            <Input
              id='estimatePoints'
              name='estimatePoints'
              type='number'
              min={1}
              step={1}
              placeholder='Estimate (story points)'
            />
          </div>
          <label className='flex items-center gap-2 text-sm'>
            <input type='checkbox' name='blocked' />
            Blocked
          </label>
        </form>
        <DialogFooter>
          <Button type='submit' size='sm' form='todo-form'>
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
