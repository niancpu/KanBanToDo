# KanBan ToDo — 项目记忆

## 部署

### 后端服务器
- 地址：43.139.169.47（SSH Host: `TX`）
- 用户：wnz
- 项目路径：`~/kanbantodo`
- 进程管理：`npx pm2`（ecosystem.config.js）
- 数据库：PostgreSQL 本地实例

### 部署流程
1. 将修改的 server 文件 scp 到服务器：`scp server/src/xxx.ts TX:~/kanbantodo/src/xxx.ts`
2. SSH 到服务器编译：`ssh TX "cd ~/kanbantodo && npx nest build"`
3. 重启服务：`ssh TX "cd ~/kanbantodo && npx pm2 restart kanbantodo"`

### 前端
- `client/.env` 中 `VITE_API_URL` 指向远程后端，后端无需本地启动
- 开发：`cd client && pnpm dev`（Vite dev server）
- 桌面端开发：`cd client && pnpm tauri dev`

## 打包规则

- 打包前必须更新版本号，同时改两个文件：
  - `client/package.json` → `"version"`
  - `client/src-tauri/tauri.conf.json` → `"version"`
- 打包命令：`cd client && pnpm tauri build`
- 产物：`client/src-tauri/target/release/bundle/nsis/KanBan ToDo_x.x.x_x64-setup.exe`
- 推送到 GitHub：`git push origin main`（仓库：https://github.com/niancpu/KanBanToDo.git）

## 认证

- 管理员用户「一念」：用户名 + 密码登录，无需邮箱验证，密码用 bcrypt hash
- 普通用户：用户名 + 密码 + 邮箱验证码注册登录

## 项目概述

pnpm monorepo 个人效率桌面应用：Vue 3 + Vuetify 3 + Tauri 2 (client) / NestJS + Drizzle + PostgreSQL (server) / shared types。
核心功能：每日看板（四列拖拽）、项目管理（WBS 树 + 甘特图）、习惯追踪（连续天数）、日历视图。

## DESIGN.md 中 19 个 bug 的修复状态

已修复：#1 Column ID 硬编码、#2 拖拽绑定 computed、#3 onDragEnd targetColId、#4 priority 未传递、#5 优先级颜色映射、#6 moveCard sortOrder、#7 不读取 route query date、#8 getStreak 今天显示 0、#9 sync.ts 类型错误、#10 by-status 索引、#11 DB schema 类型、#12 api.delete 204 崩溃、#13 WebSocket 无条件重连、#14 CalendarView events 空、#15 删除缺少确认弹窗、#16 userId 硬编码、#17 全量 getAll 未利用索引、#18 无路由守卫、#19 vuedraggable 兼容性。

## 工作规则

- 修复一个 bug 后，从「仍存在的 Bug」中删除对应条目
- 如果是 DESIGN.md 中编号的 bug，移到「已修复」列表中
- 修改了 server 文件后，必须自动执行部署流程（scp → nest build → pm2 restart）
- 启动前端时用 `pnpm tauri dev`（这是 Tauri 桌面应用，不是纯 Web），用后台任务运行
- 临时使用的脚本、调试文件用完后必须删除，不要留在项目中

## 仍存在的 Bug

（暂无）

## 未实现的功能（DESIGN.md 中描述）

- WBS ↔ 每日看板拖拽关联（右上角浮现按钮区域只有 UI 壳，无实际逻辑）
- 甘特图拖拽交互（调整日期、平移区间）
- CRDT 同步引擎
- 多设备同步
- 自定义列拖拽排序（store 方法 reorderColumns 存在，但 UI 未接入拖拽）

## 关键文件索引

| 文件 | 说明 |
|------|------|
| `client/src/stores/board.ts` | 每日看板核心逻辑 |
| `client/src/views/DailyBoardView.vue` | 看板 UI + 拖拽 |
| `client/src/stores/habit.ts` | 习惯 CRUD + 打卡 |
| `client/src/composables/useStreak.ts` | 连续天数算法 |
| `client/src/db/index.ts` | IndexedDB schema (v4) |
| `client/src/services/sync.ts` | SyncEngine (WebSocket + opLog) |
| `server/src/database/schema.ts` | Drizzle ORM schema |
| `shared/src/types/` | 共享 TypeScript 接口 |
| `DESIGN.md` | 完整架构规格文档 |

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
