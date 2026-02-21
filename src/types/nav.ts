export interface NavItemAccess {
  requireOrg?: boolean;
  permission?: string;
  role?: string;
  plan?: string;
  feature?: string;
}

export interface NavItem {
  title: string;
  url: string;
  icon?: string;
  shortcut?: string[];
  isActive?: boolean;
  items?: NavItem[];
  access?: NavItemAccess;
}
