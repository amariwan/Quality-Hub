export const WORKSPACE_ACTIVE_ID_KEY = 'qh.workspace.active.id';
export const WORKSPACE_ACTIVE_GROUP_ID_KEY =
  'qh.workspace.active.gitlab_group_id';
export const WORKSPACE_ACTIVE_GROUP_PATH_KEY =
  'qh.workspace.active.gitlab_group_path';
export const WORKSPACE_ORDER_IDS_KEY = 'qh.workspace.order.ids';

export type ActiveWorkspaceContext = {
  workspaceId: number | null;
  gitlabGroupId: number | null;
  gitlabGroupPath: string | null;
};

export function workspaceSlugFromGroupPath(
  gitlabGroupPath: string | null | undefined
): string | null {
  if (!gitlabGroupPath) return null;
  const trimmed = gitlabGroupPath.trim();
  if (!trimmed) return null;

  const segments = trimmed.split('/').filter(Boolean);
  const candidate = (segments[segments.length - 1] || trimmed).toLowerCase();
  const slug = candidate
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || null;
}

export function readActiveWorkspaceContext(): ActiveWorkspaceContext {
  if (typeof window === 'undefined') {
    return { workspaceId: null, gitlabGroupId: null, gitlabGroupPath: null };
  }

  const workspaceIdRaw = window.localStorage.getItem(WORKSPACE_ACTIVE_ID_KEY);
  const gitlabGroupIdRaw = window.localStorage.getItem(
    WORKSPACE_ACTIVE_GROUP_ID_KEY
  );
  const gitlabGroupPath = window.localStorage.getItem(
    WORKSPACE_ACTIVE_GROUP_PATH_KEY
  );

  const workspaceId = workspaceIdRaw ? Number(workspaceIdRaw) || null : null;
  const gitlabGroupId = gitlabGroupIdRaw
    ? Number(gitlabGroupIdRaw) || null
    : null;

  return {
    workspaceId,
    gitlabGroupId,
    gitlabGroupPath: gitlabGroupPath || null
  };
}

export function writeActiveWorkspaceContext(payload: ActiveWorkspaceContext) {
  if (typeof window === 'undefined') return;

  if (payload.workspaceId) {
    window.localStorage.setItem(
      WORKSPACE_ACTIVE_ID_KEY,
      String(payload.workspaceId)
    );
  } else {
    window.localStorage.removeItem(WORKSPACE_ACTIVE_ID_KEY);
  }

  if (payload.gitlabGroupId) {
    window.localStorage.setItem(
      WORKSPACE_ACTIVE_GROUP_ID_KEY,
      String(payload.gitlabGroupId)
    );
  } else {
    window.localStorage.removeItem(WORKSPACE_ACTIVE_GROUP_ID_KEY);
  }

  if (payload.gitlabGroupPath) {
    window.localStorage.setItem(
      WORKSPACE_ACTIVE_GROUP_PATH_KEY,
      payload.gitlabGroupPath
    );
  } else {
    window.localStorage.removeItem(WORKSPACE_ACTIVE_GROUP_PATH_KEY);
  }
}

export function readWorkspaceOrderIds(): number[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(WORKSPACE_ORDER_IDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0);
  } catch {
    return [];
  }
}

export function writeWorkspaceOrderIds(order: number[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WORKSPACE_ORDER_IDS_KEY, JSON.stringify(order));
}
