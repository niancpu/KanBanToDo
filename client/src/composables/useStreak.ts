import type { HabitRecord, Habit } from '@kanban/shared'
import { HabitFrequency } from '@kanban/shared'

export type HabitDayStatus = 'done' | 'skipped' | 'broken' | 'pending'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 获取习惯应执行的日期序列（从 startDate 往前回溯 maxDays 天） */
function getDueDates(habit: Habit, endDate: string, maxDays: number): string[] {
  const dates: string[] = []
  const d = new Date(endDate + 'T00:00:00')
  const createdDate = new Date(habit.createdAt.slice(0, 10) + 'T00:00:00')

  for (let i = 0; i < maxDays; i++) {
    if (d < createdDate) break
    const ds = toDateStr(d)

    if (habit.frequency === HabitFrequency.Daily) {
      dates.push(ds)
    } else if (habit.frequency === HabitFrequency.Weekly) {
      if (d.getDay() === createdDate.getDay()) dates.push(ds)
    } else if (habit.frequency === HabitFrequency.Monthly) {
      if (d.getDate() === createdDate.getDate()) dates.push(ds)
    } else if (habit.frequency === HabitFrequency.Custom && habit.customIntervalDays) {
      const diff = Math.round((d.getTime() - createdDate.getTime()) / 86400000)
      if (diff >= 0 && diff % habit.customIntervalDays === 0) dates.push(ds)
    }

    d.setDate(d.getDate() - 1)
  }
  return dates // 从近到远排列
}

/**
 * 计算习惯连续天数和当天状态
 *
 * 规则：
 * - 完成 → 绿色勾，计入天数
 * - 中断恰好 1 个应执行日 → 黄色圈，不打断累计但不计入天数
 * - 中断超过 1 个应执行日 → 红色叉，累计归零
 */
export function calcStreak(
  habit: Habit,
  records: HabitRecord[],
  today: string,
): { streak: number; todayStatus: HabitDayStatus } {
  const habitRecords = records.filter((r) => r.habitId === habit.id && r.completed)
  const completedSet = new Set(habitRecords.map((r) => r.date))

  const dueDates = getDueDates(habit, today, 730) // 回溯 2 年
  if (dueDates.length === 0) return { streak: 0, todayStatus: 'pending' }

  // 今天状态
  const todayIsDue = dueDates[0] === today
  const todayDone = completedSet.has(today)
  let todayStatus: HabitDayStatus = 'pending'
  if (todayIsDue && todayDone) todayStatus = 'done'
  else if (todayIsDue && !todayDone) todayStatus = 'pending'

  // 计算连续天数
  let streak = 0
  let missedConsecutive = 0

  for (const date of dueDates) {
    if (completedSet.has(date)) {
      streak++
      missedConsecutive = 0
    } else {
      missedConsecutive++
      if (missedConsecutive > 1) break // 中断超过 1 次，归零
      // missedConsecutive === 1 时继续（黄色圈，容忍 1 次）
    }
  }

  // 如果第一个就是 miss 且今天还没到（pending），从第二个开始算
  if (dueDates[0] === today && !todayDone) {
    streak = 0
    missedConsecutive = 0
    for (let i = 1; i < dueDates.length; i++) {
      if (completedSet.has(dueDates[i]!)) {
        streak++
        missedConsecutive = 0
      } else {
        missedConsecutive++
        if (missedConsecutive > 1) break
      }
    }
  }

  return { streak, todayStatus }
}

/**
 * 获取某一天的习惯状态（用于日历显示）
 */
export function getHabitDayStatus(
  habit: Habit,
  records: HabitRecord[],
  date: string,
): HabitDayStatus {
  const isDue = getDueDates(habit, date, 1)[0] === date
  if (!isDue) return 'pending'

  const done = records.some((r) => r.habitId === habit.id && r.date === date && r.completed)
  if (done) return 'done'

  // 检查是否中断：看前后的应执行日
  const today = toDateStr(new Date())
  if (date >= today) return 'pending' // 未来的日期

  // 往后找下一个完成的应执行日，判断中间 miss 了几天
  const dueDates = getDueDates(habit, today, 730)
  const idx = dueDates.indexOf(date)
  if (idx === -1) return 'pending'

  // 从该日期往前看，如果前一个应执行日完成了且后一个也完成了，就是 skipped
  const prevDue = idx + 1 < dueDates.length ? dueDates[idx + 1] : null
  const nextDue = idx - 1 >= 0 ? dueDates[idx - 1] : null

  const prevDone = prevDue ? records.some((r) => r.habitId === habit.id && r.date === prevDue && r.completed) : false
  const nextDone = nextDue ? records.some((r) => r.habitId === habit.id && r.date === nextDue && r.completed) : false

  if (prevDone && nextDone) return 'skipped'
  return 'broken'
}
