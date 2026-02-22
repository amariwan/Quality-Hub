'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useRuntimeSettings } from '@/features/quality-hub/api/swr';
import { readActiveWorkspaceContext } from '@/features/quality-hub/workspace-context';
import { useEffect, useState } from 'react';

type TeamProfile =
  | 'custom'
  | 'ops_lead'
  | 'incident_commander'
  | 'release_manager';

const PROFILE_PRESETS: Record<
  Exclude<TeamProfile, 'custom'>,
  {
    liveEnabled: boolean;
    autoRefresh: boolean;
    liveInterval: number;
    eventsLimit: number;
    insightsLimit: number;
    eventLimit: number;
    notifyHigh: boolean;
    desktopNotify: boolean;
  }
> = {
  ops_lead: {
    liveEnabled: true,
    autoRefresh: true,
    liveInterval: 8,
    eventsLimit: 30,
    insightsLimit: 60,
    eventLimit: 60,
    notifyHigh: true,
    desktopNotify: true
  },
  incident_commander: {
    liveEnabled: true,
    autoRefresh: true,
    liveInterval: 5,
    eventsLimit: 40,
    insightsLimit: 80,
    eventLimit: 80,
    notifyHigh: true,
    desktopNotify: true
  },
  release_manager: {
    liveEnabled: true,
    autoRefresh: true,
    liveInterval: 12,
    eventsLimit: 20,
    insightsLimit: 50,
    eventLimit: 50,
    notifyHigh: true,
    desktopNotify: false
  }
};

