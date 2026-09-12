# features/

Business/application features. Each subfolder owns one user-facing capability and composes components/, three/, and animations/ as needed.

- command-center/ — main operational dashboard shell
- auth/ — Firebase session provider, route guard, token getter (Prompt 12)
- (scenario creation lives inside command-center/ — `NewTestModal` + `presets.ts`; the standalone builder was removed in Prompt 12)
- timeline/ — playback controls (play/pause/scrub/speed) UI
- alerts/ — alert/notification UI
- risk-analysis/ — vulnerability/risk result display
- response-plan/ — Incident Action Plan display
- data-layers/ — toggling/configuring map/visualization data layers
