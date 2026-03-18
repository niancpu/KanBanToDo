# 服务端看板模块

## 对应源码

- `server/src/board/board.module.ts`
- `server/src/board/board.controller.ts`
- `server/src/board/board.service.ts`

## 模块职责

- 管理按日期组织的日看板
- 管理看板下的系统列与自定义列
- 管理卡片的创建、修改、移动、删除
- 校验用户对看板、列、卡片的归属关系

## 对外接口

- `GET /boards?date=YYYY-MM-DD`：获取或创建某一天的看板
- `POST /boards/cards`：创建卡片
- `PUT /boards/cards/:id`：更新卡片
- `PUT /boards/cards/:id/move`：移动卡片并更新排序
- `DELETE /boards/cards/:id`：删除卡片
- `POST /boards/:boardId/columns`：新增列
- `PUT /boards/columns/:id`：重命名列
- `DELETE /boards/columns/:id`：删除列
- `PUT /boards/:boardId/columns/reorder`：列重排

## 关键实现

- `getOrCreateBoard()` 会为新日期自动建立默认列：`ToDo`、`Doing`、`Done`、`Dropped`
- 列删除会联动删除该列下卡片
- 默认系统列受保护，不能按普通自定义列删除
- 服务内部会校验 board / column / card 的用户所有权

## 依赖方向

- 依赖 `database` 中的 `boards`、`columns`、`cards` 表
- 上游主要被客户端 `board store` 与 MCP 工具调用

## 边界说明

- 该模块只处理服务端持久化层面的看板事实
- 未来任务限制、习惯卡片生成、任务延续等前端本地规则不在这里实现