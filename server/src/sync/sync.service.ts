import { Injectable, Inject } from '@nestjs/common';
import { gt, eq, and, asc, desc } from 'drizzle-orm';
import { DB } from '../database/database.module';
import { opLog } from '../database/schema';
import { v4 as uuid } from 'uuid';

type SupportedEntityType = 'board' | 'column' | 'card' | 'habit' | 'habitRecord'
type SupportedOperation = 'create' | 'update' | 'delete'

interface IncomingOperation {
  id?: string
  deviceId: string
  entityType: string
  entityId: string
  operation: string
  data?: unknown
  clock: number
  timestamp: string
}

interface SnapshotData {
  boards: Map<string, any>
  columns: Map<string, any>
  cards: Map<string, any>
  habits: Map<string, any>
  habitRecords: Map<string, any>
}

@Injectable()
export class SyncService {
  constructor(@Inject(DB) private db: any) {}

  private getUserServerClock = async (userId: string): Promise<number> => {
    const [latest] = await this.db
      .select({ clock: opLog.clock })
      .from(opLog)
      .where(eq(opLog.userId, userId))
      .orderBy(desc(opLog.clock))
      .limit(1)
    return latest?.clock ?? 0
  }

  private isSupportedEntityType(entityType: string): entityType is SupportedEntityType {
    return entityType === 'board'
      || entityType === 'column'
      || entityType === 'card'
      || entityType === 'habit'
      || entityType === 'habitRecord'
  }

  private isSupportedOperation(operation: string): operation is SupportedOperation {
    return operation === 'create' || operation === 'update' || operation === 'delete'
  }

  private sanitizeOperations(userId: string, operations: IncomingOperation[]) {
    const now = new Date().toISOString()
    const normalizeTimestamp = (raw: string | undefined) => {
      const parsed = raw ? new Date(raw) : new Date(now)
      return Number.isNaN(parsed.getTime()) ? new Date(now) : parsed
    }
    return operations
      .filter((op) => (
        this.isSupportedEntityType(op.entityType)
        && this.isSupportedOperation(op.operation)
        && typeof op.deviceId === 'string'
        && typeof op.entityId === 'string'
        && typeof op.clock === 'number'
      ))
      .map((op) => ({
        id: uuid(),
        userId,
        deviceId: op.deviceId,
        entityType: op.entityType,
        entityId: op.entityId,
        operation: op.operation,
        data: op.data,
        clock: op.clock,
        timestamp: normalizeTimestamp(op.timestamp),
      }))
  }

  async push(userId: string, operations: IncomingOperation[]) {
    const safeOps = this.sanitizeOperations(userId, operations || [])
    if (safeOps.length > 0) {
      await this.db.insert(opLog).values(safeOps)
    }
    return { serverClock: await this.getUserServerClock(userId), operations: [] }
  }

  async pull(userId: string, lastSyncClock: number) {
    const ops = await this.db
      .select()
      .from(opLog)
      .where(and(gt(opLog.clock, lastSyncClock), eq(opLog.userId, userId)))
      .orderBy(asc(opLog.clock), asc(opLog.timestamp))
    return { serverClock: await this.getUserServerClock(userId), operations: ops }
  }

  private applyOperation(snapshot: SnapshotData, op: any) {
    const { entityType, entityId, operation, data } = op
    if (!this.isSupportedEntityType(entityType) || !this.isSupportedOperation(operation)) return

    const resolveData = () => (
      typeof data === 'object' && data !== null
        ? { ...(data as Record<string, unknown>), id: entityId }
        : { id: entityId }
    )

    const handleDelete = () => {
      if (entityType === 'board') {
        snapshot.boards.delete(entityId)
        for (const [colId, col] of snapshot.columns) {
          if (col.boardId === entityId) snapshot.columns.delete(colId)
        }
        for (const [cardId, card] of snapshot.cards) {
          if (card.boardId === entityId) snapshot.cards.delete(cardId)
        }
        return
      }

      if (entityType === 'column') {
        snapshot.columns.delete(entityId)
        for (const [cardId, card] of snapshot.cards) {
          if (card.columnId === entityId) snapshot.cards.delete(cardId)
        }
        return
      }

      if (entityType === 'card') {
        snapshot.cards.delete(entityId)
        return
      }

      if (entityType === 'habit') {
        snapshot.habits.delete(entityId)
        for (const [recordId, record] of snapshot.habitRecords) {
          if (record.habitId === entityId) snapshot.habitRecords.delete(recordId)
        }
        for (const [cardId, card] of snapshot.cards) {
          if (card.linkedHabitId === entityId) snapshot.cards.delete(cardId)
        }
        return
      }

      snapshot.habitRecords.delete(entityId)
    }

    if (operation === 'delete') {
      handleDelete()
      return
    }

    const next = resolveData()
    if (entityType === 'board') snapshot.boards.set(entityId, next)
    else if (entityType === 'column') snapshot.columns.set(entityId, next)
    else if (entityType === 'card') snapshot.cards.set(entityId, next)
    else if (entityType === 'habit') snapshot.habits.set(entityId, next)
    else snapshot.habitRecords.set(entityId, next)
  }

  async snapshot(userId: string) {
    const ops = await this.db
      .select()
      .from(opLog)
      .where(eq(opLog.userId, userId))
      .orderBy(asc(opLog.clock), asc(opLog.timestamp))

    const snapshot: SnapshotData = {
      boards: new Map(),
      columns: new Map(),
      cards: new Map(),
      habits: new Map(),
      habitRecords: new Map(),
    }

    for (const op of ops) {
      this.applyOperation(snapshot, op)
    }

    return {
      serverClock: await this.getUserServerClock(userId),
      boards: [...snapshot.boards.values()],
      columns: [...snapshot.columns.values()],
      cards: [...snapshot.cards.values()],
      habits: [...snapshot.habits.values()],
      habitRecords: [...snapshot.habitRecords.values()],
    }
  }
}
