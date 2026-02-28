export enum Priority {
  UI = 'UI', // Urgent & Important
  INU = 'INU', // Important, Not Urgent
  UNI = 'UNI', // Urgent, Not Important
  NN = 'NN', // Neither Urgent nor Important
}

export const LEGACY_PRIORITY_MAP: Record<string, Priority> = {
  VH: Priority.UI,
  VN: Priority.INU,
  IH: Priority.UNI,
  IN: Priority.NN,
}

export function normalizePriority(value?: string): Priority | undefined {
  if (!value) return undefined
  if (value in Priority) return Priority[value as keyof typeof Priority]
  return LEGACY_PRIORITY_MAP[value]
}

export enum HabitFrequency {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Custom = 'custom',
}

export enum SyncOperation {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export enum DefaultColumnType {
  Todo = 'todo',
  Doing = 'doing',
  Done = 'done',
  Dropped = 'dropped',
}

