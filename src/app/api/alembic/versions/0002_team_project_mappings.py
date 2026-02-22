"""add team_project_mappings table

Revision ID: 0002_team_project_mappings
Revises: 0001_quality_hub_base
Create Date: 2026-02-22 19:30:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0002_team_project_mappings"
down_revision = "0001_quality_hub_base"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "team_project_mappings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("team_id", "project_id", name="uq_team_project_mappings_team_project"),
    )
    op.create_index("ix_team_project_mappings_team_id", "team_project_mappings", ["team_id"])
    op.create_index("ix_team_project_mappings_project_id", "team_project_mappings", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_team_project_mappings_project_id", table_name="team_project_mappings")
    op.drop_index("ix_team_project_mappings_team_id", table_name="team_project_mappings")
    op.drop_table("team_project_mappings")
