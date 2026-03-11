import { SyncEngine } from './sync'
import { SyncOperation } from '@kanban/shared'
import type { Board, Card, Column, Habit, HabitRecord, OpLogEntry } from '@kanban/shared'
import { getDB } from '@/db'

let engine: SyncEngine | null = null

export function getSyncEngine(): SyncEngine {
  if (!engine) {
    engine = new SyncEngine()
  }
  return engine
}

export async function initSync(userId: string, token: string, wsUrl: string) {
  const sync = getSyncEngine()
  sync.setUserId(userId)
  await sync.hydratePendingOps()
  sync.setOnRemoteOps((ops) => {
    applyRemoteOps(ops).catch((e) => console.error('Failed to apply remote ops:', e))
  })
  sync.connect(wsUrl, token)
  await sync.pull()
  await bootstrapServerFromLocalIfNeeded(userId, sync)
  await sync.pull()
  await recoverFromSnapshotIfNeeded(userId, sync)
}

export function destroySync() {
  if (engine) {
    engine.disconnect()
    engine = null
  }
}

async function hasLocalData(userId: string) {
  const db = await getDB()
  const boards = await db.getAllFromIndex('boards', 'by-userId', userId)
  if (boards.length > 0) return true
  const habits = await db.getAllFromIndex('habits', 'by-userId', userId)
  return habits.length > 0
}

async function recoverFromSnapshotIfNeeded(userId: string, sync: SyncEngine) {
  if (!userId) return
  if (await hasLocalData(userId)) return

  const snapshot = await sync.snapshot()
  const hasRemoteData = snapshot.boards.length > 0
    || snapshot.columns.length > 0
    || snapshot.cards.length > 0
    || snapshot.habits.length > 0
    || snapshot.habitRecords.length > 0
  if (!hasRemoteData) return

  const db = await getDB()
  const tx = db.transaction(['boards', 'columns', 'cards', 'habits', 'habitRecords'], 'readwrite')
  await tx.objectStore('boards').clear()
  await tx.objectStore('columns').clear()
  await tx.objectStore('cards').clear()
  await tx.objectStore('habits').clear()
  await tx.objectStore('habitRecords').clear()

  for (const board of snapshot.boards) {
    tx.objectStore('boards').put(board)
  }
  for (const column of snapshot.columns) {
    tx.objectStore('columns').put(column)
  }
  for (const card of snapshot.cards) {
    tx.objectStore('cards').put(card)
  }
  for (const habit of snapshot.habits) {
    tx.objectStore('habits').put(habit)
  }
  for (const record of snapshot.habitRecords) {
    tx.objectStore('habitRecords').put(record)
  }
  await tx.done

}

async function bootstrapServerFromLocalIfNeeded(userId: string, sync: SyncEngine) {
  if (!userId) return
  const remote = await sync.snapshot()
  const remoteEmpty = remote.boards.length === 0
    && remote.columns.length === 0
    && remote.cards.length === 0
    && remote.habits.length === 0
    && remote.habitRecords.length === 0
  if (!remoteEmpty) return

  const db = await getDB()
  const boards = await db.getAllFromIndex('boards', 'by-userId', userId)
  const habits = await db.getAllFromIndex('habits', 'by-userId', userId)
  if (boards.length === 0 && habits.length === 0) return

  const boardIds = new Set(boards.map((b) => b.id))
  const habitIds = new Set(habits.map((h) => h.id))
  const allColumns = await db.getAll('columns')
  const allCards = await db.getAll('cards')
  const allRecords = await db.getAll('habitRecords')
  const columns = allColumns.filter((c) => boardIds.has(c.boardId))
  const cards = allCards.filter((c) => boardIds.has(c.boardId))
  const records = allRecords.filter((r) => habitIds.has(r.habitId))

  for (const board of boards) {
    await sync.recordOp({ entityType: 'board', entityId: board.id, operation: SyncOperation.Create, data: board })
  }
  for (const column of columns) {
    await sync.recordOp({ entityType: 'column', entityId: column.id, operation: SyncOperation.Create, data: column })
  }
  for (const card of cards) {
    await sync.recordOp({ entityType: 'card', entityId: card.id, operation: SyncOperation.Create, data: card })
  }
  for (const habit of habits) {
    await sync.recordOp({ entityType: 'habit', entityId: habit.id, operation: SyncOperation.Create, data: habit })
  }
  for (const record of records) {
    await sync.recordOp({
      entityType: 'habitRecord',
      entityId: record.id,
      operation: SyncOperation.Create,
      data: record,
    })
  }

  await sync.push()
}

