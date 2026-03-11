# 模块：Client

## 模块路径

- `client/`
- 入口：`client/src/main.ts`
- 桌面壳：`client/src-tauri/`

## 模块职责

- 提供 Vue 3 + Vuetify 用户界面。
- 管理本地状态（Pinia）与本地数据（IndexedDB）。
- 负责与服务端 API/WebSocket 同步。
- 通过 Tauri 提供桌面端运行与打包能力。

## 目录与子模块

- `src/views/`
  - `DailyBoardView.vue`：每日看板主界面（列、卡片、拖拽、日期切换）
  - `HabitsView.vue`：习惯列表、打卡、编辑、删除
  - `CalendarView.vue`：月/周视图，聚合完成与习惯状态
  - `LoginView.vue`：登录、注册、验证码验证
- `src/stores/`
  - `auth.ts`：登录态、token、会话恢复、同步初始化/销毁
  - `board.ts`：看板/列/卡片 CRUD、拖拽重排、跨日继承、未来日期限制
  - `habit.ts`：习惯与打卡记录管理、与看板卡片联动
- `src/services/`
  - `api.ts`：HTTP 封装（带 JWT）
  - `sync.ts`：同步引擎（op log、push/pull、快照恢复）
  - `syncInstance.ts`：同步引擎单例与远端操作落地
- `src/db/`
  - `index.ts`：IndexedDB schema 与升级逻辑（`kanban-todo`，版本 5）
- `src/router/`
  - `index.ts`：路由与登录守卫
- `src/components/board/`
  - `CardItem.vue`：卡片组件
  - `CardDialog.vue`：卡片编辑/创建弹窗
- `src/composables/`
  - `useDateNav.ts`：日期导航
  - `useStreak.ts`：习惯连续状态计算
  - `useToast.ts`：全局消息通知
- `src/plugins/vuetify.ts`：UI 主题与默认组件配置
- `src-tauri/`
  - `tauri.conf.json`：应用标识、窗口、打包目标
  - `src/main.rs`、`src/lib.rs`：Tauri Rust 侧入口

## 主要数据流

1. 用户登录后 `auth` store 初始化同步引擎。
2. 业务操作先写本地 IndexedDB（boards/columns/cards/habits/habitRecords/opLog）。
3. 同步模块将本地 op 推送到服务端，并拉取远端 op 应用到本地。
4. 日历与看板视图从本地 store/DB 渲染，确保本地优先体验。

## 外部依赖

- `@kanban/shared`：共享类型与枚举
- `server`：`/auth`、`/sync` 等 API 与 WebSocket
- Tauri WebView2：桌面容器与本地运行环境

