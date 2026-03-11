import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Board, Column, Card, Habit } from '@kanban/shared'
import { DefaultColumnType, HabitFrequency, Priority, SyncOperation, toDateStr, parseLocalDate } from '@kanban/shared'
import { getDB } from '@/db'
import { getSyncEngine } from '@/services/syncInstance'
import { useAuthStore } from '@/stores/auth'

const DEFAULT_COLUMNS: { title: string; defaultType: DefaultColumnType }[] = [
  { title: 'ToDo', defaultType: DefaultColumnType.Todo },
  { title: 'Doing', defaultType: DefaultColumnType.Doing },
  { title: 'Done', defaultType: DefaultColumnType.Done },
  { title: 'Dropped', defaultType: DefaultColumnType.Dropped },
]

export const useBoardStore = defineStore('board', () => {
  const currentBoard = ref<Board | null>(null)
  const cards = ref<Card[]>([])
  const columns = ref<Column[]>([])
  const loading = ref(false)
  const todayStr = () => toDateStr(new Date())
  const isFutureDate = (date: string) => date > todayStr()
  const getCardEffectiveDate = (card: Card) => (
    card.effectiveDate || card.startDate || currentBoard.value?.date || todayStr()
  )
  const ensureTodoForFutureTask = (columnId: string, effectiveDate: string) => {
    if (!isFutureDate(effectiveDate)) return
    const targetCol = columns.value.find((c) => c.id === columnId)
    if (targetCol?.defaultType !== DefaultColumnType.Todo) {
      throw new Error('Future tasks can only stay in ToDo column')
    }
  }
  const isFutureBoard = computed(() => (
    !!currentBoard.value && isFutureDate(currentBoard.value.date)
  ))

  const cardsByColumn = computed(() => {
    const map: Record<string, Card[]> = {}
    for (const col of columns.value) {
      map[col.id] = cards.value
        .filter((c) => c.columnId === col.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return map
  })

  const getColumnCards = (columnId: string) => cardsByColumn.value[columnId] || []

  /** 缁ф壙鍓嶉潰鐪嬫澘涓湭瀹屾垚鐨勫崱鐗囷細淇敼鍘熷崱灞炴€хЩ鍒板綋鍓嶇湅鏉匡紝鍦ㄦ簮鐪嬫澘鐣欏喕缁撳揩鐓?*/
  const loadCarriedForwardCards = async () => {
    if (!currentBoard.value) return

    if (navigator.locks) {
      await navigator.locks.request('carry-forward-lock', () => doCarryForward())
    } else {
      await doCarryForward()
    }
  }

  const doCarryForward = async () => {
    if (!currentBoard.value) return
    const db = await getDB()
    const date = currentBoard.value.date

    const lower = parseLocalDate(date)
    lower.setDate(lower.getDate() - 30)
    const range = IDBKeyRange.bound(toDateStr(lower), date, false, true)

    const prevBoards: Board[] = []
    const cursor = await db.transaction('boards', 'readonly').store.index('by-date').openCursor(range, 'prev')
    let cur = cursor
    while (cur) {
      prevBoards.push(cur.value)
      cur = await cur.continue()
    }
    if (prevBoards.length === 0) return

    const todoCol = columns.value.find((c) => c.defaultType === DefaultColumnType.Todo)
    const doingCol = columns.value.find((c) => c.defaultType === DefaultColumnType.Doing)
    if (!todoCol) return

    const existingIds = new Set(cards.value.map((c) => c.id))
    const existingHabitIds = new Set(cards.value.filter((c) => c.linkedHabitId).map((c) => c.linkedHabitId))

    const snapshots: Card[] = []
    const movedCards: Card[] = []
    const sync = getSyncEngine()

    for (const prevBoard of prevBoards) {
      const prevColumns = await db.getAllFromIndex('columns', 'by-board', prevBoard.id)
      const prevCards = await db.getAllFromIndex('cards', 'by-board', prevBoard.id)
      const localColTypeMap = new Map(prevColumns.map((c) => [c.id, c.defaultType]))

      for (const card of prevCards) {
        if (card.isFromInheritance) continue
        if (existingIds.has(card.id)) continue
        if (card.linkedHabitId && existingHabitIds.has(card.linkedHabitId)) continue

        const colType = localColTypeMap.get(card.columnId)
        if (colType !== DefaultColumnType.Todo && colType !== DefaultColumnType.Doing) continue

        const mappedColId = (colType === DefaultColumnType.Doing && doingCol) ? doingCol.id : todoCol.id

        snapshots.push({
          ...card,
          id: uuidv4(),
          isFromInheritance: true,
        })

        card.boardId = currentBoard.value!.id
        card.columnId = mappedColId
        card.updatedAt = new Date().toISOString()
        movedCards.push(card)

        cards.value.push(card)
        existingIds.add(card.id)
        if (card.linkedHabitId) existingHabitIds.add(card.linkedHabitId)
      }
    }

    if (snapshots.length > 0 || movedCards.length > 0) {
      const tx = db.transaction('cards', 'readwrite')
      for (const s of snapshots) tx.store.put(s)
      for (const c of movedCards) tx.store.put({ ...c })
      await tx.done
      for (const c of movedCards) {
        sync.recordOp({ entityType: 'card', entityId: c.id, operation: SyncOperation.Update, data: { ...c } })
      }
    }
  }

  /** 鍒ゆ柇涔犳儻鍦ㄦ寚瀹氭棩鏈熸槸鍚﹀簲鎵ц�?*/
  const isHabitDue = (habit: Habit, date: string): boolean => {
    if (habit.frequency === HabitFrequency.Daily) return true
    const created = new Date(habit.createdAt)
    const target = parseLocalDate(date)
    if (habit.frequency === HabitFrequency.Weekly) return target.getDay() === created.getDay()
    if (habit.frequency === HabitFrequency.Monthly) return target.getDate() === created.getDate()
    if (habit.frequency === HabitFrequency.Custom && habit.customIntervalDays) {
      const diffDays = Math.round((target.getTime() - parseLocalDate(habit.createdAt.slice(0, 10)).getTime()) / 86400000)
      return diffDays >= 0 && diffDays % habit.customIntervalDays === 0
    }
    return false
  }

  /** 涓哄綋澶╁簲鎵ц鐨勪範鎯垱寤哄崱鐗囷紙璺宠繃宸蹭粠鍓嶄竴澶╃户鎵跨殑锛?*/
  const createHabitCards = async (board: Board, date: string) => {
    const db = await getDB()
    const allHabits: Habit[] = await db.getAll('habits')
    const dueHabits = allHabits.filter((h) => isHabitDue(h, date))
    if (dueHabits.length === 0) return

    const existingHabitIds = new Set(cards.value.filter((c) => c.linkedHabitId).map((c) => c.linkedHabitId))
    const newHabits = dueHabits.filter((h) => !existingHabitIds.has(h.id))
    if (newHabits.length === 0) return

    const todoCol = columns.value.find((c) => c.defaultType === DefaultColumnType.Todo)
    if (!todoCol) return

    const now = new Date().toISOString()
    const baseSort = cards.value.filter((c) => c.columnId === todoCol.id).length
    const tx = db.transaction('cards', 'readwrite')
    const sync = getSyncEngine()

    for (let i = 0; i < newHabits.length; i++) {
      const habit = newHabits[i]!
      const card: Card = {
        id: uuidv4(),
        boardId: board.id,
        columnId: todoCol.id,
        title: habit.title,
        description: habit.description,
        priority: Priority.INU,
        sortOrder: baseSort + i,
        effectiveDate: date,
        startDate: date,
        linkedHabitId: habit.id,
        isFromInheritance: false,
        createdAt: now,
        updatedAt: now,
      }
      tx.store.put(card)
      cards.value.push(card)
      sync.recordOp({ entityType: 'card', entityId: card.id, operation: SyncOperation.Create, data: card })
    }
    await tx.done
  }

  const loadBoard = async (date: string) => {
    loading.value = true
    try {
      const db = await getDB()
      const authStore = useAuthStore()
      const userId = authStore.user?.id || ''
      const existing = await db.getAllFromIndex('boards', 'by-date', date)
      let board = existing.find((b) => b.userId === userId) || existing[0]
      const today = todayStr()

      if (!board) {
        if (date < today) {
          currentBoard.value = null
          columns.value = []
          cards.value = []
          return
        }

        board = { id: uuidv4(), userId: authStore.user?.id || '', date, createdAt: new Date().toISOString() }
        await db.put('boards', board)

        const newCols: Column[] = DEFAULT_COLUMNS.map((col, i) => ({
          id: uuidv4(),
          boardId: board!.id,
          title: col.title,
          sortOrder: i,
          defaultType: col.defaultType,
        }))
        const tx = db.transaction('columns', 'readwrite')
        for (const col of newCols) tx.store.put(col)
        await tx.done

        const sync = getSyncEngine()
        sync.recordOp({ entityType: 'board', entityId: board.id, operation: SyncOperation.Create, data: board })
        for (const col of newCols) {
          sync.recordOp({ entityType: 'column', entityId: col.id, operation: SyncOperation.Create, data: col })
        }

        columns.value = newCols
        cards.value = []
        currentBoard.value = board
        if (!isFutureDate(date)) {
          await loadCarriedForwardCards()
          await createHabitCards(board, date)
        }
      } else {
        currentBoard.value = board
        columns.value = (await db.getAllFromIndex('columns', 'by-board', board.id))
          .sort((a, b) => a.sortOrder - b.sortOrder)
        cards.value = await db.getAllFromIndex('cards', 'by-board', board.id)
        if (!isFutureDate(date)) {
          await loadCarriedForwardCards()
        }

        if (date === toDateStr(new Date())) {
          await createHabitCards(board, date)
        }
      }
    } finally {
      loading.value = false
    }
  }

  const addCard = async (data: {
    title: string
    columnId: string
    description?: string
    priority?: Priority
    effectiveDate?: string
    startDate?: string
    estimatedTime?: number
    linkedHabitId?: string
  }) => {
    if (!currentBoard.value) return
    const now = new Date().toISOString()
    const effectiveDate = data.effectiveDate || data.startDate || currentBoard.value.date
    ensureTodoForFutureTask(data.columnId, effectiveDate)
    const colCards = cards.value.filter((c) => c.columnId === data.columnId)
    const card: Card = {
      id: uuidv4(),
      boardId: currentBoard.value.id,
      columnId: data.columnId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      sortOrder: colCards.length,
      effectiveDate,
      startDate: effectiveDate,
      estimatedTime: data.estimatedTime,
      linkedHabitId: data.linkedHabitId,
      isFromInheritance: false,
      createdAt: now,
      updatedAt: now,
    }
    const db = await getDB()
    await db.put('cards', card)
    cards.value.push(card)
    getSyncEngine().recordOp({ entityType: 'card', entityId: card.id, operation: SyncOperation.Create, data: card })
    return card
  }

  const updateCard = async (cardId: string, data: Partial<Card>) => {
    const card = cards.value.find((c) => c.id === cardId)
    if (!card || !currentBoard.value) return

    const next: Partial<Card> = { ...data }
    if (next.effectiveDate && !next.startDate) next.startDate = next.effectiveDate
    if (next.startDate && !next.effectiveDate) next.effectiveDate = next.startDate

    const nextEffectiveDate = next.effectiveDate || card.effectiveDate || card.startDate || currentBoard.value.date
    const nextColumnId = next.columnId || card.columnId
    ensureTodoForFutureTask(nextColumnId, nextEffectiveDate)

    Object.assign(card, next, { updatedAt: new Date().toISOString() })
    const db = await getDB()
    await db.put('cards', { ...card })
    getSyncEngine().recordOp({ entityType: 'card', entityId: card.id, operation: SyncOperation.Update, data: { ...card } })
  }

  const moveCard = async (cardId: string, targetColumnId: string, newIndex: number) => {
    const card = cards.value.find((c) => c.id === cardId)
    if (!card || !currentBoard.value) return
    ensureTodoForFutureTask(targetColumnId, getCardEffectiveDate(card))

    const oldColumnId = card.columnId
    card.columnId = targetColumnId
    card.updatedAt = new Date().toISOString()

    // 閲嶆柊璁＄畻鐩爣鍒楁墍鏈夊崱鐗囩殑 sortOrder
    const targetCards = cards.value
      .filter((c) => c.columnId === targetColumnId && c.id !== cardId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    targetCards.splice(newIndex, 0, card)
    targetCards.forEach((c, i) => (c.sortOrder = i))

    // 濡傛灉鏄法鍒楃Щ鍔紝閲嶆柊璁＄畻婧愬垪�?sortOrder
    if (oldColumnId !== targetColumnId) {
      const sourceCards = cards.value
        .filter((c) => c.columnId === oldColumnId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      sourceCards.forEach((c, i) => (c.sortOrder = i))
    }

    // 鎵归噺鍐欏叆
    const db = await getDB()
    const allAffected = oldColumnId !== targetColumnId
      ? [...targetCards, ...cards.value.filter((c) => c.columnId === oldColumnId)]
      : targetCards
    const tx = db.transaction('cards', 'readwrite')
    for (const c of allAffected) tx.store.put({ ...c })
    await tx.done

    const sync = getSyncEngine()
    for (const c of allAffected) {
      sync.recordOp({ entityType: 'card', entityId: c.id, operation: SyncOperation.Update, data: { ...c } })
    }

    if (oldColumnId !== targetColumnId) {
      const targetCol = columns.value.find((c) => c.id === targetColumnId)
      const oldCol = columns.value.find((c) => c.id === oldColumnId)

      if (card.linkedHabitId && currentBoard.value) {
        const { useHabitStore } = await import('@/stores/habit')
        const habitStore = useHabitStore()
        if (targetCol?.defaultType === DefaultColumnType.Done) {
          await habitStore.checkIn(card.linkedHabitId, currentBoard.value.date)
        } else if (oldCol?.defaultType === DefaultColumnType.Done) {
          await habitStore.uncheckIn(card.linkedHabitId, currentBoard.value.date)
        }
      }
    }
  }

  const deleteCard = async (cardId: string) => {
    const db = await getDB()
    await db.delete('cards', cardId)
    cards.value = cards.value.filter((c) => c.id !== cardId)
    getSyncEngine().recordOp({ entityType: 'card', entityId: cardId, operation: SyncOperation.Delete })
  }

  // --- 鑷畾涔夊垪鎿嶄�?---

  const addColumn = async (title: string) => {
    if (!currentBoard.value) return
    const col: Column = {
      id: uuidv4(),
      boardId: currentBoard.value.id,
      title,
      sortOrder: columns.value.length,
    }
    const db = await getDB()
    await db.put('columns', col)
    columns.value.push(col)
    getSyncEngine().recordOp({ entityType: 'column', entityId: col.id, operation: SyncOperation.Create, data: col })
    return col
  }

  const renameColumn = async (columnId: string, title: string) => {
    const col = columns.value.find((c) => c.id === columnId)
    if (!col) return
    col.title = title
    const db = await getDB()
    await db.put('columns', { ...col })
    getSyncEngine().recordOp({ entityType: 'column', entityId: col.id, operation: SyncOperation.Update, data: { ...col } })
  }

  const deleteColumn = async (columnId: string) => {
    const col = columns.value.find((c) => c.id === columnId)
    if (!col) return
    if (col.defaultType) return

    const db = await getDB()
    const colCards = cards.value.filter((c) => c.columnId === columnId)
    const tx = db.transaction(['columns', 'cards'], 'readwrite')
    const sync = getSyncEngine()
    for (const c of colCards) {
      tx.objectStore('cards').delete(c.id)
      sync.recordOp({ entityType: 'card', entityId: c.id, operation: SyncOperation.Delete })
    }
    tx.objectStore('columns').delete(columnId)
    await tx.done

    columns.value = columns.value.filter((c) => c.id !== columnId)
    cards.value = cards.value.filter((c) => c.columnId !== columnId)
    sync.recordOp({ entityType: 'column', entityId: columnId, operation: SyncOperation.Delete })
  }

  const reorderColumns = async (orderedIds: string[]) => {
    const db = await getDB()
    const tx = db.transaction('columns', 'readwrite')
    const sync = getSyncEngine()
    for (let i = 0; i < orderedIds.length; i++) {
      const col = columns.value.find((c) => c.id === orderedIds[i])
      if (col) {
        col.sortOrder = i
        tx.store.put({ ...col })
        sync.recordOp({ entityType: 'column', entityId: col.id, operation: SyncOperation.Update, data: { ...col } })
      }
    }
    await tx.done
    columns.value.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  return {
    currentBoard, cards, columns, loading, isFutureBoard,
    cardsByColumn, getColumnCards,
    loadBoard, addCard, updateCard, moveCard, deleteCard,
    addColumn, renameColumn, deleteColumn, reorderColumns,
  }
})



