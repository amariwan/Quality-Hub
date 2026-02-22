'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { addTeamMember, createTeam } from '@/features/quality-hub/api/client';
import { useTeamMembers, useTeams } from '@/features/quality-hub/api/swr';
import { Team, TeamMember } from '@/features/quality-hub/types';
import { useEffect, useState } from 'react';

const EMPTY_TEAMS: Team[] = [];
const EMPTY_TEAM_MEMBERS: TeamMember[] = [];

export function TeamManagement() {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamName, setTeamName] = useState('');
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    data: teamsData,
    error: teamsError,
    isLoading: teamsLoading,
    mutate: mutateTeams
  } = useTeams();
  const {
    data: membersData,
    error: membersError,
    isLoading: membersLoading,
    mutate: mutateMembers
  } = useTeamMembers(selectedTeamId);
  const teams = teamsData ?? EMPTY_TEAMS;
  const members = membersData ?? EMPTY_TEAM_MEMBERS;
  const errorMessage =
    actionError ||
    (teamsError
      ? teamsError instanceof Error
        ? teamsError.message
        : 'Failed to load teams'
      : membersError
        ? membersError instanceof Error
          ? membersError.message
          : 'Failed to load team members'
        : null);

  useEffect(() => {
    if (!selectedTeamId && teams.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTeamId(teams[0].id);
    }
  }, [selectedTeamId, teams]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams & Memberships</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {teamsLoading && (
          <p className='text-muted-foreground text-sm'>Loading teams...</p>
        )}
        {errorMessage && (
          <p className='text-destructive text-sm'>{errorMessage}</p>
        )}

        <div className='flex gap-2'>
          <Input
            placeholder='New team name'
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
          />
          <Button
            onClick={async () => {
              if (!teamName.trim()) return;
              try {
                setActionError(null);
                await createTeam({ name: teamName.trim() });
                setTeamName('');
                await mutateTeams();
              } catch (err) {
                setActionError(
                  err instanceof Error ? err.message : 'Failed to create team'
                );
              }
            }}
          >
            Create Team
          </Button>
        </div>

        <div className='flex flex-wrap gap-2'>
          {teams.map((team) => (
            <Button
              key={team.id}
              variant={selectedTeamId === team.id ? 'default' : 'outline'}
              onClick={() => setSelectedTeamId(team.id)}
            >
              {team.name}
            </Button>
          ))}
        </div>

        {selectedTeamId && (
          <div className='space-y-2 rounded-md border p-3'>
            <h4 className='font-medium'>Members</h4>
            <div className='flex gap-2'>
              <Input
                placeholder='User ID'
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
              />
              <Input
                placeholder='Role (owner/admin/member)'
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value)}
              />
              <Button
                onClick={async () => {
                  if (!memberUserId.trim()) return;
                  try {
                    setActionError(null);
                    await addTeamMember(selectedTeamId, {
                      user_id: Number(memberUserId),
                      role: memberRole
                    });
                    setMemberUserId('');
                    await mutateMembers();
                  } catch (err) {
                    setActionError(
                      err instanceof Error
                        ? err.message
                        : 'Failed to add team member'
                    );
                  }
                }}
              >
                Add Member
              </Button>
            </div>

            <div className='space-y-1'>
              {membersLoading && (
                <p className='text-muted-foreground text-sm'>
                  Loading team members...
                </p>
              )}
              {members.length === 0 && !membersLoading && (
                <p className='text-muted-foreground text-sm'>
                  No members in this team yet.
                </p>
              )}
              {members.map((member) => (
                <p key={member.id} className='text-sm'>
                  Member #{member.id} | user {member.user_id} | role{' '}
                  {member.role}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
