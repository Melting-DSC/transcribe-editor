# AGENTS.md

「文字起こしエディタ」— a browser-only single-page React app for editing
transcript data while listening to a locally attached audio file. It does **not**
transcribe audio: transcripts come from CSV import or manual entry. No backend,
no API calls, no API keys. No test suite or CI.

## Commands

- `npm run dev` — Vite dev server. This is a pure Vite SPA; there is no Express
  or custom server anymore.
- `npm run build` — `vite build` → `dist/`.
- `npm run preview` — serves the built `dist/` locally (no `/api` to worry about).
- `npm run lint` — actually just `tsc --noEmit` (typecheck). There is **no
  ESLint**; do not look for or add one.
- `npm run clean` — removes `dist/` via Node's `fs.rmSync` (cross-platform).

## Layout

- `src/App.tsx` — the single stateful root component. Nearly all state,
  localStorage persistence, keyboard shortcuts, and cross-component wiring are
  here; new features usually touch this file plus one component.
- `src/components/*` — presentational, props-driven children of `App`.
  - `ModalShell.tsx` — shared modal frame (overlay, Escape/backdrop close,
    `role="dialog"`). Use it for any new modal.
- `src/utils/*` — pure logic: `time.ts` (timestamp parsing), `csv.ts`,
  `colors.ts` (speaker colors), `sampleData.ts` (demo transcripts + synthesized
  WAV).
- `src/types.ts` — `TranscriptSegment` (`{ id, timestamp, speaker, text }`) is
  the core shape used throughout the app.
- `@` → repo root alias is set in both `vite.config.ts` and `tsconfig.json`, but
  existing code imports relatively. Match the relative style.

## Conventions / gotchas

- Everything is client-side. Do not reintroduce a server, `fetch` to an API, or
  any cloud/Gemini dependency.
- CSV schema is fixed: columns `id,timestamp,speaker,text`; export prepends a
  UTF-8 BOM. Import auto-detects UTF-8 vs Shift-JIS, comma vs tab, and accepts
  Japanese headers — see `src/utils/csv.ts` before changing either side.
- Timestamps are free-form strings (`"MM:SS"` or `"MM:SS - MM:SS"`). Parse via
  `src/utils/time.ts`; do not assume a single format.
- `localStorage` keys are prefixed `transcription_editor_*`; renaming them
  silently discards users' saved sessions. Audio files themselves cannot be
  persisted, so the app shows a "re-attach audio" notice instead.
- React 19 + Tailwind v4 via `@tailwindcss/vite`; CSS is just
  `@import "tailwindcss"` — there is no `tailwind.config`, do not add one.
- `vite.config.ts` honors `DISABLE_HMR` (AI Studio disables file watching); do
  not "fix" it.
- `metadata.json` is AI Studio boilerplate — trust code and config over it.