export function SettingsManager() {
  const {
    data: runtime,
    error: runtimeError,
    isLoading: runtimeLoading,
    mutate: reloadRuntime
  } = useRuntimeSettings();
  const [profile, setProfile] = useState<TeamProfile>('custom');
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [liveInterval, setLiveInterval] = useState(10);
  const [eventsLimit, setEventsLimit] = useState(20);
  const [insightsLimit, setInsightsLimit] = useState(40);
  const [eventLimit, setEventLimit] = useState(50);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [notifyHigh, setNotifyHigh] = useState(true);
  const [desktopNotify, setDesktopNotify] = useState(false);
  const [scopeLabel, setScopeLabel] = useState('global');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keyForScope = (scope: string, key: string) =>
    `qh.scope.${scope}.${key}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const context = readActiveWorkspaceContext();
    const scope = context.gitlabGroupId
      ? `group:${context.gitlabGroupId}`
      : 'global';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize persisted scope label on mount.
    setScopeLabel(context.gitlabGroupPath || scope);
    const readString = (key: string) =>
      window.localStorage.getItem(keyForScope(scope, key)) ||
      window.localStorage.getItem(`qh.${key}`);
    const readBool = (key: string, fallback: boolean) => {
      const value = readString(key);
      if (value === 'true') return true;
      if (value === 'false') return false;
      return fallback;
    };
    const readNum = (key: string, fallback: number) =>
      Number(readString(key) || fallback) || fallback;
    setLiveEnabled(readBool('gitlab.live.enabled', false));
    setAutoRefresh(readBool('gitlab.events.auto_refresh', false));
    setLiveInterval(readNum('gitlab.live.interval', 10));
    setEventsLimit(readNum('gitlab.live.events_limit', 20));
    setInsightsLimit(readNum('gitlab.insights.limit', 40));
    setEventLimit(readNum('gitlab.events.limit', 50));
    setNotifyHigh(readBool('gitlab.notifications.high_enabled', true));
    setDesktopNotify(readBool('gitlab.notifications.desktop_enabled', false));
    const rawProfile = readString('gitlab.profile.active');
    if (
      rawProfile === 'ops_lead' ||
      rawProfile === 'incident_commander' ||
      rawProfile === 'release_manager'
    ) {
      setProfile(rawProfile);
    } else {
      setProfile('custom');
    }
  }, []);

  const runtimeErrorMessage = runtimeError
    ? runtimeError instanceof Error
      ? runtimeError.message
      : 'Failed to load runtime settings'
    : null;
  const displayError = error || runtimeErrorMessage;

  const saveSettings = () => {
    if (typeof window === 'undefined') return;
    const context = readActiveWorkspaceContext();
    const scope = context.gitlabGroupId
      ? `group:${context.gitlabGroupId}`
      : 'global';
    window.localStorage.setItem(
      keyForScope(scope, 'gitlab.live.enabled'),
      String(liveEnabled)
    );
    window.localStorage.setItem(
      keyForScope(scope, 'gitlab.events.auto_refresh'),
      String(autoRefresh)
    );
    window.localStorage.setItem(
      keyForScope(scope, 'gitlab.live.interval'),
      String(liveInterval)
    );
    window.localStorage.setItem(
      keyForScope(scope, 'gitlab.live.events_limit'),
      String(eventsLimit)
    );
    window.localStorage.setItem(
      keyForScope(scope, 'gitlab.insights.limit'),
      String(insightsLimit)
    );
    window.localStorage.setItem(
      keyForScope(scope, 'gitlab.events.limit'),
      String(eventLimit)
    );
    window.localStorage.setItem(
      keyForScope(scope, 'gitlab.notifications.high_enabled'),
      String(notifyHigh)
    );
    window.localStorage.setItem(
      keyForScope(scope, 'gitlab.notifications.desktop_enabled'),
      String(desktopNotify)
    );
    window.localStorage.setItem(
      keyForScope(scope, 'gitlab.profile.active'),
      profile
    );
    setMessage(
      `Settings saved for scope: ${context.gitlabGroupPath || scope}.`
    );
  };

  const applyProfile = () => {
    if (profile === 'custom') return;
    const preset = PROFILE_PRESETS[profile];
    setLiveEnabled(preset.liveEnabled);
    setAutoRefresh(preset.autoRefresh);
    setLiveInterval(preset.liveInterval);
    setEventsLimit(preset.eventsLimit);
    setInsightsLimit(preset.insightsLimit);
    setEventLimit(preset.eventLimit);
    setNotifyHigh(preset.notifyHigh);
    setDesktopNotify(preset.desktopNotify);
    setMessage(
      `Profile "${profile}" loaded. Click Save UI Settings to persist.`
    );
  };

  const requestDesktopPermission = async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      setError('Browser notifications are not supported in this environment.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setError('Desktop notification permission was not granted.');
      return;
    }
    setDesktopNotify(true);
    setError(null);
    setMessage('Desktop notifications enabled.');
  };

  return (
    <Card>
      <CardHeader className='gap-2'>
        <CardTitle>Quality-Hub Settings</CardTitle>
        <p className='text-muted-foreground text-sm'>
          Live-WebSocket und GitLab-Ansicht konfigurieren sowie Runtime-Config
          prüfen.
        </p>
        <p className='text-muted-foreground text-xs'>
          Active scope: {scopeLabel}
        </p>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-sm'>Live WebSocket enabled</span>
          <Switch checked={liveEnabled} onCheckedChange={setLiveEnabled} />
          <span className='text-sm'>Events auto refresh</span>
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          <span className='text-sm'>High attention alerts</span>
          <Switch checked={notifyHigh} onCheckedChange={setNotifyHigh} />
          <span className='text-sm'>Desktop notifications</span>
          <Switch checked={desktopNotify} onCheckedChange={setDesktopNotify} />
          <Button
            size='sm'
            variant='outline'
            onClick={() => void requestDesktopPermission()}
          >
            Allow browser notifications
          </Button>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-sm'>Team profile</span>
          <Select
            value={profile}
            onValueChange={(value) => setProfile(value as TeamProfile)}
          >
            <SelectTrigger className='w-[220px]'>
              <SelectValue placeholder='Select profile' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='custom'>Custom</SelectItem>
              <SelectItem value='ops_lead'>Ops Lead</SelectItem>
              <SelectItem value='incident_commander'>
                Incident Commander
              </SelectItem>
              <SelectItem value='release_manager'>Release Manager</SelectItem>
            </SelectContent>
          </Select>
          <Button size='sm' variant='outline' onClick={applyProfile}>
            Apply profile
          </Button>
        </div>

        <div className='grid gap-2 md:grid-cols-4'>
          <Input
            type='number'
            min={3}
            max={60}
            value={liveInterval}
            onChange={(event) =>
              setLiveInterval(Number(event.target.value) || 10)
            }
            placeholder='Live interval seconds'
          />
          <Input
            type='number'
            min={5}
            max={100}
            value={eventsLimit}
            onChange={(event) =>
              setEventsLimit(Number(event.target.value) || 20)
            }
            placeholder='Events per project'
          />
          <Input
            type='number'
            min={10}
            max={200}
            value={insightsLimit}
            onChange={(event) =>
              setInsightsLimit(Number(event.target.value) || 40)
            }
            placeholder='Insights pipeline sample'
          />
          <Input
            type='number'
            min={10}
            max={200}
            value={eventLimit}
            onChange={(event) =>
              setEventLimit(Number(event.target.value) || 50)
            }
            placeholder='Events feed limit'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Button onClick={saveSettings}>Save UI Settings</Button>
          <Button
            variant='outline'
            onClick={() => void reloadRuntime()}
            disabled={runtimeLoading}
          >
            {runtimeLoading ? 'Loading...' : 'Reload Runtime'}
          </Button>
          {message && <Badge variant='secondary'>{message}</Badge>}
        </div>

        {displayError && (
          <p className='text-destructive text-sm'>{displayError}</p>
        )}

        {runtime && (
          <div className='space-y-2 rounded-md border p-3 text-sm'>
            <p className='font-medium'>Runtime</p>
            <div className='flex flex-wrap gap-2'>
              <Badge variant='outline'>env: {runtime.environment}</Badge>
              <Badge variant='outline'>api: {runtime.api_version}</Badge>
              <Badge variant='outline'>gitlab: {runtime.gitlab_base_url}</Badge>
              <Badge variant='outline'>
                ws default: {runtime.ws_live_default_interval_seconds}s
              </Badge>
              <Badge variant='outline'>
                ws max: {runtime.ws_live_max_interval_seconds}s
              </Badge>
              <Badge variant='outline'>
                watch heartbeat: {runtime.watch_heartbeat_interval_seconds}s
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
