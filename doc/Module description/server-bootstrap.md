# 服务端启动与装配模块

## 对应源码

- `server/src/main.ts`
- `server/src/app.module.ts`
- `server/src/mcp/main.ts`

## 模块职责

- 启动 Nest HTTP 服务并开放 CORS
- 装配服务端全部业务模块
- 配置全局 JWT 鉴权守卫
- 提供一个复用服务端能力的 MCP 辅助入口

## 子模块说明

- `main.ts`
  - 创建 Nest 应用并监听 `3000` 端口
- `app.module.ts`
  - 注册全局 `JwtModule`
  - 装配 `DatabaseModule`、`AuthModule`、`BoardModule`、`HabitModule`、`SyncModule`
  - 通过 `APP_GUARD` 启用全局 `JwtAuthGuard`
- `mcp/main.ts`
  - 以应用上下文方式加载 `AppModule`
  - 复用 `BoardService` 与 `HabitService`
  - 对单一用户暴露 MCP 工具能力，属于辅助集成入口

## 依赖方向

- 依赖各业务模块完成真正的业务处理
- 不直接承载认证、看板、习惯或同步逻辑本身

## 边界说明

- 该模块负责“服务怎么启动、模块怎么装起来”
- 真正的业务职责分散在 `auth`、`board`、`habit`、`sync`、`database`