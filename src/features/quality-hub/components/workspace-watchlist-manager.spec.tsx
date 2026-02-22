/// <reference types="vitest" />
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { WorkspaceWatchlistManager } from './workspace-watchlist-manager';

// mock the api client functions used by the component
vi.mock('@/features/quality-hub/api/client', () => ({
  listProjects: vi.fn(),
  listWorkspaceWatchlist: vi.fn(),
  createWorkspaceWatchlist: vi.fn(),
  deleteWorkspaceWatchlist: vi.fn()
}));

import * as api from '@/features/quality-hub/api/client';

describe('WorkspaceWatchlistManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing items and handles add', async () => {
    const projects = [
      {
        id: 7,
        gitlab_project_id: 1007,
        path_with_namespace: 'team/project-seven',
        default_branch: 'main'
      }
    ];
    const items = [
      { id: 1, project_id: 42, visibility: 'private', team_id: null }
    ];
    (api.listProjects as unknown as vi.Mock).mockResolvedValue(projects);
    (api.listWorkspaceWatchlist as unknown as vi.Mock).mockResolvedValue(items);
    (api.createWorkspaceWatchlist as unknown as vi.Mock).mockResolvedValue({});

    render(<WorkspaceWatchlistManager />);

    // initial items should be fetched and displayed
    expect(api.listProjects).toHaveBeenCalled();
    expect(api.listWorkspaceWatchlist).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('team/project-seven')).toBeInTheDocument();
    });

    // add selected project from list
    fireEvent.click(screen.getByText('Add to watchlist'));

    expect(api.createWorkspaceWatchlist).toHaveBeenCalledWith({
      project_id: 7
    });
    // after adding we expect loadAll called again
    await waitFor(() => expect(api.listProjects).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(api.listWorkspaceWatchlist).toHaveBeenCalledTimes(2)
    );
  });

  it('shows error when creation fails', async () => {
    (api.listProjects as unknown as vi.Mock).mockResolvedValue([
      {
        id: 1,
        gitlab_project_id: 1001,
        path_with_namespace: 'team/project-one',
        default_branch: 'main'
      }
    ]);
    (api.listWorkspaceWatchlist as unknown as vi.Mock).mockResolvedValue([]);
    (api.createWorkspaceWatchlist as unknown as vi.Mock).mockRejectedValue(
      new Error('oops')
    );

    render(<WorkspaceWatchlistManager />);
    await waitFor(() => {
      expect(api.listProjects).toHaveBeenCalled();
      expect(api.listWorkspaceWatchlist).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Add to watchlist'));

    await waitFor(() => {
      expect(screen.getByText('oops')).toBeInTheDocument();
    });
  });
});
