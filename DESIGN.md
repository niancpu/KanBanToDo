# KanBan ToDo — 目标架构与功能规格

> 本文档描述项目的目标状态，用于指导重构和新功能开发。

---

## 1. 技术栈

| 层 | 选型 |
|---|---|
| 前端框架 | Vue 3 + TypeScript |
| UI 库 | Vuetify 3 |
| 状态管理 | Pinia |
| 本地存储 | IndexedDB（idb 库） |
| 桌面壳 | Tauri 2 |
| 拖拽 | vue-draggable-plus |
| Monorepo | pnpm workspaces（client / server / shared） |
| 后端 | NestJS + PostgreSQL + Drizzle ORM |

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
  defaultType?: DefaultColumnType // 标记是否为系统默认列（防止删除核心列）
}
```

默认列：`待办(ToDo)` / `进行中(Doing)` / `已完成(Done)` / `已放弃(Dropped)`。用户可增删改自定义列，但 Done 和 Dropped 不可删除（用于日历统计和继承逻辑）。

### 2.3 Card（任务卡片）

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

### 2.5 Habit（习惯）

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
  Custom = 'custom',
}
```

### 2.6 OpLogEntry（同步日志）

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
   - 查找前面看板中 `待办` 和 `进行中` 列的卡片，移动到新看板的对应列
   - 在源看板留冻结快照（标记 `isFromInheritance: true`）
   - 为当天应执行的习惯创建卡片
3. 如果当天看板已存在，直接加载，并检查是否有新习惯需要创建卡片。

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
- 从日历页面点击某天时，通过路由 query 传递日期

### 3.2 习惯追踪（Habits）

**习惯列表页：**

- 展示所有习惯，每个习惯显示：标题、频率、连续天数、今日状态
- 新建习惯：标题、频率（每天/每周/每月/自定义）
- 编辑习惯：右键菜单编辑标题、描述、频率
- 删除习惯：需二次确认

**习惯与每日看板的联动：**

- 习惯卡片每天自动出现在当天看板的 `待办` 列
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

### 3.3 日历（Calendar）

**视图模式：**

- 月视图：7×N 网格，显示每天的摘要
- 周视图：7 列，每列显示当天详情

**每天显示内容：**

1. Done 卡片数量
2. Dropped 卡片数量
3. 习惯完成状态（绿勾 / 黄圈 / 红叉）

**交互：**

- 点击某天 → 跳转到该天的每日看板
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

### 4.2 登录流程

- 普通用户：username + password → 校验密码 + emailVerified → 返回 JWT
- 未验证用户登录时返回 401 提示"邮箱未验证"

### 4.3 管理员免密登录

用户名为 `一念` 时享有特殊待遇：
- 客户端：检测到用户名为"一念"时自动隐藏密码和邮箱字段
- 服务端：login 接口收到 username=一念 时跳过密码校验，直接签发 JWT
- 注册接口禁止使用"一念"作为用户名

### 4.4 SMTP 配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| SMTP_HOST | SMTP 服务器 | smtp.qq.com |
| SMTP_PORT | 端口 | 465 |
| SMTP_USER | 发件邮箱 | — |
| SMTP_PASS | 授权码 | — |
| SMTP_FROM | 发件人显示 | 同 SMTP_USER |

---

## 5. 目录结构

```
client/src/
├── main.ts
├── App.vue
├── db/
│   └── index.ts              # IndexedDB schema
├── router/
│   └── index.ts              # 路由 + 守卫
├── plugins/
│   └── vuetify.ts
├── services/
│   ├── api.ts                # HTTP 请求封装
│   ├── sync.ts               # CRDT 同步引擎
│   └── syncInstance.ts       # 同步引擎单例
├── stores/
│   ├── board.ts              # 每日看板 store
│   ├── habit.ts              # 习惯 store
│   └── auth.ts               # 认证 store
├── composables/
│   ├── useStreak.ts          # 习惯连续天数计算
│   ├── useDateNav.ts         # 日期导航逻辑复用
│   └── useToast.ts           # 全局 toast
├── views/
│   ├── DailyBoardView.vue    # 每日看板
│   ├── HabitsView.vue        # 习惯追踪
│   ├── CalendarView.vue      # 日历
│   └── LoginView.vue         # 登录
├── components/
│   └── board/
│       ├── CardItem.vue      # 卡片组件（优先级色条）
│       └── CardDialog.vue    # 卡片编辑对话框
└── assets/

shared/src/
├── index.ts
├── enums.ts                  # Priority, HabitFrequency, SyncOperation, DefaultColumnType
└── types/
    ├── board.ts
    ├── card.ts
    ├── column.ts
    ├── habit.ts
    ├── user.ts
    └── sync.ts
```
