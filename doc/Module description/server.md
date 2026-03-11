# 模块：Server

## 模块路径

- `server/`
- HTTP 入口：`server/src/main.ts`
- 主模块：`server/src/app.module.ts`
- MCP 入口：`server/src/mcp/main.ts`

## 模块职责

- 提供认证、看板、习惯、同步相关 API。
- 通过 WebSocket 推送同步更新。
- 使用 Drizzle + PostgreSQL 持久化操作日志与业务数据。
- 提供 MCP（Model Context Protocol）工具接口供外部代理调用。

## 子模块拆分

- `database/`
  - `database.module.ts`：注入全局 DB 连接
  - `schema.ts`：数据表定义（users、boards、columns、cards、habits、habit_records、op_log）
- `auth/`
  - `auth.controller.ts`：`register/verify/resend-code/login/me`
  - `auth.service.ts`：注册、邮箱验证码、登录、JWT 签发
  - `jwt-auth.guard.ts`：全局鉴权守卫（支持 `@Public()`）
  - `jwt.strategy.ts`：JWT 解析策略
  - `email.service.ts`：SMTP 发信
- `board/`
  - `board.controller.ts`：看板、列、卡片接口
  - `board.service.ts`：看板创建、列/卡片 CRUD、权限校验
- `habit/`
  - `habit.controller.ts`：习惯与打卡接口
  - `habit.service.ts`：习惯 CRUD、打卡记录管理、归属校验
- `sync/`
  - `sync.controller.ts`：`push`、`pull`、`snapshot`
  - `sync.service.ts`：操作日志清洗、保存、拉取、快照重建
  - `sync.gateway.ts`：WebSocket 鉴权、广播同用户设备更新
- `mcp/`
  - `main.ts`：stdio JSON-RPC 服务，暴露 board/habit 工具集合

## 运行机制

- `AppModule` 开启全局 JWT 模块和全局 `APP_GUARD`（`JwtAuthGuard`）。
- `@Public()` 标记接口可绕过鉴权。
- 同步以 `op_log` 为核心，按 `clock` 顺序返回和重放。

## 外部依赖

- PostgreSQL（`DATABASE_URL`）
- JWT 密钥（`JWT_SECRET`）
- SMTP（`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`）

