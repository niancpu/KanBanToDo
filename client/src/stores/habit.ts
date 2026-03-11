import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Habit, HabitRecord } from '@kanban/shared'
import { HabitFrequency, Priority, DefaultColumnType, SyncOperation } from '@kanban/shared'
import { getDB } from '@/db'
import { getSyncEngine } from '@/services/syncInstance'
import { useBoardStore } from '@/stores/board'
import { useAuthStore } from '@/stores/auth'

export const useHabitStore = defineStore('habit', () => {
  const habits = ref<Habit[]>([])
  const records = ref<HabitRecord[]>([])
  const loading = ref(false)

  const loadHabits = async () => {
    loading.value = true
    try {
      const db = await getDB()
      const userId = useAuthStore().user?.id
      habits.value = userId
        ? await db.getAllFromIndex('habits', 'by-userId', userId)
        : await db.getAll('habits')

      const loaded: HabitRecord[] = []
      for (const h of habits.value) {
        const recs = await db.getAllFromIndex('habitRecords', 'by-habit', h.id)
        loaded.push(...recs)
      }
      records.value = loaded
    } finally {
      loading.value = false
    }
  }

  const createHabit = async (data: {
    title: string
    description?: string
    frequency: HabitFrequency
    customIntervalDays?: number
  }) => {
    const habit: Habit = {
      id: uuidv4(),
      title: data.title,
      description: data.description,
      frequency: data.frequency,
      customIntervalDays: data.frequency === HabitFrequency.Custom ? data.customIntervalDays : undefined,
      userId: useAuthStore().user?.id || '',
      createdAt: new Date().toISOString(),
    }
    const db = await getDB()
    await db.put('habits', habit)
    habits.value.push(habit)
    getSyncEngine().recordOp({ entityType: 'habit', entityId: habit.id, operation: SyncOperation.Create, data: habit })

    const boardStore = useBoardStore()
    if (boardStore.currentBoard) {
      const todoCol = boardStore.columns.find((c) => c.defaultType === DefaultColumnType.Todo)
      if (todoCol) {
        await boardStore.addCard({
          title: habit.title,
          description: habit.description,
          columnId: todoCol.id,
          priority: Priority.INU,
          linkedHabitId: habit.id,
        })
      }
    }
    return habit
  }

  const checkIn = async (habitId: string, date: string) => {
    const existing = records.value.find((r) => r.habitId === habitId && r.date === date)
    if (existing) return existing

    const record: HabitRecord = {
      id: uuidv4(),
      habitId,
      date,
      completed: true,
    }
    const db = await getDB()
    await db.put('habitRecords', record)
    records.value.push(record)
    getSyncEngine().recordOp({
      entityType: 'habitRecord',
      entityId: record.id,
      operation: SyncOperation.Create,
      data: record,
    })
    return record
  }

  const uncheckIn = async (habitId: string, date: string) => {
    const existing = records.value.find((r) => r.habitId === habitId && r.date === date)
    if (!existing) return
    const db = await getDB()
    await db.delete('habitRecords', existing.id)
    records.value = records.value.filter((r) => r.id !== existing.id)
    getSyncEngine().recordOp({ entityType: 'habitRecord', entityId: existing.id, operation: SyncOperation.Delete })
  }

  const updateHabit = async (id: string, data: Partial<{ title: string; description: string; frequency: HabitFrequency }>) => {
    const habit = habits.value.find((h) => h.id === id)
    if (!habit) return
    Object.assign(habit, data)
    const db = await getDB()
    await db.put('habits', { ...habit })
    getSyncEngine().recordOp({ entityType: 'habit', entityId: habit.id, operation: SyncOperation.Update, data: { ...habit } })
  }

  const deleteHabit = async (id: string) => {
    const db = await getDB()
    const relatedRecords = records.value.filter((r) => r.habitId === id)

    const boardStore = useBoardStore()
    const linkedCardIds: string[] = []

    for (const card of boardStore.cards) {
      if (card.linkedHabitId === id) linkedCardIds.push(card.id)
    }

    const allBoards = await db.getAll('boards')
    for (const board of allBoards) {
      if (board.id === boardStore.currentBoard?.id) continue
      const boardCards = await db.getAllFromIndex('cards', 'by-board', board.id)
      for (const c of boardCards) {
        if (c.linkedHabitId === id) linkedCardIds.push(c.id)
      }
    }

    const tx = db.transaction(['habits', 'habitRecords', 'cards'], 'readwrite')
    for (const r of relatedRecords) tx.objectStore('habitRecords').delete(r.id)
    for (const cid of linkedCardIds) tx.objectStore('cards').delete(cid)
    tx.objectStore('habits').delete(id)
    await tx.done

    habits.value = habits.value.filter((h) => h.id !== id)
    records.value = records.value.filter((r) => r.habitId !== id)

    const linkedIds = new Set(linkedCardIds)
    boardStore.cards = boardStore.cards.filter((c) => !linkedIds.has(c.id))

    const sync = getSyncEngine()
    for (const r of relatedRecords) {
      sync.recordOp({ entityType: 'habitRecord', entityId: r.id, operation: SyncOperation.Delete })
    }
    for (const cardId of linkedCardIds) {
      sync.recordOp({ entityType: 'card', entityId: cardId, operation: SyncOperation.Delete })
    }
    sync.recordOp({ entityType: 'habit', entityId: id, operation: SyncOperation.Delete })
  }

  const isDueDate = (habit: Habit, date: string): boolean => {
    if (habit.frequency === HabitFrequency.Daily) return true
    if (habit.frequency === HabitFrequency.Weekly) {
      return new Date(date).getDay() === new Date(habit.createdAt).getDay()
    }
    if (habit.frequency === HabitFrequency.Monthly) {
      return new Date(date).getDate() === new Date(habit.createdAt).getDate()
    }
    if (habit.frequency === HabitFrequency.Custom && habit.customIntervalDays) {
      const start = new Date(habit.createdAt.slice(0, 10))
      const target = new Date(date)
      const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000)
      return diffDays >= 0 && diffDays % habit.customIntervalDays === 0
    }
    return false
  }

  return {
    habits, records, loading,
    loadHabits, createHabit, updateHabit, checkIn, uncheckIn, deleteHabit, isDueDate,
  }
})
