<template>
  <v-container>
    <v-row align="center" class="mb-4">
      <v-col>
        <h2 class="text-h5 font-weight-medium">习惯追踪</h2>
      </v-col>
      <v-col cols="auto">
        <v-btn prepend-icon="mdi-plus" color="primary" @click="dialog = true">新建习惯</v-btn>
      </v-col>
    </v-row>

    <v-row v-if="habitStore.loading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate />
      </v-col>
    </v-row>

    <v-row v-else-if="habitStore.habits.length === 0">
      <v-col cols="12">
        <v-card variant="outlined" class="pa-8 text-center text-medium-emphasis">
          暂无习惯，点击右上角新建
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col v-for="habit in habitStore.habits" :key="habit.id" cols="12" md="6">
        <v-card variant="outlined" class="pa-4" @contextmenu.prevent="openContextMenu($event, habit)">
          <v-card-title class="d-flex align-center">
            {{ habit.title }}
            <v-spacer />
            <v-chip size="small" color="info" variant="tonal">{{ frequencyLabel(habit) }}</v-chip>
          </v-card-title>
          <v-card-text>
            <div v-if="habit.description" class="text-body-2 text-medium-emphasis mb-2">{{ habit.description }}</div>
            <div class="d-flex align-center ga-2">
              <v-icon v-if="getStreakInfo(habit).todayStatus === 'done'" color="success" size="small">mdi-check-circle</v-icon>
              <v-icon v-else-if="getStreakInfo(habit).todayStatus === 'pending'" color="grey" size="small">mdi-clock-outline</v-icon>
              <span class="text-body-2">连续 {{ getStreakInfo(habit).streak }} 天</span>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              :color="isTodayChecked(habit.id) ? 'warning' : 'success'"
              variant="tonal"
              size="small"
              :prepend-icon="isTodayChecked(habit.id) ? 'mdi-undo' : 'mdi-check'"
              @click="toggleCheckIn(habit.id)"
            >
              {{ isTodayChecked(habit.id) ? '撤销打卡' : '今日打卡' }}
            </v-btn>
            <v-spacer />
            <v-btn icon="mdi-delete" size="small" color="error" variant="text" @click="askDelete(habit)" />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- 新建习惯 -->
    <v-dialog v-model="dialog" max-width="400">
      <v-card>
        <v-card-title>新建习惯</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.title" label="习惯名称" required autofocus @keyup.enter="handleCreate" />
          <v-textarea v-model="form.description" label="详细描述" rows="2" auto-grow />
          <v-select v-model="form.frequency" :items="frequencyOptions" label="频率" />
          <v-text-field
            v-if="form.frequency === HabitFrequency.Custom"
            v-model.number="form.customIntervalDays"
            label="每隔几天执行一次"
            type="number"
            :min="2"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">取消</v-btn>
          <v-btn color="primary" :disabled="!canCreate" @click="handleCreate">创建</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认 -->
    <v-dialog v-model="showConfirm" max-width="340">
      <v-card>
        <v-card-title>确认删除</v-card-title>
        <v-card-text>确定删除习惯「{{ deleteTarget?.title }}」？所有打卡记录也会被删除。</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showConfirm = false">取消</v-btn>
          <v-btn color="error" @click="handleDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 右键菜单 -->
    <v-menu v-model="ctxMenu.show" :style="{ position: 'fixed', left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }">
      <v-list density="compact">
        <v-list-item prepend-icon="mdi-pencil" @click="openEdit">
          <v-list-item-title>编辑</v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-delete" class="text-error" @click="askDelete(ctxMenu.habit!)">
          <v-list-item-title>删除</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- 编辑习惯 -->
    <v-dialog v-model="editDialog" max-width="400">
      <v-card>
        <v-card-title>编辑习惯</v-card-title>
        <v-card-text>
          <v-text-field v-model="editForm.title" label="习惯名称" autofocus @keyup.enter="handleEdit" />
          <v-textarea v-model="editForm.description" label="详细描述" rows="2" auto-grow />
          <v-select v-model="editForm.frequency" :items="frequencyOptions" label="频率" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editDialog = false">取消</v-btn>
          <v-btn color="primary" :disabled="!editForm.title.trim()" @click="handleEdit">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useHabitStore } from '@/stores/habit'
