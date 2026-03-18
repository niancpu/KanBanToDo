# 服务端习惯模块

## 对应源码

- `server/src/habit/habit.module.ts`
- `server/src/habit/habit.controller.ts`
- `server/src/habit/habit.service.ts`

## 模块职责

- 管理习惯实体与习惯打卡记录
- 提供习惯的增删改查
- 提供某个习惯的打卡、取消打卡、记录查询
- 校验用户对习惯数据的归属关系

## 对外接口

- `GET /habits`：获取当前用户全部习惯
- `POST /habits`：创建习惯
- `PUT /habits/:id`：更新习惯
- `POST /habits/:id/checkin`：打卡
- `DELETE /habits/:id/checkin`：取消打卡
- `DELETE /habits/:id`：删除习惯
- `GET /habits/:id/records`：获取习惯记录

## 关键实现

- `habit.service.ts` 负责习惯所有权校验
- 打卡记录写入 `habit_records` 表
- 删除习惯时，服务端负责清理该习惯本体；客户端还会处理本地关联卡片清理

## 依赖方向

- 依赖 `database` 中的 `habits` 与 `habit_records` 表
- 上游主要被客户端 `habit store` 与 MCP 工具调用

## 边界说明

- 该模块负责服务端的习惯事实存储
- 习惯何时到期、如何映射到日看板卡片，这类前端本地编排逻辑不在本模块