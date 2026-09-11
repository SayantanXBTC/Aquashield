# animations/

UI/timeline animation, separated from Three.js render-loop logic (which stays in three/). Anime.js belongs here; do not mix it into three/ render loops.

- transitions/ — view/panel transitions
- timeline/ — timeline scrubbing/playback animation
- disasters/ — disaster-progression animation helpers (non-3D, e.g. UI-side state easing)
- micro-interactions/ — buttons, alerts, small UI feedback animation
