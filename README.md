# KanBan ToDo

一个基于四象限优先级的每日看板应用，包含习惯追踪与日历视图，支持 Tauri 桌面端。

## 技术栈

- 前端：Vue 3 + TypeScript + Vuetify 3
- 桌面端：Tauri 2
- 后端：NestJS + PostgreSQL + Drizzle ORM
- 本地存储：IndexedDB（idb）
- 包管理：npm workspaces（请使用 npm，不要使用 pnpm）

## 项目结构

```text
.
├─ client/   # Vue 前端 + Tauri 桌面壳
├─ server/   # NestJS API + WebSocket 同步
├─ shared/   # 前后端共享类型/枚举
└─ release/  # 构建产物（安装包/APK）
```

## 环境要求

- Node.js 22+
- npm 10+
- Rust（Tauri 构建需要）

## 安装与开发

在仓库根目录执行：

```bash
npm install
```

常用命令：

```bash
# 同时启动服务端与桌面端开发流程
npm run dev

# 仅启动服务端（watch）
npm run server:dev

# 仅启动客户端 Tauri 开发流程
npm run client:dev
```

## 代码质量与构建

```bash
# 客户端类型检查
npm --workspace client run type-check

# 客户端 lint（oxlint + eslint）
npm --workspace client run lint

# 服务端构建
npm --workspace server run build
```

## 桌面端打包

```bash
npm --workspace client run tauri build
```

产物位于：`client/src-tauri/target/release/bundle/`

## MCP Integration (Server)

This repo now includes a stdio MCP server at `server/src/mcp/main.ts`.

### 1) Build server

```bash
npm --workspace server run build
```

### 2) Set identity

The MCP server runs as one app user.

- set `MCP_USER_ID` directly, or
- set `MCP_USERNAME` to resolve user id automatically

Optional:

- set `MCP_READ_ONLY=true` to block all write tools

### 3) Start MCP server

```bash
# production (after build)
npm --workspace server run mcp:start

# development
npm --workspace server run mcp:dev
```
