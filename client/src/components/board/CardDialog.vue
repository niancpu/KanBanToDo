<template>
  <v-dialog :model-value="modelValue" max-width="500" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        {{ isEdit ? 'Edit Card' : 'New Card' }}
        <v-btn v-if="isEdit" icon="mdi-delete" variant="text" size="small" color="error" @click="$emit('delete')" />
      </v-card-title>
      <v-card-text>
        <v-text-field v-model="form.title" label="Title" autofocus class="mb-2" @keyup.enter="handleConfirm" />
        <v-textarea v-model="form.description" label="Description" rows="2" class="mb-2" />
        <v-select
          ref="selectRef"
          v-model="form.priority"
          class="mb-2"
          label="Priority"
          :items="priorityItems"
          item-title="title"
          item-value="value"
          :menu-props="{ contained: true }"
          variant="outlined"
          density="comfortable"
          placeholder="Select priority"
          menu-icon="mdi-chevron-down"
          no-data-text="No priorities"
          clearable
          @click="onSelectClick"
          @update:menu="(v: boolean) => dlog('update:menu →', v)"
        />
        <v-text-field v-model="form.effectiveDate" label="Effective Date" type="date" class="mb-2" />
        <v-text-field
          v-model.number="form.estimatedTime"
          label="Estimated Time (minutes)"
          type="number"
          :min="0"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" :disabled="!form.title.trim()" @click="handleConfirm">
          {{ isEdit ? 'Save' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch, nextTick } from 'vue'
import type { Card } from '@kanban/shared'
import { Priority, normalizePriority } from '@kanban/shared'

const props = defineProps<{
  modelValue: boolean
  card?: Card | null
  isEdit?: boolean
  defaultEffectiveDate?: string
  defaultStartDate?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [data: {
    title: string
    description?: string
    priority?: Priority
    effectiveDate?: string
    startDate?: string
    estimatedTime?: number
  }]
  delete: []
}>()

const priorityItems = [
  { title: 'UI · Urgent & Important', value: Priority.UI },
  { title: 'INU · Important, Not Urgent', value: Priority.INU },
  { title: 'UNI · Urgent, Not Important', value: Priority.UNI },
  { title: 'NN · Neither Urgent nor Important', value: Priority.NN },
]

// --- debug util (临时) ---
function dlog(...args: unknown[]) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
  fetch('/debug-log', { method: 'POST', body: `[${new Date().toLocaleTimeString()}] ${msg}` }).catch(() => {})
}
const selectRef = ref<InstanceType<any>>(null)
// --- end debug ---

const form = reactive({
  title: '',
  description: '',
  priority: null as Priority | null,
  effectiveDate: '',
  estimatedTime: undefined as number | undefined,
})

watch(() => props.modelValue, (open) => {
  if (open && props.card) {
    form.title = props.card.title
    form.description = props.card.description || ''
    form.priority = normalizePriority(props.card.priority) || null
    form.effectiveDate = props.card.effectiveDate || props.card.startDate || ''
    form.estimatedTime = props.card.estimatedTime
  } else if (open) {
    form.title = ''
    form.description = ''
    form.priority = null
    form.effectiveDate = props.defaultEffectiveDate || props.defaultStartDate || ''
    form.estimatedTime = undefined
  }
})

const onSelectClick = () => {
  dlog('v-select clicked')
  nextTick(() => {
    const overlays = document.querySelectorAll('.v-overlay')
    dlog('total overlays:', overlays.length)
    overlays.forEach((el, i) => {
      const s = getComputedStyle(el)
      dlog(`overlay[${i}]:`, JSON.stringify({
        cls: [...el.classList].filter(c => c.startsWith('v-')).join(' '),
        active: el.classList.contains('v-overlay--active'),
        display: s.display, zIndex: s.zIndex,
        vis: s.visibility, opacity: s.opacity,
      }))
    })
    // 检查 v-select 内部 menu ref
    if (selectRef.value) {
      const vm = selectRef.value
      dlog('select menu state:', vm.menu)
      dlog('select isActive:', vm.isActive)
    }
  })
}

const handleConfirm = () => {
  if (!form.title.trim()) return
  emit('confirm', {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    priority: form.priority || undefined,
    effectiveDate: form.effectiveDate || undefined,
    startDate: form.effectiveDate || undefined,
    estimatedTime: form.estimatedTime || undefined,
  })
  emit('update:modelValue', false)
}
</script>

<style scoped>
</style>
