# AGENTS.md

"Gemini Transcribe" — a single-page React app with an Express backend that
transcribes audio with speaker diarization via Gemini, lets the user edit the
result in the browser, and imports/exports CSV. No test suite, CI, or lockfile.

## Commands

- `npm run dev` — the dev server. Runs `tsx server.ts`, which starts Express on
  port `3000` (`PORT` to override) and mounts Vite in **middleware mode**. This
  is not `vite`; editing frontend code goes through this process.
- `npm run build` — `vite build` → `dist/`.
- `NODE_ENV=production npm start` — serves `dist/` + SPA fallback. `start` is
  otherwise identical to `dev` (without `NODE_ENV=production` it uses Vite
  middleware), so production behavior only activates in prod mode.
- `npm run lint` — actually just `tsc --noEmit` (typecheck). There is **no
  ESLint**; do not look for or add one.
- Gotcha: `npm run clean` uses `rm -rf` and **fails on Windows PowerShell**.

## Layout

- `server.ts` — the entire backend. Two routes: `GET /api/health` and
  `POST /api/transcribe`. Gemini calls and all fallback logic live here.
- `src/App.tsx` — the single stateful root component. Nearly all state,
  localStorage persistence, keyboard shortcuts, and cross-component wiring are
  here; new features usually touch this file plus one component.
- `src/components/*` — presentational, props-driven children of `App`.
- `src/utils/*` — pure logic: `time.ts` (timestamp parsing), `csv.ts`,
  `colors.ts` (speaker colors), `sampleData.ts` (demo transcripts + synthesized
  WAV).
- `src/types.ts` — `TranscriptSegment` (`{ id, timestamp, speaker, text }`) is
  the core shape shared by server and client. Keep both sides aligned.
- `@` → repo root alias is set in both `vite.config.ts` and `tsconfig.json`, but
  existing code imports relatively. Match the relative style.

## Backend / Gemini

- Requires `GEMINI_API_KEY`. `server.ts` uses `dotenv.config()`, which loads
  `.env` — the README's `.env.local` is **not** read unless it is `.env`.
- `POST /api/transcribe` routes across models with automatic fallback, in order:
  `gemini-3.5-transcribe` (native diarization + word timestamps) → on quota/error
  `gemini-3.1-flash-lite` → `gemini-3.8-flash`. Speaker-*name* inference uses
  `gemini-3.1-flash-lite`, then `gemini-3.8-flash`. Update all tiers together.
- The response carries `usedNativeDiarization`, `isQuotaFallback`, and
  `fallbackNotice`; the UI displays them. Preserve these flags when editing.
- Speaker names are sanitized: role titles (面接官, 応募者, 司会, … — see
  `ROLE_KEYWORDS`) are rejected; unknown speakers become `話者A/B/C`.
- JSON body limit is `100mb` because audio is sent inline as base64.

## Conventions / gotchas

- CSV schema is fixed: columns `id,timestamp,speaker,text`; export prepends a
  UTF-8 BOM. Import auto-detects UTF-8 vs Shift-JIS, comma vs tab, and accepts
  Japanese headers — see `src/utils/csv.ts` before changing either side.
- Timestamps are free-form strings (`"MM:SS"` or `"MM:SS - MM:SS"`). Parse via
  `src/utils/time.ts`; do not assume a single format.
- User-model labels shown in the UI (e.g. "Gemini 3.5 Transcribe" and the
  fallback copy in `AudioInputSection.tsx`) describe the server's model routing.
  Keep them in sync with `server.ts`.
- React 19 + Tailwind v4 via `@tailwindcss/vite`; CSS is just
  `@import "tailwindcss"` — there is no `tailwind.config`, do not add one.
- `localStorage` keys are prefixed `transcription_editor_*`; renaming them
  silently discards users' saved sessions.
- `vite.config.ts` honors `DISABLE_HMR` (AI Studio disables file watching); do
  not "fix" it.
- `README.md` and `metadata.json` are AI Studio boilerplate — trust code and
  config over the README.
