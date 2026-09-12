"""Wipe every scenario, scenario version, simulation run, artifact, and
derived assessment row from PostgreSQL, plus the JSON timeline artifacts
under simulation/outputs/.

Reference geodata (geographic_datasets/features, infrastructure_assets) is
NOT touched — it is ingested reference data, not user scenario data.

Destructive and irreversible. Run from the repo root:

    .venv/bin/python scripts/wipe_scenario_data.py --yes
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
for p in (str(REPO_ROOT), str(BACKEND_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

# Settings read backend/.env relative to the cwd — make that explicit.
import os

os.chdir(BACKEND_ROOT)

from sqlalchemy import text  # noqa: E402

from app.config.settings import settings  # noqa: E402
from app.db.session import engine  # noqa: E402

# Order does not matter: TRUNCATE ... CASCADE follows the FK graph.
TABLES = [
    "scenarios",
    "scenario_versions",
    "simulation_runs",
    "simulation_artifacts",
    "risk_assessments",
    "vulnerability_assessments",
    "response_recommendations",
    "incident_action_plans",
    "audit_events",
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--yes", action="store_true", help="actually wipe (otherwise dry run)")
    args = parser.parse_args()

    with engine.connect() as conn:
        existing = {
            row[0]
            for row in conn.execute(
                text("select tablename from pg_tables where schemaname = 'public'")
            )
        }
        targets = [t for t in TABLES if t in existing]
        counts = {t: conn.execute(text(f"select count(*) from {t}")).scalar() for t in targets}

    outputs_dir = Path(settings.simulation_output_dir)
    artifacts = sorted(outputs_dir.glob("*.json")) if outputs_dir.exists() else []

    print("Rows to delete:")
    for table, count in counts.items():
        print(f"  {table:28s} {count}")
    print(f"Artifact files to delete: {len(artifacts)} in {outputs_dir}")

    if not args.yes:
        print("\nDry run — re-run with --yes to wipe.")
        return 0

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE " + ", ".join(targets) + " RESTART IDENTITY CASCADE"))
    for path in artifacts:
        path.unlink()
    print("\nWiped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
