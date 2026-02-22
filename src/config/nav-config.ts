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
    title: 'Release Readiness',
    url: '/dashboard/release-readiness',
    icon: 'dashboard',
    isActive: true,
    items: []
  },
  {
    title: 'DORA Metrics',
    url: '/dashboard/workspace/dora',
    icon: 'chart',
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
        url: '/dashboard/:workspace/views'
      },
      {
        title: 'Notes',
        url: '/dashboard/:workspace/notes'
      },
      {
        title: 'Watchlist',
        url: '/dashboard/:workspace/watchlist'
      },
      {
        title: 'Tags',
        url: '/dashboard/:workspace/tags'
      },
      {
        title: 'Teams',
        url: '/dashboard/:workspace/teams'
      },
      {
        title: 'Tickets',
        url: '/dashboard/:workspace/tickets'
      },
      {
        title: 'Change Log',
        url: '/dashboard/:workspace/change-log'
      },
      {
        title: 'Project Mapping',
        url: '/dashboard/:workspace/project-mapping'
      },
      {
        title: 'Cluster Registry',
        url: '/dashboard/:workspace/cluster-registry'
      },
      {
        title: 'Services',
        url: '/dashboard/:workspace/services'
      },
      {
        title: 'Clusters',
        url: '/dashboard/:workspace/clusters'
      },
      {
        title: 'Environments',
        url: '/dashboard/:workspace/environments'
      },
      {
        title: 'Settings',
        url: '/dashboard/:workspace/settings'
      }
    ]
  }
];
