# Shared Contracts — AQUASHIELD

The stable integration surface between every domain (architecture.md §16, CLAUDE.md Repository Structure Rules). Frontend, backend, simulation, agents, and rag communicate through these contracts instead of inventing parallel formats. Treat a change here as an intentional cross-domain integration change, not a routine edit.

- schemas/ — Pydantic/JSON-schema definitions of shared data shapes
- types/ — TypeScript types mirroring schemas/ for the frontend
- contracts/ — API/WebSocket contract definitions (endpoints, event names, payload shapes)
- constants/ — shared enums/constants (disaster types, event names)

Examples of contracts expected to live here: Scenario definition, Simulation state, Timeline frame, Risk assessment, Vulnerability result, Agent request/response, Incident Action Plan, WebSocket event, API response.
