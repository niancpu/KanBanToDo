# KanBan ToDo

基于四象限优先级的每日看板 + 习惯追踪 + WBS 项目管理桌面应用。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vue 3 + TypeScript + Vuetify 3 |
| 桌面端 | Tauri 2 |
| 本地存储 | IndexedDB (idb) |
| 拖拽 | vue-draggable-plus |
| 后端 | NestJS + PostgreSQL + Drizzle ORM |
| 包管理 | pnpm workspaces (monorepo) |

## 项目结构

```
├── client/          # 前端 + Tauri 桌面端
│   ├── src/         # Vue 源码
│   └── src-tauri/   # Tauri/Rust 配置
├── server/          # NestJS 后端
├── shared/          # 共享类型和枚举
├── pnpm-workspace.yaml
└── package.json
```

## 开发

```bash
# 安装依赖
pnpm install

# 启动前端开发服务器
cd client && pnpm dev

# 启动 Tauri 桌面开发模式
cd client && pnpm tauri dev
```

## 打包

```bash
cd client && pnpm tauri build
```

产物在 `client/src-tauri/target/release/bundle/nsis/` 下。

## 功能

- 每日看板：ToDo / Doing / Done / Dropped 四列，支持拖拽
- 四象限优先级：VH(重要紧急) / VN(重要不紧急) / IH(不重要紧急) / IN(不重要不紧急)
- 每日继承：未完成任务自动继承到新一天（最多回溯 30 天）
- 习惯追踪：支持每日/每周/每月/自定义频率，自动生成看板卡片
- WBS 项目管理：树形结构分解项目
- 日历视图：查看习惯完成情况
