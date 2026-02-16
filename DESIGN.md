# KanBan ToDo — 目标架构与功能规格

> 本文档描述项目的目标状态，用于指导重构和新功能开发。

---

## 1. 技术栈（保持不变）

| 层 | 选型 |
|---|---|
| 前端框架 | Vue 3 + TypeScript |
| UI 库 | Vuetify 3 |
| 状态管理 | Pinia |
| 本地存储 | IndexedDB（idb 库） |
| 桌面壳 | Tauri 2 |
| 拖拽 | 替换 vuedraggable v4 → `vue-draggable-plus` 或 `sortablejs-vue3`（兼容 Vue 3.5+） |
| Monorepo | pnpm workspaces（client / server / shared） |
| 后端（远期） | NestJS + PostgreSQL + Drizzle ORM |

---

## 2. 数据模型（shared/src/types/）

### 2.1 Board（每日看板）

```ts
interface Board {
  id: string
  userId: string
  date: string          // 'YYYY-MM-DD'，每天唯一
  createdAt: string
}
```

### 2.2 Column（列）

```ts
interface Column {
  id: string            // 必须 uuid，不能硬编码
  boardId: string
  title: string         // 默认四列：待办 / 进行中 / 已完成 / 已放弃
  sortOrder: number
  isDefault: boolean    // 标记是否为系统默认列（防止删除核心列）
}
```

默认列：`待办(ToDo)` / `进行中(Doing)` / `已完成(Done)` / `已放弃(Dropped)`。用户可增删改自定义列，但 Done 和 Dropped 不可删除（用于日历统计和继承逻辑）。

### 2.3 Card（任务卡片）

每日看板卡片和 WBS 卡片共用同一数据结构：

```ts
interface Card {
  id: string
  boardId: string
  columnId: string
  title: string
  description?: string
  priority?: Priority           // VH / VN / IH / IN
  sortOrder: number
  startDate?: string            // 'YYYY-MM-DD'，开始日期
  estimatedTime?: number        // 用户自定义预估时间（分钟）
  linkedProjectNodeId?: string  // 关联的 WBS 节点 ID（双向同步用）
  linkedHabitId?: string        // 关联的习惯 ID
  isFromInheritance: boolean    // 是否从前一天继承而来
  createdAt: string
  updatedAt: string
}
```

### 2.4 Priority（四象限优先级）

```ts
enum Priority {
  VH = 'VH',  // 重要紧急     — 低饱和红色
  VN = 'VN',  // 重要不紧急   — 低饱和蓝色
  IH = 'IH',  // 不重要紧急   — 低饱和橙色
  IN = 'IN',  // 不重要不紧急  — 低饱和绿色
}
```

卡片 UI：优先级颜色只渲染卡片顶部色条（约 4px 高），不填充整张卡片。

### 2.5 Project & WbsNode（项目 / WBS）

```ts
interface Project {
  id: string
  userId: string
  title: string
  description?: string
  createdAt: string
}

interface WbsNode {
  id: string
  projectId: string
  parentId?: string           // null = 根节点
  title: string
  description?: string
  priority?: Priority
  sortOrder: number
  startDate?: string
  endDate?: string
  estimatedTime?: number
  progress: number            // 0-100，叶子节点手动/状态驱动，分组节点自动计算
  status: WbsStatus           // 见下方枚举
  linkedCardId?: string       // 关联的每日看板卡片 ID
  depth: number               // 层级深度，用于限制最大层数
}

enum WbsStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Done = 'done',
  Dropped = 'dropped',
}
```

### 2.6 Habit（习惯）

```ts
interface Habit {
  id: string
  userId: string
  title: string
  frequency: HabitFrequency   // 默认 Daily
  customIntervalDays?: number // 当 frequency = Custom 时，每 N 天执行一次
  createdAt: string
}

interface HabitRecord {
  id: string
  habitId: string
  date: string                // 'YYYY-MM-DD'
  completed: boolean
}

enum HabitFrequency {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Custom = 'custom',   // 每 N 天一次，N 由 Habit.customIntervalDays 指定
}
```

### 2.7 OpLogEntry（同步日志，远期）

```ts
interface OpLogEntry {
  id: string
  userId: string
  deviceId: string
  entityType: string
  entityId: string
  operation: SyncOperation
  data?: unknown
  clock: number
  timestamp: string
}
```

