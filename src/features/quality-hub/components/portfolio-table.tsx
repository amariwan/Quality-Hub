'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { EnvStatusChip } from '@/features/quality-hub/components/env-status-chips';
import {
  getPortfolio,
  triggerProjectSync
} from '@/features/quality-hub/api/client';
import { PortfolioItem } from '@/features/quality-hub/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export function PortfolioTable() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [showClusters, setShowClusters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (nextShowClusters: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPortfolio({
        showClusters: nextShowClusters,
        scope: 'readiness'
      });
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(showClusters);
  }, [loadData, showClusters]);

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>Release Readiness Portfolio</CardTitle>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={async () => {
              const next = !showClusters;
              setShowClusters(next);
              await loadData(next);
            }}
          >
            {showClusters ? 'Hide clusters' : 'Show clusters'}
          </Button>
          <Button
            onClick={async () => {
              await triggerProjectSync();
              await loadData(showClusters);
            }}
          >
            Sync projects
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <p className='text-muted-foreground text-sm'>Loading portfolio...</p>
        )}
        {error && <p className='text-destructive text-sm'>{error}</p>}
        {!loading && !error && (
          <div className='space-y-3'>
            {items.length === 0 && (
              <p className='text-muted-foreground text-sm'>
                No deployments yet. Register clusters and mappings first.
              </p>
            )}
            {items.map((item) => (
              <div key={item.project_id} className='rounded-md border p-3'>
                <div className='flex items-center justify-between'>
                  <h3 className='font-medium'>
                    <Link
                      href={`/dashboard/projects/${item.project_id}`}
                      className='hover:underline'
                    >
                      {item.project || `Project ${item.project_id}`}
                    </Link>
                  </h3>
                  <span className='text-muted-foreground text-xs'>
                    ID: {item.project_id}
                  </span>
                </div>
                <Separator className='my-2' />
                <div className='flex flex-wrap gap-2'>
                  {item.environments.map((env) => (
                    <div
                      key={`${item.project_id}-${env.env}`}
                      className='space-y-2'
                    >
                      <EnvStatusChip label={env.env} status={env.status} />
                      {showClusters && env.clusters.length > 0 && (
                        <div className='flex flex-wrap gap-2'>
                          {env.clusters.map((cluster) => (
                            <EnvStatusChip
                              key={`${cluster.cluster_id}-${env.env}`}
                              label={
                                cluster.cluster ||
                                `Cluster ${cluster.cluster_id}`
                              }
                              status={cluster.status}
                            />
                          ))}
                        </div>
                      )}
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
