# Repository Guidelines

## Project Structure & Module Organization
This is a workspace monorepo with three packages:

- `client/`: Vue 3 + TypeScript UI, Vuetify components, and Tauri desktop wrapper (`src-tauri/`).
- `server/`: NestJS API and WebSocket sync service, with Drizzle/PostgreSQL integration.
- `shared/`: shared TypeScript types/enums used by both client and server.
- `release/`: built installers/APKs; treat as output artifacts, not source.

Keep business contracts in `shared/src/` first, then consume them from `client/src/` and `server/src/`.

## Build, Test, and Development Commands
- `npm install`: install workspace dependencies from repo root.
- `npm run dev`: run server (`start:dev`) and desktop client (`tauri dev`) together.
- `npm run server:dev`: run only NestJS in watch mode.
- `npm run client:dev`: run Tauri desktop dev flow.
- `npm --workspace client run lint`: run `oxlint` + `eslint` autofixes.
- `npm --workspace client run format`: format client source with Prettier.
- `npm --workspace server run build`: compile server to `server/dist`.

## Coding Style & Naming Conventions
- Follow `.editorconfig`: UTF-8, LF endings, 2-space indentation.
- Client formatting rules (`client/.prettierrc.json`): single quotes, no semicolons, max line width 100.
- Use Vue/Nest defaults already present in the codebase:
  - Vue components/views: `PascalCase.vue` (for example `DailyBoardView.vue`).
  - Composables: `useX.ts` (for example `useStreak.ts`).
  - Stores/services/utilities: concise `camelCase` file names.

## Testing Guidelines
There is no committed automated test suite yet. Before opening a PR:

- run `npm --workspace client run type-check`
- run `npm --workspace client run lint`
- run `npm --workspace server run build`
- smoke-test key flows (login, board drag/drop, habit updates, sync).

When adding tests, colocate them near source files using `*.spec.ts` naming.

## Commit & Pull Request Guidelines
Follow the existing commit style from history: `feat:`, `fix:`, `refactor:`, `docs:` + short summary.

PRs should include:
- clear scope (`client`, `server`, `shared`, or combinations),
- linked issue/task ID when available,
- screenshots/video for UI changes,
- notes for schema or env var changes (`DATABASE_URL`, `JWT_SECRET`, `SMTP_*`, `VITE_API_URL`).
