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

已修复：#1 Column ID 硬编码、#2 拖拽绑定 computed、#3 onDragEnd targetColId、#4 priority 未传递、#5 优先级颜色映射、#6 moveCard sortOrder、#7 不读取 route query date、#8 getStreak 今天显示 0、#9 sync.ts 类型错误、#10 by-status 索引、#11 DB schema 类型、#12 api.delete 204 崩溃、#14 CalendarView events 空、#18 无路由守卫、#19 vuedraggable 兼容性。

## 仍存在的 Bug

### 🔴 功能缺失（DESIGN.md 描述了但未实现的双向同步）

1. **习惯卡片拖到 Done 列不会同步 HabitRecord**
   - 位置：`stores/board.ts` moveCard
   - 问题：moveCard 没有检查 card.linkedHabitId，拖到 Done 列不会调用 habitStore.checkIn
   - DESIGN.md 要求：看板拖拽完成 ↔ 习惯打卡 双向同步

2. **WBS 节点状态不随看板卡片同步**
   - 位置：`stores/board.ts` moveCard
   - 问题：moveCard 没有检查 card.linkedProjectNodeId，不会调用 projectStore.syncNodeStatus
   - DESIGN.md 要求：卡片拖到 Done → WbsNode.status = Done, progress = 100

3. **删除习惯不清理看板中关联的卡片**
   - 位置：`stores/habit.ts` deleteHabit
   - 问题：删除习惯后，看板中 linkedHabitId 指向已删除习惯的卡片仍然残留

### 🟠 数据问题

4. **userId 全部硬编码空字符串**
   - 位置：`stores/board.ts:149`、`stores/project.ts:30`、`stores/habit.ts:37`
   - 问题：Board/Project/Habit 创建时 userId 写死 ''，多用户场景数据无法隔离

5. **CalendarView 数据不实时刷新**
   - 位置：`views/CalendarView.vue` loadCalendarData
   - 问题：boardCache 只在 onMounted 加载一次，从看板页操作后返回日历页不会更新统计数据

### 🟡 体验 / 健壮性

6. **WebSocket 登出后仍可能重连**
   - 位置：`services/sync.ts`
   - 问题：socket.io 默认 reconnection:true，如果网络断开触发自动重连，connect handler 会调 pull()，若用户已登出则请求会失败

7. **findPreviousBoard 效率低**
   - 位置：`stores/board.ts:35-44`
   - 问题：最多循环 30 次 IndexedDB 单条查询，应改为范围查询或游标

8. **拖拽过程中可能视觉闪烁**
   - 位置：`views/DailyBoardView.vue`
   - 问题：moveCard 更新 store → 触发 cardsByColumn watcher → syncCardModels 重写 columnCardModels，与 vue-draggable-plus 内部状态冲突

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
| `client/src/db/index.ts` | IndexedDB schema (v3) |
| `client/src/services/sync.ts` | SyncEngine (WebSocket + opLog) |
| `server/src/database/schema.ts` | Drizzle ORM schema |
| `shared/src/types/` | 共享 TypeScript 接口 |
| `DESIGN.md` | 完整架构规格文档 |
