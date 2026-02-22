"""add workspace_group_id to notes

Revision ID: 0003_notes_workspace_scope
Revises: 0002_team_project_mappings
Create Date: 2026-02-22 21:40:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0003_notes_workspace_scope"
down_revision = "0002_team_project_mappings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notes", sa.Column("workspace_group_id", sa.Integer(), nullable=True))
    op.create_index("ix_notes_workspace_group_id", "notes", ["workspace_group_id"])
    op.create_foreign_key(
        "fk_notes_workspace_group_id_monitored_groups",
        "notes",
        "monitored_groups",
        ["workspace_group_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_notes_workspace_group_id_monitored_groups", "notes", type_="foreignkey")
    op.drop_index("ix_notes_workspace_group_id", table_name="notes")
    op.drop_column("notes", "workspace_group_id")