---

## 3. 功能模块

### 3.1 每日看板（DailyBoard）

**核心逻辑：**

1. 进入页面时，根据当前日期（或路由 query `?date=YYYY-MM-DD`）加载/创建看板。
2. 如果当天看板不存在：
   - 创建新 Board 记录
   - 创建默认四列（每列 uuid 唯一）
   - 查找前一天的看板，将其 `待办` 和 `进行中` 列的卡片复制到新看板的 `待办` 列
   - 复制时标记 `isFromInheritance: true`
   - 如果卡片关联了 WBS 节点，继承时保留关联关系
3. 如果当天看板已存在，直接加载。

**卡片操作：**

- 新建卡片：标题（必填）、描述、优先级、开始日期、预估时间
- 编辑卡片：点击打开详情对话框，所有字段可编辑
- 删除卡片：需二次确认
- 拖拽排序：列内拖拽改变 sortOrder，跨列拖拽改变 columnId + sortOrder
- 拖拽时需要重新计算目标列所有卡片的 sortOrder

**自定义列：**

- 用户可新增列、重命名列、删除列、拖拽调整列顺序
- Done 和 Dropped 列不可删除（系统保留）

**日期导航：**

- 左右箭头切换日期
- "今天"按钮回到当天
- 从日历页面点击某天时，通过路由 query 传递日期，DailyBoardView 需读取 `route.query.date`

### 3.2 项目管理 & WBS

**项目列表页：**

- 展示所有项目卡片
- 新建 / 删除项目（删除需二次确认，级联删除所有 WBS 节点）

**项目详情页（WBS + 甘特图）：**

- 左侧：WBS 树状结构
  - 树形展示，支持展开/折叠
  - 每个节点显示：标题、状态、进度条、优先级色条
  - 支持新增子节点、编辑、删除、拖拽调整顺序和层级
  - 最大 4 层（项目 → 阶段 → 任务 → 子任务）
- 右侧：甘特图
  - 横轴为时间线，纵轴对应 WBS 节点
  - 条形图显示 startDate → endDate
  - 进度用填充比例表示
  - 可拖拽交互：拖拽条形图左右边缘调整 startDate/endDate，拖拽整个条平移时间区间

**WBS 节点状态与进度：**

- 叶子节点：状态由用户手动设置，或通过关联的每日看板卡片自动同步
  - 卡片拖到 Done → WbsNode.status = Done, progress = 100
  - 卡片拖到 Dropped → WbsNode.status = Dropped
  - 卡片在 Doing → WbsNode.status = InProgress
- 分组节点（有子节点的节点）：
  - progress 自动计算：如果所有子节点都填写了 estimatedTime，则按预估时间加权平均；否则按子节点数量平均
  - status 根据子节点状态自动推导

**WBS ↔ 每日看板关联：**

- 拖拽关联机制：在每日看板中拖拽卡片时，页面右上角浮现一个"发送到 WBS"按钮区域，将卡片拖到该区域后弹出项目/节点选择器，完成关联。反之在 WBS 页面拖拽节点时右上角浮现"发送到今日看板"按钮区域，拖入后在当天看板待办列创建关联卡片。
- 手动关联：用户也可在卡片/节点详情中手动选择关联目标
- 默认不关联，只有通过上述操作才建立关联
- 关联后状态双向同步

### 3.3 习惯追踪（Habits）

**习惯列表页：**

- 展示所有习惯，每个习惯显示：标题、频率、连续天数、今日状态
- 新建习惯：标题、频率（每天/每周/每月/自定义）
- 删除习惯：需二次确认

**习惯与每日看板的联动：**

- 习惯是绿色的卡片，每天自动出现在当天看板的 `待办` 列
- 完成方式二选一：
  - 在看板中拖拽习惯卡片到 `已完成` 列
  - 在习惯页面点击"打卡"按钮
- 两种方式等效，状态双向同步

**连续天数计算规则：**

| 情况 | 显示 | 对连续天数的影响 |
|---|---|---|
| 当天已完成 | ✅ 绿色勾 | +1 |
| 中断恰好 1 天 | 🟡 黄色圈 | 不打断累计，但该天不计入天数 |
| 中断超过 1 天 | ❌ 红色叉 | 累计天数归零 |

