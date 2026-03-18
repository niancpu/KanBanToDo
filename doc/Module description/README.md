# 源码模块说明索引

本目录改为按“源码模块”组织，而不是按 workspace 包、发布产物或仓库目录组织。

这里的“模块”只指实际承载功能实现的源码层：

- `client/src`：桌面端 UI、状态、本地存储、同步编排
- `server/src`：认证、看板、习惯、同步、数据库、启动入口
- `shared/src`：前后端共享契约、枚举、日期工具

以下内容不再作为本目录的模块说明对象：

- `release/`：构建产物
- `_recovery/`：恢复或调试数据
- 根目录 `workspaces` 结构：这是工程组织，不是业务源码模块

## 文档索引

- `client-shell.md`：客户端应用壳层、路由、页面与界面组件
- `client-state-and-sync.md`：客户端状态管理、本地数据库、API 与同步引擎
- `server-bootstrap.md`：服务端启动入口、模块装配与 MCP 辅助入口
- `server-auth.md`：认证与鉴权模块
- `server-board.md`：日看板、列、卡片模块
- `server-habit.md`：习惯与打卡记录模块
- `server-sync.md`：操作日志同步模块
- `server-database.md`：数据库接入与表结构模块
- `shared-contracts.md`：共享类型、枚举与通用日期工具

## 依赖关系总览

- `shared/src` 是契约中心，`client/src` 与 `server/src` 都依赖它
- `client/src/views` / `client/src/components` 不直接定义业务事实，主要通过 `stores` 驱动界面
- `client/src/stores` 组合 `db`、`services/api.ts`、`services/sync*.ts` 实现本地优先
- `server/src` 由 `AppModule` 装配业务模块，并通过 `database` 访问 PostgreSQL
- `server/src/mcp/main.ts` 复用服务端能力，但它是辅助入口，不是主业务模块

## 维护原则

- 以 `src` 目录的实际职责为准，不以仓库层级命名代替源码边界
- 新增 `src` 一级业务目录或明显独立的支撑模块时，在这里补充说明
- 先描述职责边界，再描述关键入口和依赖方向，避免把“目录介绍”写成“模块说明”