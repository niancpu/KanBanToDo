import type { Priority, WbsStatus } from '../enums'

export interface Project {
  id: string
  userId: string
  title: string
  description?: string
  createdAt: string
}

export interface WbsNode {
  id: string
  projectId: string
  parentId?: string
  title: string
  description?: string
  priority?: Priority
  sortOrder: number
  startDate?: string
  endDate?: string
  estimatedTime?: number
  progress: number       // 0-100
  status: WbsStatus
  linkedCardId?: string  // 关联的每日看板卡片 ID
  depth: number          // 层级深度，最大 4
}
