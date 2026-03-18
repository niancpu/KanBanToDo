# 服务端数据库模块

## 对应源码

- `server/src/database/database.module.ts`
- `server/src/database/schema.ts`

## 模块职责

- 创建 PostgreSQL 连接并通过 Drizzle 暴露统一数据库实例
- 定义服务端全部持久化表结构与索引
- 为其它模块提供全局可注入的 `DB`

## 表结构

- `users`：用户、密码哈希、邮箱、验证状态
- `boards`：按用户和日期组织的日看板
- `columns`：看板列及排序
- `cards`：卡片主体、优先级、预计时间、关联习惯等
- `habits`：习惯定义
- `habit_records`：习惯某日是否完成
- `op_log`：跨设备同步的操作日志与逻辑时钟

## 关键实现

- `database.module.ts` 通过 `@Global()` 暴露数据库实例
- `schema.ts` 是服务端数据库事实来源
- 多个关键表建立了按用户、日期、board 或 clock 的索引，服务于查询与同步

## 依赖方向

- 被 `auth`、`board`、`habit`、`sync` 全部业务模块依赖
- 不反向依赖任何业务模块

## 边界说明

- 该模块负责“数据存在哪、表怎么定义”
- 不负责业务动作和接口协议