async function applyRemoteOps(ops: OpLogEntry[]) {
  const db = await getDB()

  const { useBoardStore } = await import('@/stores/board')
  const { useHabitStore } = await import('@/stores/habit')
  const boardStore = useBoardStore()
  const habitStore = useHabitStore()

  const isCardData = (value: unknown): value is Card => (
    typeof value === 'object'
    && value !== null
    && typeof (value as Card).id === 'string'
    && typeof (value as Card).boardId === 'string'
    && typeof (value as Card).columnId === 'string'
  )
  const isColumnData = (value: unknown): value is Column => (
    typeof value === 'object'
    && value !== null
    && typeof (value as Column).id === 'string'
    && typeof (value as Column).boardId === 'string'
  )
  const isBoardData = (value: unknown): value is Board => (
    typeof value === 'object'
    && value !== null
    && typeof (value as Board).id === 'string'
    && typeof (value as Board).userId === 'string'
    && typeof (value as Board).date === 'string'
  )
  const isHabitData = (value: unknown): value is Habit => (
    typeof value === 'object'
    && value !== null
    && typeof (value as Habit).id === 'string'
    && typeof (value as Habit).userId === 'string'
  )
  const isHabitRecordData = (value: unknown): value is HabitRecord => (
    typeof value === 'object'
    && value !== null
    && typeof (value as HabitRecord).id === 'string'
    && typeof (value as HabitRecord).habitId === 'string'
    && typeof (value as HabitRecord).date === 'string'
  )

  for (const op of ops) {
    const { entityType, entityId, operation, data } = op

    if (entityType === 'board') {
      if (operation === SyncOperation.Create || operation === SyncOperation.Update) {
        if (!isBoardData(data)) continue
        await db.put('boards', data)
        if (boardStore.currentBoard?.id === entityId) {
          boardStore.currentBoard = data
        }
      } else if (operation === SyncOperation.Delete) {
        await db.delete('boards', entityId)
        if (boardStore.currentBoard?.id === entityId) {
          boardStore.currentBoard = null
          boardStore.columns = []
          boardStore.cards = []
        }
      }
      continue
    }

    if (entityType === 'card') {
      if (operation === SyncOperation.Create || operation === SyncOperation.Update) {
        if (!isCardData(data)) continue
        const cardData = data
        await db.put('cards', cardData)
        if (boardStore.currentBoard && cardData.boardId === boardStore.currentBoard.id) {
          const idx = boardStore.cards.findIndex((c) => c.id === entityId)
          if (idx >= 0) {
            const local = boardStore.cards[idx]!
            if (!local.updatedAt || cardData.updatedAt > local.updatedAt) {
              Object.assign(boardStore.cards[idx]!, cardData)
            }
          } else {
            boardStore.cards.push(cardData)
          }
        }
      } else if (operation === SyncOperation.Delete) {
        await db.delete('cards', entityId)
        if (boardStore.currentBoard) {
          const idx = boardStore.cards.findIndex((c) => c.id === entityId)
          if (idx >= 0) boardStore.cards.splice(idx, 1)
        }
      }
      continue
    }

    if (entityType === 'column') {
      if (operation === SyncOperation.Create || operation === SyncOperation.Update) {
        if (!isColumnData(data)) continue
        const colData = data
        await db.put('columns', colData)
        if (boardStore.currentBoard && colData.boardId === boardStore.currentBoard.id) {
          const idx = boardStore.columns.findIndex((c) => c.id === entityId)
          if (idx >= 0) {
            Object.assign(boardStore.columns[idx]!, colData)
          } else {
            boardStore.columns.push(colData)
          }
        }
      } else if (operation === SyncOperation.Delete) {
        await db.delete('columns', entityId)
        const toDelete = (await db.getAll('cards')).filter((c) => c.columnId === entityId)
        const tx = db.transaction('cards', 'readwrite')
        for (const card of toDelete) tx.store.delete(card.id)
        await tx.done

        if (boardStore.currentBoard) {
          const idx = boardStore.columns.findIndex((c) => c.id === entityId)
          if (idx >= 0) boardStore.columns.splice(idx, 1)
          boardStore.cards = boardStore.cards.filter((c) => c.columnId !== entityId)
        }
      }
      continue
    }

    if (entityType === 'habit') {
      if (operation === SyncOperation.Create || operation === SyncOperation.Update) {
        if (!isHabitData(data)) continue
        await db.put('habits', data)
        const idx = habitStore.habits.findIndex((h) => h.id === entityId)
        if (idx >= 0) habitStore.habits[idx] = data
        else habitStore.habits.push(data)
      } else if (operation === SyncOperation.Delete) {
        await db.delete('habits', entityId)
        habitStore.habits = habitStore.habits.filter((h) => h.id !== entityId)
      }
      continue
    }

    if (entityType === 'habitRecord') {
      if (operation === SyncOperation.Create || operation === SyncOperation.Update) {
        if (!isHabitRecordData(data)) continue
        await db.put('habitRecords', data)
        const idx = habitStore.records.findIndex((r) => r.id === entityId)
        if (idx >= 0) habitStore.records[idx] = data
        else habitStore.records.push(data)
      } else if (operation === SyncOperation.Delete) {
        await db.delete('habitRecords', entityId)
        habitStore.records = habitStore.records.filter((r) => r.id !== entityId)
      }
    }
  }
}
