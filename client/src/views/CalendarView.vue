<template>
  <v-container fluid>
    <v-row align="center" class="mb-4">
      <v-col cols="auto">
        <v-btn-toggle v-model="viewMode" mandatory variant="outlined" density="compact">
          <v-btn value="month">月视图</v-btn>
          <v-btn value="week">周视图</v-btn>
        </v-btn-toggle>
      </v-col>
      <v-spacer />
      <v-col cols="auto" class="d-flex align-center ga-2">
        <v-btn icon="mdi-chevron-left" variant="text" size="small" @click="prev" />
        <h3 class="text-h6">{{ headerText }}</h3>
        <v-btn icon="mdi-chevron-right" variant="text" size="small" @click="next" />
        <v-btn variant="tonal" size="small" @click="goToday">今天</v-btn>
      </v-col>
    </v-row>

    <!-- 月视图 -->
    <div v-if="viewMode === 'month'">
      <div class="calendar-grid">
        <div v-for="day in weekDayNames" :key="day" class="calendar-header text-caption font-weight-medium text-center pa-2">
          {{ day }}
        </div>
        <div
          v-for="(cell, i) in monthCells"
          :key="i"
          class="calendar-cell pa-1"
          :class="{ 'bg-blue-lighten-5': cell.isToday, 'text-medium-emphasis': !cell.isCurrentMonth }"
          @click="goToDate(cell.date)"
        >
          <div class="text-caption text-right">{{ cell.day }}</div>
          <div v-if="cell.doneCount" class="text-caption text-success"><v-icon size="x-small">mdi-check-circle</v-icon> {{ cell.doneCount }}</div>
          <div v-if="cell.droppedCount" class="text-caption text-error"><v-icon size="x-small">mdi-close-circle</v-icon> {{ cell.droppedCount }}</div>
          <div class="d-flex ga-1 flex-wrap mt-1">
            <span
              v-for="hs in cell.habitStatuses"
              :key="hs.id"
              class="habit-dot"
              :class="habitDotClass(hs.status)"
              :title="hs.title"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 周视图 -->
    <div v-if="viewMode === 'week'">
      <div class="week-grid">
        <div
          v-for="(cell, i) in weekCells"
          :key="i"
          class="week-cell pa-2"
          :class="{ 'bg-blue-lighten-5': cell.isToday }"
          @click="goToDate(cell.date)"
        >
          <div class="text-subtitle-2 font-weight-medium mb-1">
            {{ cell.dayName }} {{ cell.day }}
          </div>
          <div v-if="cell.doneCount" class="text-caption text-success mb-1"><v-icon size="x-small">mdi-check-circle</v-icon> {{ cell.doneCount }} 完成</div>
          <div v-if="cell.droppedCount" class="text-caption text-error mb-1"><v-icon size="x-small">mdi-close-circle</v-icon> {{ cell.droppedCount }} 放弃</div>
          <div v-for="hs in cell.habitStatuses" :key="hs.id" class="d-flex align-center ga-1 mb-1">
            <span class="habit-dot" :class="habitDotClass(hs.status)" />
            <span class="text-caption">{{ hs.title }}</span>
          </div>
          <div v-if="cell.doneCount === 0 && cell.droppedCount === 0 && cell.habitStatuses.length === 0" class="text-caption text-medium-emphasis">
            无事项
          </div>
        </div>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '@/stores/board'
import { useHabitStore } from '@/stores/habit'
import { DefaultColumnType } from '@kanban/shared'
import { getHabitDayStatus, type HabitDayStatus } from '@/composables/useStreak'
import { getDB } from '@/db'

const router = useRouter()
const boardStore = useBoardStore()
const habitStore = useHabitStore()
const viewMode = ref<'month' | 'week'>('month')
const currentDate = ref(new Date())

const weekDayNames = ['一', '二', '三', '四', '五', '六', '日']

// 缓存所有看板数据用于日历统计
const boardCache = ref<Record<string, { done: number; dropped: number }>>({})

