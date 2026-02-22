'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createWorkspaceTag } from '@/features/quality-hub/api/client';
import { useWorkspaceTags } from '@/features/quality-hub/api/swr';
import { useState } from 'react';

export function WorkspaceTagsManager() {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useWorkspaceTags();
  const items = (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    color: item.color
  }));
  const errorMessage =
    actionError ||
    (error
      ? error instanceof Error
        ? error.message
        : 'Failed to load tags'
      : null);

  return (
    <Card>
      <CardContent className='space-y-3 pt-6'>
        <div className='flex gap-2'>
          <Input
            placeholder='Tag name'
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            placeholder='Color'
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
          <Button
            onClick={async () => {
              if (!name.trim()) return;
              try {
                setActionError(null);
                await createWorkspaceTag({ name: name.trim(), color });
                setName('');
                await mutate();
              } catch (err) {
                setActionError(
                  err instanceof Error ? err.message : 'Failed to create tag'
                );
              }
            }}
          >
            Add Tag
          </Button>
        </div>
        {isLoading && (
          <p className='text-muted-foreground text-sm'>Loading tags...</p>
        )}
        {errorMessage && (
          <p className='text-destructive text-sm'>{errorMessage}</p>
        )}
        <div className='space-y-1'>
          {items.map((item) => (
            <p key={item.id} className='text-sm'>
              #{item.id} {item.name} ({item.color || 'no color'})
            </p>
          ))}
          {items.length === 0 && (
            <p className='text-muted-foreground text-sm'>No tags.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
