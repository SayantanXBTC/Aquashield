# infrastructure/

Local development infrastructure. Deployment infrastructure (reverse proxy, production environment templates, monitoring) is still future work — not over-engineered before it's needed.

- `docker-compose.yml` — local PostgreSQL + PostGIS. Start with `docker compose -f infrastructure/docker-compose.yml up -d` from the repo root. See [docs/development/database.md](../docs/development/database.md).
