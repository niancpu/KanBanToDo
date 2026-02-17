import { ref, computed } from 'vue'
import { toDateStr, parseLocalDate } from '@kanban/shared'

export function useDateNav(initialDate?: string) {
  const currentDate = ref(initialDate ? parseLocalDate(initialDate) : new Date())

  const dateStr = computed(() => toDateStr(currentDate.value))

  const displayDate = computed(() =>
    currentDate.value.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }),
  )

  const prevDay = () => {
    const d = new Date(currentDate.value)
    d.setDate(d.getDate() - 1)
    currentDate.value = d
  }

  const nextDay = () => {
    const d = new Date(currentDate.value)
    d.setDate(d.getDate() + 1)
    currentDate.value = d
  }

  const goToday = () => {
    currentDate.value = new Date()
  }

  const setDate = (date: string) => {
    currentDate.value = parseLocalDate(date)
  }

  return { currentDate, dateStr, displayDate, prevDay, nextDay, goToday, setDate }
}
