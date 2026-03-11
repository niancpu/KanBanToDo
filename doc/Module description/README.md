# 模块说明索引

按“一个模块一个文件”维护，扫描范围为仓库根目录 `D:\workfield\Projects\KanBanToDo`。

## 模块文件

- `root-workspace.md`：根工作区模块（workspaces、根脚本、顶层目录职责）
- `client.md`：客户端模块（Vue + Pinia + IndexedDB + Tauri）
- `server.md`：服务端模块（NestJS + Drizzle + Sync）
- `shared.md`：共享契约模块（types/enums/utils）
- `release.md`：发布产物模块（安装包/APK）
- `recovery.md`：恢复数据模块（调试/恢复快照）
- `doc.md`：文档模块（说明类文档）

## 依赖关系总览

- `client` 运行时依赖 `server` API/WebSocket，并消费 `shared` 契约。
- `server` 持久化依赖 PostgreSQL（由 Drizzle schema 定义）。
- `shared` 不依赖业务运行模块，仅提供契约与工具。
