# Archived: legacy Vite frontend

This folder previously contained an early Vite-based frontend prototype. The active frontend is now the Next.js app under `frontend/cruip-landing`.

Changes in this commit:
- Removed the invalid `frontend/package.json` (it mistakenly contained Markdown text)
- Excluded `./frontend/**` from the root `build:all` script so CI and local builds won’t touch this folder

If you need to revive the Vite app, create a fresh `package.json` and restore dependencies, or copy content into a new location.