> 注意：这里的"中断 1 天"指的是连续完成序列中间有且仅有 1 天空缺。

### 3.4 日历（Calendar）

**视图模式：**

- 月视图：7×N 网格，显示每天的摘要
- 周视图：7 列，每列显示当天详情

**每天显示内容：**

1. Done 卡片数量 / 列表
2. Dropped 卡片数量 / 列表
3. 习惯完成状态（绿勾 / 黄圈 / 红叉）

**交互：**

- 点击某天 → 跳转到该天的每日看板（通过路由 query `?date=YYYY-MM-DD`）
- 左右切换月/周
- "今天"按钮

---

## 4. 认证与注册

### 4.1 注册流程（邮箱验证）

```
用户填写 username + password + email
  → POST /auth/register
  → 服务端创建用户（emailVerified=false），生成 6 位验证码，10 分钟有效
  → 通过 SMTP 发送验证码到用户邮箱
  → 返回 { needVerification: true }

用户输入验证码
  → POST /auth/verify { email, code }
  → 验证通过 → emailVerified=true，返回 JWT
```

支持 `POST /auth/resend-code { email }` 重新发送验证码。

### 4.2 登录流程

- 普通用户：username + password → 校验密码 + emailVerified → 返回 JWT
- 未验证用户登录时返回 401 提示"邮箱未验证"

### 4.3 管理员免密登录

用户名为 `一念` 时享有特殊待遇：
- 客户端：检测到用户名为"一念"时自动隐藏密码和邮箱字段，显示"直接登录"按钮
- 服务端：login 接口收到 username=一念 时跳过密码校验，直接签发 JWT
- 注册接口禁止使用"一念"作为用户名（返回 400）

### 4.4 数据库扩展字段

```sql
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN verification_code TEXT;
ALTER TABLE users ADD COLUMN verification_code_expires TIMESTAMP;
```

### 4.5 SMTP 配置

服务端通过环境变量配置邮件发送：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| SMTP_HOST | SMTP 服务器 | smtp.qq.com |
| SMTP_PORT | 端口 | 465 |
| SMTP_USER | 发件邮箱 | — |
| SMTP_PASS | 授权码 | — |
| SMTP_FROM | 发件人显示 | 同 SMTP_USER |

### 4.6 涉及文件

| 文件 | 变更 |
|------|------|
| `server/src/database/schema.ts` | users 表增加 email/emailVerified/verificationCode/verificationCodeExpires |
| `server/src/auth/email.service.ts` | 新建，nodemailer 发送验证码 |
| `server/src/auth/auth.service.ts` | register 增加邮箱验证流程，login 增加管理员免密，新增 verify/resendCode |
| `server/src/auth/auth.controller.ts` | 新增 POST verify / resend-code 端点 |
| `server/src/auth/auth.module.ts` | 注册 EmailService |
| `client/src/views/LoginView.vue` | 三步表单（登录/注册/验证码），管理员免密 UI |
| `client/src/stores/auth.ts` | 新增 register(email) / verify / resendCode 方法 |

---

## 5. 已确认的设计决策

| 问题 | 结论 |
|---|---|
| WBS 树最大层数 | 4 层（项目 → 阶段 → 任务 → 子任务） |
| 分组节点进度权重 | 如果所有子节点都有 estimatedTime，按时间加权；否则按数量平均 |
| WBS ↔ 每日看板关联方式 | 拖拽时右上角浮现按钮区域，拖入后完成关联；也支持手动关联 |
| 甘特图交互 | 可拖拽：拖边缘调整日期，拖整条平移区间 |
| 自定义习惯频率 | 每 N 天执行一次，N 为用户输入的正整数（`Habit.customIntervalDays`） |
| WBS 展示形式 | 左侧树状列表 + 右侧甘特图并排 |

---

## 5. 当前代码需修复的关键问题

按优先级排列：

