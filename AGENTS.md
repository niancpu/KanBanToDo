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

## AI 编码约束（Vibe Coding Rules）

- **只做被要求的事** — 不擅自重构、优化、扩展未提及的代码。
- **先读后写** — 修改任何文件前必须先读完相关上下文，遵循已有模式。
- **不引入幻觉** — 不使用未安装的依赖、不编造不存在的 API 或方法。
- **不过度工程** — 三行能解决的不抽函数，一次性逻辑不建抽象层。
- **不留垃圾** — 禁止残留 `console.log`、注释掉的旧代码、空 TODO、调试临时文件。
- **不加废话注释** — 代码自解释即可，只在逻辑不直观处加注释。
- **不膨胀依赖** — 能用现有依赖或原生实现的，不引入新包。
- **控制文件长度** — 单文件超过 500 行时必须考虑拆分。当一个文件持续增长，说明它承担了过多职责，应将独立的功能块提取为单独的模块或组件，而不是在同一个文件里不断追加代码。
- **不破坏现有模式** — 项目已有的命名、分层、风格约定必须沿用，不另起一套。
- **不假装完成** — 每行代码必须是可运行的实现，禁止 placeholder 或空壳函数。
- **交付前自查** — 改完后验证类型检查通过、无遗留调试代码、不影响已有功能。
