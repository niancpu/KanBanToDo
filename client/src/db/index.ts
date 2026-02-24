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
    upgrade(db, oldVersion, _newVersion, transaction) {
      // 升级时删除旧 stores 重建
      if (oldVersion < 5) {
        for (const name of db.objectStoreNames) {
          db.deleteObjectStore(name)
        }

        const boardStore = db.createObjectStore('boards', { keyPath: 'id' })
        boardStore.createIndex('by-date', 'date')
        boardStore.createIndex('by-userId', 'userId')

        const colStore = db.createObjectStore('columns', { keyPath: 'id' })
        colStore.createIndex('by-board', 'boardId')

        const cardStore = db.createObjectStore('cards', { keyPath: 'id' })
        cardStore.createIndex('by-board', 'boardId')
        cardStore.createIndex('by-column', 'columnId')

        const habitStore = db.createObjectStore('habits', { keyPath: 'id' })
        habitStore.createIndex('by-userId', 'userId')

        const hrStore = db.createObjectStore('habitRecords', { keyPath: 'id' })
        hrStore.createIndex('by-habit', 'habitId')
        hrStore.createIndex('by-date', 'date')

        const opStore = db.createObjectStore('opLog', { keyPath: 'id' })
        opStore.createIndex('by-clock', 'clock')
      }
    },
  })
  return dbInstance
}
