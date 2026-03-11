import type { SyncOperation } from '../enums'
import type { Board } from './board'
import type { Column } from './column'
import type { Card } from './card'
import type { Habit, HabitRecord } from './habit'

export interface OpLogEntry {
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

export interface SyncPushRequest {
  operations: OpLogEntry[]
  lastSyncClock: number
}

export interface SyncResponse {
  operations: OpLogEntry[]
  serverClock: number
}

export interface SyncSnapshotResponse {
  serverClock: number
  boards: Board[]
  columns: Column[]
  cards: Card[]
  habits: Habit[]
  habitRecords: HabitRecord[]
}
