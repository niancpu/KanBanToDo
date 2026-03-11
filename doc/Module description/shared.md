# 模块：Shared

## 模块路径

- `shared/`
- 导出入口：`shared/src/index.ts`

## 模块职责

- 维护前后端共享的数据契约。
- 维护跨端统一枚举和值转换逻辑。
- 维护日期工具函数，避免前后端日期格式偏差。

## 子模块

- `src/types/`
  - `board.ts`：Board
  - `column.ts`：Column
  - `card.ts`：Card
  - `habit.ts`：Habit、HabitRecord
  - `sync.ts`：OpLogEntry、同步请求/响应结构
  - `user.ts`：User
- `src/enums.ts`
  - `Priority`
  - `HabitFrequency`
  - `SyncOperation`
  - `DefaultColumnType`
  - `normalizePriority` / `LEGACY_PRIORITY_MAP`
- `src/utils/dateUtils.ts`
  - `toDateStr`
  - `parseLocalDate`

## 使用规则

- 新增业务字段应先更新本模块，再更新 client/server 实现。
- 尽量保持向后兼容，尤其是本地存储与同步字段。
- 本模块不应依赖 client/server 的运行时代码。

