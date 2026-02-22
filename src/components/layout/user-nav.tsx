'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { disconnectGitlabToken } from '@/features/quality-hub/api/client';
import {
  IconActivityHeartbeat,
  IconDashboard,
  IconFolders,
  IconGitPullRequest,
  IconPlugConnectedX,
  IconSettings,
  IconSparkles
} from '@tabler/icons-react';
import { usePathname, useRouter } from 'next/navigation';

export function UserNav() {
  const router = useRouter();
  const pathname = usePathname();
  const go = (path: string) => router.push(path);
  const isActive = (path: string) =>
    pathname === path ||
    (path !== '/dashboard' && pathname.startsWith(`${path}/`));
  const navEntries = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: IconDashboard,
      hint: 'G D'
    },
    {
      label: 'Edit Widgets',
      path: '/dashboard?widgetStudio=1',
      icon: IconSettings,
      hint: 'G W'
    },
    {
      label: 'Release Readiness',
      path: '/dashboard/release-readiness',
      icon: IconActivityHeartbeat,
      hint: 'G P'
    },
    {
      label: 'Portfolio',
      path: '/dashboard/portfolio',
      icon: IconActivityHeartbeat,
      hint: 'G O'
    },
    {
      label: 'Pipelines',
      path: '/dashboard/pipelines',
      icon: IconGitPullRequest,
      hint: 'G L'
    },
    {
      label: 'Groups (Workspace)',
      path: '/dashboard/groups',
      icon: IconFolders,
      hint: 'G G'
    }
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='hover:ring-primary/30 relative h-8 w-8 rounded-full ring-0 transition-all duration-200 hover:scale-105 hover:ring-2'
        >
          <UserAvatarProfile
            user={{
              fullName: 'Local User',
              emailAddresses: [{ emailAddress: 'local@quality-hub.dev' }],
              imageUrl: ''
            }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='w-56'
        align='end'
        sideOffset={10}
        forceMount
      >
        <DropdownMenuLabel className='font-normal'>
          <div className='flex flex-col space-y-1'>
            <p className='text-sm leading-none font-medium'>Local User</p>
            <p className='text-muted-foreground text-xs leading-none'>
              local@quality-hub.dev
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className='text-muted-foreground text-[11px] font-medium tracking-wide uppercase'>
          Quick Access
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {navEntries.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.label}
                className={`group flex cursor-pointer items-center justify-between rounded-sm transition-all duration-150 hover:translate-x-0.5 ${
                  isActive(item.path) ? 'bg-accent/60' : ''
                }`}
                onClick={() => go(item.path)}
              >
                <span className='flex items-center'>
                  <Icon className='mr-2 h-4 w-4 transition-transform duration-150 group-hover:scale-110' />
                  {item.label}
                </span>
                <span className='text-muted-foreground rounded border px-1.5 py-0.5 text-[10px]'>
                  {item.hint}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='group transition-all duration-150 hover:translate-x-0.5'
          onClick={async () => {
            await disconnectGitlabToken();
            router.push('/auth/token');
          }}
        >
          <IconPlugConnectedX className='mr-2 h-4 w-4' />
          Disconnect Token
        </DropdownMenuItem>
        <DropdownMenuItem className='text-muted-foreground pointer-events-none text-xs'>
          <IconSparkles className='mr-2 h-4 w-4' />
          Pro tip: Use Cmd/Ctrl + K for fast navigation.
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
