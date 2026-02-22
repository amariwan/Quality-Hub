"""add advanced ops center feature tables

Revision ID: 0005_ops_center_adv_features
Revises: 0004_ops_center_features
Create Date: 2026-02-22 23:20:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0005_ops_center_adv_features"
down_revision = "0004_ops_center_features"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "release_train_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False, server_default=sa.text("'release'")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'planned'")),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_release_train_events_owner_user_id", "release_train_events", ["owner_user_id"])
    op.create_index("ix_release_train_events_workspace_group_id", "release_train_events", ["workspace_group_id"])
    op.create_index("ix_release_train_events_project_id", "release_train_events", ["project_id"])
    op.create_index("ix_release_train_events_status", "release_train_events", ["status"])
    op.create_index("ix_release_train_events_start_at", "release_train_events", ["start_at"])
    op.create_index("ix_release_train_events_end_at", "release_train_events", ["end_at"])

    op.create_table(
        "remediation_playbooks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("trigger_type", sa.String(length=64), nullable=False, server_default=sa.text("'alert_rule'")),
        sa.Column("action_type", sa.String(length=64), nullable=False, server_default=sa.text("'notify'")),
        sa.Column("config_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_remediation_playbooks_owner_user_id", "remediation_playbooks", ["owner_user_id"])
    op.create_index("ix_remediation_playbooks_workspace_group_id", "remediation_playbooks", ["workspace_group_id"])
    op.create_index("ix_remediation_playbooks_team_id", "remediation_playbooks", ["team_id"])
    op.create_index("ix_remediation_playbooks_active", "remediation_playbooks", ["active"])

    op.create_table(
        "service_slos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("service_name", sa.String(length=255), nullable=False),
        sa.Column("slo_target_pct", sa.Float(), nullable=False, server_default=sa.text("99.9")),
        sa.Column("window_days", sa.Integer(), nullable=False, server_default=sa.text("30")),
        sa.Column("error_budget_remaining_pct", sa.Float(), nullable=False, server_default=sa.text("100")),
        sa.Column("availability_pct", sa.Float(), nullable=False, server_default=sa.text("100")),
        sa.Column("burn_rate", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'healthy'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_service_slos_owner_user_id", "service_slos", ["owner_user_id"])
    op.create_index("ix_service_slos_workspace_group_id", "service_slos", ["workspace_group_id"])
    op.create_index("ix_service_slos_project_id", "service_slos", ["project_id"])
    op.create_index("ix_service_slos_status", "service_slos", ["status"])

    op.create_table(
        "rollout_guardrails",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("canary_required", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("canary_success_rate_min_pct", sa.Float(), nullable=False, server_default=sa.text("98")),
        sa.Column("max_flag_rollout_pct", sa.Float(), nullable=False, server_default=sa.text("50")),
        sa.Column("block_if_error_budget_below_pct", sa.Float(), nullable=False, server_default=sa.text("25")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_rollout_guardrails_owner_user_id", "rollout_guardrails", ["owner_user_id"])
    op.create_index("ix_rollout_guardrails_workspace_group_id", "rollout_guardrails", ["workspace_group_id"])
    op.create_index("ix_rollout_guardrails_project_id", "rollout_guardrails", ["project_id"])
    op.create_index("ix_rollout_guardrails_active", "rollout_guardrails", ["active"])

    op.create_table(
        "service_dependencies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("source_project_id", sa.Integer(), nullable=False),
        sa.Column("target_project_id", sa.Integer(), nullable=False),
        sa.Column("criticality", sa.String(length=16), nullable=False, server_default=sa.text("'medium'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "owner_user_id",
            "workspace_group_id",
            "source_project_id",
            "target_project_id",
            name="uq_service_dependencies_owner_scope_source_target",
        ),
    )
    op.create_index("ix_service_dependencies_owner_user_id", "service_dependencies", ["owner_user_id"])
    op.create_index("ix_service_dependencies_workspace_group_id", "service_dependencies", ["workspace_group_id"])
    op.create_index("ix_service_dependencies_source_project_id", "service_dependencies", ["source_project_id"])
    op.create_index("ix_service_dependencies_target_project_id", "service_dependencies", ["target_project_id"])

    op.create_table(
        "postmortems",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("incident_link_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("root_cause", sa.Text(), nullable=True),
        sa.Column("impact", sa.Text(), nullable=True),
        sa.Column("action_items_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["incident_link_id"], ["incident_links.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_postmortems_owner_user_id", "postmortems", ["owner_user_id"])
    op.create_index("ix_postmortems_workspace_group_id", "postmortems", ["workspace_group_id"])
    op.create_index("ix_postmortems_incident_link_id", "postmortems", ["incident_link_id"])
    op.create_index("ix_postmortems_status", "postmortems", ["status"])

    op.create_table(
        "change_approvals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("release_version", sa.String(length=128), nullable=False),
        sa.Column("required_roles_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("approvals_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("requested_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_change_approvals_owner_user_id", "change_approvals", ["owner_user_id"])
    op.create_index("ix_change_approvals_workspace_group_id", "change_approvals", ["workspace_group_id"])
    op.create_index("ix_change_approvals_project_id", "change_approvals", ["project_id"])
    op.create_index("ix_change_approvals_status", "change_approvals", ["status"])

    op.create_table(
        "webhook_automations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_group_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False, server_default=sa.text("'release_blocked'")),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("secret_ref", sa.String(length=255), nullable=True),
        sa.Column("headers_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_status", sa.String(length=32), nullable=True),
        sa.Column("last_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_group_id"], ["monitored_groups.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_webhook_automations_owner_user_id", "webhook_automations", ["owner_user_id"])
    op.create_index("ix_webhook_automations_workspace_group_id", "webhook_automations", ["workspace_group_id"])
    op.create_index("ix_webhook_automations_active", "webhook_automations", ["active"])


def downgrade() -> None:
    op.drop_index("ix_webhook_automations_active", table_name="webhook_automations")
    op.drop_index("ix_webhook_automations_workspace_group_id", table_name="webhook_automations")
    op.drop_index("ix_webhook_automations_owner_user_id", table_name="webhook_automations")
    op.drop_table("webhook_automations")

    op.drop_index("ix_change_approvals_status", table_name="change_approvals")
    op.drop_index("ix_change_approvals_project_id", table_name="change_approvals")
    op.drop_index("ix_change_approvals_workspace_group_id", table_name="change_approvals")
    op.drop_index("ix_change_approvals_owner_user_id", table_name="change_approvals")
    op.drop_table("change_approvals")

    op.drop_index("ix_postmortems_status", table_name="postmortems")
    op.drop_index("ix_postmortems_incident_link_id", table_name="postmortems")
    op.drop_index("ix_postmortems_workspace_group_id", table_name="postmortems")
    op.drop_index("ix_postmortems_owner_user_id", table_name="postmortems")
    op.drop_table("postmortems")

    op.drop_index("ix_service_dependencies_target_project_id", table_name="service_dependencies")
    op.drop_index("ix_service_dependencies_source_project_id", table_name="service_dependencies")
    op.drop_index("ix_service_dependencies_workspace_group_id", table_name="service_dependencies")
    op.drop_index("ix_service_dependencies_owner_user_id", table_name="service_dependencies")
    op.drop_table("service_dependencies")

    op.drop_index("ix_rollout_guardrails_active", table_name="rollout_guardrails")
    op.drop_index("ix_rollout_guardrails_project_id", table_name="rollout_guardrails")
    op.drop_index("ix_rollout_guardrails_workspace_group_id", table_name="rollout_guardrails")
    op.drop_index("ix_rollout_guardrails_owner_user_id", table_name="rollout_guardrails")
    op.drop_table("rollout_guardrails")

    op.drop_index("ix_service_slos_status", table_name="service_slos")
    op.drop_index("ix_service_slos_project_id", table_name="service_slos")
    op.drop_index("ix_service_slos_workspace_group_id", table_name="service_slos")
    op.drop_index("ix_service_slos_owner_user_id", table_name="service_slos")
    op.drop_table("service_slos")

    op.drop_index("ix_remediation_playbooks_active", table_name="remediation_playbooks")
    op.drop_index("ix_remediation_playbooks_team_id", table_name="remediation_playbooks")
    op.drop_index("ix_remediation_playbooks_workspace_group_id", table_name="remediation_playbooks")
    op.drop_index("ix_remediation_playbooks_owner_user_id", table_name="remediation_playbooks")
    op.drop_table("remediation_playbooks")

    op.drop_index("ix_release_train_events_end_at", table_name="release_train_events")
    op.drop_index("ix_release_train_events_start_at", table_name="release_train_events")
    op.drop_index("ix_release_train_events_status", table_name="release_train_events")
    op.drop_index("ix_release_train_events_project_id", table_name="release_train_events")
    op.drop_index("ix_release_train_events_workspace_group_id", table_name="release_train_events")
    op.drop_index("ix_release_train_events_owner_user_id", table_name="release_train_events")
    op.drop_table("release_train_events")