const loadCalendarData = async () => {
  await habitStore.loadHabits()
  // 加载所有 boards + columns + cards 用于统计
  const db = await getDB()
  const allBoards = await db.getAll('boards')
  const allColumns = await db.getAll('columns')
  const allCards = await db.getAll('cards')

  const cache: Record<string, { done: number; dropped: number }> = {}
  for (const board of allBoards) {
    const cols = allColumns.filter((c) => c.boardId === board.id)
    const doneCols = cols.filter((c) => c.defaultType === DefaultColumnType.Done).map((c) => c.id)
    const droppedCols = cols.filter((c) => c.defaultType === DefaultColumnType.Dropped).map((c) => c.id)
    const boardCards = allCards.filter((c) => c.boardId === board.id)
    cache[board.date] = {
      done: boardCards.filter((c) => doneCols.includes(c.columnId)).length,
      dropped: boardCards.filter((c) => droppedCols.includes(c.columnId)).length,
    }
  }
  boardCache.value = cache
}

onMounted(loadCalendarData)

interface CellHabitStatus { id: string; title: string; status: HabitDayStatus }

const getHabitStatusesForDate = (dateStr: string): CellHabitStatus[] => {
  return habitStore.habits.map((h) => ({
    id: h.id,
    title: h.title,
    status: getHabitDayStatus(h, habitStore.records, dateStr),
  })).filter((hs) => hs.status !== 'pending')
}

const headerText = computed(() => {
  const d = currentDate.value
  if (viewMode.value === 'month') return `${d.getFullYear()}年${d.getMonth() + 1}月`
  const weekStart = getWeekStart(d)
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
  return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 - ${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`
})

const getWeekStart = (d: Date) => {
  const day = d.getDay() || 7
  const start = new Date(d)
  start.setDate(d.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)
  return start
}

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const isToday = (d: Date) => toDateStr(d) === toDateStr(new Date())

const monthCells = computed(() => {
  const d = currentDate.value
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDay = new Date(year, month, 1)
  const startDay = (firstDay.getDay() || 7) - 1
  const cells = []
  for (let i = -startDay; i < 42 - startDay; i++) {
    const date = new Date(year, month, 1 + i)
    const dateStr = toDateStr(date)
    const stats = boardCache.value[dateStr]
    cells.push({
      date,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: isToday(date),
      doneCount: stats?.done || 0,
      droppedCount: stats?.dropped || 0,
      habitStatuses: getHabitStatusesForDate(dateStr),
    })
  }
  return cells
})

const weekCells = computed(() => {
  const start = getWeekStart(currentDate.value)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getTime() + i * 86400000)
    const dateStr = toDateStr(date)
    const stats = boardCache.value[dateStr]
    return {
      date,
      day: date.getDate(),
      dayName: weekDayNames[i],
      isToday: isToday(date),
      doneCount: stats?.done || 0,
      droppedCount: stats?.dropped || 0,
      habitStatuses: getHabitStatusesForDate(dateStr),
    }
  })
})

const prev = () => {
  const d = new Date(currentDate.value)
  if (viewMode.value === 'month') d.setMonth(d.getMonth() - 1)
  else d.setDate(d.getDate() - 7)
  currentDate.value = d
}
const next = () => {
  const d = new Date(currentDate.value)
  if (viewMode.value === 'month') d.setMonth(d.getMonth() + 1)
  else d.setDate(d.getDate() + 7)
  currentDate.value = d
}
const goToday = () => { currentDate.value = new Date() }
const goToDate = (date: Date) => {
  router.push({ name: 'daily-board', query: { date: toDateStr(date) } })
}

const habitDotClass = (status: HabitDayStatus) => ({
  'habit-done': status === 'done',
  'habit-skipped': status === 'skipped',
  'habit-broken': status === 'broken',
})
</script>

<style scoped>
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); border: 1px solid rgba(0,0,0,0.12); }
.calendar-header { border-bottom: 1px solid rgba(0,0,0,0.12); background: rgba(0,0,0,0.03); }
.calendar-cell { min-height: 80px; border: 1px solid rgba(0,0,0,0.06); cursor: pointer; }
.calendar-cell:hover { background: rgba(0,0,0,0.04); }
.week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.week-cell { min-height: 200px; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; cursor: pointer; }
.week-cell:hover { background: rgba(0,0,0,0.04); }
.habit-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.habit-done { background-color: #4CAF50; }
.habit-skipped { background-color: #FFC107; }
.habit-broken { background-color: #FF5252; }
</style>
