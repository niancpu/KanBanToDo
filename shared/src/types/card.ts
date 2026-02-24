import type { Priority } from '../enums'

export interface Card {
  id: string
  boardId: string
  columnId: string
  title: string
  description?: string
  priority?: Priority
  sortOrder: number
  startDate?: string            // 'YYYY-MM-DD'
  estimatedTime?: number        // 预估时间（分钟）
  linkedHabitId?: string        // 关联的习惯 ID
  isFromInheritance: boolean    // 是否从前一天继承
  createdAt: string
  updatedAt: string
}
