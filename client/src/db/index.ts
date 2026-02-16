import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Board } from '@kanban/shared'
import type { Column } from '@kanban/shared'
import type { Card } from '@kanban/shared'
import type { Project, WbsNode } from '@kanban/shared'
import type { Habit, HabitRecord } from '@kanban/shared'
import type { OpLogEntry } from '@kanban/shared'

interface KanbanDB extends DBSchema {
  boards: { key: string; value: Board; indexes: { 'by-date': string } }
  columns: { key: string; value: Column; indexes: { 'by-board': string } }
  cards: { key: string; value: Card; indexes: { 'by-board': string; 'by-column': string } }
  projects: { key: string; value: Project }
  wbsNodes: { key: string; value: WbsNode; indexes: { 'by-project': string; 'by-parent': string } }
  habits: { key: string; value: Habit }
  habitRecords: { key: string; value: HabitRecord; indexes: { 'by-habit': string; 'by-date': string } }
  opLog: { key: string; value: OpLogEntry; indexes: { 'by-clock': number } }
}

let dbInstance: IDBPDatabase<KanbanDB> | null = null

export async function getDB(): Promise<IDBPDatabase<KanbanDB>> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB<KanbanDB>('kanban-todo', 3, {
    upgrade(db, oldVersion) {
      // 升级时删除旧 stores 重建
      if (oldVersion < 3) {
        for (const name of db.objectStoreNames) {
          db.deleteObjectStore(name)
        }
      }

      const boardStore = db.createObjectStore('boards', { keyPath: 'id' })
      boardStore.createIndex('by-date', 'date')

      const colStore = db.createObjectStore('columns', { keyPath: 'id' })
      colStore.createIndex('by-board', 'boardId')

      const cardStore = db.createObjectStore('cards', { keyPath: 'id' })
      cardStore.createIndex('by-board', 'boardId')
      cardStore.createIndex('by-column', 'columnId')

      db.createObjectStore('projects', { keyPath: 'id' })

      const wbsStore = db.createObjectStore('wbsNodes', { keyPath: 'id' })
      wbsStore.createIndex('by-project', 'projectId')
      wbsStore.createIndex('by-parent', 'parentId')

      db.createObjectStore('habits', { keyPath: 'id' })

      const hrStore = db.createObjectStore('habitRecords', { keyPath: 'id' })
      hrStore.createIndex('by-habit', 'habitId')
      hrStore.createIndex('by-date', 'date')

      const opStore = db.createObjectStore('opLog', { keyPath: 'id' })
      opStore.createIndex('by-clock', 'clock')
    },
  })
  return dbInstance
}
