import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Board } from '@kanban/shared'
import type { Column } from '@kanban/shared'
import type { Card } from '@kanban/shared'
import type { Habit, HabitRecord } from '@kanban/shared'
import type { OpLogEntry } from '@kanban/shared'

interface KanbanDB extends DBSchema {
  boards: { key: string; value: Board; indexes: { 'by-date': string; 'by-userId': string } }
  columns: { key: string; value: Column; indexes: { 'by-board': string } }
  cards: { key: string; value: Card; indexes: { 'by-board': string; 'by-column': string } }
  habits: { key: string; value: Habit; indexes: { 'by-userId': string } }
  habitRecords: { key: string; value: HabitRecord; indexes: { 'by-habit': string; 'by-date': string } }
  opLog: { key: string; value: OpLogEntry; indexes: { 'by-clock': number } }
}

let dbInstance: IDBPDatabase<KanbanDB> | null = null

export async function getDB(): Promise<IDBPDatabase<KanbanDB>> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB<KanbanDB>('kanban-todo', 5, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      type StoreName = 'boards' | 'columns' | 'cards' | 'habits' | 'habitRecords' | 'opLog'

      const getOrCreateStore = (storeName: StoreName, keyPath: string) => (
        db.objectStoreNames.contains(storeName)
          ? transaction.objectStore(storeName)
          : db.createObjectStore(storeName, { keyPath })
      )

      const ensureStore = (
        storeName: StoreName,
        keyPath: string,
        indexes: Array<{ name: string; keyPath: string }>,
      ) => {
        const store = getOrCreateStore(storeName, keyPath) as unknown as IDBObjectStore

        for (const index of indexes) {
          if (!store.indexNames.contains(index.name)) {
            store.createIndex(index.name, index.keyPath)
          }
        }
      }

      // Non-destructive migration: keep user data, only create missing stores/indexes.
      ensureStore('boards', 'id', [
        { name: 'by-date', keyPath: 'date' },
        { name: 'by-userId', keyPath: 'userId' },
      ])
      ensureStore('columns', 'id', [{ name: 'by-board', keyPath: 'boardId' }])
      ensureStore('cards', 'id', [
        { name: 'by-board', keyPath: 'boardId' },
        { name: 'by-column', keyPath: 'columnId' },
      ])
      ensureStore('habits', 'id', [{ name: 'by-userId', keyPath: 'userId' }])
      ensureStore('habitRecords', 'id', [
        { name: 'by-habit', keyPath: 'habitId' },
        { name: 'by-date', keyPath: 'date' },
      ])
      ensureStore('opLog', 'id', [{ name: 'by-clock', keyPath: 'clock' }])
    },
  })
  return dbInstance
}
