"""add ops center feature tables

Revision ID: 0004_ops_center_features
Revises: 0003_notes_workspace_scope
Create Date: 2026-02-22 22:45:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0004_ops_center_features"
down_revision = "0003_notes_workspace_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "release_gate_policies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("max_release_risk_score", sa.Float(), nullable=False, server_default=sa.text("59")),
        sa.Column("min_release_readiness_pct", sa.Float(), nullable=False, server_default=sa.text("75")),
        sa.Column("min_delivery_confidence_pct", sa.Float(), nullable=False, server_default=sa.text("70")),
        sa.Column("require_green_build", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("block_on_open_incidents", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_release_gate_policies_owner_user_id", "release_gate_policies", ["owner_user_id"])
    op.create_index("ix_release_gate_policies_workspace_group_id", "release_gate_policies", ["workspace_group_id"])
    op.create_index("ix_release_gate_policies_team_id", "release_gate_policies", ["team_id"])
    op.create_index("ix_release_gate_policies_project_id", "release_gate_policies", ["project_id"])
    op.create_index("ix_release_gate_policies_active", "release_gate_policies", ["active"])

    op.create_table(
        "alert_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False, server_default=sa.text("'high'")),
        sa.Column("channel", sa.String(length=16), nullable=False, server_default=sa.text("'slack'")),
        sa.Column("condition_type", sa.String(length=64), nullable=False, server_default=sa.text("'release_risk'")),
        sa.Column("threshold_value", sa.Float(), nullable=False, server_default=sa.text("60")),
        sa.Column("escalation_minutes", sa.Integer(), nullable=False, server_default=sa.text("60")),
        sa.Column("recipients_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_alert_rules_owner_user_id", "alert_rules", ["owner_user_id"])
    op.create_index("ix_alert_rules_workspace_group_id", "alert_rules", ["workspace_group_id"])
    op.create_index("ix_alert_rules_team_id", "alert_rules", ["team_id"])
    op.create_index("ix_alert_rules_active", "alert_rules", ["active"])

    op.create_table(
        "incident_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("pipeline_id", sa.Integer(), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default=sa.text("'gitlab'")),
        sa.Column("external_issue_id", sa.String(length=255), nullable=False),
        sa.Column("external_url", sa.String(length=500), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'open'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pipeline_id"], ["pipelines.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_incident_links_owner_user_id", "incident_links", ["owner_user_id"])
    op.create_index("ix_incident_links_workspace_group_id", "incident_links", ["workspace_group_id"])
    op.create_index("ix_incident_links_project_id", "incident_links", ["project_id"])
    op.create_index("ix_incident_links_pipeline_id", "incident_links", ["pipeline_id"])
    op.create_index("ix_incident_links_status", "incident_links", ["status"])

    op.create_table(
        "workspace_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("definition_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.UniqueConstraint(
            "owner_user_id",
            "workspace_group_id",
            "name",
            name="uq_workspace_templates_owner_scope_name",
        ),
    )
    op.create_index("ix_workspace_templates_owner_user_id", "workspace_templates", ["owner_user_id"])
    op.create_index("ix_workspace_templates_workspace_group_id", "workspace_templates", ["workspace_group_id"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("details_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_audit_events_owner_user_id", "audit_events", ["owner_user_id"])
    op.create_index("ix_audit_events_workspace_group_id", "audit_events", ["workspace_group_id"])
    op.create_index("ix_audit_events_resource_type", "audit_events", ["resource_type"])
    op.create_index("ix_audit_events_resource_id", "audit_events", ["resource_id"])
    op.create_index("ix_audit_events_action", "audit_events", ["action"])


def downgrade() -> None:
    op.drop_index("ix_audit_events_action", table_name="audit_events")
    op.drop_index("ix_audit_events_resource_id", table_name="audit_events")
    op.drop_index("ix_audit_events_resource_type", table_name="audit_events")
    op.drop_index("ix_audit_events_workspace_group_id", table_name="audit_events")
    op.drop_index("ix_audit_events_owner_user_id", table_name="audit_events")
    op.drop_table("audit_events")

    op.drop_index("ix_workspace_templates_workspace_group_id", table_name="workspace_templates")
    op.drop_index("ix_workspace_templates_owner_user_id", table_name="workspace_templates")
    op.drop_table("workspace_templates")

    op.drop_index("ix_incident_links_status", table_name="incident_links")
    op.drop_index("ix_incident_links_pipeline_id", table_name="incident_links")
    op.drop_index("ix_incident_links_project_id", table_name="incident_links")
    op.drop_index("ix_incident_links_workspace_group_id", table_name="incident_links")
    op.drop_index("ix_incident_links_owner_user_id", table_name="incident_links")
    op.drop_table("incident_links")

    op.drop_index("ix_alert_rules_active", table_name="alert_rules")
    op.drop_index("ix_alert_rules_team_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_workspace_group_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_owner_user_id", table_name="alert_rules")
    op.drop_table("alert_rules")

    op.drop_index("ix_release_gate_policies_active", table_name="release_gate_policies")
    op.drop_index("ix_release_gate_policies_project_id", table_name="release_gate_policies")
    op.drop_index("ix_release_gate_policies_team_id", table_name="release_gate_policies")
    op.drop_index("ix_release_gate_policies_workspace_group_id", table_name="release_gate_policies")
    op.drop_index("ix_release_gate_policies_owner_user_id", table_name="release_gate_policies")
    op.drop_table("release_gate_policies")
