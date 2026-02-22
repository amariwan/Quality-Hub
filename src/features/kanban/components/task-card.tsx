import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Task, useTaskStore } from '../utils/store';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cva } from 'class-variance-authority';
import {
  IconAlertTriangle,
  IconCalendar,
  IconCopy,
  IconDots,
  IconGripVertical,
  IconPencil,
  IconTrash,
  IconUser
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  formatDueDate,
  isTaskOverdue,
  priorityBadgeClass,
  priorityLabel
} from '../utils/task-metadata';
import { TaskDetailsDialog } from './task-details-dialog';

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
}

export type TaskType = 'Task';

export interface TaskDragData {
  type: TaskType;
  task: Task;
}

export function TaskCard({ task, isOverlay }: TaskCardProps) {
  const removeTask = useTaskStore((state) => state.removeTask);
  const duplicateTask = useTaskStore((state) => state.duplicateTask);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task
    } satisfies TaskDragData,
    attributes: {
      roleDescription: 'Task'
    }
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform)
  };

  const variants = cva('mb-2', {
    variants: {
      dragging: {
        over: 'ring-2 opacity-30',
        overlay: 'ring-2 ring-primary'
      }
    }
  });

  const overdue = isTaskOverdue(task);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={variants({
        dragging: isOverlay ? 'overlay' : isDragging ? 'over' : undefined
      })}
    >
      <CardHeader className='space-between border-secondary relative flex flex-row items-center gap-1 border-b-2 px-3 py-2'>
        <Button
          variant='ghost'
          {...attributes}
          {...listeners}
          className='text-secondary-foreground/50 -ml-2 h-auto cursor-grab p-1'
        >
          <span className='sr-only'>Move task</span>
          <IconGripVertical size={16} />
        </Button>

        <Badge variant='outline' className={priorityBadgeClass[task.priority]}>
          {priorityLabel[task.priority]}
        </Badge>

        {task.blocked && (
          <Badge variant='destructive' className='ml-1'>
            Blocked
          </Badge>
        )}

        <div className='ml-auto flex items-center'>
          <TaskDetailsDialog
            task={task}
            trigger={
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <IconPencil size={16} />
                <span className='sr-only'>Edit task</span>
              </Button>
            }
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <IconDots size={16} />
                <span className='sr-only'>Task actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => duplicateTask(task.id)}>
                <IconCopy size={14} /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => removeTask(task.id)}
                className='text-red-600 focus:text-red-600'
              >
                <IconTrash size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className='space-y-2 px-3 pt-3 pb-4 text-left'>
        <p className='line-clamp-2 text-sm font-medium'>{task.title}</p>
        {task.description && (
          <p className='text-muted-foreground line-clamp-2 text-xs whitespace-pre-wrap'>
            {task.description}
          </p>
        )}

        <div className='text-muted-foreground flex flex-wrap items-center gap-3 text-xs'>
          <span className='inline-flex items-center gap-1'>
            <IconUser size={13} />
            {task.assignee || 'Unassigned'}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${
              overdue ? 'text-red-600' : ''
            }`}
          >
            {overdue ? (
              <IconAlertTriangle size={13} />
            ) : (
              <IconCalendar size={13} />
            )}
            {formatDueDate(task.dueDate)}
          </span>
          {typeof task.estimatePoints === 'number' && (
            <span>SP: {task.estimatePoints}</span>
          )}
        </div>

        {task.labels.length > 0 && (
          <div className='flex flex-wrap gap-1'>
            {task.labels.map((label) => (
              <Badge key={label} variant='secondary' className='text-[10px]'>
                {label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
