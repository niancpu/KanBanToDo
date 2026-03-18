# 共享契约模块

## 对应源码

- `shared/src/index.ts`
- `shared/src/types/`
- `shared/src/enums.ts`
- `shared/src/utils/dateUtils.ts`

## 模块职责

- 定义前后端共享的数据结构
- 定义共享枚举，避免客户端与服务端各自维护状态字面量
- 提供少量跨端一致的通用日期工具

## 契约内容

- `types/board.ts`：`Board`
- `types/column.ts`：`Column`
- `types/card.ts`：`Card`
- `types/habit.ts`：`Habit`、`HabitRecord`
- `types/user.ts`：`User`
- `types/sync.ts`：`OpLogEntry`、`SyncPushRequest`、`SyncResponse`、`SyncSnapshotResponse`
- `enums.ts`：`Priority`、`HabitFrequency`、`SyncOperation`、`DefaultColumnType`
- `utils/dateUtils.ts`：`toDateStr()`、`parseLocalDate()`

## 依赖方向

- 被 `client/src` 与 `server/src` 共同依赖
- 自身不依赖业务运行时模块

## 边界说明

- 该模块只放共享契约与极少量纯工具
- 不放客户端状态逻辑，也不放服务端持久化与控制器逻辑