import { HabitFrequency, toDateStr } from '@kanban/shared'
import type { Habit } from '@kanban/shared'
import { calcStreak } from '@/composables/useStreak'
import { useToast } from '@/composables/useToast'

const habitStore = useHabitStore()
const toast = useToast()
const dialog = ref(false)

const ctxMenu = reactive({ show: false, x: 0, y: 0, habit: null as Habit | null })
const editDialog = ref(false)
const editForm = reactive({ title: '', description: '', frequency: HabitFrequency.Daily as HabitFrequency })

const openContextMenu = (e: MouseEvent, habit: Habit) => {
  ctxMenu.x = e.clientX
  ctxMenu.y = e.clientY
  ctxMenu.habit = habit
  ctxMenu.show = true
}

const openEdit = () => {
  if (!ctxMenu.habit) return
  editForm.title = ctxMenu.habit.title
  editForm.description = ctxMenu.habit.description || ''
  editForm.frequency = ctxMenu.habit.frequency
  editDialog.value = true
}

const handleEdit = async () => {
  if (!ctxMenu.habit || !editForm.title.trim()) return
  try {
    await habitStore.updateHabit(ctxMenu.habit.id, {
      title: editForm.title.trim(),
      description: editForm.description.trim() || undefined,
      frequency: editForm.frequency,
    })
    editDialog.value = false
    toast.success('习惯已更新')
  } catch (e: any) {
    toast.error(e.message || '更新失败')
  }
}

const form = reactive({
  title: '',
  description: '',
  frequency: HabitFrequency.Daily as HabitFrequency,
  customIntervalDays: 2,
})
const showConfirm = ref(false)
const deleteTarget = ref<Habit | null>(null)

const frequencyOptions = [
  { title: '每天', value: HabitFrequency.Daily },
  { title: '每周', value: HabitFrequency.Weekly },
  { title: '每月', value: HabitFrequency.Monthly },
  { title: '自定义', value: HabitFrequency.Custom },
]

const frequencyLabel = (habit: Habit) => {
  const map: Record<string, string> = {
    [HabitFrequency.Daily]: '每天',
    [HabitFrequency.Weekly]: '每周',
    [HabitFrequency.Monthly]: '每月',
  }
  if (habit.frequency === HabitFrequency.Custom) return `每 ${habit.customIntervalDays} 天`
  return map[habit.frequency] || habit.frequency
}

const today = () => toDateStr(new Date())

const isTodayChecked = (habitId: string) =>
  habitStore.records.some((r) => r.habitId === habitId && r.date === today() && r.completed)

const getStreakInfo = (habit: Habit) => calcStreak(habit, habitStore.records, today())

const canCreate = computed(() => {
  if (!form.title.trim()) return false
  if (form.frequency === HabitFrequency.Custom && (!form.customIntervalDays || form.customIntervalDays < 2)) return false
  return true
})

onMounted(() => habitStore.loadHabits())

const handleCreate = async () => {
  if (!canCreate.value) return
  try {
    await habitStore.createHabit({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      frequency: form.frequency,
      customIntervalDays: form.frequency === HabitFrequency.Custom ? form.customIntervalDays : undefined,
    })
    form.title = ''
    form.description = ''
    form.frequency = HabitFrequency.Daily
    form.customIntervalDays = 2
    dialog.value = false
    toast.success('习惯创建成功')
  } catch (e: any) {
    toast.error(e.message || '创建失败')
  }
}

const toggleCheckIn = async (habitId: string) => {
  try {
    if (isTodayChecked(habitId)) {
      await habitStore.uncheckIn(habitId, today())
    } else {
      await habitStore.checkIn(habitId, today())
    }
  } catch (e: any) {
    toast.error(e.message || '操作失败')
  }
}

const askDelete = (habit: Habit) => {
  deleteTarget.value = habit
  showConfirm.value = true
}

const handleDelete = async () => {
  if (!deleteTarget.value) return
  try {
    await habitStore.deleteHabit(deleteTarget.value.id)
    showConfirm.value = false
    toast.success('习惯已删除')
  } catch (e: any) {
    toast.error(e.message || '删除失败')
  }
}
</script>
