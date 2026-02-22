import { NavItem } from '@/types';

export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: 'dashboard',
    isActive: true,
    items: []
  },
  {
    title: 'Portfolio',
    url: '/dashboard/portfolio',
    icon: 'dashboard',
    isActive: true,
    items: []
  },
  {
    title: 'Pipelines',
    url: '/dashboard/pipelines',
    icon: 'warning',
    isActive: false,
    items: []
  },
  {
    title: 'GitLab',
    url: '#',
    icon: 'kanban',
    isActive: false,
    items: [
      {
        title: 'Overview',
        url: '/dashboard/gitlab'
      },
      {
        title: 'Groups (Workspaces)',
        url: '/dashboard/groups'
      },
      {
        title: 'Views',
        url: '/dashboard/workspace/views'
      },
      {
        title: 'Notes',
        url: '/dashboard/workspace/notes'
      },
      {
        title: 'Watchlist',
        url: '/dashboard/workspace/watchlist'
      },
      {
        title: 'Tags',
        url: '/dashboard/workspace/tags'
      },
      {
        title: 'Teams',
        url: '/dashboard/workspace/teams'
      },
      {
        title: 'Tickets',
        url: '/dashboard/workspace/tickets'
      },
      {
        title: 'Settings',
        url: '/dashboard/workspace/settings'
      }
    ]
  }
];
