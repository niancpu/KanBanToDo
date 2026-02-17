import { ref, computed } from 'vue'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useDateNav(initialDate?: string) {
  const currentDate = ref(initialDate ? new Date(initialDate + 'T00:00:00') : new Date())

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
    currentDate.value = new Date(date + 'T00:00:00')
  }

  return { currentDate, dateStr, displayDate, prevDay, nextDay, goToday, setDate }
}
