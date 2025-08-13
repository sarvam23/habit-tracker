# 8‑Bit Habits

A minimalistic black/white, 8‑bit inspired habit and task tracker. No build step, just open `index.html`.

## Features
- Habit tracking with daily target and 7‑day mini history
- Task tracking with step goals
- Blocky progress bars and pixel‑art canvas that reflects overall progress
- Black/white theme with light/dark toggle
- Local storage persistence
- Export/Import JSON backup

## Run
- Option 1: Open `index.html` in a browser
- Option 2: Serve locally
  - Python: `python3 -m http.server 8000` then visit `http://localhost:8000`

## Data
Saved in browser `localStorage` under key `pixelHabitsData.v1`.