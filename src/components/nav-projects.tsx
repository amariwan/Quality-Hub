'use client';

import {
  IconFolder,
  IconShare,
  IconDots,
  IconTrash
} from '@tabler/icons-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar';
import { Icon } from '@/components/icons';

export function NavProjects({
  projects
}: {
  projects: {
    name: string;
    url: string;
    icon: Icon;
  }[];
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarGroup className='group-data-[collapsible=icon]:hidden'>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.name}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className='hover:bg-primary/10 hover:text-primary transition-all duration-200'
                >
                  <IconDots />
                  <span className='sr-only'>More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-48 rounded-lg'
                side={isMobile ? 'bottom' : 'right'}
                align={isMobile ? 'end' : 'start'}
              >
                <DropdownMenuItem className='transition-all duration-150 hover:translate-x-0.5'>
                  <IconFolder className='text-muted-foreground mr-2 h-4 w-4' />
                  <span>View Project</span>
                </DropdownMenuItem>
                <DropdownMenuItem className='transition-all duration-150 hover:translate-x-0.5'>
                  <IconShare className='text-muted-foreground mr-2 h-4 w-4' />
                  <span>Share Project</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className='transition-all duration-150 hover:translate-x-0.5'>
                  <IconTrash className='text-muted-foreground mr-2 h-4 w-4' />
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton className='group text-sidebar-foreground/70 hover:bg-primary/10 hover:text-primary transition-all duration-200'>
            <IconDots className='text-sidebar-foreground/70 transition-transform duration-200 group-hover:scale-105' />
            <span>More</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
