import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Board, Column, Card, Habit } from '@kanban/shared'
import { DefaultColumnType, HabitFrequency, Priority, SyncOperation, WbsStatus, toDateStr, parseLocalDate } from '@kanban/shared'
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

  /** 加载前面看板中尚未完成的卡片（同一张卡片，不做副本） */
  const loadCarriedForwardCards = async () => {
    if (!currentBoard.value) return
    const db = await getDB()
    const date = currentBoard.value.date

    // 回溯最多 30 天
    const lower = parseLocalDate(date)
    lower.setDate(lower.getDate() - 30)
    const range = IDBKeyRange.bound(toDateStr(lower), date, false, true)

    const prevBoards: Board[] = []
    const cursor = await db.transaction('boards', 'readonly').store.index('by-date').openCursor(range)
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
    const existingProjectNodeIds = new Set(
      cards.value.filter((c) => c.linkedProjectNodeId).map((c) => c.linkedProjectNodeId),
    )

    for (const prevBoard of prevBoards) {
      const prevColumns = await db.getAllFromIndex('columns', 'by-board', prevBoard.id)
      const prevCards = await db.getAllFromIndex('cards', 'by-board', prevBoard.id)

      const todoDoingColIds = new Set(
        prevColumns
          .filter((c) => c.defaultType === DefaultColumnType.Todo || c.defaultType === DefaultColumnType.Doing)
          .map((c) => c.id),
      )

      // 映射：前看板列 → 当前看板列
      const colMap = new Map<string, string>()
      for (const pc of prevColumns) {
        if (pc.defaultType === DefaultColumnType.Todo) colMap.set(pc.id, todoCol.id)
        else if (pc.defaultType === DefaultColumnType.Doing && doingCol) colMap.set(pc.id, doingCol.id)
      }

      for (const card of prevCards) {
        if (!todoDoingColIds.has(card.columnId)) continue
        if (existingIds.has(card.id)) continue
        if (card.linkedHabitId && existingHabitIds.has(card.linkedHabitId)) continue
        if (card.linkedProjectNodeId && existingProjectNodeIds.has(card.linkedProjectNodeId)) continue

        cards.value.push({ ...card, columnId: colMap.get(card.columnId) || todoCol.id })
        existingIds.add(card.id)
        if (card.linkedHabitId) existingHabitIds.add(card.linkedHabitId)
        if (card.linkedProjectNodeId) existingProjectNodeIds.add(card.linkedProjectNodeId)
      }
    }
  }

  /** 判断习惯在指定日期是否应执行 */
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

  /** 为当天应执行的习惯创建卡片（跳过已从前一天继承的） */
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
        priority: Priority.VN,
        sortOrder: baseSort + i,
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
      const existing = await db.getAllFromIndex('boards', 'by-date', date)
      let board = existing[0]

      if (!board) {
        const authStore = useAuthStore()
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

        columns.value = newCols
        cards.value = []
        currentBoard.value = board

        // 加载前面看板中未完成的卡片（原卡片，非副本）
        await loadCarriedForwardCards()

        // 为当天应执行的习惯创建卡片（跳过已 carry-forward 的）
        await createHabitCards(board, date)
      } else {
        currentBoard.value = board
        columns.value = (await db.getAllFromIndex('columns', 'by-board', board.id))
          .sort((a, b) => a.sortOrder - b.sortOrder)
        cards.value = await db.getAllFromIndex('cards', 'by-board', board.id)

        // 加载前面看板中未完成的卡片
        await loadCarriedForwardCards()
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
    startDate?: string
    estimatedTime?: number
    linkedProjectNodeId?: string
    linkedHabitId?: string
  }) => {
    if (!currentBoard.value) return
    const now = new Date().toISOString()
    const colCards = cards.value.filter((c) => c.columnId === data.columnId)
    const card: Card = {
      id: uuidv4(),
      boardId: currentBoard.value.id,
      columnId: data.columnId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      sortOrder: colCards.length,
      startDate: data.startDate,
      estimatedTime: data.estimatedTime,
      linkedProjectNodeId: data.linkedProjectNodeId,
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
    // 编辑 carry-forward 卡片时认领到当前看板
    if (card.boardId !== currentBoard.value.id) {
      card.boardId = currentBoard.value.id
    }
    Object.assign(card, data, { updatedAt: new Date().toISOString() })
    const db = await getDB()
    await db.put('cards', { ...card })
    getSyncEngine().recordOp({ entityType: 'card', entityId: card.id, operation: SyncOperation.Update, data: { ...card } })
  }

  const moveCard = async (cardId: string, targetColumnId: string, newIndex: number) => {
    const card = cards.value.find((c) => c.id === cardId)
    if (!card || !currentBoard.value) return

    // 跨看板卡片（carry-forward）移动时，认领到当前看板
    if (card.boardId !== currentBoard.value.id) {
      card.boardId = currentBoard.value.id
    }

    const oldColumnId = card.columnId
    card.columnId = targetColumnId
    card.updatedAt = new Date().toISOString()

    // 重新计算目标列所有卡片的 sortOrder
    const targetCards = cards.value
      .filter((c) => c.columnId === targetColumnId && c.id !== cardId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    targetCards.splice(newIndex, 0, card)
    targetCards.forEach((c, i) => (c.sortOrder = i))

    // 如果是跨列移动，重新计算源列的 sortOrder
    if (oldColumnId !== targetColumnId) {
      const sourceCards = cards.value
        .filter((c) => c.columnId === oldColumnId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      sourceCards.forEach((c, i) => (c.sortOrder = i))
    }

    // 批量写入
    const db = await getDB()
    const allAffected = oldColumnId !== targetColumnId
      ? [...targetCards, ...cards.value.filter((c) => c.columnId === oldColumnId)]
      : targetCards
    const tx = db.transaction('cards', 'readwrite')
    for (const c of allAffected) tx.store.put({ ...c })
    await tx.done

    // 同步所有 sortOrder 变更的卡片
    const sync = getSyncEngine()
    for (const c of allAffected) {
      sync.recordOp({ entityType: 'card', entityId: c.id, operation: SyncOperation.Update, data: { ...c } })
    }

    // 跨列移动时触发双向同步
    if (oldColumnId !== targetColumnId) {
      const targetCol = columns.value.find((c) => c.id === targetColumnId)
      const oldCol = columns.value.find((c) => c.id === oldColumnId)

      // 习惯打卡同步
      if (card.linkedHabitId && currentBoard.value) {
        const { useHabitStore } = await import('@/stores/habit')
        const habitStore = useHabitStore()
        if (targetCol?.defaultType === DefaultColumnType.Done) {
          await habitStore.checkIn(card.linkedHabitId, currentBoard.value.date)
        } else if (oldCol?.defaultType === DefaultColumnType.Done) {
          await habitStore.uncheckIn(card.linkedHabitId, currentBoard.value.date)
        }
      }

      // WBS 节点状态同步
      if (card.linkedProjectNodeId && targetCol?.defaultType) {
        const { useProjectStore } = await import('@/stores/project')
        const projectStore = useProjectStore()
        const statusMap: Record<string, WbsStatus> = {
          [DefaultColumnType.Done]: WbsStatus.Done,
          [DefaultColumnType.Dropped]: WbsStatus.Dropped,
          [DefaultColumnType.Doing]: WbsStatus.InProgress,
          [DefaultColumnType.Todo]: WbsStatus.NotStarted,
        }
        const newStatus = statusMap[targetCol.defaultType]
        if (newStatus) {
          await projectStore.syncNodeStatus(card.linkedProjectNodeId, newStatus)
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

  // --- 自定义列操作 ---

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
    // 系统保留列不可删除（四个默认列都受保护，继承依赖 ToDo/Doing）
    if (col.defaultType) return

    const db = await getDB()
    // 删除列中的所有卡片
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
    currentBoard, cards, columns, loading,
    cardsByColumn, getColumnCards,
    loadBoard, addCard, updateCard, moveCard, deleteCard,
    addColumn, renameColumn, deleteColumn, reorderColumns,
  }
})
