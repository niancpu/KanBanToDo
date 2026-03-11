# 模块：Root Workspace

## 模块路径

- 仓库根目录：`D:\workfield\Projects\KanBanToDo`

## 模块职责

- 管理 npm workspaces（`client`、`server`、`shared`）。
- 提供统一开发入口脚本。
- 承载顶层规范与说明文件。

## 关键文件

- `package.json`
  - `workspaces`: `client`, `server`, `shared`
  - `scripts`
    - `client:dev`: 启动 Tauri 客户端开发流
    - `server:dev`: 启动 NestJS watch 模式
    - `dev`: 并发启动 client/server
- `README.md`：项目总说明
- `DESIGN.md`：设计文档
- `AGENTS.md`：仓库协作说明
- `.editorconfig`：编辑器规范
- `pnpm-workspace.yaml` / `pnpm-lock.yaml`：pnpm 工作区与锁文件（当前流程以 npm 为主）

## 顶层目录职责

- `client/`：前端与桌面壳
- `server/`：后端 API、同步、MCP
- `shared/`：共享契约
- `release/`：构建产物
- `_recovery/`：恢复与取证数据
- `doc/`：文档目录
- `.claude/`：本地助手配置数据
- `node_modules/`：依赖安装产物

## 模块边界

- 本模块不承载具体业务逻辑。
- 业务逻辑应下沉到 `client/server/shared`。

