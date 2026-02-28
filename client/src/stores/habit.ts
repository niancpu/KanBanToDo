import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Habit, HabitRecord } from '@kanban/shared'
import { HabitFrequency, Priority, DefaultColumnType } from '@kanban/shared'
import { getDB } from '@/db'
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

      // 按已加载的习�?ID 查询记录，利�?by-habit 索引避免全表扫描
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
    // 在当前看板的 ToDo 列创建对应卡�?
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
    return record
  }

  const uncheckIn = async (habitId: string, date: string) => {
    const existing = records.value.find((r) => r.habitId === habitId && r.date === date)
    if (!existing) return
    const db = await getDB()
    await db.delete('habitRecords', existing.id)
    records.value = records.value.filter((r) => r.id !== existing.id)
  }

  const updateHabit = async (id: string, data: Partial<{ title: string; description: string; frequency: HabitFrequency }>) => {
    const habit = habits.value.find((h) => h.id === id)
    if (!habit) return
    Object.assign(habit, data)
    const db = await getDB()
    await db.put('habits', { ...habit })
  }

  const deleteHabit = async (id: string) => {
    const db = await getDB()
    const relatedRecords = records.value.filter((r) => r.habitId === id)

    // �?by-column 索引逐列查找关联卡片，避免全表扫�?
    const boardStore = useBoardStore()
    const linkedCardIds: string[] = []

    // 先从当前看板内存中找
    for (const card of boardStore.cards) {
      if (card.linkedHabitId === id) linkedCardIds.push(card.id)
    }

    // 再从 IndexedDB 中按 board 索引查找其他看板的关联卡�?
    const allBoards = await db.getAll('boards')
    for (const board of allBoards) {
      if (board.id === boardStore.currentBoard?.id) continue // 已从内存中处�?
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

    // 同步当前看板的内存状�?
    const linkedIds = new Set(linkedCardIds)
    boardStore.cards = boardStore.cards.filter((c) => !linkedIds.has(c.id))
  }

  /** 判断指定日期是否为该习惯的应执行�?*/
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

