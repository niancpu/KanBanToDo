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
        <div class="priority-field mb-2">
          <label class="priority-label" for="card-priority">优先级</label>
          <div class="priority-control">
            <select id="card-priority" v-model="form.priority" class="priority-select">
              <option value="">无</option>
              <option v-for="item in priorityItems" :key="item.value" :value="item.value">
                {{ item.title }}
              </option>
            </select>
          </div>
        </div>
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
import { reactive, watch } from 'vue'
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
  confirm: [data: { title: string; description?: string; priority?: Priority; effectiveDate?: string; startDate?: string; estimatedTime?: number }]
  delete: []
}>()

const priorityItems = [
  { title: '重要且紧急 (UI)', value: 'UI' as Priority },
  { title: '重要不紧急 (INU)', value: 'INU' as Priority },
  { title: '紧急不重要 (UNI)', value: 'UNI' as Priority },
  { title: '不重要不紧急 (NN)', value: 'NN' as Priority },
]

const form = reactive({
  title: '',
  description: '',
  priority: '' as Priority | '',
  effectiveDate: '',
  estimatedTime: undefined as number | undefined,
})

watch(() => props.modelValue, (open) => {
  if (open && props.card) {
    form.title = props.card.title
    form.description = props.card.description || ''
    form.priority = normalizePriority(props.card.priority) || ''
    form.effectiveDate = props.card.effectiveDate || props.card.startDate || ''
    form.estimatedTime = props.card.estimatedTime
  } else if (open) {
    form.title = ''
    form.description = ''
    form.priority = ''
    form.effectiveDate = props.defaultEffectiveDate || props.defaultStartDate || ''
    form.estimatedTime = undefined
  }
})

const handleConfirm = () => {
  if (!form.title.trim()) return
  emit('confirm', {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    priority: form.priority ? (form.priority as Priority) : undefined,
    effectiveDate: form.effectiveDate || undefined,
    startDate: form.effectiveDate || undefined,
    estimatedTime: form.estimatedTime || undefined,
  })
  emit('update:modelValue', false)
}
</script>

<style scoped>
.priority-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.priority-label {
  font-size: 0.75rem;
  line-height: 1;
  color: rgba(0, 0, 0, 0.58);
  padding-left: 4px;
}

.priority-control {
  position: relative;
}

.priority-control::after {
  content: '▼';
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%) scale(0.82);
  color: rgba(0, 0, 0, 0.52);
  pointer-events: none;
}

.priority-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  width: 100%;
  min-height: 48px;
  border: 1px solid rgba(0, 0, 0, 0.38);
  border-radius: 8px;
  padding: 0 44px 0 14px;
  font-size: 1rem;
  line-height: 1.3;
  background: #fff;
  color: rgba(0, 0, 0, 0.87);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.priority-select:hover {
  border-color: rgba(0, 0, 0, 0.62);
}

.priority-select:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.18);
}
</style>


