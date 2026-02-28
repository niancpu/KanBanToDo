import type { Priority } from '../enums'

export interface Card {
  id: string
  boardId: string
  columnId: string
  title: string
  description?: string
  priority?: Priority
  sortOrder: number
  effectiveDate?: string // Business effective date, format 'YYYY-MM-DD'
  startDate?: string // Legacy alias of effectiveDate
  estimatedTime?: number // Estimated time in minutes
  linkedHabitId?: string // Linked habit ID
  isFromInheritance: boolean
  createdAt: string
  updatedAt: string
}

