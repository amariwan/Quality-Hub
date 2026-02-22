'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createTeamProjectMapping,
  deleteTeamProjectMapping,
  listProjects,
  listTeamProjectMappings,
  listTeams
} from '@/features/quality-hub/api/client';
import { Team, TeamProjectMapping } from '@/features/quality-hub/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ProjectOption = {
  id: number;
  path_with_namespace: string;
};

export function TeamProjectMappingsManager() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [items, setItems] = useState<TeamProjectMapping[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [teamsData, projectsData, mappingsData] = await Promise.all([
        listTeams(),
        listProjects(false),
        listTeamProjectMappings()
      ]);
      setTeams(teamsData);
      setProjects(projectsData);
      setItems(mappingsData);
      setTeamId((current) => current ?? teamsData[0]?.id ?? null);
      setProjectId((current) => current ?? projectsData[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const canCreate = useMemo(
    () => teamId !== null && projectId !== null,
    [teamId, projectId]
  );

  return (
    <Card>
      <CardHeader className='gap-2'>
        <CardTitle>Team to Project Mapping</CardTitle>
        <p className='text-muted-foreground text-sm'>
          Definiert die exakte Team-Zuordnung fuer den Quality Indicator und den
          Management Risk Radar.
        </p>
      </CardHeader>
      <CardContent className='space-y-4'>
        {loading && (
          <p className='text-muted-foreground text-sm'>Loading mappings...</p>
        )}
        {error && <p className='text-destructive text-sm'>{error}</p>}

        {!loading && (
          <div className='space-y-3'>
            <div className='grid gap-2 md:grid-cols-[1fr_1fr_auto]'>
              <select
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                value={teamId ?? ''}
                onChange={(event) =>
                  setTeamId(Number(event.target.value) || null)
                }
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>

              <select
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                value={projectId ?? ''}
                onChange={(event) =>
                  setProjectId(Number(event.target.value) || null)
                }
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.path_with_namespace}
                  </option>
                ))}
              </select>

              <Button
                disabled={!canCreate || saving}
                onClick={async () => {
                  if (!teamId || !projectId) return;
                  try {
                    setSaving(true);
                    setError(null);
                    await createTeamProjectMapping({
                      team_id: teamId,
                      project_id: projectId
                    });
                    await loadData();
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'Failed to create mapping'
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Add mapping
              </Button>
            </div>

            <div className='space-y-2'>
              {items.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  No mappings configured yet.
                </p>
              )}
              {items.map((item) => (
                <div
                  key={item.id}
                  className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-2'
                >
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='secondary'>
                      {item.team || item.team_id}
                    </Badge>
                    <span className='text-muted-foreground text-xs'>
                      {'->'}
                    </span>
                    <Badge variant='outline'>
                      {item.project || `Project ${item.project_id}`}
                    </Badge>
                  </div>
                  <Button
                    size='sm'
                    variant='destructive'
                    onClick={async () => {
                      try {
                        setError(null);
                        await deleteTeamProjectMapping(item.id);
                        await loadData();
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : 'Failed to delete mapping'
                        );
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
