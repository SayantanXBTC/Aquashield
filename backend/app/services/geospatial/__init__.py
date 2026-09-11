"""Real-world geospatial data foundation: providers that fetch/parse a public
dataset, a service that ingests it into GeographicDataset/GeographicFeature,
and the spatial-analysis helpers (exposure/vulnerability) built on top of it.
No FastAPI/route logic lives here — app/api/routes/ calls into this package
via app/services (route -> service -> repository, CLAUDE.md §25)."""
