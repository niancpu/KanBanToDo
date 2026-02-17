import { SyncEngine } from './sync'
import { SyncOperation } from '@kanban/shared'
import type { OpLogEntry } from '@kanban/shared'
import { getDB } from '@/db'

let engine: SyncEngine | null = null

export function getSyncEngine(): SyncEngine {
  if (!engine) {
    engine = new SyncEngine()
  }
  return engine
}

/** Initialize sync after login: set userId, wire up remote ops handler, connect WebSocket, pull */
export async function initSync(userId: string, token: string, wsUrl: string) {
  const sync = getSyncEngine()
  sync.setUserId(userId)
  sync.setOnRemoteOps((ops) => {
    applyRemoteOps(ops).catch((e) => console.error('Failed to apply remote ops:', e))
  })
  sync.connect(wsUrl, token)
  await sync.pull()
}

export function destroySync() {
  if (engine) {
    engine.disconnect()
    engine = null
  }
}

/** Apply remote operations to local IndexedDB and reactive stores */
async function applyRemoteOps(ops: OpLogEntry[]) {
  const db = await getDB()

  // Lazy import to avoid circular dependency at module level
  const { useBoardStore } = await import('@/stores/board')
  const boardStore = useBoardStore()

  for (const op of ops) {
    const { entityType, entityId, operation, data } = op

    if (entityType === 'card') {
      if (operation === SyncOperation.Create || operation === SyncOperation.Update) {
        const cardData = data as any
        await db.put('cards', cardData)
        // Update reactive state if this card belongs to the current board
        if (boardStore.currentBoard && cardData.boardId === boardStore.currentBoard.id) {
          const idx = boardStore.cards.findIndex((c) => c.id === entityId)
          if (idx >= 0) {
            // LWW: only apply if remote is newer
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
    } else if (entityType === 'column') {
      if (operation === SyncOperation.Create || operation === SyncOperation.Update) {
        const colData = data as any
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
        if (boardStore.currentBoard) {
          const idx = boardStore.columns.findIndex((c) => c.id === entityId)
          if (idx >= 0) boardStore.columns.splice(idx, 1)
        }
      }
    }
  }
}
