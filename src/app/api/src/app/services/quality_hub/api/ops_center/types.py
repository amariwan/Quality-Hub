from __future__ import annotations

from typing import Any, TypedDict


class OpsOverviewRows(TypedDict):
    release_gates: list[Any]
    alert_rules: list[Any]
    incident_links: list[Any]
    templates: list[Any]
    audits: list[Any]
    release_trains: list[Any]
    remediation_playbooks: list[Any]
    service_slos: list[Any]
    guardrails: list[Any]
    dependencies: list[Any]
    postmortems: list[Any]
    change_approvals: list[Any]
    webhooks: list[Any]
