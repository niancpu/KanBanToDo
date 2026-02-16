/** 四象限优先级：重要紧急 / 重要不紧急 / 不重要紧急 / 不重要不紧急 */
export enum Priority {
  VH = 'VH', // 重要紧急     — 低饱和红色
  VN = 'VN', // 重要不紧急   — 低饱和蓝色
  IH = 'IH', // 不重要紧急   — 低饱和橙色
  IN = 'IN', // 不重要不紧急  — 低饱和绿色
}

/** 习惯频率 */
export enum HabitFrequency {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Custom = 'custom', // 每 N 天一次，N 由 Habit.customIntervalDays 指定
}

/** 同步操作类型 */
export enum SyncOperation {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

/** WBS 节点状态 */
export enum WbsStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Done = 'done',
  Dropped = 'dropped',
}

/** 默认列标识（用于判断系统保留列） */
export enum DefaultColumnType {
  Todo = 'todo',
  Doing = 'doing',
  Done = 'done',
  Dropped = 'dropped',
}
