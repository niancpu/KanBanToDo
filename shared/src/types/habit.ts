import type { HabitFrequency } from '../enums'

export interface Habit {
  id: string
  userId: string
  title: string
  description?: string
  frequency: HabitFrequency
  customIntervalDays?: number // 当 frequency = Custom 时，每 N 天执行一次
  createdAt: string
}

export interface HabitRecord {
  id: string
  habitId: string
  date: string // 'YYYY-MM-DD'
  completed: boolean
}
