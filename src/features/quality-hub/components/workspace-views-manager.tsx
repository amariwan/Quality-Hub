'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createWorkspaceView } from '@/features/quality-hub/api/client';
import { useWorkspaceViews } from '@/features/quality-hub/api/swr';
import { useState } from 'react';

export function WorkspaceViewsManager() {
  const [name, setName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useWorkspaceViews();
  const items = (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    visibility: item.visibility
  }));
  const errorMessage =
    actionError ||
    (error
      ? error instanceof Error
        ? error.message
        : 'Failed to load views'
      : null);

  return (
    <Card>
      <CardContent className='space-y-3 pt-6'>
        <div className='flex gap-2'>
          <Input
            placeholder='View name'
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            onClick={async () => {
              if (!name.trim()) return;
              try {
                setActionError(null);
                await createWorkspaceView({
                  name: name.trim(),
                  definition_json: {}
                });
                setName('');
                await mutate();
              } catch (err) {
                setActionError(
                  err instanceof Error ? err.message : 'Failed to create view'
                );
              }
            }}
          >
            Add View
          </Button>
        </div>
        {isLoading && (
          <p className='text-muted-foreground text-sm'>Loading views...</p>
        )}
        {errorMessage && (
          <p className='text-destructive text-sm'>{errorMessage}</p>
        )}
        <div className='space-y-1'>
          {items.map((item) => (
            <p key={item.id} className='text-sm'>
              #{item.id} {item.name} ({item.visibility})
            </p>
          ))}
          {items.length === 0 && (
            <p className='text-muted-foreground text-sm'>No saved views.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
