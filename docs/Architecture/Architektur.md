# 🎯 Zielbild

**Projekt:** Quality-Hub

Ein zentrales Web-Dashboard, das pro **Gruppe/Projekt/Branch/MR** zeigt:

- ✅ Pipeline Status (last, trend, duration)
- 🧪 Tests (passed/failed/skipped) + flakiness
- 📈 Coverage (trend, delta zum main)
- 🧹 Lint/Static analysis (count, severity)
- 🔐 Security (SAST/Dependency/Container scan findings)
- 📄 Docs (Build Status, “last updated”, broken links)
- 🚀 Deployments/Envs (optional)
- 👥 Ownership (Team, CODEOWNERS, Maintainer)

---

# 🧱 Architektur (modular, aber “alles in eins” UI)

## 1) Data Ingestion (2 Wege)

### A) **GitLab API Pull**

- Pipelines, Jobs, MR, Issues, Releases, Environments
- Vorteil: schnell, zuverlässig

### B) **CI Push (Artefakte & Reports)**

Deine Pipeline lädt Reports in deinen Service hoch:

- `junit.xml`
- `coverage.xml` / `lcov.info`
- `eslint.json` / `checkstyle.xml`
- `sarif.json`
- `sbom.json` (CycloneDX / SPDX)
- `mkdocs build log` / `linkcheck`

👉 Das ist der “goldene Weg”, weil du **Format-agnostisch** wirst.

---

# 🗄️ Datenmodell (wichtig für “Teamlead Sicht”)

Minimal-Schema:

- `projects` (gitlab_id, path, group, default_branch)
- `pipelines` (project_id, pipeline_id, sha, ref, status, started_at, duration)
- `reports` (pipeline_id, type, parser_version, summary_json, raw_artifact_url)
- `metrics_timeseries` (project_id, ref, metric, value, ts)
- `ownership` (project_id, team, codeowners)

**Reports** bleiben “raw + normalized summary”.
So kannst du später neue Parsers hinzufügen ohne DB-Migration-Hölle.

---

# 🧩 Parsers (du willst “alles in eins”)

Implementiere Parser-Module:

- **JUnit** → tests passed/failed/skipped + suites + flaky detection
- **Coverage** (lcov/cobertura/jacoco) → % total + delta + files hot spots
- **Lint** (ESLint, Stylelint, Flake8, Checkstyle) → counts by severity + top rules
- **SARIF** (SAST) → findings by tool + severity + file
- **SBOM** → vuln summary (wenn du später CVE feeds anbinden willst)
- **Docs** → build status + last commit that touched docs + linkcheck errors

---

# 🖥️ UI/UX (was Teamleiter wirklich braucht)

**1. Portfolio Overview (alle Projekte)**

- Ampel-Status je Projekt (Quality Gate)
- Trends (7/30 Tage)
- “Top regressions” (wer ist schlechter geworden)

**2. Projekt-Detail**

- Pipeline timeline
- Tests/coverage/lint/security cards
- MR-Quality Delta (was hat dieser MR verschlechtert?)

**3. Drilldown**

- “Top failing tests” + flaky chart
- “Top lint rules”
- “Top vulnerable components”
- “Docs broken links”

---

# 🔌 GitLab Integration (realistisch & sauber)

## Auth

- GitLab OAuth (für User Login)
- Optional: Service Account Token fürs polling

## Events

- **GitLab Webhooks**
  - Pipeline events
  - Job events
  - Merge request events
  - Release events

Damit dein Dashboard “live” ist, ohne ständig zu poll’en.

---

# 🛠️ Tech Stack Empfehlung (pragmatisch, schnell, robust)

### Backend

- **FastAPI (Python)** oder **NestJS (Node)**
- Background worker: **Celery/RQ** (Python) oder **BullMQ** (Node)
- DB: **PostgreSQL**
- Cache/Queue: **Redis**

### Frontend

- **Next.js** (du bist ja eh im TS/Next Ökosystem)
- Charts: Recharts / ECharts

### Storage

- Artefakte: **S3/MinIO** (self-hosted friendly)
- Optional: nur summary speichern, raw in GitLab artifacts belassen

---

# 🚀 MVP in 7 Tagen (wirklich machbar)

## MVP Scope (nicht zu groß!)

**In MVP:**

- GitLab OAuth login
- Projektliste (Group)
- Letzte Pipeline + Status + Dauer
- JUnit: pass/fail + Top failing tests
- Coverage: total % + trend
- Lint: count + severity
- Docs: build status (z.B. mkdocs job)
- Webhook ingest + report upload endpoint

**Später:**

- SAST/SARIF
- SBOM & vulns
- Flakiness detection
- Ownership & team slicing
- SLAs / DORA

---

# ✅ CI Beispiel (Push Reports in dein System)

Deine GitLab CI produziert Reports und lädt sie hoch:

- Tests erzeugen `junit.xml`
- Coverage erzeugt `lcov.info`
- ESLint erzeugt `eslint.json`

Dann:

- `curl -H "Authorization: Bearer $QH_TOKEN" -F "file=@junit.xml" https://quality-hub/api/reports/junit?pipeline_id=$CI_PIPELINE_ID`

👉 Dadurch ist dein Dashboard unabhängig von “GitLab UI-Features”.

---

# 🔥 “Quality Gate” (Ampel Logik)

Du definierst Regeln:

- **RED**: pipeline failed OR critical security findings OR coverage drop > 2%
- **YELLOW**: lint errors increased OR flaky test detected
- **GREEN**: all ok

Das ist für Teamlead-Übersicht Gold. 🟢🟡🔴