| # | 问题 | 位置 | 严重程度 |
|---|---|---|---|
| 1 | Column ID 硬编码，多日看板数据互相覆盖 | `stores/board.ts:7-11` | 🔴 致命 |
| 2 | 拖拽列表绑定 computed（只读），拖拽不工作 | `DailyBoardView.vue:140-146` | 🔴 致命 |
| 3 | `onDragEnd` 的 targetColId 永远是源列 | `DailyBoardView.vue:148-152` | 🔴 致命 |
| 4 | 新建卡片时 priority 未传递给 store | `DailyBoardView.vue:187-195` | 🟠 严重 |
| 5 | 优先级颜色 VN/IH 映射与主题定义相反 | `DailyBoardView.vue` vs `vuetify.ts` | 🟠 严重 |
| 6 | `moveCard` 不更新其他卡片的 sortOrder | `stores/board.ts:92-100` | 🟠 严重 |
| 7 | DailyBoardView 不读取路由 query 的 date 参数 | `DailyBoardView.vue` | 🟠 严重 |
| 8 | `getStreak` 今天未打卡就显示 0 | `HabitsView.vue:104-121` | 🟡 中等 |
| 9 | `sync.ts` 引用不存在的类型，编译报错 | `services/sync.ts:1` | 🟡 中等 |
| 10 | IndexedDB cards 建了不存在的 `by-status` 索引 | `db/index.ts:4` | 🟡 中等 |
| 11 | DB schema value 类型全是 `Record<string, unknown>` | `db/index.ts` | 🟡 中等 |
| 12 | `api.delete` 对 204 响应会崩溃 | `services/api.ts` | 🟡 中等 |
| 13 | WebSocket 断开后无条件重连（含主动断开） | `services/sync.ts:40` | 🟡 中等 |
| 14 | CalendarView events 永远为空 | `CalendarView.vue:74` | 🟡 中等 |
| 15 | 删除操作无二次确认 | 多处 | 🔵 低 |
| 16 | `userId` 全部硬编码空字符串 | 多处 | 🔵 低 |
| 17 | 全量 `getAll` + 内存过滤，未使用索引 | `stores/board.ts` | 🔵 低 |
| 18 | 无路由守卫 | `router/index.ts` | 🔵 低 |
| 19 | vuedraggable v4 与 Vue 3.5+ 兼容性问题 | `package.json` | 🔵 低 |

---

## 6. 目录结构建议

```
client/src/
├── main.ts
├── App.vue
├── db/
│   └── index.ts              # IndexedDB schema，value 类型用 shared 接口
├── router/
│   └── index.ts              # 路由 + 守卫
├── plugins/
│   └── vuetify.ts
├── services/
│   ├── api.ts                # HTTP 请求封装（修复 204 处理）
│   └── sync.ts               # CRDT 同步引擎（远期）
├── stores/
│   ├── board.ts              # 每日看板 store
│   ├── project.ts            # 项目 + WBS store
│   ├── habit.ts              # 习惯 store
│   └── auth.ts               # 认证 store
├── composables/
│   ├── useCardDrag.ts        # 拖拽逻辑抽取
│   ├── useStreak.ts          # 习惯连续天数计算
│   └── useDateNav.ts         # 日期导航逻辑复用
├── views/
│   ├── DailyBoardView.vue    # 每日看板
│   ├── ProjectsView.vue      # 项目列表
│   ├── ProjectDetailView.vue # WBS + 甘特图
│   ├── HabitsView.vue        # 习惯追踪
│   ├── CalendarView.vue      # 日历
│   └── LoginView.vue         # 登录
├── components/
│   ├── board/
│   │   ├── BoardColumn.vue   # 单列组件
│   │   ├── CardItem.vue      # 卡片组件（优先级色条）
│   │   └── CardDialog.vue    # 卡片编辑对话框
│   ├── wbs/
│   │   ├── WbsTree.vue       # WBS 树
│   │   ├── WbsNode.vue       # 树节点
│   │   └── GanttChart.vue    # 甘特图
│   ├── calendar/
│   │   ├── MonthGrid.vue     # 月视图网格
│   │   └── WeekGrid.vue      # 周视图网格
│   └── habit/
│       └── HabitCard.vue     # 习惯卡片
└── assets/

shared/src/
├── index.ts
├── enums.ts                  # Priority, HabitFrequency, SyncOperation, WbsStatus
└── types/
    ├── board.ts
    ├── card.ts
    ├── column.ts             # 独立出来
    ├── project.ts
    ├── habit.ts
    ├── user.ts
    └── sync.ts
```
