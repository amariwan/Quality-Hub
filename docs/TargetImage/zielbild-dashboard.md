# Zielbild

Ein zentrales das für jede Gruppe/Projekt/Branch/MR die folgenden Kennzahlen darstellt:

- ✅ **Pipeline Status**
  - Aktueller Zustand der letzten Pipeline
  - Trend-Visualisierung über Zeit
  - Laufzeit der Pipelines

- 🧪 **Tests**
  - Anzahl bestandener, fehlgeschlagener und übersprungener Tests
  - Flakiness-Indikator (Instabilität einzelner Tests über Zeit)

- 📈 **Coverage**
  - Verlauf der Testabdeckung
  - Delta im Vergleich zum `main`-Branch

- 🧹 **Lint/Static Analysis**
  - Anzahl gefundener Probleme
  - Aufschlüsselung nach Schweregrad

- 🔐 **Security**
  - Ergebnisse aus SAST-Scans
  - Abhängigkeitsscans (Dependency)
  - Container-Scans

- 📄 **Docs**
  - Build-Status der Dokumentation
  - Zeitpunkt der letzten Aktualisierung
  - Prüfen auf defekte Links

- 🚀 **Deployments/Envs** _(optional)_
  - Übersicht über Deployments und Umgebungen

- 👥 **Ownership**
  - Zuständiges Team
  - Informationen aus `CODEOWNERS`
  - Ansprechpartner / Maintainer

Dieses Dashboard dient als zentrale Übersicht zur schnellen Beurteilung des Gesundheitszustands und der Verantwortlichkeiten in unserem Entwicklungssystem.
