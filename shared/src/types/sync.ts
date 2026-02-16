import type { SyncOperation } from '../enums'

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
