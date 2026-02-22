'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectMatrix } from '@/features/quality-hub/api/swr';

export function ProjectMatrix({ projectId }: { projectId: number }) {
  const { data, error, isLoading } = useProjectMatrix(projectId);
  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : 'Failed to load project matrix'
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project {projectId} Deployment Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className='text-muted-foreground text-sm'>Loading matrix...</p>
        )}
        {errorMessage && (
          <p className='text-destructive text-sm'>{errorMessage}</p>
        )}
        {!isLoading && !errorMessage && data && (
          <div className='space-y-3'>
            {Object.keys(data.matrix).length === 0 && (
              <p className='text-muted-foreground text-sm'>
                No deployment rows found for this project.
              </p>
            )}
            {Object.entries(data.matrix).map(([env, rows]) => (
              <div key={env} className='rounded-md border p-3'>
                <h4 className='font-medium capitalize'>{env}</h4>
                <div className='mt-2 space-y-2'>
                  {rows.map((row) => (
                    <div key={String(row.deployment_id)} className='text-sm'>
                      <span className='font-medium'>{String(row.status)}</span>
                      {' · '}
                      {String(row.kind)} / {String(row.namespace)} /{' '}
                      {String(row.resource_name)}
                      {' · '}
                      revision: {String(row.git_revision || '-')}
                      {' · '}
                      tag: {String(row.git_tag || '-')}
                      {' · '}
                      image: {String(row.image_ref || '-')}
                      {' · '}
                      chart: {String(row.helm_chart_version || '-')}
                      {' · '}
                      actor:{' '}
                      {String(row.actor_merger || row.actor_author || '-')}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
