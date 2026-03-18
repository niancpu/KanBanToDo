# 服务端同步模块

## 对应源码

- `server/src/sync/sync.module.ts`
- `server/src/sync/sync.controller.ts`
- `server/src/sync/sync.service.ts`
- `server/src/sync/sync.gateway.ts`

## 模块职责

- 接收客户端上报的操作日志
- 按逻辑时钟为用户提供增量拉取
- 生成完整快照，支持新设备或本地空库恢复
- 通过 WebSocket 向同一用户的其它设备广播同步更新

## 对外接口

- `POST /sync/push`：提交操作日志
- `POST /sync/pull`：按 `lastSyncClock` 拉取增量操作
- `POST /sync/snapshot`：获取用户全量快照
- WebSocket `sync:push`：实时推送操作并广播 `sync:update`

## 关键实现

- `sync.service.ts` 只接受受支持的实体类型：`board`、`column`、`card`、`habit`、`habitRecord`
- 同步基于 `op_log` 逻辑时钟，不直接以业务表更新时间做同步依据
- `snapshot()` 会从操作日志重建当前可见状态，用于冷启动恢复
- `sync.gateway.ts` 使用 JWT 验证 Socket 连接，并按 `user:{userId}` 房间广播

## 依赖方向

- 依赖 `database` 中的 `op_log` 表
- 上游被客户端 `SyncEngine` 与同步实例编排调用

## 边界说明

- 该模块负责“变更怎么传播与重放”
- 不负责业务规则本身，业务数据的合法性仍应由各业务模块与客户端状态层保证