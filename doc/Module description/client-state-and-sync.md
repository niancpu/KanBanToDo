# 客户端状态与同步模块

## 对应源码

- `client/src/stores/auth.ts`
- `client/src/stores/board.ts`
- `client/src/stores/habit.ts`
- `client/src/services/api.ts`
- `client/src/services/sync.ts`
- `client/src/services/syncInstance.ts`
- `client/src/db/index.ts`
- `client/src/composables/`

## 模块职责

- 管理认证状态、当前用户与本地 token
- 管理日看板状态：看板、列、卡片及其本地业务规则
- 管理习惯状态：习惯列表、打卡记录与到期判断
- 封装对服务端 REST API 的访问
- 维护 IndexedDB 本地库，支撑离线可用与本地优先
- 维护操作日志同步引擎，负责 push / pull / snapshot / WebSocket 更新

## 子模块说明

- `stores/auth.ts`
  - 负责登录、注册、验证码验证、会话恢复、退出登录
  - 在登录或恢复会话后触发同步初始化，在退出时销毁同步实例
- `stores/board.ts`
  - 负责加载指定日期的看板
  - 负责卡片与列的增删改移
  - 包含日看板特有规则，如未来任务限制、任务延续、习惯卡片生成
- `stores/habit.ts`
  - 负责习惯 CRUD、打卡 / 取消打卡、记录装载与到期计算
  - 删除习惯时会联动删除相关记录与已关联卡片
- `services/api.ts`
  - 提供带鉴权头的统一 HTTP 请求封装
- `services/sync.ts`
  - `SyncEngine` 负责本地操作入队、时钟推进、推拉同步、Socket 连接
- `services/syncInstance.ts`
  - 管理同步单例生命周期
  - 负责“首登时本地数据回灌到服务端”和“本地为空时从快照恢复”
- `db/index.ts`
  - 定义本地库 `boards`、`columns`、`cards`、`habits`、`habitRecords`、`opLog`
- `composables/`
  - 提供 UI 侧可复用逻辑，如日期导航、连续打卡计算、提示消息

## 依赖方向

- 上游被 `views/` 与 `components/` 调用
- 下游依赖 `shared/src` 契约、`server` 暴露的 API / WebSocket
- `stores` 是客户端业务状态中心，`services` 与 `db` 是其支撑层

## 边界说明

- 该模块负责“状态怎么维护、数据怎么落地、变化怎么同步”
- 不负责页面布局与组件呈现，这些属于 `client-shell.md`