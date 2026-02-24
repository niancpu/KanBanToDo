<template>
  <v-container fluid>
    <v-row align="center" class="mb-2">
      <v-col cols="auto">
        <v-btn-toggle v-model="viewMode" mandatory variant="outlined" density="compact">
          <v-btn value="month" size="small">月</v-btn>
          <v-btn value="week" size="small">周</v-btn>
        </v-btn-toggle>
      </v-col>
      <v-spacer />
      <v-col cols="auto" class="d-flex align-center ga-1">
        <v-btn icon="mdi-chevron-left" variant="text" size="small" @click="prev" />
        <span class="text-body-1 font-weight-medium" style="min-width: 160px; text-align: center;">{{ headerText }}</span>
        <v-btn icon="mdi-chevron-right" variant="text" size="small" @click="next" />
        <v-btn variant="tonal" size="x-small" class="ml-1" @click="goToday">今天</v-btn>
      </v-col>
    </v-row>

    <!-- 月视图 -->
    <div v-if="viewMode === 'month'">
      <div class="calendar-grid">
        <div v-for="day in weekDayNames" :key="day" class="calendar-header text-caption font-weight-medium text-center">
          {{ day }}
        </div>
        <div
          v-for="(cell, i) in monthCells"
          :key="i"
          class="calendar-cell"
          :class="{
            'calendar-today': cell.isToday,
            'calendar-other-month': !cell.isCurrentMonth,
          }"
          @click="goToDate(cell.date)"
        >
          <div class="d-flex justify-space-between align-center mb-1">
            <span class="calendar-day-num" :class="{ 'calendar-day-today': cell.isToday }">{{ cell.day }}</span>
            <div class="d-flex ga-1">
              <span v-if="cell.doneCount" class="text-caption text-success d-flex align-center ga-0">
                <v-icon size="10">mdi-check</v-icon>{{ cell.doneCount }}
              </span>
              <span v-if="cell.droppedCount" class="text-caption text-error d-flex align-center ga-0">
                <v-icon size="10">mdi-close</v-icon>{{ cell.droppedCount }}
              </span>
            </div>
          </div>
          <div class="d-flex ga-1 flex-wrap">
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
          class="week-cell"
          :class="{ 'calendar-today': cell.isToday }"
          @click="goToDate(cell.date)"
        >
          <div class="week-cell-header">
            <span class="text-caption text-medium-emphasis">{{ cell.dayName }}</span>
            <span class="text-body-2 font-weight-medium" :class="{ 'calendar-day-today': cell.isToday }">{{ cell.day }}</span>
          </div>
          <div class="week-cell-body">
            <div v-if="cell.doneCount" class="text-caption text-success d-flex align-center ga-1 mb-1">
              <v-icon size="12">mdi-check-circle</v-icon> {{ cell.doneCount }} 完成
            </div>
            <div v-if="cell.droppedCount" class="text-caption text-error d-flex align-center ga-1 mb-1">
              <v-icon size="12">mdi-close-circle</v-icon> {{ cell.droppedCount }} 放弃
            </div>
            <div v-for="hs in cell.habitStatuses" :key="hs.id" class="d-flex align-center ga-1 mb-1">
              <span class="habit-dot" :class="habitDotClass(hs.status)" />
              <span class="text-caption">{{ hs.title }}</span>
            </div>
            <div v-if="cell.doneCount === 0 && cell.droppedCount === 0 && cell.habitStatuses.length === 0" class="text-caption text-medium-emphasis" style="opacity: 0.5;">
              无事项
            </div>
          </div>
        </div>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '@/stores/board'
import { useHabitStore } from '@/stores/habit'
import { useAuthStore } from '@/stores/auth'
import { DefaultColumnType, toDateStr } from '@kanban/shared'
import { getHabitDayStatus, type HabitDayStatus } from '@/composables/useStreak'
import { getDB } from '@/db'

const router = useRouter()
const boardStore = useBoardStore()
const habitStore = useHabitStore()
const authStore = useAuthStore()
const viewMode = ref<'month' | 'week'>('month')
const currentDate = ref(new Date())

const weekDayNames = ['一', '二', '三', '四', '五', '六', '日']

const boardCache = ref<Record<string, { done: number; dropped: number }>>({})

const getVisibleDateRange = () => {
  const d = currentDate.value
  if (viewMode.value === 'month') {
    const year = d.getFullYear()
    const month = d.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDay = (firstDay.getDay() || 7) - 1
    const first = new Date(year, month, 1 - startDay)
    const last = new Date(year, month, 1 + 41 - startDay)
    return { start: toDateStr(first), end: toDateStr(last) }
  }
  const start = getWeekStart(d)
  const end = new Date(start.getTime() + 6 * 86400000)
  return { start: toDateStr(start), end: toDateStr(end) }
}

const loadCalendarData = async () => {
  await habitStore.loadHabits()
  const db = await getDB()

  const { start, end } = getVisibleDateRange()
  const range = IDBKeyRange.bound(start, end)
  const allBoards = await db.getAllFromIndex('boards', 'by-date', range)
  const userId = authStore.user?.id
  const boards = userId ? allBoards.filter((b) => b.userId === userId) : allBoards

  const cache: Record<string, { done: number; dropped: number }> = {}
  for (const board of boards) {
    const cols = await db.getAllFromIndex('columns', 'by-board', board.id)
    const cards = await db.getAllFromIndex('cards', 'by-board', board.id)
    const doneCols = new Set(cols.filter((c) => c.defaultType === DefaultColumnType.Done).map((c) => c.id))
    const droppedCols = new Set(cols.filter((c) => c.defaultType === DefaultColumnType.Dropped).map((c) => c.id))
    cache[board.date] = {
      done: cards.filter((c) => doneCols.has(c.columnId)).length,
      dropped: cards.filter((c) => droppedCols.has(c.columnId)).length,
    }
  }
  boardCache.value = cache
}

onMounted(loadCalendarData)
onActivated(loadCalendarData)
watch([currentDate, viewMode], loadCalendarData)

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
  return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 — ${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`
})

const getWeekStart = (d: Date) => {
  const day = d.getDay() || 7
  const start = new Date(d)
  start.setDate(d.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)
  return start
}

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
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
}
.calendar-header {
  padding: 8px;
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.calendar-cell {
  min-height: 76px;
  padding: 6px 8px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: background 0.1s;
}
.calendar-cell:hover {
  background: rgba(0, 0, 0, 0.03);
}
.calendar-today {
  background: rgba(25, 118, 210, 0.04);
}
.calendar-other-month {
  opacity: 0.35;
}
.calendar-day-num {
  font-size: 12px;
  line-height: 1;
}
.calendar-day-today {
  background: #1976D2;
  color: white;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}
.week-cell {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
  min-height: 180px;
}
.week-cell:hover {
  background: rgba(0, 0, 0, 0.02);
}
.week-cell-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 8px 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}
.week-cell-body {
  padding: 8px;
}

.habit-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}
.habit-done { background-color: #4CAF50; }
.habit-skipped { background-color: #FFC107; }
.habit-broken { background-color: #FF5252; }
</style>
